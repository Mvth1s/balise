<script setup lang="ts">
import { ArrowRight, Check, Eye, Lock } from '@lucide/vue';
import { computed, nextTick, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import ScoreGauge from '@/components/ScoreGauge.vue';
import TierLabel from '@/components/TierLabel.vue';
import { usePageMeta } from '@/composables/usePageMeta';
import { drawStroke } from '@/lib/animate';
import { ApiError, createAnalysis, describeError, type ErrorDescription } from '@/lib/api';
import { URL_PROBLEM_MESSAGES, validateUrl } from '@/lib/url';
import { withViewTransition } from '@/lib/view-transition';

usePageMeta({
  title: 'Balise : pré-diagnostic d’accessibilité RGAA d’une page web',
  rawTitle: true,
  description:
    'Saisissez l’adresse d’une page publique : Balise teste les critères RGAA 4.1.2 vérifiables automatiquement, affiche des scores indicatifs par thématique et liste ce qu’il reste à vérifier à la main.',
});

const router = useRouter();
const input = ref('');
const touched = ref(false);
const submitting = ref(false);
const apiError = ref<ErrorDescription | null>(null);
const field = ref<HTMLInputElement | null>(null);
const checkPath = ref<SVGPathElement | null>(null);

const validation = computed(() => validateUrl(input.value));
const fieldError = computed(() =>
  touched.value && !validation.value.ok ? URL_PROBLEM_MESSAGES[validation.value.problem] : '',
);

// Draws the check mark each time the address becomes valid.
watch(
  () => validation.value.ok,
  async (ok) => {
    if (!ok) return;
    await nextTick();
    if (checkPath.value) drawStroke(checkPath.value, 300);
  },
);

function onInput() {
  apiError.value = null;
}

async function submit() {
  if (submitting.value) return;
  touched.value = true;
  apiError.value = null;
  const result = validation.value;
  if (!result.ok) {
    field.value?.focus();
    return;
  }
  submitting.value = true;
  try {
    const created = await createAnalysis(result.url);
    await withViewTransition(() => router.push(`/analyses/${encodeURIComponent(created.id)}`));
  } catch (err) {
    const code = err instanceof ApiError ? err.code : 'internal';
    apiError.value = describeError(code, err instanceof ApiError ? err.retryAfter : null);
    submitting.value = false;
    await nextTick();
    field.value?.focus();
  }
}

const describedBy = computed(() =>
  ['url-hint', fieldError.value ? 'url-error' : '', apiError.value ? 'url-api-error' : '']
    .filter(Boolean)
    .join(' '),
);
</script>

<template>
  <div class="home">
    <section class="container hero" aria-labelledby="titre">
      <div class="hero__main">
        <p class="hero__kicker">Pré-diagnostic d’accessibilité RGAA 4.1.2</p>
        <h1 id="titre" class="text-display">
          Repérez en une minute les erreurs d’accessibilité de votre page.
        </h1>
        <p class="muted hero__lead">
          Balise teste les critères RGAA vérifiables par une machine, les range par thématique et
          liste ce qu’il vous reste à contrôler à la main.
        </p>

        <form class="url-form" novalidate @submit.prevent="submit">
          <!-- eslint-disable-next-line vuejs-accessibility/label-has-for -- associated with for/id -->
          <label for="url" class="url-form__label">Adresse de la page à analyser</label>
          <div class="url-form__row">
            <div class="url-form__field">
              <input
                id="url"
                ref="field"
                v-model="input"
                class="field-input"
                type="url"
                name="url"
                inputmode="url"
                autocomplete="url"
                spellcheck="false"
                placeholder="https://www.exemple.fr/contact"
                :aria-invalid="fieldError || apiError ? 'true' : 'false'"
                :aria-describedby="describedBy"
                @input="onInput"
                @blur="touched = input.trim() !== ''"
              />
            </div>
            <button type="submit" class="btn" :aria-disabled="submitting ? 'true' : undefined">
              {{ submitting ? 'Lancement de l’analyse…' : 'Analyser la page' }}
              <ArrowRight :size="20" aria-hidden="true" />
            </button>
          </div>
          <p class="small url-form__valid" aria-live="polite">
            <template v-if="validation.ok">
              <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path ref="checkPath" d="M20 6L9 17l-5-5" />
              </svg>
              Adresse valide
            </template>
          </p>
          <p v-if="fieldError" id="url-error" class="small url-form__error">{{ fieldError }}</p>
          <div v-if="apiError" id="url-api-error" class="url-form__api-error" role="alert">
            <p>
              <strong>{{ apiError.title }}.</strong> {{ apiError.message }}
            </p>
          </div>
          <p id="url-hint" class="small muted">
            Page publique uniquement. Résultat en 30 secondes environ.
          </p>
          <p class="small">
            Pas de site sous la main ?
            <RouterLink to="/exemple/avant" class="strong-link">
              Essayer avec une page d’exemple
            </RouterLink>
          </p>
        </form>
      </div>

      <figure class="panel sample">
        <figcaption class="small muted">Exemple de rapport, données fictives</figcaption>
        <div class="sample__head">
          <ScoreGauge
            :score="69"
            :size="120"
            label="Score global indicatif : 69 sur 100, palier À corriger, 32 critères testés automatiquement sur 106"
          />
          <div class="sample__text">
            <span class="text-h3">Score global indicatif</span>
            <TierLabel :score="69" />
            <span class="small muted">32 critères testés sur 106</span>
          </div>
        </div>
        <ul class="plain-list sample__list small">
          <li><span>Images</span><strong>67</strong></li>
          <li><span>Couleurs</span><strong>0</strong></li>
          <li><span>Formulaires</span><strong>75</strong></li>
        </ul>
      </figure>
    </section>

    <section id="methode" class="container method" aria-labelledby="methode-titre">
      <h2 id="methode-titre" class="visually-hidden">Comment ça marche</h2>
      <ul class="plain-list method__grid">
        <li class="card method__card">
          <Check :size="24" aria-hidden="true" />
          <h3>Ce que Balise teste</h3>
          <p class="small muted">
            Les critères RGAA vérifiables automatiquement sur la page rendue : alternatives
            d’images, contrastes, étiquettes de champs, structure des titres.
          </p>
        </li>
        <li id="limites" class="card method__card">
          <Eye :size="24" aria-hidden="true" />
          <h3>Ce qu’il vous reste à vérifier</h3>
          <p class="small muted">
            La majorité des critères demande un regard humain. Le rapport les liste avec ce qu’il
            faut contrôler.
          </p>
        </li>
        <li class="card method__card">
          <Lock :size="24" aria-hidden="true" />
          <h3>Vos données</h3>
          <p class="small muted">
            Sans compte. Analyses exécutées à Paris, rapports supprimés après 30 jours. Mesure
            d’audience uniquement si vous l’acceptez.
          </p>
        </li>
      </ul>
      <p class="note">
        Les scores de Balise sont indicatifs. Ils ne constituent pas un taux de conformité RGAA et
        ne remplacent pas un audit réalisé selon la méthode officielle.
      </p>
    </section>
  </div>
</template>

<style scoped>
.hero {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-12);
  padding-block: var(--space-12);
}

