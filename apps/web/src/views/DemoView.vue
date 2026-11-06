<script setup lang="ts">
import { Mail, Share2, TriangleAlert, Check } from '@lucide/vue';
import { onMounted, ref } from 'vue';
import { usePageMeta } from '@/composables/usePageMeta';

/**
 * Demonstration page of a fictitious library, rendered twice:
 * - /demo/avant (broken): intentional accessibility errors, at least one per
 *   theme that Balise can test automatically (see the "ERREUR" comments);
 * - /demo/apres: the same page, corrected (zero axe violation expected).
 * /demo/avant is excluded from the e2e axe tests, noindex, and announced by a
 * warning banner.
 */
const props = defineProps<{ broken: boolean }>();

// The frame document (srcdoc, same origin) takes the focus itself and cannot
// carry a style (CSP): its focus ring is drawn on the <iframe> (RGAA 10.7).
const frame = ref<HTMLIFrameElement | null>(null);
const frameFocused = ref(false);
function watchFrameFocus() {
  const win = frame.value?.contentWindow;
  if (!win) return;
  win.addEventListener('focus', () => (frameFocused.value = true));
  win.addEventListener('blur', () => (frameFocused.value = false));
}
onMounted(() => {
  watchFrameFocus();
  // Each load creates a new window: listen again.
  frame.value?.addEventListener('load', watchFrameFocus);
});

usePageMeta({
  title: props.broken
    ? 'Démonstration : page avec erreurs volontaires'
    : 'Démonstration : page corrigée',
  description: props.broken
    ? 'Page fictive contenant volontairement des erreurs d’accessibilité, analysée par Balise à titre d’exemple.'
    : 'Version corrigée de la page fictive de démonstration de Balise.',
  noindex: props.broken,
});

const PLAN_HTML =
  '<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Plan d’accès</title></head>' +
  '<body><p>Médiathèque des Tilleuls : 12 rue des Tilleuls. Arrêt de bus « Les Tilleuls », lignes 3 et 7.</p></body></html>';
</script>

