<script setup lang="ts">
import { ArrowRight } from '@lucide/vue';
import { computed, nextTick, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { usePageMeta } from '@/composables/usePageMeta';
import { drawStroke } from '@/lib/animate';
import { ApiError, createAnalysis, describeError, type ErrorDescription } from '@/lib/api';
import { URL_PROBLEM_MESSAGES, validateUrl } from '@/lib/url';
import { withViewTransition } from '@/lib/view-transition';

usePageMeta({
  title: 'Balise : pré-diagnostic d’accessibilité RGAA d’une page web',
  rawTitle: true,
  description:
    'Saisissez l’adresse d’une page publique : Balise teste les critères RGAA 4.1.2 vérifiables automatiquement, affiche des scores indicatifs par thématique et liste ce qu’il reste à vérifier à la main.',
});

const router = useRouter();
const input = ref('');
const touched = ref(false);
const submitting = ref(false);
const apiError = ref<ErrorDescription | null>(null);
const field = ref<HTMLInputElement | null>(null);
const checkPath = ref<SVGPathElement | null>(null);

const validation = computed(() => validateUrl(input.value));
const fieldError = computed(() =>
  touched.value && !validation.value.ok ? URL_PROBLEM_MESSAGES[validation.value.problem] : '',
);

// Draws the check mark each time the address becomes valid.
watch(
  () => validation.value.ok,
  async (ok) => {
    if (!ok) return;
    await nextTick();
    if (checkPath.value) drawStroke(checkPath.value, 300);
  },
);

function onInput() {
  apiError.value = null;
}

async function submit() {
  if (submitting.value) return;
  touched.value = true;
  apiError.value = null;
  const result = validation.value;
  if (!result.ok) {
    field.value?.focus();
    return;
  }
  submitting.value = true;
  try {
    const created = await createAnalysis(result.url);
    await withViewTransition(() =>
      router.push({
        path: `/analyses/${encodeURIComponent(created.id)}`,
        // Tells the analysis view to play the steps even if the report is already done.
        state: { fresh: true },
      }),
    );
  } catch (err) {
    const code = err instanceof ApiError ? err.code : 'internal';
    apiError.value = describeError(code, err instanceof ApiError ? err.retryAfter : null);
    submitting.value = false;
    await nextTick();
    field.value?.focus();
  }
}

const describedBy = computed(() =>
  ['url-hint', fieldError.value ? 'url-error' : '', apiError.value ? 'url-api-error' : '']
    .filter(Boolean)
    .join(' '),
);
</script>

<template>
  <div class="home">
    <section class="container hero" aria-labelledby="titre">
      <div class="hero__main">
        <h1 id="titre" class="text-display">Repérez les erreurs d’accessibilité de votre page.</h1>
        <p class="hero__lead">
          Balise teste les critères RGAA 4.1.2 vérifiables automatiquement et vous donne un score
          indicatif, les corrections prioritaires et la liste de ce qu’il reste à vérifier à la
          main.
        </p>

        <form class="url-form" novalidate @submit.prevent="submit">
          <label for="url" class="url-form__label">Adresse de la page à analyser</label>
          <div class="url-form__row">
            <div class="url-form__field">
              <input
                id="url"
                ref="field"
                v-model="input"
                class="field-input"
                type="url"
                name="url"
                inputmode="url"
                autocomplete="url"
                spellcheck="false"
                placeholder="https://www.exemple.fr/contact"
                :aria-invalid="fieldError || apiError ? 'true' : 'false'"
                :aria-describedby="describedBy"
                @input="onInput"
                @blur="touched = input.trim() !== ''"
              />
            </div>
            <button type="submit" class="btn" :aria-disabled="submitting ? 'true' : undefined">
              {{ submitting ? 'Lancement de l’analyse…' : 'Analyser la page' }}
              <ArrowRight :size="20" aria-hidden="true" />
            </button>
          </div>
          <p class="small url-form__valid" aria-live="polite">
            <template v-if="validation.ok">
              <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path ref="checkPath" d="M20 6L9 17l-5-5" />
              </svg>
              Adresse valide
            </template>
          </p>
          <p v-if="fieldError" id="url-error" class="small url-form__error">{{ fieldError }}</p>
          <div v-if="apiError" id="url-api-error" class="url-form__api-error" role="alert">
            <p>
              <strong>{{ apiError.title }}.</strong> {{ apiError.message }}
            </p>
          </div>
          <p id="url-hint" class="small muted">
            Page publique uniquement. Résultat en 30 secondes environ.
          </p>
          <p class="small">
            Pas de site sous la main ?
            <RouterLink to="/exemple/avant" class="strong-link">
              Essayer avec une page d’exemple
            </RouterLink>
          </p>
        </form>
      </div>
    </section>

    <section id="methode" class="container method" aria-labelledby="methode-titre">
      <h2 id="methode-titre">Comment ça marche</h2>
      <dl class="method__list">
        <dt>Ce que Balise teste</dt>
        <dd>
          Les critères vérifiables automatiquement sur la page rendue : alternatives d’images,
          contrastes, étiquettes de champs, structure des titres, liens, tableaux.
        </dd>
        <dt id="limites">Ce qu’il vous reste à vérifier</dt>
        <dd>
          La majorité des critères demande un regard humain. Le rapport les liste avec ce qu’il faut
          contrôler.
        </dd>
        <dt>Vos données</dt>
        <dd>
          Sans compte. Analyses exécutées à Paris, rapports supprimés après 30 jours. Mesure
          d’audience uniquement si vous l’acceptez.
        </dd>
      </dl>
      <p class="small muted">
        Les scores de Balise sont indicatifs. Ils ne constituent pas un taux de conformité RGAA et
        ne remplacent pas un audit réalisé selon la méthode officielle.
      </p>
    </section>
  </div>
</template>

<style scoped>
.hero {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-12);
  padding-block: var(--space-12) 0;
}

