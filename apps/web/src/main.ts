import { createHead as createClientHead } from '@unhead/vue/client';
import { createHead as createServerHead } from '@unhead/vue/server';
import { ViteSSG } from 'vite-ssg';
import App from './App.vue';
import { routes, scrollBehavior } from './router';
import '@fontsource-variable/atkinson-hyperlegible-next/wght.css';
import '@fontsource-variable/jetbrains-mono/wght.css';
import './styles/tokens.css';
import './styles/base.css';

export const createApp = ViteSSG(
  App,
  { routes, scrollBehavior },
  (ctx) => {
    // vite-ssg ships @unhead/vue 2; Balise uses @unhead/vue 3 (rendered by vite.config.ts).
    const head = import.meta.env.SSR ? createServerHead() : createClientHead();
    ctx.app.use(head);
    Object.assign(ctx, { unhead: head });
  },
  { useHead: false, hydration: true },
);
