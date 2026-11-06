<script setup lang="ts">
import { usePreferences } from '@/composables/usePreferences';
import { THEME_LABELS, type ThemePreference } from '@/lib/theme';
import BaliseLogo from './BaliseLogo.vue';

const { state, setTheme, setMotion } = usePreferences();
const themes = Object.entries(THEME_LABELS) as [ThemePreference, string][];

function onThemeChange(event: Event) {
  setTheme((event.target as HTMLSelectElement).value as ThemePreference);
}
</script>

<template>
  <header class="site-header">
    <div class="container site-header__inner">
      <RouterLink to="/" class="site-header__home" aria-label="Balise, accueil">
        <BaliseLogo :size="40" />
      </RouterLink>
      <nav aria-label="Navigation principale" class="site-header__nav">
        <ul>
          <li>
            <!-- An anchor link is never the "current page": no aria-current. -->
            <RouterLink v-slot="{ href, navigate }" to="/#methode" custom>
              <a :href="href" @click="navigate">Comment ça marche</a>
            </RouterLink>
          </li>
          <li><RouterLink to="/exemple">Exemple de rapport</RouterLink></li>
        </ul>
      </nav>
      <div class="site-header__prefs">
        <div class="pref">
          <label for="pref-theme">Thème</label>
          <select id="pref-theme" class="field-input" :value="state.theme" @change="onThemeChange">
            <option v-for="[value, label] in themes" :key="value" :value="value">
              {{ label }}
            </option>
          </select>
        </div>
        <div class="pref">
          <button
            id="pref-motion"
            type="button"
            role="switch"
            class="switch"
            :aria-checked="state.motion ? 'true' : 'false'"
            :aria-describedby="state.systemReduce ? 'pref-motion-hint' : undefined"
            @click="setMotion(!state.motion)"
          >
            <span class="switch__label">Animations</span>
            <span class="switch__track" aria-hidden="true"><span class="switch__thumb" /></span>
            <span class="switch__state" aria-hidden="true">{{ state.motion ? 'Oui' : 'Non' }}</span>
          </button>
          <p v-if="state.systemReduce" id="pref-motion-hint" class="small muted pref__hint">
            Réduites par votre système
          </p>
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped>
.site-header {
  border-bottom: 1px solid var(--color-border);
}

.site-header__inner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4) var(--space-6);
  padding-block: var(--space-4);
}

.site-header__home {
  display: inline-flex;
  text-decoration: none;
  border-radius: var(--radius-sm);
}

.site-header__nav ul {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-6);
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: var(--text-small-size);
  line-height: var(--text-small-line);
}

.site-header__nav a {
  display: inline-block;
  padding-block: var(--space-2);
}

.site-header__prefs {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2) var(--space-4);
  font-size: var(--text-small-size);
  line-height: var(--text-small-line);
}

.pref {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

.pref label {
  font-weight: 700;
}

.pref select {
  width: auto;
  min-height: 44px;
}

.pref__hint {
  flex-basis: 100%;
}
</style>
