<script setup lang="ts">
import type { CriterionResult } from '@balise/analyzer/types';
import { computed } from 'vue';
import StatusBadge from '@/components/StatusBadge.vue';
import { enter } from '@/lib/animate';
import { pluralize } from '@/lib/format';
import { affectedLabel, safeHref } from '@/lib/report';

/**
 * One criterion of the report. Every string coming from the analysed page
 * (selector, HTML snippet) is rendered through text interpolation only.
 */
const props = defineProps<{ criterion: CriterionResult; themeName: string }>();
const headingId = computed(() => `critere-${props.criterion.id.replace(/\W/g, '-')}`);

function onToggle(event: Event) {
  const details = event.currentTarget as HTMLDetailsElement;
  const body = details.querySelector('.finding__nodes');
  if (details.open && body) enter(body, 0, 250);
}
</script>

<template>
  <article class="criterion" :aria-labelledby="headingId">
    <div class="criterion__meta">
      <StatusBadge :status="criterion.status" />
      <span class="small muted">{{ themeName }}</span>
    </div>
    <h3 :id="headingId" class="criterion__title">
      Critère {{ criterion.id }} : {{ criterion.title }}
    </h3>
    <p v-if="criterion.status === 'non-conforme'" class="small">
      <strong>{{ affectedLabel(criterion) }}</strong>
    </p>

    <div v-for="finding in criterion.findings" :key="finding.rule" class="finding">
      <p>{{ finding.explanation }}</p>
      <p><strong>Correction :</strong> {{ finding.fix }}</p>
      <details v-if="finding.nodes.length" class="finding__details" @toggle="onToggle">
        <summary>
          Voir {{ finding.count > 1 ? `les ${finding.count} éléments` : 'l’élément' }}
          <span class="muted">(test {{ finding.rule }})</span>
        </summary>
        <div class="finding__nodes">
          <ol class="plain-list stack">
            <li v-for="(node, index) in finding.nodes" :key="index" class="node">
              <p class="small">
                Sélecteur : <code class="mono">{{ node.selector }}</code>
              </p>
              <pre class="code-block"><code>{{ node.html }}</code></pre>
            </li>
          </ol>
          <p v-if="finding.count > finding.nodes.length" class="small muted">
            Et
            {{
              pluralize(finding.count - finding.nodes.length, 'autre élément', 'autres éléments')
            }}
            non listés dans ce rapport.
          </p>
        </div>
      </details>
      <p v-if="safeHref(finding.helpUrl)" class="small">
        <a :href="safeHref(finding.helpUrl)" hreflang="en"
          >Documentation du test {{ finding.rule }} (en anglais)</a
        >
      </p>
    </div>

    <p v-if="safeHref(criterion.url)" class="small">
      <a :href="safeHref(criterion.url)">Critère {{ criterion.id }} sur le site officiel du RGAA</a>
    </p>
  </article>
</template>

<style scoped>
.criterion {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding-block: var(--space-6);
  border-bottom: 1px solid var(--color-border);
}

.criterion__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2) var(--space-4);
}

.finding {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding-top: var(--space-2);
  border-top: 1px solid var(--color-border);
}

.finding__details summary {
  cursor: pointer;
  font-weight: 700;
  color: var(--color-brand);
  padding-block: var(--space-2);
}

.finding__nodes {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding-top: var(--space-2);
}

.node {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
</style>
