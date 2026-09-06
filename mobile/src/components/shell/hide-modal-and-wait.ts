/** iOS Modal fade is ~300ms; Android often never fires onDismiss. */
export const MODAL_HIDE_FALLBACK_MS = 450;

/**
 * Hide a RN Modal and wait until it is actually gone.
 * Presenting AdMob (or replacing the screen) while the Modal VC is still
 * dismissing leaves a transparent overlay that eats all touches.
 */
export function hideModalAndWait(
  hide: () => void,
  resolverRef: { current: (() => void) | null },
  isVisible = true
): Promise<void> {
  if (!isVisible) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    let settled = false;

    const finish = () => {
      if (settled) {
        return;
      }

      settled = true;
      resolverRef.current = null;
      resolve();
    };

    resolverRef.current = finish;
    hide();
    setTimeout(finish, MODAL_HIDE_FALLBACK_MS);
  });
}
