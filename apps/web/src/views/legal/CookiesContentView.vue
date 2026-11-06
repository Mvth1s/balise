<template>
  <!-- Sources :
    - https://support.google.com/analytics/answer/11397207?hl=fr (consulté le 2026-11-05 : cookies _ga et _ga_<ID>, finalités, durée par défaut 2 ans)
    - https://www.cnil.fr/fr/cookies-et-autres-traceurs/regles/cookies/que-dit-la-loi (consulté le 2026-11-05 : traceurs exemptés de consentement)
    - https://www.cnil.fr/fr/cookies-et-autres-traceurs/regles/cookies-solutions-pour-les-outils-de-mesure-daudience (consulté le 2026-11-05 : durée de vie de 13 mois)
    - https://policies.google.com/privacy/frameworks?hl=fr (consulté le 2026-11-05 : Google LLC certifiée Data Privacy Framework)
  -->
  <!-- Note : l'interrupteur GA4 est rendu par la vue parente (frontend). Ce composant ne contient que le texte informatif. -->
  <section aria-labelledby="cookies-necessaire">
    <h2 id="cookies-necessaire">Stockage nécessaire au fonctionnement</h2>
    <p>
      Toujours actif, exempté de consentement. Balise enregistre dans le stockage local de votre
      navigateur :
    </p>
    <ul>
      <li>votre choix concernant la mesure d'audience ;</li>
      <li>votre thème (clair ou sombre) ;</li>
      <li>votre préférence d'animations ;</li>
      <li>l'état de la liste des critères à vérifier manuellement dans un rapport.</li>
    </ul>
    <p>
      Ces informations restent sur votre appareil. Elles ne sont jamais transmises à Balise ni à un
      tiers. La CNIL exempte de consentement les traceurs qui conservent votre choix sur les cookies
      et ceux qui personnalisent l'interface à votre demande.
    </p>
  </section>

  <section aria-labelledby="cookies-audience">
    <h2 id="cookies-audience">Mesure d'audience (Google Analytics 4)</h2>
    <p>
      Soumise à votre consentement. Elle sert uniquement à savoir combien de personnes visitent
      Balise et quelles pages elles consultent. Aucun usage publicitaire : les signaux Google et la
      personnalisation publicitaire sont désactivés.
    </p>
    <p>
      Tant que vous n'avez pas accepté, aucun script Google n'est chargé et aucun cookie Google
      n'est déposé. Si vous acceptez, les données sont traitées par Google, y compris aux
      États-Unis. Google LLC est certifiée au cadre de protection des données UE–États-Unis (<span
        lang="en"
        >Data Privacy Framework</span
      >).
    </p>

    <table>
      <caption>
        Cookies déposés par Google Analytics 4 si vous acceptez
      </caption>
      <thead>
        <tr>
          <th scope="col">Nom</th>
          <th scope="col">Finalité</th>
          <th scope="col">Émetteur</th>
          <th scope="col">Durée</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <th scope="row"><code>_ga</code></th>
          <td>Distinguer les visiteurs</td>
          <td>Google (Google Analytics 4)</td>
          <td>13 mois au maximum</td>
        </tr>
        <tr>
          <th scope="row"><code>_ga_&lt;ID&gt;</code></th>
          <td>
            Conserver l'état de la session. <code>&lt;ID&gt;</code> correspond à l'identifiant de la
            propriété Google Analytics de Balise.
          </td>
          <td>Google (Google Analytics 4)</td>
          <td>13 mois au maximum</td>
        </tr>
      </tbody>
    </table>
    <p>Par défaut, Google fixe la durée de ces cookies à 2 ans. Balise la limite à 13 mois.</p>
  </section>

  <section aria-labelledby="cookies-choix">
    <h2 id="cookies-choix">Votre choix</h2>
    <p>
      Votre choix est enregistré dans votre navigateur pendant 6 mois. Passé ce délai, la question
      vous est reposée.
    </p>
    <p>
      Vous pouvez modifier ou retirer votre consentement à tout moment avec l'interrupteur « Mesure
      d'audience » de cette page. Si vous le retirez, Balise ne charge plus Google Analytics. Pour
      effacer les cookies <code>_ga</code> et <code>_ga_&lt;ID&gt;</code> déjà déposés, utilisez
      aussi les réglages de votre navigateur.
    </p>
    <p>
      Pour en savoir plus sur les données traitées et vos droits, consultez la
      <RouterLink to="/confidentialite">politique de confidentialité de Balise</RouterLink>.
    </p>
  </section>
</template>
