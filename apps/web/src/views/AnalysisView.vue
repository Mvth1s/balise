<script setup lang="ts">
import type { AnalysisStatus, AnalysisStep } from '@balise/analyzer/types';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import BaliseSymbol from '@/components/BaliseSymbol.vue';
import ReportDisplay from '@/components/report/ReportDisplay.vue';
import { usePageMeta } from '@/composables/usePageMeta';
import { usePreferences } from '@/composables/usePreferences';
import { drawStroke } from '@/lib/animate';
import {
  ApiError,
  cancelAnalysis,
  describeError,
  getAnalysis,
  isFinalState,
  type ClientErrorCode,
} from '@/lib/api';
import { focusMainHeading } from '@/lib/focus';
import { shortUrl } from '@/lib/format';
import { motionAllowed } from '@/lib/motion';
import { withViewTransition } from '@/lib/view-transition';

/** Same order as ANALYSIS_STEPS in @balise/analyzer/types (type-only import). */
const STEPS: readonly { id: AnalysisStep; label: string; detail?: string }[] = [
  { id: 'validated', label: 'Adresse vérifiée', detail: '(page publique)' },
  { id: 'queued', label: 'Prise en charge par un analyseur' },
  { id: 'loading', label: 'Chargement de la page et exécution du JavaScript' },
  { id: 'testing', label: 'Tests automatiques RGAA' },
  { id: 'scoring', label: 'Calcul des scores indicatifs' },
];
const POLL_MS = 1500;
const MAX_NETWORK_RETRIES = 5;
/** Minimum display time of each step when animations are on (fast analyses stay visible). */
const STEP_MIN_MS = 600;

const route = useRoute();
const id = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''));
const mounted = ref(false);
const status = ref<AnalysisStatus | null>(null);
const errorCode = ref<ClientErrorCode | null>(null);
const cancelling = ref(false);
const announcement = ref('');
const checks = ref<SVGPathElement[]>([]);
/** Final status held back until every step has been shown. */
const pendingFinal = ref<AnalysisStatus | null>(null);
/** Number of steps currently displayed as done (lags behind the server when paced). */
const doneCount = ref(0);
const logoPaused = ref(false);
const { state: prefs } = usePreferences();
const logoAnimated = computed(() => prefs.motion && !prefs.systemReduce);
let timer = 0;
let paceTimer = 0;
let lastAdvance = 0;
let controller: AbortController | null = null;
let networkFailures = 0;

const report = computed(() =>
  status.value?.state === 'done' ? (status.value.report ?? null) : null,
);
const error = computed(() => (errorCode.value ? describeError(errorCode.value) : null));

/** Number of completed steps on the server (the address is validated as soon as the analysis exists). */
const targetCount = computed(() => {
  if (pendingFinal.value) return STEPS.length;
  const s = status.value;
  if (!s) return 0;
  if (s.state === 'done') return STEPS.length;
  const index = s.step ? STEPS.findIndex((step) => step.id === s.step) : -1;
  return Math.max(1, index + 1);
});
const currentStep = computed(() => Math.min(doneCount.value + 1, STEPS.length));
const progress = computed(() => Math.round((doneCount.value / STEPS.length) * 100));

usePageMeta({
  title: () =>
    !mounted.value
      ? 'Analyse'
      : !id.value
        ? 'Aucune analyse indiquée'
        : report.value
          ? `Rapport : ${shortUrl(report.value.url)}`
          : error.value
            ? error.value.title
            : 'Analyse en cours',
  description: 'Analyse d’accessibilité RGAA d’une page web par Balise, avec scores indicatifs.',
  noindex: true,
});

function stop() {
  window.clearTimeout(timer);
  window.clearTimeout(paceTimer);
  controller?.abort();
  controller = null;
}

