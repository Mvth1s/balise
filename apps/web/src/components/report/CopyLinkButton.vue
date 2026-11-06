<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref } from 'vue';
import { drawStroke } from '@/lib/animate';

/** Copies the report URL; confirmation = drawn check mark + text in a status region. */
const props = defineProps<{ url?: string }>();
const message = ref('');
const copied = ref(false);
const checkPath = ref<SVGPathElement | null>(null);
let timer = 0;

async function copy() {
  window.clearTimeout(timer);
  const url = props.url ?? window.location.href;
  try {
    await navigator.clipboard.writeText(url);
    copied.value = true;
    message.value = 'Lien du rapport copié.';
    await nextTick();
    if (checkPath.value) drawStroke(checkPath.value, 300);
  } catch {
    copied.value = false;
    message.value = `Copie impossible. Copiez cette adresse manuellement : ${url}`;
  }
  timer = window.setTimeout(() => {
    copied.value = false;
    message.value = '';
  }, 6000);
}

onBeforeUnmount(() => window.clearTimeout(timer));
</script>

<template>
  <div class="copy">
    <button type="button" class="btn btn-secondary btn-small" @click="copy">
      <svg
        v-if="copied"
        class="copy__check"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
      >
        <path ref="checkPath" d="M20 6L9 17l-5-5" />
      </svg>
      Copier le lien du rapport
    </button>
    <p class="small copy__status" role="status">{{ message }}</p>
  </div>
</template>

<style scoped>
.copy {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.copy__check path {
  fill: none;
  stroke: var(--color-score-good);
  stroke-width: 2.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}
</style>
