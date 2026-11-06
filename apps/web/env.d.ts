/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** GA4 measurement id (G-XXXXXXX). Empty: no GA4 code, no consent banner. */
  readonly VITE_GA_MEASUREMENT_ID?: string;
  /** Public origin of the site (https://…), used for canonical URLs and sitemap.xml. */
  readonly VITE_SITE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
