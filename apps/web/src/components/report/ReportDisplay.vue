<script setup lang="ts">
import type { AnalysisReport, CriterionStatus } from '@balise/analyzer/types';
import { Info } from '@lucide/vue';
import { computed, onMounted, ref } from 'vue';
import ScoreGauge from '@/components/ScoreGauge.vue';
import StatusIcon from '@/components/StatusIcon.vue';
import TierLabel from '@/components/TierLabel.vue';
import { enter } from '@/lib/animate';
import { screenshotUrl } from '@/lib/api';
import { formatDateTime, formatExpiry, pluralize } from '@/lib/format';
import {
  countByStatus,
  exportFileName,
  filterCriteria,
  sortedThemes,
  themeTitle,
} from '@/lib/report';
import {
  coverageLabel,
  gaugeAccessibleName,
  globalCoverageLabel,
  STATUS_INFO,
  STATUS_ORDER,
} from '@/lib/tiers';
import CopyLinkButton from './CopyLinkButton.vue';
import CriterionItem from './CriterionItem.vue';
import ManualChecklist from './ManualChecklist.vue';

const props = withDefaults(
  defineProps<{
    report: AnalysisReport;
    heading?: string;
    /** Live report from the API: shows the retention date and the screenshot. */
    live?: boolean;
  }>(),
  { heading: 'Rapport de pré-diagnostic', live: false },
);

const counts = computed(() => countByStatus(props.report.criteria));
const themes = computed(() => sortedThemes(props.report));
const themeName = (theme: number) => themeTitle(props.report, theme);

// Filters
const statuses = ref<Set<CriterionStatus>>(new Set(['non-conforme']));
const theme = ref<number | null>(null);
const shown = computed(() =>
  filterCriteria(props.report.criteria, { statuses: statuses.value, theme: theme.value }),
);
const manual = computed(() =>
  filterCriteria(props.report.criteria, { statuses: new Set(['a-verifier']), theme: null }),
);

function toggleStatus(status: CriterionStatus) {
  const next = new Set(statuses.value);
  if (next.has(status)) next.delete(status);
  else next.add(status);
  statuses.value = next;
}

function onThemeChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value;
  theme.value = value === '' ? null : Number(value);
}

const emptyMessage = computed(() =>
  statuses.value.size === 1 && statuses.value.has('non-conforme') && theme.value === null
    ? 'Aucune erreur détectée automatiquement. Les critères à vérifier manuellement restent à contrôler.'
    : 'Aucun critère ne correspond à ces filtres.',
);

function exportJson() {
  const blob = new Blob([JSON.stringify(props.report, null, 2)], { type: 'application/json' });
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = exportFileName(props.report);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(href), 1000);
}

// Theme cards appear in cascade (40 ms) when the report is rendered client-side.
const cards = ref<HTMLElement[]>([]);
onMounted(() => cards.value.forEach((el, i) => enter(el, i * 40)));
</script>

