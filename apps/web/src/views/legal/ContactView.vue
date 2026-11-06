<template>
  <!-- Sources :
    - https://github.com/Mvth1s/balise (dépôt du projet) (consulté le 2026-11-05)
  -->
  <LegalPage title="Contact" updated="2026-11-05">
    <h2>Écrire à l'éditeur</h2>
    <p>
      Balise est édité par Mvth1s. Pour nous écrire :
      <a href="mailto:mag.d3v+balise@pm.me">mag.d3v+balise@pm.me</a>.
    </p>

    <h2>Pourquoi nous écrire</h2>
    <ul>
      <li>
        <strong>Signaler un problème d'accessibilité</strong> sur Balise : décrivez la page, ce que
        vous cherchiez à faire et, si possible, votre navigateur et votre technologie d'assistance.
        Voir aussi la
        <RouterLink to="/accessibilite">déclaration d'accessibilité de Balise</RouterLink>.
      </li>
      <li>
        <strong>Exercer vos droits sur vos données personnelles</strong> : accès, effacement,
        opposition, etc. Pour supprimer un rapport, indiquez son lien. Voir la
        <RouterLink to="/confidentialite">politique de confidentialité de Balise</RouterLink>.
      </li>
      <li>
        <strong>Signaler une faille de sécurité</strong> : écrivez en privé, sans publier les
        détails. La procédure est décrite dans
        <a href="https://github.com/Mvth1s/balise/blob/main/SECURITY.md"
          >la politique de sécurité de Balise (fichier SECURITY.md sur GitHub)</a
        >.
      </li>
      <li>
        <strong>Poser une question</strong> sur un résultat ou sur la méthode de calcul des scores.
      </li>
    </ul>

    <h2>Signaler un bogue ou proposer une amélioration</h2>
    <p>
      Le code de Balise est public. Vous pouvez ouvrir un ticket sur
      <a href="https://github.com/Mvth1s/balise/issues"
        >le suivi des problèmes du dépôt GitHub de Balise</a
      >. Un compte GitHub est nécessaire. N'y publiez ni faille de sécurité ni donnée personnelle.
    </p>

    <h2>Délai de réponse</h2>
    <p>
      Balise est un projet personnel. Nous essayons de répondre sous quelques jours, sans engagement
      de délai. Les demandes relatives à vos données personnelles reçoivent une réponse dans le
      délai prévu par le RGPD, soit un mois au plus.
    </p>
  </LegalPage>
</template>

<script setup lang="ts">
import LegalPage from '@/components/LegalPage.vue';
</script>
