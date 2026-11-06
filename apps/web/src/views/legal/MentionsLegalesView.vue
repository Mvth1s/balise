<template>
  <!-- Sources :
    - https://www.legifrance.gouv.fr/loda/id/JORFTEXT000000801164 (LCEN, art. 1-1 issu de la loi SREN du 21 mai 2024) (consulté le 2026-11-05)
    - https://vercel.com/legal/privacy-policy (consulté le 2026-11-05)
    - https://vercel.com/legal/terms (consulté le 2026-11-05)
    - https://vercel.com/contact (consulté le 2026-11-05 : aucun numéro de téléphone publié)
    - https://upstash.com/trust/terms.pdf (consulté le 2026-11-05)
    - https://upstash.com/trust/privacy.pdf (consulté le 2026-11-05)
  -->
  <!-- TODO: vérifier les obligations d'identification d'un éditeur non professionnel (LCEN art. 6 III-2 : possibilité de ne tenir à disposition du public que le nom de l'hébergeur, à condition d'avoir communiqué ses éléments d'identification à celui-ci). -->
  <!-- TODO: depuis la loi SREN du 21 mai 2024, cette règle figure à l'article 1-1 II de la LCEN. L'article 1-1 I exige aussi l'adresse et le numéro de téléphone de l'hébergeur, ainsi que l'identité et l'adresse de la personne qui stocke les données : compléter les placeholders ci-dessous. -->
  <LegalPage title="Mentions légales" updated="2026-11-05">
    <p>
      Ces mentions sont publiées en application de la loi n° 2004-575 du 21 juin 2004 pour la
      confiance dans l'économie numérique (LCEN).
    </p>

    <h2>Éditeur</h2>
    <p>
      Balise est édité à titre non professionnel par <strong>Mvth1s</strong> (pseudonyme). Balise
      n'est pas un service de l'État ni d'une administration.
    </p>
    <ul>
      <li>
        Contact :
        <a href="mailto:mag.d3v+balise@pm.me">mag.d3v+balise@pm.me</a>
      </li>
      <li>Directeur de la publication : Mvth1s</li>
    </ul>
    <p>
      Conformément à la loi, les éléments d'identification personnelle de l'éditeur ont été
      communiqués à l'hébergeur.
    </p>

    <h2>Hébergement du site</h2>
    <p>Le site et ses fonctions serveur sont hébergés par :</p>
    <address>
      Vercel Inc.<br />
      440 N Barranca Avenue #4133<br />
      Covina, CA 91723<br />
      États-Unis<br />
      Courriel : <a href="mailto:privacy@vercel.com">privacy@vercel.com</a><br />
      Téléphone : [À COMPLÉTER : numéro de téléphone de Vercel Inc., non publié sur vercel.com]
    </address>
    <p>
      Les fonctions serveur de Balise s'exécutent dans la région de Paris (identifiant Vercel
      <span lang="en">cdg1</span>).
    </p>

    <h2>Stockage des données</h2>
    <p>Les rapports d'analyse et les compteurs de limitation de débit sont stockés par :</p>
    <address>
      Upstash, Inc. (société du Delaware)<br />
      Adresse : [À COMPLÉTER : adresse postale d'Upstash, Inc., non publiée dans ses conditions ni
      sa politique de confidentialité]<br />
      Courriel : <a href="mailto:privacy@upstash.com">privacy@upstash.com</a>
    </address>
    <p>
      La base de données utilisée par Balise est située en Europe. Pour en savoir plus, consultez la
      <RouterLink to="/confidentialite">politique de confidentialité de Balise</RouterLink>.
    </p>

    <h2>Propriété intellectuelle</h2>
    <ul>
      <li>
        Le code source de Balise est publié sous licence MIT. Il est disponible sur
        <a href="https://github.com/Mvth1s/balise">le dépôt GitHub de Balise (Mvth1s/balise)</a>.
      </li>
      <li>
        Les polices Atkinson Hyperlegible Next et JetBrains Mono sont distribuées sous licence SIL
        Open Font License 1.1. Elles sont servies directement par Balise.
      </li>
      <li>Les icônes proviennent du jeu Lucide, distribué sous licence ISC.</li>
      <li>
        Le nom et le logo Balise ne peuvent pas être utilisés pour présenter un autre service comme
        étant Balise.
      </li>
    </ul>
    <p>
      Les captures et extraits de pages affichés dans les rapports appartiennent à leurs auteurs
      respectifs. Ils sont reproduits uniquement pour illustrer le diagnostic.
    </p>

    <h2>Nous contacter</h2>
    <p>
      Pour toute question sur ces mentions, écrivez à
      <a href="mailto:mag.d3v+balise@pm.me">mag.d3v+balise@pm.me</a> ou consultez la
      <RouterLink to="/contact">page Contact</RouterLink>.
    </p>
  </LegalPage>
</template>

<script setup lang="ts">
import LegalPage from '@/components/LegalPage.vue';
</script>
