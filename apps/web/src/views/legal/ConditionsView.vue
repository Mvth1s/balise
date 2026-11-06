<template>
  <!-- Sources :
    - docs/specs/kickoff.md (spécification de Balise : limitation à 10 analyses par heure, conservation 30 jours, scores indicatifs) (consulté le 2026-11-05)
    - https://www.legifrance.gouv.fr/loda/id/JORFTEXT000000801164 (LCEN) (consulté le 2026-11-05)
  -->
  <LegalPage title="Conditions d'utilisation" updated="2026-11-06">
    <h2>Objet</h2>
    <p>
      Ces conditions encadrent l'utilisation de Balise, un outil de pré-diagnostic d'accessibilité.
      Balise analyse une page web publique, repère les erreurs d'accessibilité détectables
      automatiquement et les range par thématique du RGAA 4.1.2, avec des scores indicatifs. En
      utilisant Balise, vous acceptez ces conditions.
    </p>

    <h2>Accès au service</h2>
    <p>
      Balise est gratuit et accessible sans compte. L'éditeur peut suspendre ou arrêter le service à
      tout moment, notamment pour maintenance, sans préavis ni indemnité.
    </p>

    <h2>Usage autorisé</h2>
    <p>
      Vous pouvez analyser des pages publiques, accessibles sans authentification, dont vous avez le
      droit de demander l'analyse : vos propres pages, ou des pages publiques de tiers, dans le
      respect de leurs conditions d'utilisation.
    </p>

    <h2>Usages interdits</h2>
    <p>Il est interdit :</p>
    <ul>
      <li>
        d'analyser des pages privées, protégées par un mot de passe, ou contenant des données
        personnelles non publiques ;
      </li>
      <li>
        de chercher à atteindre des adresses internes ou réservées, ou à détourner Balise pour
        sonder un réseau ;
      </li>
      <li>
        de contourner la limitation du nombre d'analyses, par exemple en multipliant les adresses IP
        ;
      </li>
      <li>
        de faire un usage abusif du service : requêtes automatisées en masse, surcharge volontaire,
        tentative d'intrusion ou d'atteinte à la sécurité.
      </li>
    </ul>
    <p>
      En cas d'usage interdit, l'éditeur peut bloquer l'accès au service, sans préjudice
      d'éventuelles poursuites.
    </p>

    <h2>Limitation du nombre d'analyses</h2>
    <p>
      Vous pouvez lancer au maximum 10 analyses par heure. Au-delà, Balise refuse les nouvelles
      demandes jusqu'à ce qu'une heure se soit écoulée depuis les analyses les plus anciennes. Cette
      limite protège le service et le rend disponible pour tout le monde.
    </p>

    <h2>Caractère indicatif des scores</h2>
    <p>
      Les scores de Balise sont <strong>indicatifs</strong>. Ils reposent uniquement sur des tests
      automatiques, qui ne couvrent qu'une partie des critères du RGAA. De nombreux critères doivent
      être vérifiés manuellement.
    </p>
    <ul>
      <li>Les scores ne constituent pas un taux de conformité RGAA.</li>
      <li>Ils ne doivent pas être repris dans une déclaration d'accessibilité.</li>
      <li>
        « Aucune erreur détectée automatiquement » ne signifie pas qu'une page est accessible.
      </li>
    </ul>
    <p>
      Pour mesurer la conformité d'un site, seul un audit complet selon la méthode officielle du
      RGAA fait foi. La méthode de calcul des scores de Balise est décrite dans sa documentation
      publique.
    </p>

    <h2>Absence de garantie</h2>
    <p>
      Balise est fourni « en l'état ». L'éditeur ne garantit ni l'exactitude, ni l'exhaustivité des
      résultats, ni la disponibilité continue du service. Un résultat peut être erroné : une erreur
      peut être signalée à tort, ou ne pas être détectée.
    </p>

    <h2>Responsabilité</h2>
    <p>
      Vous êtes responsable des adresses que vous soumettez et de l'usage que vous faites des
      rapports. Dans les limites permises par la loi, l'éditeur n'est pas responsable des décisions
      prises sur la base des résultats de Balise, ni des dommages indirects liés à l'utilisation du
      service.
    </p>

    <h2>Conservation et partage des rapports</h2>
    <p>
      Chaque rapport possède une adresse unique. Il est conservé 30 jours, puis supprimé
      automatiquement.
    </p>
    <p>
      <strong>Toute personne qui possède le lien d'un rapport peut le consulter.</strong> Le rapport
      contient l'adresse analysée, une capture d'écran et des extraits du code de la page. Ne
      partagez le lien qu'avec des personnes de confiance. Pour demander la suppression anticipée
      d'un rapport, écrivez à <a href="mailto:mag.d3v+balise@pm.me">mag.d3v+balise@pm.me</a> en
      indiquant son lien.
    </p>

    <h2>Propriété intellectuelle</h2>
    <p>
      Le code source de Balise est publié sous licence MIT. Les polices et les icônes sont utilisées
      selon leurs propres licences, détaillées dans les
      <RouterLink to="/mentions-legales">mentions légales de Balise</RouterLink>. Les pages
      analysées et leurs contenus restent la propriété de leurs auteurs.
    </p>

    <h2>Données personnelles</h2>
    <p>
      Le traitement de vos données est décrit dans la
      <RouterLink to="/confidentialite">politique de confidentialité de Balise</RouterLink> et sur
      la page <RouterLink to="/cookies">Gestion des cookies</RouterLink>.
    </p>

    <h2>Droit applicable</h2>
    <p>
      Ces conditions sont soumises au droit français. En cas de litige, une solution amiable est
      recherchée en priorité.
    </p>

    <h2>Modification des conditions</h2>
    <p>
      L'éditeur peut modifier ces conditions. La version en vigueur est celle publiée sur cette
      page, avec sa date de mise à jour.
    </p>

    <h2>Contact</h2>
    <p>
      Pour toute question, écrivez à
      <a href="mailto:mag.d3v+balise@pm.me">mag.d3v+balise@pm.me</a> ou consultez la
      <RouterLink to="/contact">page Contact</RouterLink>.
    </p>
  </LegalPage>
</template>

<script setup lang="ts">
import LegalPage from '@/components/LegalPage.vue';
</script>