.hero__main {
  flex: 999 1 30rem;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.hero__kicker {
  font-size: var(--text-small-size);
  font-weight: 700;
  color: var(--color-brand);
}

.hero h1 {
  letter-spacing: -0.01em;
}

@media (max-width: 37.5em) {
  .hero h1 {
    font-size: var(--text-h1-size);
    line-height: var(--text-h1-line);
  }
}

.hero__lead {
  max-width: 35rem;
}

.url-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  max-width: 38rem;
}

.url-form__label {
  font-weight: 700;
}

.url-form__row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-4);
}

.url-form__field {
  flex: 1 1 16rem;
  min-width: 0;
}

.url-form__row .btn {
  min-height: 52px;
}

.url-form__valid {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  min-height: var(--text-small-line);
  color: var(--color-score-good);
  font-weight: 700;
}

.url-form__valid path {
  fill: none;
  stroke: currentColor;
  stroke-width: 2.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.url-form__error {
  color: var(--color-score-bad);
  font-weight: 700;
}

.url-form__api-error {
  padding: var(--space-4);
  border: 2px solid var(--color-score-bad);
  border-radius: var(--radius-md);
  background: var(--color-surface-raised);
}

.strong-link {
  font-weight: 700;
}

.sample {
  flex: 1 1 20rem;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.sample__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-6);
}

.sample__text {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.sample__list li {
  display: flex;
  justify-content: space-between;
  padding-top: var(--space-2);
  margin-top: var(--space-2);
  border-top: 1px solid var(--color-border);
}

.method {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.method__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr));
  gap: var(--space-6);
}

.method__card {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.method__card svg {
  color: var(--color-brand);
}
</style>
