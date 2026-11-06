<script setup lang="ts">
import type { CriterionResult } from '@balise/analyzer/types';
import { computed, onMounted, ref } from 'vue';
import { loadChecklist, saveChecklist, toggleItem } from '@/lib/checklist';
import { safeHref } from '@/lib/report';

/** "À vérifier manuellement" checklist; state kept in localStorage per report. */
const props = defineProps<{
  reportId: string;
  criteria: CriterionResult[];
  themeName: (theme: number) => string;
}>();

const checked = ref<Set<string>>(new Set());
// Loaded after mount: the pre-rendered HTML has every box unchecked.
onMounted(() => (checked.value = loadChecklist(props.reportId)));

const doneCount = computed(() => props.criteria.filter((c) => checked.value.has(c.id)).length);

function toggle(id: string, event: Event) {
  checked.value = toggleItem(checked.value, id, (event.target as HTMLInputElement).checked);
  saveChecklist(props.reportId, checked.value);
}

const inputId = (id: string) => `manuel-${id.replace(/\W/g, '-')}`;
</script>

<template>
  <div class="stack">
    <p class="small" role="status">
      {{ doneCount }} sur {{ criteria.length }} cochés. Vos coches restent dans ce navigateur.
    </p>
    <ul class="plain-list checklist">
      <li v-for="c in criteria" :key="c.id" class="checklist__item">
        <input
          :id="inputId(c.id)"
          type="checkbox"
          :checked="checked.has(c.id)"
          @change="toggle(c.id, $event)"
        />
        <div class="checklist__text">
          <label :for="inputId(c.id)">
            <strong>Critère {{ c.id }}</strong> ({{ themeName(c.theme) }}) : {{ c.title }}
          </label>
          <a v-if="safeHref(c.url)" :href="safeHref(c.url)" class="small">
            Méthode de test du critère {{ c.id }} sur le site officiel du RGAA
          </a>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.checklist {
  display: flex;
  flex-direction: column;
}

.checklist__item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-4);
  padding-block: var(--space-4);
  border-top: 1px solid var(--color-border);
}

.checklist__item input {
  margin-top: var(--space-1);
}

.checklist__text {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
}

.checklist__text label {
  cursor: pointer;
}
</style>
