// Which /app routes draw the dashboard kit's own shell (`AppShell`: sidebar,
// topbar, skip link, `<main id="main-content">`). The app layout draws the
// older shell around every other route; drawing it around one of these as well
// puts two sidebars, two skip links and a `<main>` inside a `<main>` on the
// page. `kit-shell.test.ts` fails when a page renders `AppShell` and is not
// matched here.

// Every buyer page, since 27 Sep 2026: the founder's review found two
// different sidebars depending on which page a buyer was on.
const KIT_SHELL = /^\/app(?:\/|$)/;

export function drawsKitShell(pathname: string): boolean {
  return KIT_SHELL.test(pathname);
}
