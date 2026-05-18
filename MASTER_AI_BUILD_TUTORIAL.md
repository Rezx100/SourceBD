# The Master AI-Assisted Build Tutorial

> A universal, noob-friendly playbook for shipping **any** application with an AI coding agent — using the same battle-tested **spec-driven development** process used to ship a real production reference app, but distilled so it works whether you're building a todo app, a SaaS, a multiplayer game, a CLI tool, a mobile app, or a back-office dashboard.
>
> You will be the **architect**. The AI will be the **typist**. By the end of this tutorial you'll have a repeatable system you can use for every project you ever build.
>
> This document is itself an instruction set for your AI agent. Drop it into your project (or paste sections into your context files) and the agent will follow the same discipline that makes senior engineers ship working software with AI instead of half-broken demos.

---

## Table of Contents

1. [Read this first — the only philosophy that matters](#1-read-this-first--the-only-philosophy-that-matters)
2. [The universal toolbox (and the "only-if-you-need-it" rule)](#2-the-universal-toolbox-and-the-only-if-you-need-it-rule)
3. [Phase 0 — Discover what you're really building](#3-phase-0--discover-what-youre-really-building)
4. [Phase 1 — Project bootstrap](#4-phase-1--project-bootstrap)
5. [Phase 2 — Pick and configure your AI agent](#5-phase-2--pick-and-configure-your-ai-agent)
6. [Phase 3 — Clean the boilerplate](#6-phase-3--clean-the-boilerplate)
7. [Phase 4 — Build the six-file CONTEXT system (universal version)](#7-phase-4--build-the-six-file-context-system-universal-version)
8. [Phase 5 — The "Spec → Prompt → Verify → Push" loop](#8-phase-5--the-spec--prompt--verify--push-loop)
9. [Phase 6 — How to write a great spec file](#9-phase-6--how-to-write-a-great-spec-file)
10. [Phase 7 — The standard prompts (copy/paste)](#10-phase-7--the-standard-prompts-copypaste)
11. [Phase 8 — Foundation specs every app needs](#11-phase-8--foundation-specs-every-app-needs)
12. [Phase 9 — The conditional-stack decision tree](#12-phase-9--the-conditional-stack-decision-tree)
13. [Phase 10 — Source control + AI code review](#13-phase-10--source-control--ai-code-review)
14. [Phase 11 — The debugging discipline (current-issues.md)](#14-phase-11--the-debugging-discipline-current-issuesmd)
15. [Phase 12 — Security & secrets — the non-negotiables](#15-phase-12--security--secrets--the-non-negotiables)
16. [Phase 13 — Polishing pass](#16-phase-13--polishing-pass)
17. [Phase 14 — Going to production](#17-phase-14--going-to-production)
18. [Phase 15 — Common stuck-points and rescue prompts](#18-phase-15--common-stuck-points-and-rescue-prompts)
19. [Appendix A — Universal AGENTS.md template](#19-appendix-a--universal-agentsmd-template)
20. [Appendix B — Universal spec template](#20-appendix-b--universal-spec-template)
21. [Appendix C — Cheat sheet](#21-appendix-c--cheat-sheet)

---

## 1. Read this first — the only philosophy that matters

Most people open an AI agent and type "build me a SaaS app." That works for a weekend, but a week later the agent forgets what it did, breaks features, and you're stuck.

Senior engineers do the opposite. Before any code, they:

1. **Talk through** the system with a planning AI (ChatGPT / Claude / Gemini). Push back on its answers. Make the system clear in your head first.
2. **Write it down** in a small set of "context" documents that travel with the project forever.
3. **Break the build into tiny units** (a "spec"). Each spec is small enough to ship in one focused session, with a checklist of what "done" means.
4. **Give one spec at a time** to the coding agent in a single prompt. Verify against the checklist. Commit. Move on.

This is **spec-driven development**. The agent stops guessing because it always has:

- The big picture (what the app is for)
- The rules (how to write code, what visuals to use, what tools to reach for)
- The current state (what's done, what's next)
- The exact tiny task it must do *right now*

You stay the architect. The agent is the typist. **This single discipline matters more than which framework, language, or AI model you pick.**

> If you remember nothing else from this tutorial, remember: **one spec → one fresh chat → verify → commit → move on.**

---

## 2. The universal toolbox (and the "only-if-you-need-it" rule)

Below is the menu. **You do NOT need all of these for every app.** The whole point of this tutorial is that the agent must consciously *choose* which tools belong to your app and ignore the rest. After phase 3 you will fill in your `architecture.md` and the agent will use only what's listed there.

| Concern | Common picks | Use it when… |
|---|---|---|
| Code editor | VS Code, Cursor, Windsurf | Always |
| AI coding agent | Claude Code, GitHub Copilot, Codex, Cursor agent | Always |
| Version control | Git + GitHub / GitLab | Always |
| AI code review | CodeRabbit, GitHub Copilot reviews | Always (it's free for personal use and catches real bugs) |
| Web framework (full-stack) | Next.js, Remix, SvelteKit, Nuxt | Building a website or SaaS |
| Front-end only | React + Vite, Vue, Svelte | SPA with a separate backend |
| Back-end only | Node + Hono/Fastify/Express, FastAPI, Go, Django | API-only product or services |
| Mobile | Expo (React Native), Flutter, SwiftUI, Kotlin | Native apps |
| Desktop | Electron, Tauri | Cross-platform desktop |
| CLI / tool | Node + commander, Python + click, Go + cobra, Rust + clap | Local utility |
| Styling | Tailwind CSS + shadcn/ui, Chakra, MUI, vanilla CSS | Any UI |
| Auth | Clerk, Auth.js (NextAuth), Supabase Auth, Firebase Auth, Lucia, custom JWT | App needs sign-in |
| Database (relational) | Postgres + Prisma / Drizzle, SQLite + Prisma, Supabase | Structured data with relationships |
| Database (document) | MongoDB + Mongoose, Firestore, DynamoDB | Flexible schemas, hierarchical docs |
| Real-time / multiplayer | Liveblocks, Supabase Realtime, Pusher, Ably, raw WebSockets, Socket.IO | Cursors, chat, syncing state |
| Background / long jobs | Trigger.dev, Inngest, BullMQ, Cloudflare Queues, Celery | Tasks > 30 s, scheduled jobs, retries |
| AI model SDK | Vercel AI SDK + OpenAI / Anthropic / Google, OpenRouter, Replicate | App calls an LLM or generative model |
| File / blob storage | Vercel Blob, S3 (AWS / Cloudflare R2 / Backblaze), Supabase Storage | Uploading or generating large files |
| Email | Resend, Postmark, SendGrid | Transactional email |
| Payments | Stripe, Paddle, Lemon Squeezy | Charging customers |
| Analytics | PostHog, Plausible, Vercel Analytics | Product/usage insight |
| Error tracking | Sentry, Highlight | Production observability |
| Hosting | Vercel, Netlify, Cloudflare, Fly.io, Railway, Render, AWS, your VPS | Deploying |
| Containers | Docker | Reproducible runtime / VPS |
| Testing | Vitest / Jest, Playwright / Cypress, pytest | Anything beyond a throwaway |

> **The rule:** every tool you add becomes a thing your agent might mis-wire later. Add the smallest set that gets the job done. You can always add more in a future spec.

---

## 3. Phase 0 — Discover what you're really building

Before you create a folder, open a planning AI (ChatGPT / Claude / Gemini) and have a conversation. Don't accept the first answer; push back.

Ask yourself, out loud or in writing, every one of these:

1. **One sentence:** what does this app do for whom?
2. **Top 3 user goals.** What must a user be able to accomplish?
3. **The core user flow** — step by step, from "opens the app" to "task complete."
4. **In-scope features** for v1.
5. **Out-of-scope features** — things you will *not* build now (billing, teams, history, dark mode, etc.).
6. **Data shape.** What persists? What is ephemeral?
7. **Multi-user?** Solo, multi-user with roles, or real-time multiplayer?
8. **Offline?** Does it need to work without internet?
9. **AI features?** Yes/no. If yes, what task — generation, classification, summarization, agentic?
10. **Platform.** Web, mobile, desktop, CLI, all of the above?
11. **Scale assumption.** 10 users? 10k? 10M? (Be honest — overbuilding kills projects.)
12. **Success criteria.** How will you know the v1 is done? Write 3–5 black-and-white statements.

Save the answers. They will feed directly into `project-overview.md` (Phase 4).

> Don't skip this. Vagueness here = drift later. The clearer you write your goals, the smarter your agent will look.

---

## 4. Phase 1 — Project bootstrap

1. Create an empty folder named after your project. Open it in VS Code.
2. Open the integrated terminal: **Ctrl + `** (backtick).
3. Initialize the project with the official starter for your stack:

   - Next.js: `npx create-next-app@latest .`
   - Vite (React/Vue/Svelte): `npm create vite@latest .`
   - Remix: `npx create-remix@latest .`
   - SvelteKit: `npm create svelte@latest .`
   - Expo: `npx create-expo-app@latest .`
   - Astro: `npm create astro@latest .`
   - Node CLI: `npm init -y` then add `tsx`, `typescript`, `commander`.
   - Python: `python -m venv .venv` + `pip install -e .` with a `pyproject.toml`.
   - Go: `go mod init <module>`.
   - Rust: `cargo init`.

4. Run the dev / build command and confirm the starter loads (e.g. http://localhost:3000).
5. Initialize git: `git init`, then make a first commit `git commit -m "chore: initial scaffold"`.
6. Push to a new GitHub repo (Phase 10 covers CI / review).

> Whatever stack you chose, **make a note of it now** — you'll write it into `architecture.md` next.

---

## 5. Phase 2 — Pick and configure your AI agent

Pick ONE of: **Claude Code**, **GitHub Copilot (Agent mode)**, **Codex**, **Cursor**, **Windsurf**.

In VS Code, open the chat panel (**Ctrl/Cmd + Shift + I**). Make sure:

- The agent is in **Agent mode** (not just Ask).
- A capable model is selected (Sonnet 4.x, GPT-5-class, Gemini 2.5 Pro — anything modern).
- **Auto-accept edits** is on (or, in the first message, say "edit files directly without asking permission for each one").

> **Pick one and stick with it for the project.** Each agent reads slightly different rule files (Claude → `CLAUDE.md`, Cursor → `.cursorrules`, Windsurf → `.windsurfrules`, Copilot/Codex → `AGENTS.md`). The *content* of the rules is identical — only the filename changes. This tutorial uses `AGENTS.md`; rename if your agent expects something else.

---

## 6. Phase 3 — Clean the boilerplate

Almost every starter dumps demo content. Open the agent chat and paste:

```
Clean up the starter boilerplate for this project:
- Remove example/marketing content from the entry pages.
- Keep core config files (build, lint, formatter) intact.
- Reduce stylesheets to the framework's directives + a single global reset only.
- Delete unused images/SVGs in the public/static folder, but keep the favicon.
- Replace the entry page with a minimal placeholder showing "<Project name>".
- Do not add any new dependencies.
```

Run, confirm the page still loads, commit.

---

## 7. Phase 4 — Build the six-file CONTEXT system (universal version)

This is the most important step in the entire tutorial. Skip it and the agent will drift on day three.

Create a folder `context/` in the project root with these six files. Then create `AGENTS.md` (or `CLAUDE.md` / `.cursorrules` / `.windsurfrules`) at the root.

```
context/
├─ project-overview.md        ← what & why
├─ architecture.md             ← how it's wired
├─ code-standards.md           ← how code must look
├─ ai-workflow-rules.md        ← how the agent must behave
├─ ui-context.md               ← how it must look (skip for non-UI projects)
└─ progress-tracker.md         ← what's done, what's next
AGENTS.md                      ← entry point at project root
```

> If your project has no UI (CLI, library, backend service), replace `ui-context.md` with `api-context.md` describing endpoint conventions, error shapes, response envelopes, and CLI flag patterns.

### 7.1 `project-overview.md`

Paste the answers from Phase 0. Structure:

```markdown
# Project overview

## One-sentence pitch
…

## Goals
1. …
2. …

## Core user flow
1. …
2. …

## Features (v1, in scope)
- …

## Out of scope (v1)
- …

## Success criteria
- …
```

### 7.2 `architecture.md`

The blueprint. Be ruthless about listing **only** the tools your app actually needs from the menu in Phase 2.

```markdown
# Architecture

## Tech stack
- Language: …
- Framework: …
- Styling: …
- Auth: … (or "none — public app")
- Database: … (or "none — stateless")
- Real-time: … (or "none")
- Background jobs: … (or "none")
- AI: … (or "none")
- File storage: … (or "none")
- Hosting: …

## System boundaries
- API routes live in: …
- Background tasks live in: …
- Shared utilities in: …
- UI components in: …
- Tests in: …

## Storage model
- Persistent metadata: …
- Large blobs / files: …
- Cache / ephemeral: …

## Invariants (rules that must NEVER be broken)
- …
- …
```

> Make explicit what is **out** of the architecture. e.g. "No background job system — every request must complete within the request lifecycle." This stops the agent reaching for tools you don't want.

### 7.3 `code-standards.md`

```markdown
# Code standards

- Language strict mode on (TypeScript strict / mypy strict / Rust deny warnings).
- No `any` / no untyped exports.
- File naming: kebab-case.
- Component / class naming: PascalCase. Variables / functions: camelCase (or snake_case in Python/Go).
- Imports ordered: std lib → third-party → local.
- No hard-coded secrets or URLs — use env vars.
- Use the project's design tokens / theme variables; no raw color literals.
- Single helper for class-name composition (e.g. `cn` in TS, `clsx` + `tailwind-merge`).
- Errors are typed and propagated, not swallowed.
- Public functions / endpoints have doc comments stating purpose, inputs, outputs.
```

### 7.4 `ai-workflow-rules.md`

```markdown
# AI workflow rules

- Work on EXACTLY one feature spec at a time. Never combine specs.
- Read AGENTS.md and every file in /context/ BEFORE writing code.
- Mark the spec "in progress" in progress-tracker.md before coding.
- If the spec is ambiguous: STOP and ask one clarifying question. Do not invent features.
- Do not introduce new tools, packages, or services that are not listed in architecture.md.
- After completion: run the build/test command, fix anything broken, then mark the spec "complete".
- Keep changes contained to the files the spec calls out. Drive-by refactors are not allowed.
- Never commit secrets. Never commit /context/current-issues.md.
- When fixing a bug, propose a hypothesis FIRST, wait for approval, THEN execute.
```

### 7.5 `ui-context.md`  (or `api-context.md` for non-UI projects)

For UIs:

```markdown
# UI context

## Theme
- Mode: dark | light | both
- Color tokens: --color-bg, --color-surface, --color-border, --color-text, --color-text-muted, --color-accent, --color-danger, --color-success
- Typography: heading font, body font, scale (text-xs … text-3xl)
- Radius scale: sm, md, lg, full
- Shadow scale: sm, md, lg
- Spacing scale: 1=4px, 2=8px, …

## Component primitives in use
- shadcn/ui (or your library), lucide-react icons

## Layout language
- App shell composition (navbar / sidebar / main / footer)
- Modal / dialog / toast patterns

## Visual rules
- No raw color literals; always tokens.
- No drop-shadows on flat elements.
- All interactive elements must have a focus ring + hover state.
- Keyboard accessible (tab order, escape closes modals, enter submits).
```

For backends/CLIs:

```markdown
# API context

## Response envelope
{ data, error: null } or { data: null, error: { code, message } }

## Status code policy
2xx success / 4xx caller error / 5xx server error.

## Authentication
- Header: Authorization: Bearer <token>
- Errors: 401 unauthenticated / 403 forbidden

## Versioning
- /api/v1/…

## CLI flag conventions
- kebab-case long flags, single-letter shorts where standard.
- --json for machine output, --quiet to suppress banners.
```

### 7.6 `progress-tracker.md`

Start almost empty:

```markdown
# Progress tracker

## Current phase
Foundation

## Current goal
(empty)

## Completed
(none yet)

## To do (next)
- 01 — design system (or first foundation spec)

## Architectural decisions
(empty)

## Session notes
(empty)
```

This is the **only** file that updates constantly. It's how a brand-new chat tomorrow can pick up exactly where you left off.

### 7.7 `AGENTS.md` (project root)

See [Appendix A](#19-appendix-a--universal-agentsmd-template) for the full universal template. Drop it in unchanged.

---

## 8. Phase 5 — The "Spec → Prompt → Verify → Push" loop

For the rest of the project, every feature follows this recipe. Burn it into your head.

1. **Make a folder** `context/feature-specs/` if it doesn't exist.
2. **Create a new spec file** named `NN-feature-name.md` (numbered).
3. **Write the spec** following the template in [Appendix B](#20-appendix-b--universal-spec-template).
4. **Open a fresh chat** in your agent. Drop the spec file in. Send the standard prompt (see Phase 7).
5. **Watch and approve** any tool/permission prompts.
6. **Verify** by running the build/test/dev command and walking through the verification checklist in the spec.
7. **Fix issues** by writing a tiny corrective prompt OR by creating `context/current-issues.md` (see Phase 11).
8. **Push** to a `development` branch and open a PR to `main`. Let the AI reviewer (CodeRabbit) comment.
9. **Merge** when green.

> Always start a **fresh chat** per spec. Stale context is the #1 cause of agent drift.

---

## 9. Phase 6 — How to write a great spec file

A bad spec produces a bad implementation no matter how smart your model is. Every spec MUST have these five sections. Use [Appendix B](#20-appendix-b--universal-spec-template) as the literal template:

1. **Goal** — one or two sentences. What does "done" look like?
2. **Design decisions** — bullets. Visual decisions, layout, the *named* pattern to use, the named tools allowed.
3. **Implementation** — bullets, file by file. List the files to create or edit. Spell out behavior. Include the small rules that the agent will otherwise get wrong (e.g. "use `proxy.ts` not `middleware.ts` because Next.js 16+", "drop handlers on the OUTER wrapper, not on the React Flow component").
4. **Out of scope** — bullets explicitly forbidding things you don't want now ("do NOT add API calls in this spec", "do NOT touch authentication").
5. **Verification** — checklist. "Build passes", "Lint passes", "Walking through user flow X works", "Two browsers in the same room see each other's cursors", etc.

A good rule: **a spec should fit on one screen.** If it doesn't, split it into two specs.

---

## 10. Phase 7 — The standard prompts (copy/paste)

### Standard spec prompt (use for every spec)

```
Read AGENTS.md and EVERY file in /context/.
Then read context/feature-specs/NN-name.md.
Update context/progress-tracker.md to mark this unit "in progress".
Implement EXACTLY what the spec says. Do not exceed scope. Do not add new tools or packages not listed in architecture.md.
Run the project's build/test command and fix any errors.
When finished, update progress-tracker.md to "complete" and add any architectural decisions.
```

### Corrective prompt (when something broke)

```
Open context/current-issues.md.
Deeply analyze the listed issues against /context/, the relevant spec, and any installed agent skills/docs.
Provide your hypothesis and plan FIRST in chat.
Wait for my approval before changing any code.
```

### "Read the docs" prompt (when an external library is involved)

```
Before writing code, read the latest <library> documentation at <url>
(or use Context7 / the installed agent skill for <library>).
Summarize the 3 things you'll do differently from your training-data assumption, then implement.
```

### Migration / rename prompt

```
Implement the migration described in context/feature-specs/NN-name.md as a SINGLE atomic change set.
Do not modify behavior; only relocate / rename / refactor as specified.
After: run all tests, all lints, and the type checker.
```

### "I'm lost, get me back on track" prompt

```
Open progress-tracker.md and the last 3 files you edited.
Summarize: where we are, what was just completed, what's the next planned spec.
Do not write code. Just summarize.
```

---

## 11. Phase 8 — Foundation specs every app needs

These three specs come first, in this order, regardless of what you're building. Once they're shipped, you start adding feature specs.

### Spec 01 — Design / API foundation

For UI apps: install your chosen UI kit + icon set, define design tokens in CSS variables, build a `cn` (class-merge) helper.

For non-UI apps: define the response envelope, error shape, logger, config loader, and base CLI / HTTP scaffold.

Verification: a hello-world page or `--help` output shows the new shell.

### Spec 02 — App shell

UI apps: navbar / sidebar / main-area layout, theme provider, dark-mode toggle if applicable.

Backend apps: middleware stack (logging, error handler, request id, CORS, rate-limit), health-check endpoint.

CLI apps: command tree, `--version`, `--help`, exit codes.

Verification: every page / endpoint / command renders the shell consistently.

### Spec 03 — Auth (only if your app needs accounts)

If your app is public/anonymous, skip this and write a one-line note in `progress-tracker.md`: "No auth — app is public."

Otherwise pick ONE auth provider from the menu. Write the spec to include:

- Sign-up / sign-in / sign-out flows
- Session retrieval helper
- Route protection middleware
- Public-route allow-list (the agent often forgets this)
- Logout redirect URL handled correctly

After these three foundation specs, every additional spec is product-feature work.

---

## 12. Phase 9 — The conditional-stack decision tree

Before adding a new tool to `architecture.md`, ask the agent:

```
For the feature in spec NN, do we actually NEED <proposed tool>?
List the 3 simplest alternatives that use only what's already in architecture.md.
Recommend one. Justify the choice in 3 bullets max.
```

Decision rules:

- **Database?** If you persist anything user-specific across sessions → yes. Otherwise no.
- **Real-time?** Only if two users must see each other's actions live within ~500 ms. Otherwise polling or refresh is fine.
- **Background jobs?** Only if a single task can exceed 30 s, or must run on a schedule, or must retry on failure. Otherwise an inline async function is fine.
- **AI / LLM?** Only if a feature requires natural-language understanding, generation, or classification beyond simple rules.
- **Blob storage?** Only if you store user-uploaded or AI-generated files larger than ~100 KB or files you can't fit in your DB.
- **Email?** Only if the app sends transactional messages.
- **Payments?** Only if v1 monetizes.
- **Analytics / error tracking?** Add at production-launch time, not before.

Every "no" is a feature you don't have to maintain.

---

## 13. Phase 10 — Source control + AI code review

1. Push to GitHub (`git remote add origin …`, `git push -u origin main`).
2. Sign up at https://coderabbit.ai with GitHub. Grant access to the repo. Now every PR gets an AI reviewer comment for free.
3. Optional: install the **CodeRabbit VS Code extension** for local pre-commit reviews.

Branching pattern after every spec:

```bash
git checkout -b development        # only first time
git add .
git commit -m "feat(NN): <spec name>"
git push -u origin development     # only first time; later just `git push`
```

Then on GitHub: **Compare & pull request** → wait for the AI review → fix or accept suggestions → merge.

> Pay attention to the AI reviewer. It catches things like missing error handling, unhandled promise rejections, race conditions, and security issues your agent skipped.

---

## 14. Phase 11 — The debugging discipline (current-issues.md)

When you find a bug, **don't** just paste the error into a fresh chat. Use this pattern instead:

1. Create `context/current-issues.md` (gitignored — see Phase 12).
2. List one or many issues with: what you saw, what you expected, the exact error / log, the URL or repro steps.
3. Send the **Corrective prompt** from Phase 7. The agent will analyze first and propose a plan.
4. Approve → it executes.
5. Mark each issue `pending test`. Walk through them in the browser / runtime.
6. If still broken, send a focused single-issue corrective prompt for that one.

Why? Because you want **diagnosis before action**. Letting the agent change code on its first guess is how you end up with five layers of bandages on the wrong file.

> Always tell the agent to *also* read the relevant agent-skill or library docs before debugging library-specific issues. e.g. "Refer to the @stripe / @prisma / @react-flow skill if helpful."

---

## 15. Phase 12 — Security & secrets — the non-negotiables

Add these to `.gitignore` immediately:

```
.env
.env.*
!.env.example
/context/current-issues.md
node_modules
dist
build
.next
.cache
*.log
.DS_Store
.idea
.vscode/*
!.vscode/settings.json
```

Rules the agent must follow (also in `code-standards.md`):

- **Never** commit secrets. If a secret was ever committed, rotate it AND remove it from git history (`git filter-repo` or use the GitHub UI to delete the file from every branch).
- All secrets live in `.env.local` (or your platform's secret manager). Maintain `.env.example` with the variable names but no values.
- Server-only env vars must NOT be referenced from client code. (In Next.js they must NOT have `NEXT_PUBLIC_` prefix.)
- Validate / authenticate at every API boundary. Owner / role checks happen server-side, not just by hiding UI.
- Storage buckets default to **private** — flip to public only with deliberate intent.
- All user input that hits the database must be parameterized; never string-concatenate SQL.
- Rate-limit any endpoint that touches expensive resources (LLM, email, payment).
- Sanitize any HTML you render from user content.

> `current-issues.md` often contains pasted tokens from terminal logs. Never push it. If you already did, rotate immediately.

---

## 16. Phase 13 — Polishing pass

Once every feature spec is shipped, walk through the app like a real user. Open `context/current-issues.md` and list every bug, weird interaction, or visual nit you find. Then send:

```
Read context/current-issues.md.
Fix issues 1 through N one by one.
For each: state the root cause in one line, apply the fix, mark "pending test".
Do not refactor anything not explicitly listed.
```

Common categories worth checking:

- **Keyboard interactions** (Delete, Escape, Enter, Cmd+Z / Cmd+Y)
- **Mobile viewport** (sidebars, modals, scroll, touch targets ≥ 44 px)
- **Empty / error / loading states** for every async surface
- **Race conditions** (double-submits, stale fetches)
- **Image domains / CSP** (Next/Image, CORS)
- **Strict mode / double-effect bugs** in dev (e.g. permanent `isMounted=false`)
- **Accessibility** (focus rings, aria-labels, alt text, contrast)
- **Default privacy** (storage buckets, share URLs)

---

## 17. Phase 14 — Going to production

### 17.1 Switch dev → production credentials

For every third-party service that has separate dev/prod environments (auth, real-time, AI keys, payments, email, queues), create the production project, copy the keys, and replace them in your hosting platform's environment variables.

### 17.2 Pre-flight checklist

- All env vars present in the hosting platform.
- Secrets rotated; no test keys left in production.
- Database migrations applied to the production DB.
- A `postinstall` step runs ORM client generation (e.g. `prisma generate`).
- `package-lock.json` / `pnpm-lock.yaml` / `yarn.lock` is committed and **not corrupted** (delete and re-generate if `npm ci` fails).
- Storage buckets exist in production with the correct privacy.
- Webhooks (payments, email events) point at production URLs.
- Domain configured, DNS propagated, HTTPS issued.
- Error tracking enabled (Sentry / Highlight) — if you skipped it earlier, add now.
- Analytics enabled — if you wanted them.

### 17.3 Push and deploy

```bash
git checkout main
git merge development
git push
```

Then in your hosting platform (Vercel / Netlify / Railway / Fly / etc.):

1. Import the repo.
2. Paste the entire `.env.local` into the env-vars field — most platforms auto-split.
3. Deploy.

### 17.4 Expect 1–3 build failures (it's normal)

Common ones and the standard fixes:

- **`npm install` fails on platform**: corrupted lockfile. Delete it locally, commit, push, re-deploy.
- **Prisma "client not generated"**: add `"postinstall": "prisma generate"` to `package.json` scripts.
- **Native module fails to compile** (sharp, bcrypt, canvas): set the platform's Node version, or switch to a pure-JS alternative.
- **Edge runtime "module not allowed"**: move that route to the Node runtime.
- **Env-var missing**: re-check spelling; restart the build.

After it's green, click your URL. Sign in. Do the core user flow once. Done.

---

## 18. Phase 15 — Common stuck-points and rescue prompts

Use these when something goes sideways.

**Agent keeps using a tool you removed:**
```
You used <tool> in your last edit. It is NOT in architecture.md.
Re-read architecture.md and re-implement using only the listed tools.
```

**Agent keeps writing the same broken pattern:**
```
The pattern <X> has failed twice. Stop. Read the official documentation at <URL>
(or the installed agent skill). Summarize the correct pattern in 3 bullets.
Wait for my approval before re-implementing.
```

**Build output you can't decipher:**
```
Run the build. Capture the full error. Do NOT change code yet.
Identify the FIRST root error (ignore warnings and downstream noise).
Provide hypothesis + minimal fix plan. Wait for approval.
```

**Tests broke after an unrelated change:**
```
Run the tests. List the failures by file.
For each: was the test wrong, was the code wrong, or did behavior intentionally change?
Provide a plan, then wait for approval.
```

**Lost in a giant PR review:**
```
Open the diff for branch <name>. Group changes into themes.
List each theme + the files involved + risk level.
Recommend which themes to merge first.
```

**Drifting from spec:**
```
Compare the latest changes against context/feature-specs/NN-name.md.
List anything implemented that is NOT in the spec.
Propose either: (a) revert the extra change, or (b) move it to a new spec.
```

---

## 19. Appendix A — Universal AGENTS.md template

Drop this into your project root unchanged. (Rename to `CLAUDE.md` / `.cursorrules` / `.windsurfrules` if your agent needs that filename — content stays identical.)

```markdown
# Agent rules for this project

You are a senior engineer working on this codebase. Follow these rules on every task.

## Before any work

1. Read EVERY file in `/context/`, in this order:
   1. project-overview.md
   2. architecture.md
   3. code-standards.md
   4. ai-workflow-rules.md
   5. ui-context.md  (or api-context.md)
   6. progress-tracker.md
2. If a feature spec was provided, read it next: `context/feature-specs/<file>.md`.
3. If `context/current-issues.md` was provided, read it instead/also.
4. Update `context/progress-tracker.md` to mark the current spec "in progress".

## During the work

- Implement EXACTLY what the spec says. No drive-by refactors. No new features.
- Use ONLY tools and packages listed in `architecture.md`. If you believe a new tool is needed, STOP and ask first.
- If the spec is ambiguous, ask ONE clarifying question and wait. Do not invent.
- Match the project's code-standards.md exactly (file naming, import order, no `any`, etc.).
- For UI work, use only design tokens from ui-context.md — never raw color literals.
- Never hard-code secrets. Read from environment variables.
- Authentication and authorization checks happen on the server. Never trust client-side hiding alone.
- For libraries you might be out-of-date on, read the project's installed skill or the live docs before writing code.

## After the work

- Run the project's build / typecheck / lint / test commands. Fix everything that breaks.
- Update `context/progress-tracker.md`: mark the spec "complete", add any architectural decisions that emerged, and note follow-ups.
- Do NOT commit `context/current-issues.md` (it may contain leaked tokens or secrets).

## Debugging mode

If you are reading `current-issues.md`:

1. State your hypothesis for each issue in plain English.
2. State the minimal change you would make.
3. WAIT for explicit approval before editing any file.
4. After approval, implement, then mark each issue "pending test".

## Hard rules

- One spec at a time. Never combine specs in a single session.
- Never push to `main` directly — work on `development` and open a PR.
- Never bypass safety prompts (`--no-verify`, `--force`, `git reset --hard`) unless the user explicitly asks.
- If something feels destructive (drop tables, delete files outside the spec, force-push), stop and ask.
```

---

## 20. Appendix B — Universal spec template

Save as `context/feature-specs/NN-name.md`:

```markdown
# NN — <feature name>

## Goal
<1–2 sentences. What does "done" look like to a user or caller?>

## Design decisions
- <Visual / structural / pattern choices>
- <Tools allowed for this spec — must already be in architecture.md>
- <Key invariants for this feature>

## Implementation
- <File 1 to create/edit + behavior>
- <File 2 to create/edit + behavior>
- <Specific gotchas the agent will likely get wrong unless told here>
- <Specific commands to run, in order>

## Out of scope
- <Thing 1 we are NOT building in this spec>
- <Thing 2 we are NOT touching>
- <"No new packages beyond <list>">

## Verification
- [ ] <Build command> passes.
- [ ] <Lint command> passes.
- [ ] <Test command> passes (or "no tests for this spec").
- [ ] <Manual user step 1>.
- [ ] <Manual user step 2>.
- [ ] No new lines written in files outside the spec's file list.
```

---

## 21. Appendix C — Cheat sheet

### The loop
1. Write spec → 2. Fresh chat → 3. Standard prompt → 4. Verify → 5. Commit → 6. PR → 7. Merge → 8. Repeat.

### The standard prompt (reuse every time)
```
Read AGENTS.md and EVERY file in /context/.
Then read context/feature-specs/NN-name.md.
Update progress-tracker.md to "in progress".
Implement EXACTLY as specified. No scope creep. No new tools.
Run build/test. Fix issues. Update progress-tracker.md to "complete".
```

### The corrective prompt
```
Open context/current-issues.md.
Analyze. Hypothesis + plan FIRST. Wait for approval. THEN execute.
```

### The `.gitignore` essentials
```
.env*
!.env.example
/context/current-issues.md
node_modules
dist build .next .cache
*.log
```

### The 9 always-true rules
1. One spec, one fresh chat.
2. Spec → Prompt → Verify → Push.
3. Architecture.md is the law: no tools outside it.
4. Server enforces auth and ownership. Always.
5. Storage buckets default to private.
6. Diagnose before fixing (current-issues.md pattern).
7. Update `progress-tracker.md` after every spec.
8. Never commit secrets or `current-issues.md`.
9. After ship, walk the app like a user; queue every nit into a polishing-pass spec.

### Foundation specs (in order)
1. Design / API foundation.
2. App shell (navbar+sidebar / middleware stack / command tree).
3. Auth (only if needed).

### Decision rules for adding a tool
- Database: only if persistence is required.
- Real-time: only if < 500 ms cross-user updates matter.
- Background jobs: only for > 30 s tasks, schedules, or retries.
- AI: only if natural language understanding/generation is required.
- Blob storage: only for files > 100 KB.
- Email / payments / analytics / error tracking: only when there's a real user need (often production-launch time).

---

## You're ready

You now have:

- A philosophy (spec-driven development).
- A six-file context system that keeps any agent on rails.
- A standard prompt for every feature.
- A corrective prompt for every bug.
- A decision tree for which tools to add (and which to refuse).
- Security and deployment defaults that won't bite you.

Use this exact playbook for every project — todo apps, multiplayer games, internal tools, AI products, mobile apps, CLIs. The methodology scales because it's about *process*, not stack.

Build something. Ship it. Then build the next one with the same loop.
