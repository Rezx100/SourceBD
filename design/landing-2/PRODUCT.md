# circle0 — product context

> Inferred from the build brief, the Covex reference (covex-template.webflow.io), the walkthrough video, and the "My Dashboard" image. Assumptions are marked (assumed).

## What circle0 is
A finance operations SaaS for small teams and operators: one dashboard for balances, cash flow, income and expenses, quick transfers, and plan management (the dashboard image shows Smart Wallet, Current Balance, Savings, Income, Expenses, a yearly Cash Flow chart, Quick send, a card, Deposit/Transfer, and an Upgrade Plan panel).

## Audience
Founders, finance leads, and operations managers at small and mid-size companies who want to see money move in one place and act on it (send, request, deposit) without a spreadsheet. (assumed)

## What the marketing site must do
Persuade a visitor to start a free trial or book a demo. Secondary: show integrations, hire, and route to login/sign-up.

## Pages
Home, Pricing, Careers, Integrations, Contact, Login, Sign Up, Forgot Password. All navigation, footer links and CTAs route between these pages.

## Proof the site can use
- Product screenshot: `my dashboard.jpg` (the real dashboard) replaces the reference's app previews everywhere.
- Plans: Basic $15, Premium $45, Pro $85 per month, matching the reference pricing page structure. (placeholder pricing, assumed)
- Integrations, stats, testimonials and jobs are placeholder content in circle0's voice.

## Constraints
- Static front end: HTML, CSS, JavaScript in this folder, no build step, ready for later backend wiring (forms post nowhere yet; `data-endpoint` hooks reserved).
- Light mode only, matching the reference.
- Motion via GSAP + ScrollTrigger from cdnjs; everything must render fully without JavaScript.
- Palette comes from the dashboard image (lime accent, near-black ink, neutral light greys); layout, type scale, radii, spacing and motion come from the reference.
