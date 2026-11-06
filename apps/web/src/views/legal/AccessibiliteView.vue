<template>
  <!-- Sources :
    - https://accessibilite.numerique.gouv.fr/obligations/declaration-accessibilite/ (consulté le 2026-11-05 : structure du modèle de déclaration)
    - https://www.defenseurdesdroits.fr/nous-contacter-355 (consulté le 2026-11-05 : formulaire, Acceo, délégués, téléphone, adresse Libre réponse)
  -->
  <LegalPage title="Déclaration d'accessibilité" updated="2026-11-06">
    <p>
      Mvth1s s'engage à rendre son service Balise accessible, conformément à l'esprit de l'article
      47 de la loi n° 2005-102 du 11 février 2005.
    </p>
    <p>
      Balise n'est pas un service public. L'obligation légale de publier cette déclaration ne
      s'applique donc pas forcément à Balise. Elle est publiée par engagement : un outil qui mesure
      l'accessibilité doit rendre compte de la sienne.
    </p>
    <p>Cette déclaration d'accessibilité s'applique au site Balise.</p>

    <h2>État de conformité</h2>
    <p>
      Balise est <strong>partiellement conforme</strong> avec le référentiel général d'amélioration
      de l'accessibilité (RGAA), version 4.1.2.
    </p>
    <p>
      Ce statut est provisoire. L'audit manuel complet de Balise reste à réaliser. Tant qu'il n'est
      pas fait, aucune conformité totale n'est revendiquée.
    </p>

    <h2>Résultats des tests</h2>
    <p>[À COMPLÉTER : résultats de l'audit manuel — taux de conformité, date, auditeur]</p>
    <p>
      En attendant cet audit, chaque page de Balise est testée automatiquement à chaque modification
      du code. Ces tests vérifient l'absence d'erreur détectable automatiquement, la navigation
      complète au clavier, l'affichage avec un zoom à 200 %, l'affichage sur un écran de 320 pixels
      de large et le respect de la préférence de réduction des animations. Ces tests automatiques ne
      remplacent pas un audit manuel.
    </p>

    <h2>Contenus non accessibles</h2>

    <h3>Non-conformités</h3>
    <p>[À COMPLÉTER : liste des non-conformités relevées lors de l'audit manuel]</p>

    <h3>Dérogations pour charge disproportionnée</h3>
    <p>Aucune.</p>

    <h3>Contenus non soumis à l'obligation d'accessibilité</h3>
    <ul>
      <li>
        <p>
          La page de démonstration « avant » (adresse <code>/demo/avant</code>) contient
          volontairement des erreurs d'accessibilité. Elle sert à montrer ce que Balise détecte, à
          des fins pédagogiques. Elle est signalée par un bandeau d'avertissement et n'est pas
          indexée par les moteurs de recherche. Cette exclusion est un choix éditorial : cette page
          n'a pas d'autre fonction que la démonstration, et sa version corrigée offre le même
          contenu.
        </p>
        <p>
          Sa version corrigée est disponible :
          <RouterLink to="/demo/apres">page de démonstration corrigée (après)</RouterLink>.
        </p>
      </li>
      <li>
        Les captures d'écran et extraits de code des pages analysées, affichés dans les rapports,
        proviennent de sites tiers. Balise n'en maîtrise pas le contenu. Les extraits de code sont
        affichés sous forme de texte.
      </li>
    </ul>

    <h2>Établissement de cette déclaration</h2>
    <p>Cette déclaration a été établie le 5 novembre 2026.</p>

    <h3>Technologies utilisées pour la réalisation de Balise</h3>
    <ul>
      <li>HTML</li>
      <li>CSS</li>
      <li>JavaScript</li>
      <li>Vue</li>
    </ul>

    <h3>Environnement de test</h3>
    <p>
      [À COMPLÉTER : agents utilisateurs et technologies d'assistance utilisés pour l'audit manuel]
    </p>

    <h3>Outils utilisés pour évaluer l'accessibilité</h3>
    <ul>
      <li>axe-core, moteur de tests d'accessibilité automatiques</li>
      <li>
        tests automatisés Playwright : parcours au clavier, zoom à 200 %, largeur de 320 pixels,
        réduction des animations
      </li>
    </ul>

    <h3>Pages du site ayant fait l'objet de la vérification de conformité</h3>
    <ul>
      <li><RouterLink to="/">Accueil</RouterLink></li>
      <li>Analyse en cours (écran affiché pendant une analyse)</li>
      <li>Rapport d'analyse (écran affiché à la fin d'une analyse)</li>
      <li><RouterLink to="/demo/apres">Page de démonstration corrigée</RouterLink></li>
      <li><RouterLink to="/mentions-legales">Mentions légales</RouterLink></li>
      <li><RouterLink to="/confidentialite">Politique de confidentialité</RouterLink></li>
      <li>
        <RouterLink to="/cookies">Gestion des cookies</RouterLink>, avec le bandeau de consentement
      </li>
      <li><RouterLink to="/accessibilite">Déclaration d'accessibilité</RouterLink></li>
      <li><RouterLink to="/conditions-utilisation">Conditions d'utilisation</RouterLink></li>
      <li><RouterLink to="/plan-du-site">Plan du site</RouterLink></li>
      <li><RouterLink to="/contact">Contact</RouterLink></li>
    </ul>

    <h2>Retour d'information et contact</h2>
    <p>
      Si vous n'arrivez pas à accéder à un contenu ou à un service de Balise, contactez l'éditeur.
      Vous serez orienté vers une alternative accessible ou vous obtiendrez le contenu sous une
      autre forme.
    </p>
    <ul>
      <li>
        Par courriel :
        <a href="mailto:mag.d3v+balise@pm.me">mag.d3v+balise@pm.me</a>
      </li>
      <li>
        Par le
        <a href="https://github.com/Mvth1s/balise/issues"
          >suivi des problèmes du dépôt GitHub de Balise</a
        >
        (un compte GitHub est nécessaire)
      </li>
    </ul>

    <h2>Voies de recours</h2>
    <p>
      Si vous avez signalé un défaut d'accessibilité qui vous empêche d'accéder à un contenu ou à un
      service, et que vous n'avez pas obtenu de réponse satisfaisante, vous pouvez :
    </p>
    <ul>
      <li>
        écrire un message au Défenseur des droits avec
        <a href="https://formulaire.defenseurdesdroits.fr/formulaire_saisine/"
          >le formulaire de saisine en ligne du Défenseur des droits</a
        >
        ;
      </li>
      <li>
        contacter le délégué du Défenseur des droits dans votre région, grâce à
        <a href="https://www.defenseurdesdroits.fr/carte-des-delegues"
          >la carte des délégués du Défenseur des droits</a
        >
        ;
      </li>
      <li>
        appeler le Défenseur des droits au <a href="tel:+33969390000">09 69 39 00 00</a>, du lundi
        au vendredi de 8 h 30 à 19 h 30 (coût d'un appel local) ;
      </li>
      <li>
        si vous êtes sourd ou malentendant, utiliser
        <a href="https://www.acce-o.fr/client/defenseur-des-droits"
          >le service Acceo du Défenseur des droits</a
        >
        (transcription instantanée, langue des signes française ou langue française parlée
        complétée) ;
      </li>
      <li>
        envoyer un courrier par la poste, gratuit et sans timbre :
        <address>
          Défenseur des droits<br />
          Libre réponse 71120<br />
          75342 Paris CEDEX 07
        </address>
      </li>
    </ul>
  </LegalPage>
</template>

<script setup lang="ts">
import LegalPage from '@/components/LegalPage.vue';
</script>