<template>
  <div class="container report">
    <div class="note report__notice" role="note">
      <Info :size="24" aria-hidden="true" />
      <p>
        <strong>Scores indicatifs.</strong> Ils ne constituent pas un taux de conformité RGAA et ne
        doivent pas être repris dans une déclaration d’accessibilité.
      </p>
    </div>

    <section class="panel report__summary" aria-labelledby="synthese">
      <ScoreGauge
        :score="report.scores.global.score"
        :size="168"
        suffix
        :label="gaugeAccessibleName('Score global indicatif', report.scores.global)"
      />
      <div class="report__intro">
        <h1 id="synthese">{{ heading }}</h1>
        <p class="mono muted">{{ report.url }}</p>
        <p v-if="report.finalUrl !== report.url" class="small muted">
          Page finale après redirection : <span class="mono">{{ report.finalUrl }}</span>
        </p>
        <p v-if="report.page.title" class="small">Titre de la page : {{ report.page.title }}</p>
        <p class="small muted">
          Analysée le {{ formatDateTime(report.analyzedAt) }}, référentiel
          {{ report.reference.name }}
        </p>
        <p class="report__global">
          <span class="text-h3">Score global indicatif</span>
          <TierLabel :score="report.scores.global.score" />
        </p>
        <ul class="plain-list report__counts small">
          <li>{{ globalCoverageLabel(report.scores.global) }}</li>
          <li class="tone-bad">
            <StatusIcon icon="cross" />
            <strong>{{ counts['non-conforme'] }}</strong>
            {{ counts['non-conforme'] > 1 ? 'non conformes' : 'non conforme' }}
          </li>
          <li class="tone-manual">
            <StatusIcon icon="eye" />
            <strong>{{ counts['a-verifier'] }}</strong> à vérifier manuellement
          </li>
        </ul>
        <p v-if="live" class="small muted">
          Rapport conservé jusqu’au {{ formatExpiry(report.analyzedAt, 30) }}.
        </p>
      </div>
      <div class="report__actions">
        <CopyLinkButton />
        <button type="button" class="btn btn-secondary btn-small" @click="exportJson">
          Exporter en JSON
        </button>
      </div>
    </section>

    <details v-if="live && report.hasScreenshot" class="card report__shot">
      <summary>Voir la capture d’écran de la page analysée</summary>
      <img
        :src="screenshotUrl(report.id)"
        alt="Capture d’écran de la page analysée, telle que Balise l’a chargée"
        loading="lazy"
      />
    </details>

    <section aria-labelledby="themes" class="stack">
      <div>
        <h2 id="themes">Scores par thématique</h2>
        <p class="small muted">
          Part des critères testés automatiquement sans erreur détectée, sur 100.
        </p>
      </div>
      <ul class="plain-list theme-grid">
        <li v-for="t in themes" :key="t.theme" ref="cards" class="card theme-card">
          <ScoreGauge :score="t.score" :size="64" :label="gaugeAccessibleName(t.title, t)" />
          <div class="theme-card__text">
            <h3 class="theme-card__name">{{ t.title }}</h3>
            <TierLabel :score="t.score" />
            <span class="small muted">{{ coverageLabel(t) }}</span>
          </div>
        </li>
      </ul>
    </section>

    <section id="details" aria-labelledby="details-titre" class="stack">
      <h2 id="details-titre">Détail des critères</h2>
      <div class="filters">
        <div role="group" aria-labelledby="filtre-statut" class="filters__group">
          <span id="filtre-statut" class="filters__label">Statut</span>
          <button
            v-for="s in STATUS_ORDER"
            :key="s"
            type="button"
            class="filter"
            :aria-pressed="statuses.has(s) ? 'true' : 'false'"
            @click="toggleStatus(s)"
          >
            <StatusIcon :icon="STATUS_INFO[s].icon" />
            {{ STATUS_INFO[s].plural }} ({{ counts[s] }})
          </button>
        </div>
        <div class="filters__group">
          <label for="filtre-theme" class="filters__label">Thématique</label>
          <select id="filtre-theme" class="field-input filters__select" @change="onThemeChange">
            <option value="">Toutes les thématiques</option>
            <option v-for="t in themes" :key="t.theme" :value="t.theme">
              {{ t.theme }}. {{ t.title }}
            </option>
          </select>
        </div>
      </div>
      <p class="small" role="status">
        {{ pluralize(shown.length, 'critère affiché', 'critères affichés') }}
      </p>
      <TransitionGroup tag="ul" name="list" class="plain-list stack">
        <li v-for="c in shown" :key="c.id">
          <CriterionItem :criterion="c" :theme-name="`${c.theme}. ${themeName(c.theme)}`" />
        </li>
      </TransitionGroup>
      <p v-if="shown.length === 0" class="note">{{ emptyMessage }}</p>
    </section>

    <section aria-labelledby="manuel" class="stack">
      <h2 id="manuel">À vérifier manuellement</h2>
      <p class="muted">
        Ces critères demandent un jugement humain. Cochez-les au fur et à mesure de vos
        vérifications.
      </p>
      <ManualChecklist :report-id="report.id" :criteria="manual" :theme-name="themeName" />
    </section>
  </div>
</template>

<style scoped>
.report {
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
  padding-block: var(--space-6) var(--space-12);
}

.report__summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-6);
}

.report__intro {
  flex: 1 1 20rem;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.report__global {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2) var(--space-4);
}

.report__counts {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-4);
}

.report__counts li {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
}

.report__actions {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-2);
}

.report__shot summary {
  cursor: pointer;
  font-weight: 700;
  color: var(--color-brand);
}

.report__shot img {
  display: block;
  margin-top: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.theme-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 13rem), 1fr));
  gap: var(--space-4);
}

.theme-card {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4);
}

.theme-card__text {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
}

.theme-card__name {
  font-size: var(--text-body-size);
  line-height: var(--text-body-line);
}

.filters {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: var(--space-4) var(--space-6);
}

.filters__group {
  min-width: 0;
  max-width: 100%;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

.filters__label {
  font-weight: 700;
  flex-basis: 100%;
}

.filters__select {
  width: auto;
  min-width: 0;
  max-width: 100%;
}

.filter {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  min-height: 44px;
  padding: 0 var(--space-4);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-lg);
  background: var(--color-surface-raised);
  color: var(--color-ink);
  font-size: var(--text-small-size);
  cursor: pointer;
}

.filter[aria-pressed='true'] {
  border: 2px solid var(--color-brand);
  background: var(--color-brand-soft);
  font-weight: 700;
}

.filter[aria-pressed='true']::before {
  content: '✓' / '';
  font-weight: 700;
}
</style>
