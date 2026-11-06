<script setup lang="ts">
import { nextTick, ref } from 'vue';
import { useConsent } from '@/composables/useConsent';
import type { ConsentValue } from '@/lib/analytics';
import { focusElement } from '@/lib/focus';

/**
 * Home-made GA4 consent banner. Rendered only when VITE_GA_MEASUREMENT_ID is
 * set and no valid choice is stored. Not modal: it sits in the page flow,
 * never blocks scrolling or typing. Both buttons look the same.
 */
const { state, analyticsConfigured, setConsent, dismissConfirmation } = useConsent();
const confirmation = ref<HTMLElement | null>(null);

async function choose(value: ConsentValue) {
  setConsent(value, true);
  // The clicked button disappears: keep the focus on the confirmation.
  await nextTick();
  focusElement(confirmation.value);
}

function close() {
  dismissConfirmation();
  focusElement(document.getElementById('contenu'));
}
</script>

<template>
  <template v-if="analyticsConfigured && state.ready">
    <section v-if="state.consent === null" class="consent" aria-labelledby="consent-title">
      <div class="container consent__inner">
        <div class="consent__text">
          <p id="consent-title" class="text-h3">Mesure d’audience</p>
          <p>
            Balise utilise Google Analytics pour compter les visites, uniquement si vous l’acceptez.
            Les données sont alors transmises à Google, y compris aux États-Unis. Votre choix est
            conservé 6 mois et modifiable à tout moment depuis « Gestion des cookies ».
          </p>
          <RouterLink to="/cookies">Personnaliser mes choix</RouterLink>
        </div>
        <div class="consent__actions">
          <button type="button" class="btn btn-secondary" @click="choose('denied')">
            Tout refuser
          </button>
          <button type="button" class="btn btn-secondary" @click="choose('granted')">
            Tout accepter
          </button>
        </div>
      </div>
    </section>
    <div v-else-if="state.lastChoice" class="consent consent--done">
      <div class="container consent__inner">
        <p ref="confirmation" role="status">
          Votre choix est enregistré : mesure d’audience
          {{ state.lastChoice === 'granted' ? 'acceptée' : 'refusée' }}. Vous pouvez le modifier
          depuis la page <RouterLink to="/cookies">Gestion des cookies</RouterLink>.
        </p>
        <button type="button" class="btn btn-secondary btn-small" @click="close">
          Fermer ce message
        </button>
      </div>
    </div>
  </template>
</template>

<style scoped>
.consent {
  background: var(--color-surface-raised);
  border-bottom: 2px solid var(--color-brand);
}

.consent__inner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4) var(--space-6);
  padding-block: var(--space-4);
}

.consent__text {
  flex: 1 1 32rem;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-2);
  font-size: var(--text-small-size);
  line-height: var(--text-small-line);
}

.consent__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-4);
}

.consent--done p {
  flex: 1 1 20rem;
}
</style>