<template>
  <div class="container demo">
    <div v-if="broken" class="demo-warning" role="note">
      <TriangleAlert :size="24" aria-hidden="true" />
      <div>
        <p>
          <strong>Page de démonstration avec erreurs volontaires.</strong> Ce site est fictif. Cette
          page contient exprès des erreurs d’accessibilité pour montrer ce que Balise détecte. Elle
          n’est pas indexée par les moteurs de recherche.
        </p>
        <p>
          Consultez la <RouterLink to="/demo/apres">version corrigée de cette page</RouterLink> ou
          <RouterLink to="/exemple"
            >la comparaison des rapports avant et après correction</RouterLink
          >.
        </p>
      </div>
    </div>
    <div v-else class="note" role="note">
      <Check :size="24" aria-hidden="true" />
      <div>
        <p>
          <strong>Page de démonstration corrigée.</strong> Ce site est fictif. C’est la même page
          que la <RouterLink to="/demo/avant">page avec erreurs volontaires</RouterLink>, une fois
          les erreurs corrigées.
        </p>
        <p>
          <RouterLink to="/exemple">Comparer les rapports avant et après correction</RouterLink>
        </p>
      </div>
    </div>

    <div class="demo-site">
      <!-- ERREUR 12.7 : lien d'évitement vers une cible inexistante. -->
      <a v-if="broken" href="#programme-introuvable" class="demo-skip">Aller au programme</a>
      <a v-else href="#programme" class="demo-skip">Aller au programme</a>

      <h1>Médiathèque des Tilleuls</h1>
      <p class="muted">Lire, écouter, se retrouver. Site fictif de démonstration.</p>

      <!-- ERREUR 1.1 : image porteuse d'information sans alternative. -->
      <!-- eslint-disable-next-line vuejs-accessibility/alt-text -- intentional demo error -->
      <img v-if="broken" src="/demo/lecture.svg" width="480" height="240" />
      <img
        v-else
        src="/demo/lecture.svg"
        width="480"
        height="240"
        alt="Deux enfants lisent dans l’espace jeunesse, autour d’une table."
      />

      <!-- ERREUR 3.2 : texte au contraste insuffisant. -->
      <p :class="broken ? 'demo-faint' : 'muted'">
        Les inscriptions sont gratuites pour les moins de 18 ans.
      </p>

      <!-- ERREUR 8.8 : code de langue invalide. -->
      <p>
        Notre devise :
        <q :lang="broken ? 'anglais' : 'en'">Books are a uniquely portable magic</q> (Stephen King).
      </p>

      <section aria-labelledby="horaires" class="demo-block">
        <h2 id="horaires">Horaires</h2>
        <!-- ERREUR 5.7 : attribut headers qui ne désigne aucune cellule d'en-tête. -->
        <table>
          <caption>
            Horaires d’ouverture
          </caption>
          <thead>
            <tr>
              <th id="h-jour" scope="col">Jour</th>
              <th id="h-heures" scope="col">Ouverture</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td :headers="broken ? 'h-inexistant' : 'h-jour'">Mardi</td>
              <td headers="h-heures">10 h – 18 h</td>
            </tr>
            <tr>
              <td headers="h-jour">Samedi</td>
              <td headers="h-heures">9 h – 13 h</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section id="programme" aria-labelledby="programme-titre" class="demo-block">
        <h2 id="programme-titre">
          Programme
          <!-- ERREUR 13.8 : élément blink. -->
          <!-- eslint-disable-next-line vuejs-accessibility/no-distracting-elements -- intentional demo error -->
          <blink v-if="broken">Nouveau</blink>
          <span v-else class="demo-tag">Nouveau</span>
        </h2>
        <!-- ERREUR 9.1 : saut de niveau de titre (h2 puis h4). -->
        <h4 v-if="broken">Atelier conte du mercredi</h4>
        <h3 v-else>Atelier conte du mercredi</h3>
        <!-- ERREUR 9.3 : liste contenant autre chose que des éléments li. -->
        <ul v-if="broken">
          <div>Mercredi 10 h : contes pour les 3-6 ans</div>
          <div>Mercredi 15 h : contes pour les 7-10 ans</div>
        </ul>
        <ul v-else>
          <li>Mercredi 10 h : contes pour les 3-6 ans</li>
          <li>Mercredi 15 h : contes pour les 7-10 ans</li>
        </ul>
        <!-- ERREUR 7.1 : rôle ARIA inexistant sur un faux bouton. -->
        <!-- eslint-disable-next-line vuejs-accessibility/aria-role -- intentional demo error -->
        <div v-if="broken" role="buton" class="btn demo-fake-button">Réserver une place</div>
        <button v-else type="button" class="btn">Réserver une place</button>
        <!-- ERREUR 10.8 : contenu masqué aux technologies d'assistance mais focalisable. -->
        <p :aria-hidden="broken ? 'true' : undefined">
          <a href="#horaires">Voir les horaires</a>
        </p>
      </section>

      <section aria-labelledby="video" class="demo-block">
        <h2 id="video">Présentation en vidéo</h2>
        <!-- ERREUR 4.3 : vidéo sans sous-titres. -->
        <!-- eslint-disable-next-line vuejs-accessibility/media-has-caption -- intentional demo error -->
        <video v-if="broken" class="demo-video" controls preload="none" width="320" height="180">
          <source src="/demo/presentation.webm" type="video/webm" />
        </video>
        <template v-else>
          <video class="demo-video" controls preload="none" width="320" height="180">
            <source src="/demo/presentation.webm" type="video/webm" />
            <track kind="captions" srclang="fr" src="/demo/presentation.vtt" label="Français" />
          </video>
          <p>
            Transcription : « Bienvenue à la médiathèque des Tilleuls. L’atelier conte a lieu chaque
            mercredi. » La vidéo montre un carré orange qui traverse un fond vert, sans son.
          </p>
        </template>
      </section>

      <section aria-labelledby="lettre" class="demo-block">
        <h2 id="lettre">Lettre d’information</h2>
        <form class="demo-form" @submit.prevent>
          <!-- ERREUR 11.1 : champ sans étiquette ; le texte visible voisin n'est pas associé au champ. -->
          <template v-if="broken">
            <span class="demo-form__text">Votre e-mail</span>
            <!-- eslint-disable-next-line vuejs-accessibility/form-control-has-label -- intentional demo error -->
            <input type="email" class="field-input" autocomplete="email" />
          </template>
          <template v-else>
            <label for="demo-email">Votre adresse électronique</label>
            <input
              id="demo-email"
              type="email"
              class="field-input"
              placeholder="nom@exemple.fr"
              autocomplete="email"
            />
          </template>
          <!-- ERREUR 11.9 : bouton sans intitulé. -->
          <button type="submit" class="btn">
            <Mail :size="20" aria-hidden="true" />
            <span v-if="!broken">S’abonner</span>
          </button>
        </form>
      </section>

      <section aria-labelledby="acces" class="demo-block">
        <h2 id="acces">Accès</h2>
        <!-- ERREUR 2.1 : cadre sans titre. -->
        <!-- eslint-disable-next-line vuejs-accessibility/iframe-has-title -- intentional demo error -->
        <iframe
          v-if="broken"
          ref="frame"
          class="demo-frame"
          :class="{ 'demo-frame--focus': frameFocused }"
          :srcdoc="PLAN_HTML"
        />
        <iframe
          v-else
          ref="frame"
          class="demo-frame"
          :class="{ 'demo-frame--focus': frameFocused }"
          title="Plan d’accès à la médiathèque"
          :srcdoc="PLAN_HTML"
        />
        <p>
          Suivez-nous :
          <!-- ERREUR 6.2 : lien sans intitulé (icône seule). -->
          <a href="#acces" class="demo-icon-link">
            <Share2 :size="20" aria-hidden="true" />
            <span v-if="!broken" class="visually-hidden"
              >La médiathèque sur les réseaux sociaux (lien fictif)</span
            >
          </a>
        </p>
      </section>
    </div>
  </div>
