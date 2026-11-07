<template>
  <footer class="site-footer">
    <div class="container site-footer__inner">
      <nav aria-label="Liens de pied de page">
        <ul>
          <li><RouterLink to="/mentions-legales">Mentions légales</RouterLink></li>
          <li><RouterLink to="/confidentialite">Politique de confidentialité</RouterLink></li>
          <li><RouterLink to="/cookies">Gestion des cookies</RouterLink></li>
          <li>
            <RouterLink to="/accessibilite">Accessibilité : non conforme</RouterLink>
          </li>
          <li><RouterLink to="/conditions-utilisation">Conditions d’utilisation</RouterLink></li>
          <li><RouterLink to="/plan-du-site">Plan du site</RouterLink></li>
          <li><RouterLink to="/contact">Contact</RouterLink></li>
          <li><a href="https://github.com/Mvth1s/balise">Code source</a></li>
        </ul>
      </nav>
      <p>Balise, par Mvth1s. Scores indicatifs, sans valeur de certification RGAA.</p>
    </div>
  </footer>
</template>

<style scoped>
.site-footer {
  border-top: 1px solid var(--color-border);
  margin-top: var(--space-12);
}

.site-footer__inner {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding-block: calc(var(--space-6) + var(--space-2));
  font-size: var(--text-small-size);
  line-height: var(--text-small-line);
  color: var(--color-ink-muted);
}

.site-footer ul {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-6);
  margin: 0;
  padding: 0;
  list-style: none;
}

.site-footer a {
  display: inline-block;
  padding-block: var(--space-1);
}
</style>
