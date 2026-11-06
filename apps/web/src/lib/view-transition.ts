import { nextTick } from 'vue';
import { motionAllowed } from './motion';

/**
 * Runs a DOM update (route change) inside a View Transition when the browser
 * supports it and animations are allowed; otherwise runs it directly.
 */
export async function withViewTransition(update: () => unknown): Promise<void> {
  if (!motionAllowed() || typeof document.startViewTransition !== 'function') {
    await update();
    return;
  }
  const transition = document.startViewTransition(async () => {
    await update();
    await nextTick();
  });
  await transition.updateCallbackDone;
}
