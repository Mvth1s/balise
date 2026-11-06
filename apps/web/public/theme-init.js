/*
 * Balise: applies the saved theme and animation preference before the first
 * paint. Loaded as a blocking <script src> (the CSP forbids inline scripts).
 * Keys and values must stay in sync with src/lib/theme.ts and src/lib/motion.ts.
 */
(function () {
  var root = document.documentElement;
  var theme = null;
  var motion = null;
  try {
    theme = window.localStorage.getItem('balise:theme');
    motion = window.localStorage.getItem('balise:motion');
  } catch {
    /* Storage unavailable (private mode, blocked cookies): keep the defaults. */
  }
  if (theme === 'light' || theme === 'dark') root.setAttribute('data-theme', theme);
  var reduce;
  try {
    reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    reduce = false;
  }
  root.setAttribute('data-motion', motion === 'off' || reduce ? 'off' : 'on');
})();
