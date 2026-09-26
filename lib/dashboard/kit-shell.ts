// Which /app routes draw the dashboard kit's own shell (`AppShell`: sidebar,
// topbar, skip link, `<main id="main-content">`). The app layout draws the
// older shell around every other route; drawing it around one of these as well
// puts two sidebars, two skip links and a `<main>` inside a `<main>` on the
// page. `kit-shell.test.ts` fails when a page renders `AppShell` and is not
// matched here.

const KIT_SHELL = /^\/app\/(?:discover|products|searches|suppliers\/[^/]+)(?:\/|$)/;

export function drawsKitShell(pathname: string): boolean {
  return KIT_SHELL.test(pathname);
}