async function poll() {
  const current = id.value;
  controller = new AbortController();
  try {
    const next = await getAnalysis(current, controller.signal);
    if (current !== id.value) return;
    networkFailures = 0;
    const wasRunning =
      (status.value !== null && !isFinalState(status.value.state)) || consumeFreshFlag();
    if (next.state === 'done' && next.report && wasRunning) {
      pendingFinal.value = next;
      pace();
      return;
    }
    status.value = next;
    if (next.state === 'error') errorCode.value = next.error?.code ?? 'internal';
    else if (next.state === 'cancelled') errorCode.value = 'cancelled_by_user';
    else if (next.state === 'done' && !next.report) errorCode.value = 'internal';
    if (!isFinalState(next.state)) timer = window.setTimeout(poll, POLL_MS);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return;
    const code = err instanceof ApiError ? err.code : 'internal';
    if (code === 'network' && networkFailures < MAX_NETWORK_RETRIES) {
      networkFailures += 1;
      timer = window.setTimeout(poll, POLL_MS * 2);
      return;
    }
    errorCode.value = code;
  }
}

/** True once, right after the home page started this analysis. */
function consumeFreshFlag(): boolean {
  const state = window.history.state as Record<string, unknown> | null;
  if (state?.fresh !== true) return false;
  window.history.replaceState({ ...state, fresh: false }, '');
  return true;
}

/** Advances the displayed steps one at a time, at most one every STEP_MIN_MS. */
function pace() {
  window.clearTimeout(paceTimer);
  const paced = motionAllowed();
  if (doneCount.value < targetCount.value) {
    const wait = paced ? Math.max(0, lastAdvance + STEP_MIN_MS - Date.now()) : 0;
    const advance = () => {
      doneCount.value = paced ? doneCount.value + 1 : targetCount.value;
      lastAdvance = Date.now();
      pace();
    };
    if (wait) paceTimer = window.setTimeout(advance, wait);
    else advance();
    return;
  }
  if (pendingFinal.value) {
    const wait = paced ? Math.max(0, lastAdvance + STEP_MIN_MS - Date.now()) : 0;
    paceTimer = window.setTimeout(() => void finish(), wait);
  }
}

async function finish() {
  const next = pendingFinal.value;
  if (!next) return;
  pendingFinal.value = null;
  announcement.value = 'Analyse terminée. Le rapport est affiché.';
  await withViewTransition(() => (status.value = next));
  await nextTick();
  focusMainHeading();
}

function start() {
  stop();
  status.value = null;
  pendingFinal.value = null;
  doneCount.value = 0;
  lastAdvance = 0;
  errorCode.value = null;
  cancelling.value = false;
  networkFailures = 0;
  if (id.value) void poll();
}

async function cancel() {
  if (cancelling.value) return;
  cancelling.value = true;
  stop();
  try {
    await cancelAnalysis(id.value);
    errorCode.value = 'cancelled_by_user';
    announcement.value = 'Analyse annulée.';
    await nextTick();
    focusMainHeading();
  } catch (err) {
    cancelling.value = false;
    errorCode.value = err instanceof ApiError ? err.code : 'internal';
  }
}

watch(targetCount, pace);

// Steps get checked one by one; announce each new step.
watch(doneCount, async (count, previous) => {
  if (!pendingFinal.value && (!status.value || isFinalState(status.value.state))) return;
  const step = STEPS[currentStep.value - 1];
  if (step) announcement.value = `Étape ${currentStep.value} sur ${STEPS.length} : ${step.label}.`;
  await nextTick();
  for (let i = previous ?? 0; i < count; i += 1) {
    const path = checks.value[i];
    if (path) drawStroke(path, 300);
  }
});

watch(id, start);
onMounted(() => {
  mounted.value = true;
  start();
});
onBeforeUnmount(stop);
</script>