</template>

<style scoped>
.demo {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  padding-block: var(--space-6) var(--space-12);
}

.demo-warning {
  display: flex;
  gap: var(--space-2);
  align-items: flex-start;
  padding: var(--space-4);
  border: 2px solid var(--color-score-warn);
  border-radius: var(--radius-md);
  background: var(--color-surface-raised);
}

.demo-warning > svg {
  flex: none;
  color: var(--color-score-warn);
}

.demo-warning p + p,
.note p + p {
  margin-top: var(--space-2);
}

.demo-site {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-6);
  border: 1px dashed var(--color-border-strong);
  border-radius: var(--radius-lg);
  background: var(--color-surface-raised);
}

.demo-skip {
  align-self: flex-start;
}

.demo-block {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.demo-block ul {
  margin: 0;
}

/* Intentionally insufficient contrast (demo "avant" only). */
.demo-faint {
  color: var(--color-border);
}

.demo-tag {
  margin-inline-start: var(--space-2);
  padding: 0 var(--space-2);
  border: 1px solid currentColor;
  border-radius: var(--radius-sm);
  font-size: var(--text-small-size);
}

.demo-fake-button,
.demo-block .btn {
  align-self: flex-start;
}

.demo-form {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: var(--space-2) var(--space-4);
}

.demo-form label,
.demo-form__text {
  flex-basis: 100%;
  font-weight: 700;
}

.demo-form input {
  flex: 1 1 14rem;
  width: auto;
}

.demo-video {
  max-width: 100%;
  height: auto;
  background: var(--color-ink);
}

.demo-frame {
  width: 100%;
  height: 6rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.demo-frame--focus {
  outline: 2px solid var(--color-brand);
  outline-offset: 2px;
}

.demo-icon-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  min-height: 44px;
  vertical-align: middle;
}
</style>
