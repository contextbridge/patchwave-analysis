/** Stops link clicks from navigating the test page, while React's own click handlers still run. */
export function suppressNavigation(): () => void {
  const handler = (e: Event) => e.preventDefault();
  document.addEventListener('click', handler, true);
  return () => document.removeEventListener('click', handler, true);
}
