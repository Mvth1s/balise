<script setup lang="ts">
import { onMounted, ref } from 'vue';
import LegalPage from '@/components/LegalPage.vue';
import { useConsent } from '@/composables/useConsent';
import CookiesContentView from './legal/CookiesContentView.vue';

const { state, analyticsConfigured, setConsent } = useConsent();
// Never pre-checked: reflects the stored choice once the client has read it.
const accepted = ref(false);
const saved = ref('');

onMounted(() => (accepted.value = state.consent === 'granted'));

function save() {
  setConsent(accepted.value ? 'granted' : 'denied');
  saved.value = accepted.value
    ? 'Choix enregistré : mesure d’audience acceptée.'
    : 'Choix enregistré : mesure d’audience refusée.';
}
</script>

<template>
  <LegalPage
    title="Gestion des cookies"
    updated="2026-11-06"
    description="Gérez votre consentement à la mesure d’audience de Balise et consultez la liste des cookies et du stockage local utilisés."
  >
    <p>
      Vous pouvez modifier ou retirer votre choix à tout moment. Il est conservé 6 mois, puis
      redemandé.
    </p>

    <section aria-labelledby="choix-audience" class="panel prefs">
      <h2 id="choix-audience">Modifier votre choix</h2>
      <template v-if="analyticsConfigured">
        <label class="switch prefs__switch" for="ga4">
          <input id="ga4" v-model="accepted" type="checkbox" role="switch" class="switch__input" />
          <span class="switch__track" aria-hidden="true"><span class="switch__thumb" /></span>
          <span>Mesure d’audience (Google Analytics 4)</span>
          <span class="switch__state" aria-hidden="true">{{
            accepted ? 'Acceptée' : 'Refusée'
          }}</span>
        </label>
        <div class="prefs__actions">
          <button type="button" class="btn" @click="save">Enregistrer mes choix</button>
          <p role="status">{{ saved }}</p>
        </div>
      </template>
      <p v-else>
        La mesure d’audience n’est pas activée sur ce site : aucun script ni cookie Google n’est
        utilisé. Seul le stockage nécessaire décrit ci-dessous est employé.
      </p>
    </section>

    <CookiesContentView />
  </LegalPage>
</template>

<style scoped>
.prefs {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.prefs h2 {
  margin-top: 0;
}

.prefs__switch {
  position: relative;
  align-self: flex-start;
  padding: 0;
}

.prefs__switch:focus-within {
  outline: 2px solid var(--color-brand);
  outline-offset: 2px;
}

.prefs__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2) var(--space-4);
}
</style>
