<template>
  <!-- Sources :
    - https://vercel.com/legal/privacy-policy (consulté le 2026-11-06 : Vercel déclare adhérer au Data Privacy Framework UE–États-Unis et recourir aux clauses contractuelles types si nécessaire)
    - https://upstash.com/trust/privacy.pdf (consulté le 2026-11-06 : Upstash déclare adhérer au Data Privacy Framework UE–États-Unis ; clauses contractuelles types avec ses sous-traitants)
    - https://upstash.com/trust/dpa.pdf (consulté le 2026-11-06 : Upstash, Inc., société du Delaware)
    - https://policies.google.com/privacy/frameworks?hl=fr (consulté le 2026-11-06 : Google LLC certifiée Data Privacy Framework ; clauses contractuelles types)
    - https://support.google.com/analytics/answer/7667196?hl=fr (consulté le 2026-11-06 : conservation des données GA4, 2 ou 14 mois)
    - https://www.cnil.fr/fr/saisir-la-cnil/nous-contacter (consulté le 2026-11-06 : adresse postale de la CNIL)
    - https://www.cnil.fr/fr/plaintes (consulté le 2026-11-06 : plainte en ligne)
    - server/rate-limit.ts (fenêtre glissante d'1 heure, clé HMAC-SHA-256 de l'IP avec sel secret) (consulté le 2026-11-06)
  -->
  <LegalPage title="Politique de confidentialité" updated="2026-11-06">
    <p>
      Cette page explique quelles données Balise traite, pourquoi, combien de temps, et quels sont
      vos droits. Elle répond à l'article 13 du règlement général sur la protection des données
      (RGPD).
    </p>

    <h2>Responsable du traitement</h2>
    <p>
      Le responsable du traitement est Mvth1s, éditeur de Balise à titre non professionnel. Contact
      :
      <a href="mailto:mag.d3v+balise@pm.me">mag.d3v+balise@pm.me</a>.
    </p>

    <h2>Données traitées</h2>

    <h3>Quand vous lancez une analyse</h3>
    <ul>
      <li>L'adresse (URL) de la page que vous demandez d'analyser.</li>
      <li>
        Le rapport produit : résultats des tests, extraits du code HTML de la page analysée et
        capture d'écran de cette page.
      </li>
      <li>
        Une empreinte de votre adresse IP, calculée par une fonction de hachage à clé (HMAC). Votre
        adresse IP n'est jamais stockée en clair. Cette empreinte sert uniquement à limiter le
        nombre d'analyses.
      </li>
      <li>
        Votre adresse IP et des informations techniques de connexion (navigateur, date, page
        demandée), traitées par l'hébergeur Vercel pour acheminer les requêtes et tenir ses journaux
        techniques.
      </li>
    </ul>
    <p>Balise ne vous demande ni compte, ni nom, ni adresse électronique pour analyser une page.</p>
    <p>
      La seule donnée que vous devez fournir est l'adresse de la page à analyser : sans elle,
      l'analyse est impossible. Le refus de la mesure d'audience n'a aucune conséquence sur l'usage
      de Balise.
    </p>

    <h3>Préférences enregistrées dans votre navigateur</h3>
    <p>
      Balise mémorise dans le stockage local de votre navigateur votre thème, votre préférence
      d'animations, votre choix concernant la mesure d'audience et l'état de la liste des critères à
      vérifier manuellement. Ces informations restent sur votre appareil. Elles ne sont jamais
      transmises à Balise ni à un tiers.
    </p>

    <h3>Mesure d'audience, uniquement si vous l'acceptez</h3>
    <p>
      Si vous acceptez la mesure d'audience, Google Analytics 4 collecte des données de navigation :
      pages consultées, informations techniques sur votre navigateur et votre appareil, identifiants
      enregistrés dans des cookies. Sans votre accord, aucun script Google n'est chargé. Le détail
      figure sur la page
      <RouterLink to="/cookies">Gestion des cookies</RouterLink>.
    </p>

    <h3>Une précaution importante</h3>
    <p>
      N'analysez pas de pages qui contiennent des données personnelles non publiques. Balise
      enregistre une capture d'écran et des extraits du code de la page analysée. Ces éléments sont
      visibles par toute personne qui possède le lien du rapport.
    </p>

    <h2>Finalités et bases légales</h2>
    <table>
      <caption>
        Finalités des traitements et bases légales correspondantes
      </caption>
      <thead>
        <tr>
          <th scope="col">Finalité</th>
          <th scope="col">Données</th>
          <th scope="col">Base légale</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <th scope="row">Réaliser l'analyse et afficher le rapport</th>
          <td>URL analysée, rapport, capture d'écran</td>
          <td>Intérêt légitime : fournir le service que vous demandez</td>
        </tr>
        <tr>
          <th scope="row">Limiter le nombre d'analyses et protéger le service contre les abus</th>
          <td>Empreinte (HMAC) de l'adresse IP</td>
          <td>Intérêt légitime : sécurité et disponibilité du service</td>
        </tr>
        <tr>
          <th scope="row">Journaux techniques de l'hébergeur</th>
          <td>Adresse IP, navigateur, date, page demandée</td>
          <td>Intérêt légitime : sécurité et fonctionnement du service</td>
        </tr>
        <tr>
          <th scope="row">Mémoriser vos préférences</th>
          <td>Thème, animations, choix de consentement, liste de vérification</td>
          <td>Intérêt légitime ; stockage strictement nécessaire, exempté de consentement</td>
        </tr>
        <tr>
          <th scope="row">Mesurer l'audience</th>
          <td>Données de navigation collectées par Google Analytics 4</td>
          <td>Consentement, que vous pouvez retirer à tout moment</td>
        </tr>
      </tbody>
    </table>

    <h2>Durées de conservation</h2>
    <table>
      <caption>
        Durée de conservation de chaque catégorie de données
      </caption>
      <thead>
        <tr>
          <th scope="col">Données</th>
          <th scope="col">Durée</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <th scope="row">Rapports et captures d'écran</th>
          <td>30 jours, puis suppression automatique</td>
        </tr>
        <tr>
          <th scope="row">Empreinte de l'adresse IP</th>
          <td>
            2 heures au plus : les compteurs de la fenêtre glissante d'une heure expirent au bout de
            deux fenêtres
          </td>
        </tr>
        <tr>
          <th scope="row">Journaux techniques de l'hébergeur</th>
          <td>
            [À COMPLÉTER : durée de conservation des journaux de requêtes par Vercel ; journaux
            d'exécution consultables 1 heure sur l'offre Hobby]
          </td>
        </tr>
        <tr>
          <th scope="row">Choix concernant la mesure d'audience</th>
          <td>6 mois, puis la question vous est reposée</td>
        </tr>
        <tr>
          <th scope="row">Autres préférences locales</th>
          <td>Jusqu'à ce que vous les effaciez dans votre navigateur</td>
        </tr>
        <tr>
          <th scope="row">Cookies Google Analytics 4</th>
          <td>13 mois au maximum</td>
        </tr>
        <tr>
          <th scope="row">Données Google Analytics 4 conservées par Google</th>
          <td>
            [À COMPLÉTER : durée de conservation configurée dans la propriété GA4 (2 ou 14 mois)]
          </td>
        </tr>
      </tbody>
    </table>

    <h2>Destinataires</h2>
    <p>Seul l'éditeur accède aux données. Elles sont traitées par les prestataires suivants :</p>
    <ul>
      <li>
        <strong>Vercel Inc.</strong> (États-Unis) : hébergement du site et exécution des analyses.
        Les fonctions serveur s'exécutent dans la région de Paris.
      </li>
      <li>
        <strong>Upstash, Inc.</strong> (États-Unis) : stockage des rapports et des compteurs de
        limitation de débit, dans une base de données située en Europe.
      </li>
      <li>
        <strong>Google Ireland Limited</strong> et <strong>Google LLC</strong> : mesure d'audience,
        uniquement si vous l'acceptez. Les signaux Google et la personnalisation publicitaire sont
        désactivés.
      </li>
    </ul>
    <p>
      Par ailleurs, toute personne qui possède le lien d'un rapport peut le consulter pendant 30
      jours.
    </p>

    <h2>Transferts hors de l'Union européenne</h2>
    <p>
      Vercel, Upstash et Google sont des sociétés américaines. Des données peuvent donc être
      transférées ou rendues accessibles aux États-Unis. Ces transferts sont encadrés ainsi :
    </p>
    <ul>
      <li>
        Vercel Inc. déclare adhérer au cadre de protection des données UE–États-Unis (<span
          lang="en"
          >Data Privacy Framework</span
        >) et recourir, si nécessaire, aux clauses contractuelles types de la Commission européenne.
      </li>
      <li>
        Upstash, Inc. déclare adhérer au cadre de protection des données UE–États-Unis. Elle impose
        des clauses contractuelles types à ses propres sous-traitants.
      </li>
      <li>
        Google LLC est certifiée au cadre de protection des données UE–États-Unis et s'appuie aussi
        sur les clauses contractuelles types.
      </li>
    </ul>
    <p>
      La liste officielle des organismes certifiés est publiée sur
      <a href="https://www.dataprivacyframework.gov/list"
        >le site du Data Privacy Framework (dataprivacyframework.gov, en anglais)</a
      >.
    </p>
    <p>
      Vous pouvez obtenir une copie des garanties applicables (clauses contractuelles types) en
      écrivant à <a href="mailto:mag.d3v+balise@pm.me">mag.d3v+balise@pm.me</a>.
    </p>

    <h2>Vos droits</h2>
    <p>Vous disposez des droits suivants sur vos données :</p>
    <ul>
      <li>droit d'accès ;</li>
      <li>droit de rectification ;</li>
      <li>droit à l'effacement ;</li>
      <li>droit à la limitation du traitement ;</li>
      <li>droit d'opposition aux traitements fondés sur l'intérêt légitime ;</li>
      <li>
        droit de retirer votre consentement à la mesure d'audience, à tout moment, sur la page
        <RouterLink to="/cookies">Gestion des cookies</RouterLink> ;
      </li>
      <li>droit à la portabilité, lorsqu'il s'applique.</li>
    </ul>
    <p>
      Pour exercer ces droits, écrivez à
      <a href="mailto:mag.d3v+balise@pm.me">mag.d3v+balise@pm.me</a>. Pour la suppression d'un
      rapport, indiquez son lien. Balise ne vous identifie pas : l'empreinte de votre adresse IP ne
      permet pas de retrouver vos analyses, et elle disparaît au bout de deux heures au plus.
    </p>

    <h2>Décision automatisée</h2>
    <p>
      Balise ne prend aucune décision automatisée produisant des effets juridiques à votre égard, et
      ne fait pas de profilage. Les scores portent sur la page analysée, pas sur vous.
    </p>

    <h2>Réclamation auprès de la CNIL</h2>
    <p>
      Si vous estimez que vos droits ne sont pas respectés, vous pouvez adresser une réclamation à
      la Commission nationale de l'informatique et des libertés (CNIL) :
    </p>
    <ul>
      <li>
        en ligne :
        <a href="https://www.cnil.fr/fr/plaintes">adresser une plainte sur le site de la CNIL</a>
        ;
      </li>
      <li>
        par courrier :
        <address>
          Commission nationale de l'informatique et des libertés<br />
          3 Place de Fontenoy<br />
          75007 Paris
        </address>
      </li>
    </ul>

    <h2>Modification de cette politique</h2>
    <p>Cette politique peut évoluer. La date de dernière mise à jour figure en haut de la page.</p>
  </LegalPage>
</template>

<script setup lang="ts">
import LegalPage from '@/components/LegalPage.vue';
</script>
