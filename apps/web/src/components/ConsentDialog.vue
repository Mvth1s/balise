<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useConsent } from '@/composables/useConsent';
import type { ConsentValue } from '@/lib/analytics';
import { focusElement, focusMainHeading } from '@/lib/focus';

/**
 * Home-made GA4 consent dialog (native role="dialog"). Rendered only when
 * VITE_GA_MEASUREMENT_ID is set and no valid choice is stored, except on
 * « Gestion des cookies », which offers the same choice. Native modal <dialog>:
 * the rest of the page is inert,
 * Escape refuses, and closing returns the focus to where it was (or to the
 * page heading). « Personnaliser » leaves it to the route change.
 */
const { state, analyticsConfigured, setConsent } = useConsent();
const route = useRoute();
const dialog = ref<HTMLDialogElement | null>(null);
const text = ref<HTMLElement | null>(null);
// Escape closes the dialog without a button: that is a refusal.
let escapeRefuses = true;
let opener: HTMLElement | null = null;

const open = computed(() => state.consent === null && route.path !== '/cookies');

watch(dialog, (el) => {
  if (!el || el.open) return;
  escapeRefuses = true;
  opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  el.addEventListener('keydown', trapTab);
  el.showModal();
  focusElement(text.value);
});

/** `null`: « Personnaliser mes choix », no choice yet (the route change moves the focus). */
function choose(value: ConsentValue | null) {
  escapeRefuses = false;
  dialog.value?.close();
  if (value) apply(value);
}

// The close event is asynchronous: buttons apply their choice directly instead.
function onClose() {
  if (escapeRefuses) apply('denied');
}

function apply(value: ConsentValue) {
  setConsent(value, true);
  // Opened on page load, there is usually no opener: same target as a route change.
  const restored = opener && opener !== document.body && opener.isConnected && focusElement(opener);
  if (!restored) focusMainHeading();
}
// The browser chrome is reachable between the last and first elements otherwise.
function trapTab(event: KeyboardEvent) {
  if (event.key !== 'Tab' || !dialog.value) return;
  const items = dialog.value.querySelectorAll<HTMLElement>('a[href], button');
  const first = items[0];
  const last = items[items.length - 1];
  if (!first || !last) return;
  const active = document.activeElement;
  if (event.shiftKey && (active === first || active === text.value)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}
</script>

<template>
  <template v-if="analyticsConfigured && state.ready">
    <dialog
      v-if="open"
      ref="dialog"
      class="consent"
      aria-modal="true"
      aria-labelledby="consent-title"
      aria-describedby="consent-text"
      @close="onClose"
    >
      <h2 id="consent-title" class="text-h3">Mesure d’audience</h2>
      <p id="consent-text" ref="text">
        Balise utilise Google Analytics pour compter les visites, uniquement si vous l’acceptez. Les
        données sont alors transmises à Google, y compris aux États-Unis. Votre choix est conservé 6
        mois et modifiable à tout moment depuis « Gestion des cookies ».
      </p>
      <RouterLink to="/cookies" @click="choose(null)">Personnaliser mes choix</RouterLink>
      <div class="consent__actions">
        <button type="button" class="btn btn-secondary" @click="choose('denied')">
          Tout refuser
        </button>
        <button type="button" class="btn btn-secondary" @click="choose('granted')">
          Tout accepter
        </button>
      </div>
    </dialog>
    <p class="visually-hidden" role="status">
      <template v-if="state.lastChoice">
        Votre choix est enregistré : mesure d’audience
        {{ state.lastChoice === 'granted' ? 'acceptée' : 'refusée' }}.
      </template>
    </p>
  </template>
</template>

<style scoped>
.consent {
  width: min(36rem, calc(100% - 2 * var(--space-4)));
  max-height: calc(100% - 2 * var(--space-4));
  padding: var(--space-6);
  border: 2px solid var(--color-brand);
  border-radius: var(--radius-md);
  background: var(--color-surface-raised);
  color: inherit;
}

.consent[open] {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-4);
}

.consent::backdrop {
  background: rgb(0 0 0 / 0.5);
}

.consent h2,
.consent p {
  margin: 0;
}

.consent__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-4);
}
</style>
