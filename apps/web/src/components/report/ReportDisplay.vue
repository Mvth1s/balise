<script setup lang="ts">
import type { AnalysisReport, CriterionStatus } from '@balise/analyzer/types';
import { computed, ref } from 'vue';
import ScoreGauge from '@/components/ScoreGauge.vue';
import StatusIcon from '@/components/StatusIcon.vue';
import TierLabel from '@/components/TierLabel.vue';
import { screenshotUrl } from '@/lib/api';
import { formatDateTime, formatExpiry, pluralize } from '@/lib/format';
import {
  countByStatus,
  exportFileName,
  filterCriteria,
  priorityFixes,
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
const fixes = computed(() => priorityFixes(props.report));

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
</script>

<template>
  <div class="container report">
    <!-- Level 1: global score, coverage and the three fixes to make first. -->
    <section class="report__summary" aria-labelledby="synthese">
      <header class="report__head">
        <h1 id="synthese">{{ heading }}</h1>
        <p class="mono report__url">{{ report.url }}</p>
        <p v-if="report.finalUrl !== report.url" class="small muted">
          Page finale après redirection : <span class="mono">{{ report.finalUrl }}</span>
        </p>
        <p class="small muted">
          <template v-if="report.page.title">Titre de la page : {{ report.page.title }}. </template>
          Analysée le {{ formatDateTime(report.analyzedAt) }}, référentiel
          {{ report.reference.name }}.
          <template v-if="live">
            Rapport conservé jusqu’au {{ formatExpiry(report.analyzedAt, 30) }}.
          </template>
        </p>
      </header>

      <div class="report__score">
        <ScoreGauge
          :score="report.scores.global.score"
          :size="136"
          suffix
          :label="gaugeAccessibleName('Score global indicatif', report.scores.global)"
        />
        <div class="report__score-text">
          <p class="report__global">
            <span class="text-h3">Score global indicatif</span>
            <TierLabel :score="report.scores.global.score" />
          </p>
          <p>{{ globalCoverageLabel(report.scores.global) }}</p>
          <p class="small">
            <strong>{{ counts['non-conforme'] }}</strong>
            {{ counts['non-conforme'] > 1 ? 'critères non conformes' : 'critère non conforme' }}
            (test automatique), <strong>{{ counts['a-verifier'] }}</strong> à vérifier manuellement.
          </p>
          <p class="small muted">
            Scores indicatifs. Ils ne constituent pas un taux de conformité RGAA et ne doivent pas
            être repris dans une déclaration d’accessibilité.
          </p>
        </div>
      </div>

      <div class="report__fixes">
        <h2 id="priorites">Corrections prioritaires</h2>
        <ol v-if="fixes.length" class="report__fix-list" aria-labelledby="priorites">
          <li v-for="f in fixes" :key="f.criterion.id">
            <p class="report__fix">{{ f.fix }}</p>
            <p class="small muted">
              Critère {{ f.criterion.id }} ({{ themeName(f.criterion.theme) }}),
              {{ pluralize(f.count, 'élément concerné', 'éléments concernés') }}.
            </p>
          </li>
        </ol>
        <p v-else>
          Aucune erreur détectée automatiquement. Les critères à vérifier manuellement restent à
          contrôler.
        </p>
      </div>

      <div class="report__actions">
        <CopyLinkButton />
        <button type="button" class="btn btn-secondary btn-small" @click="exportJson">
          Exporter en JSON
        </button>
      </div>
    </section>

    <!-- Level 2: the 13 themes, one line each. -->
    <section aria-labelledby="themes" class="report__section">
      <h2 id="themes">Scores par thématique</h2>
      <p class="small muted">
        Part des critères testés automatiquement sans erreur détectée, sur 100.
      </p>
      <ul class="plain-list theme-list">
        <li v-for="t in themes" :key="t.theme" class="theme-row">
          <span class="theme-row__name">{{ t.theme }}. {{ t.title }}</span>
          <span class="theme-row__score" role="img" :aria-label="gaugeAccessibleName(t.title, t)">
            <span aria-hidden="true">{{ t.score ?? '–' }}</span>
          </span>
          <TierLabel :score="t.score" class="theme-row__tier" />
          <span class="small muted theme-row__coverage">{{ coverageLabel(t) }}</span>
        </li>
      </ul>
    </section>

    <!-- Level 3: criterion details, only when opened. -->
    <section id="details" aria-labelledby="details-titre" class="report__section">
      <h2 id="details-titre">Détail des critères</h2>
      <details class="disclosure">
        <summary>Afficher le détail des {{ report.criteria.length }} critères</summary>
        <div class="disclosure__body">
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
          <TransitionGroup tag="ul" name="list" class="plain-list criteria-list">
            <li v-for="c in shown" :key="c.id">
              <CriterionItem :criterion="c" :theme-name="`${c.theme}. ${themeName(c.theme)}`" />
            </li>
          </TransitionGroup>
          <p v-if="shown.length === 0">{{ emptyMessage }}</p>
        </div>
      </details>
    </section>

    <section aria-labelledby="manuel" class="report__section">
      <h2 id="manuel">À vérifier manuellement</h2>
      <details class="disclosure">
        <summary>Afficher la liste des {{ manual.length }} critères à vérifier</summary>
        <div class="disclosure__body">
          <p class="muted">
            Ces critères demandent un jugement humain. Cochez-les au fur et à mesure de vos
            vérifications.
          </p>
          <ManualChecklist :report-id="report.id" :criteria="manual" :theme-name="themeName" />
        </div>
      </details>
    </section>

    <details v-if="live && report.hasScreenshot" class="disclosure report__shot">
      <summary>Voir la capture d’écran de la page analysée</summary>
      <img
        :src="screenshotUrl(report.id)"
        alt="Capture d’écran de la page analysée, telle que Balise l’a chargée"
        loading="lazy"
      />
    </details>
  </div>
</template>

<style scoped>
.report {
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
  padding-block: var(--space-12);
}

.report > * {
  max-width: 60rem;
}

.report__summary {
  display: grid;
  gap: var(--space-6);
}

.report__head {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.report__url {
  font-size: var(--text-small-size);
}

.report__score {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-6);
  padding-block: var(--space-6);
  border-block: 1px solid var(--color-border);
}

.report__score-text {
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

.report__fixes {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.report__fix-list {
  margin: 0;
  padding-inline-start: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.report__fix-list li::marker {
  font-weight: 700;
  color: var(--color-brand);
}

.report__fix {
  font-weight: 700;
}

.report__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-4);
}

.report__section {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.theme-list {
  border-top: 1px solid var(--color-border);
}

.theme-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 3rem minmax(0, 11rem) minmax(0, 13rem);
  align-items: center;
  gap: var(--space-1) var(--space-4);
  padding-block: var(--space-2);
  border-bottom: 1px solid var(--color-border);
}

.theme-row__name {
  font-weight: 700;
}

.theme-row__score {
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  font-size: 1.25rem;
  text-align: end;
}

@media (max-width: 45em) {
  .theme-row {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .theme-row__tier,
  .theme-row__coverage {
    grid-column: 1 / -1;
  }

  .theme-row__score {
    grid-row: 1;
    grid-column: 2;
  }
}

.disclosure > summary {
  cursor: pointer;
  font-weight: 700;
  color: var(--color-brand);
  padding-block: var(--space-2);
}

.disclosure__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding-top: var(--space-4);
}

.criteria-list {
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--color-border);
}

.report__shot img {
  display: block;
  margin-top: var(--space-4);
  border: 1px solid var(--color-border);
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