<template>
  <!-- The pre-rendered shell (and the first client render) only shows this neutral state. -->
  <div v-if="!mounted" class="container narrow">
    <h1>Analyse</h1>
    <p>Chargement de l’analyse…</p>
  </div>

  <div v-else-if="!id" class="container narrow">
    <h1>Aucune analyse indiquée</h1>
    <p>Cette adresse ne désigne pas d’analyse. Lancez une analyse depuis l’accueil.</p>
    <p><RouterLink to="/" class="btn">Analyser une page</RouterLink></p>
  </div>

  <div v-else-if="error" class="container narrow">
    <h1>{{ error.title }}</h1>
    <p v-if="status" class="mono muted">{{ status.url }}</p>
    <p>{{ error.message }}</p>
    <p><RouterLink to="/" class="btn">Lancer une nouvelle analyse</RouterLink></p>
  </div>

  <ReportDisplay v-else-if="report" :report="report" live />

  <div v-else class="container narrow">
    <div class="analysis-head">
      <BaliseSymbol :size="56" animated :paused="logoPaused" />
      <div class="stack">
        <h1>Analyse en cours</h1>
        <p v-if="status ?? pendingFinal" class="mono muted">{{ (status ?? pendingFinal)?.url }}</p>
      </div>
    </div>
    <div v-if="logoAnimated">
      <button type="button" class="btn btn-secondary" @click="logoPaused = !logoPaused">
        {{ logoPaused ? 'Reprendre l’animation du logo' : 'Mettre en pause l’animation du logo' }}
      </button>
    </div>

    <div class="panel progress">
      <div class="progress__head small">
        <span class="progress__step">Étape {{ currentStep }} sur {{ STEPS.length }}</span>
      </div>
      <div
        class="progress__bar"
        role="progressbar"
        aria-label="Avancement de l’analyse"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-valuenow="progress"
        :aria-valuetext="`${progress} %, étape ${currentStep} sur ${STEPS.length}`"
      >
        <div class="progress__fill" :style="{ transform: `scaleX(${progress / 100})` }" />
      </div>

      <ol class="plain-list steps">
        <li
          v-for="(step, index) in STEPS"
          :key="step.id"
          class="step"
          :class="{
            'step--done': index < doneCount,
            'step--current': index === doneCount,
          }"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <circle cx="12" cy="12" r="10" />
            <path v-if="index < doneCount" ref="checks" d="M8 12l3 3 5-6" />
            <path v-else-if="index === doneCount" d="M12 2a10 10 0 0 1 10 10" />
          </svg>
          <span class="step__label">
            {{ step.label }}
            <span v-if="step.detail" class="muted">{{ step.detail }}</span>
          </span>
          <span class="step__state small">
            {{ index < doneCount ? 'Terminé' : index === doneCount ? 'En cours' : 'À venir' }}
          </span>
        </li>
      </ol>
    </div>

    <p class="note">
      Vous pouvez quitter cette page : le rapport restera disponible 30 jours à cette adresse.
    </p>

    <div>
      <button
        type="button"
        class="btn btn-secondary"
        :aria-disabled="cancelling ? 'true' : undefined"
        @click="cancel"
      >
        {{ cancelling ? 'Annulation…' : 'Annuler l’analyse' }}
      </button>
    </div>
  </div>

  <p class="visually-hidden" role="status">{{ announcement }}</p>
</template>

<style scoped>
.analysis-head {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.narrow {
  max-width: 44rem;
  padding-block: var(--space-12);
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.progress {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.progress__step {
  font-weight: 700;
}

.progress__bar {
  height: var(--space-2);
  border-radius: var(--radius-sm);
  background: var(--color-brand-soft);
  overflow: hidden;
  border: 1px solid var(--color-border-strong);
}

.progress__fill {
  height: 100%;
  background: var(--color-brand);
  transform-origin: left center;
}

@media (prefers-reduced-motion: no-preference) {
  html[data-motion='on'] .progress__fill {
    transition: transform 400ms ease-out;
  }
}

.steps {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.step {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2) var(--space-4);
  color: var(--color-ink-muted);
}

.step svg {
  flex: none;
  fill: none;
  stroke: var(--color-border-strong);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.step__label {
  flex: 1 1 12rem;
}

.step__state {
  font-weight: 700;
}

.step--done {
  color: var(--color-ink);
}

.step--done svg,
.step--done .step__state {
  stroke: var(--color-score-good);
  color: var(--color-score-good);
}

.step--current {
  color: var(--color-ink);
  font-weight: 700;
}

.step--current svg circle {
  stroke: var(--color-brand-soft);
}

.step--current svg path,
.step--current .step__state {
  stroke: var(--color-brand);
  color: var(--color-brand);
}
</style>