.hero__main {
  flex: 1 1 30rem;
  max-width: 44rem;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.hero h1 {
  letter-spacing: -0.01em;
}

@media (max-width: 37.5em) {
  .hero h1 {
    font-size: var(--text-h1-size);
    line-height: var(--text-h1-line);
  }
}

.hero__lead {
  max-width: 38rem;
  font-size: 1.125rem;
}

.url-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  max-width: 38rem;
}

.url-form__label {
  font-weight: 700;
}

.url-form__row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-4);
}

.url-form__field {
  flex: 1 1 16rem;
  min-width: 0;
}

.url-form__row .btn {
  min-height: 52px;
}

.url-form__valid {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  min-height: var(--text-small-line);
  color: var(--color-score-good);
  font-weight: 700;
}

.url-form__valid path {
  fill: none;
  stroke: currentColor;
  stroke-width: 2.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.url-form__error {
  color: var(--color-score-bad);
  font-weight: 700;
}

.url-form__api-error {
  padding: var(--space-4);
  border: 2px solid var(--color-score-bad);
  border-radius: var(--radius-md);
  background: var(--color-surface-raised);
}

.strong-link {
  font-weight: 700;
}

.method {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding-block: var(--space-12);
}

.method > * {
  max-width: 44rem;
}

.method > h2 {
  padding-top: var(--space-12);
  border-top: 1px solid var(--color-border);
}

.method__list {
  display: grid;
  grid-template-columns: minmax(0, 14rem) minmax(0, 1fr);
  gap: var(--space-4) var(--space-6);
  margin: 0;
}

.method__list dt {
  font-weight: 700;
}

.method__list dd {
  margin: 0;
}

@media (max-width: 37.5em) {
  .method__list {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-1);
  }

  .method__list dd + dt {
    margin-top: var(--space-4);
  }
}
</style>
