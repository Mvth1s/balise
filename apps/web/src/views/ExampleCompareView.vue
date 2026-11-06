<script setup lang="ts">
import ScoreGauge from '@/components/ScoreGauge.vue';
import TierLabel from '@/components/TierLabel.vue';
import { usePageMeta } from '@/composables/usePageMeta';
import { DEMO_LABELS, DEMO_REPORTS, type DemoVariant } from '@/lib/demo-reports';
import { pluralize } from '@/lib/format';
import { countByStatus, sortedThemes } from '@/lib/report';
import { gaugeAccessibleName, globalCoverageLabel } from '@/lib/tiers';

usePageMeta({
  title: 'Exemple : avant et après correction',
  description:
    'Comparaison des rapports Balise sur une page fictive, avant et après correction de ses erreurs d’accessibilité.',
});

const variants: DemoVariant[] = ['avant', 'apres'];
const before = sortedThemes(DEMO_REPORTS.avant);
const after = sortedThemes(DEMO_REPORTS.apres);
const rows = before.map((t) => ({ before: t, after: after.find((a) => a.theme === t.theme) }));
const scoreText = (score: number | null) => (score === null ? 'Non évaluable' : `${score} sur 100`);
</script>

<template>
  <div class="container compare">
    <div class="stack">
      <h1>Exemple : avant et après correction</h1>
      <p class="muted">
        Balise a analysé une page fictive qui contient des erreurs volontaires, puis la même page
        corrigée. Les rapports sont pré-calculés : ils s’affichent instantanément.
      </p>
      <p class="note">
        Scores indicatifs. Ils ne constituent pas un taux de conformité RGAA et ne doivent pas être
        repris dans une déclaration d’accessibilité.
      </p>
    </div>

    <ul class="plain-list compare__grid">
      <li v-for="v in variants" :key="v" class="panel compare__card">
        <h2 class="text-h3">Page {{ v === 'avant' ? 'avant' : 'après' }} correction</h2>
        <div class="compare__score">
          <ScoreGauge
            :score="DEMO_REPORTS[v].scores.global.score"
            :size="120"
            suffix
            :label="gaugeAccessibleName('Score global indicatif', DEMO_REPORTS[v].scores.global)"
          />
          <div class="stack compare__text">
            <TierLabel :score="DEMO_REPORTS[v].scores.global.score" />
            <span class="small muted">{{
              globalCoverageLabel(DEMO_REPORTS[v].scores.global)
            }}</span>
            <span class="small">
              {{
                pluralize(
                  countByStatus(DEMO_REPORTS[v].criteria)['non-conforme'],
                  'critère non conforme',
                  'critères non conformes',
                )
              }}
            </span>
          </div>
        </div>
        <ul class="plain-list stack small">
          <li>
            <RouterLink :to="`/exemple/${v}`"
              >Voir le rapport complet ({{ DEMO_LABELS[v] }})</RouterLink
            >
          </li>
          <li>
            <RouterLink :to="`/demo/${v}`">Voir la page analysée ({{ DEMO_LABELS[v] }})</RouterLink>
          </li>
        </ul>
      </li>
    </ul>

    <section aria-labelledby="par-theme" class="stack">
      <h2 id="par-theme">Scores par thématique</h2>
      <table>
        <caption>
          Scores indicatifs par thématique, avant et après correction
        </caption>
        <thead>
          <tr>
            <th scope="col">Thématique</th>
            <th scope="col">Avant</th>
            <th scope="col">Après</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.before.theme">
            <th scope="row">{{ row.before.theme }}. {{ row.before.title }}</th>
            <td>
              <span class="cell">
                <strong>{{ scoreText(row.before.score) }}</strong>
                <TierLabel :score="row.before.score" />
              </span>
            </td>
            <td>
              <span v-if="row.after" class="cell">
                <strong>{{ scoreText(row.after.score) }}</strong>
                <TierLabel :score="row.after.score" />
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>

<style scoped>
.compare {
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
  padding-block: var(--space-12);
}

.compare__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr));
  gap: var(--space-6);
}

.compare__card {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.compare__score {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-4);
}

.compare__text {
  gap: var(--space-1);
}

.cell {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1) var(--space-2);
}
</style>
