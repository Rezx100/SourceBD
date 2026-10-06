> **7 Oct 2026: the page is now SourceBD.** `public/landing-2` keeps this kit's layout, section order, page set and
> motion skeleton, with SourceBD's words, tokens (both themes), IBM Plex, the Pane's glass, real SourceBD screens at 2x
> and Higgsfield visuals (`imagery.md`). Careers is a holding page until there are real roles; the forms hand off to
> the real `/login`, `/signup`, `/forgot-password` and `/contact`. The notes below describe the circle0 kit as it came.

# circle0 marketing site

Static, light-mode marketing site for circle0: Home, Pricing, Careers, Integrations, Contact, Log in, Sign up and Forgot password. Plain HTML, CSS and JavaScript, no build step.

## Run it

Any static server works. From this folder:

```bash
python -m http.server 8765
```

Then open http://127.0.0.1:8765/index.html. Opening the files directly (`file://`) also works; Google Fonts and GSAP load from CDNs.

## Structure

```
index.html            Home (logo marquee, bento, accordion split, WebGL shader number, orbit cards, stories)
pricing.html          Plans, comparison table, billing FAQ
careers.html          Gallery hero, benefits, quote, filterable job list
integrations.html     Searchable, filterable integration grid
contact.html          Contact form, offices map
login.html            Sign in
signup.html           Register (reads ?plan=basic|premium|pro)
forgot-password.html  Reset flow with success state
css/styles.css        Tokens, components, layout, motion
js/main.js            Nav, GSAP reveals, carousels, accordion, pricing toggle, filters, forms
assets/brand/         Logo mark, wordmark, favicons
assets/img/           Dashboard screenshot and crops, photography, gradient backdrops
PRODUCT.md, DESIGN.md Product context and the design system (also published as a Design System artifact)
```

## Wiring a backend

Forms are client-validated and currently simulate a submit. Each form carries a `data-endpoint` attribute with the intended route:

| form | endpoint | notes |
| --- | --- | --- |
| Contact | `/api/contact` | fields: name, email, company, topic, message, consent |
| Log in | `/api/auth/login` | redirects to `data-redirect` on success |
| Sign up | `/api/auth/register` | fields: fullname, email, company, password, terms |
| Forgot password | `/api/auth/forgot` | shows the `#reset-sent` state on success |
| Newsletter | (none yet) | `form[data-newsletter]` in the home page |

In `js/main.js`, the `forms()` block has one `setTimeout` that stands in for the request. Replace it with a `fetch(form.dataset.endpoint, { method: "POST", body: new FormData(form) })` and keep the surrounding success and error handling. The social sign-in buttons call `window.circle0.toast(...)`; point them at your auth provider.

Integration "Connect" buttons only toggle local state; hook `[data-connect]` to your OAuth flow.

## Deployment

Upload the folder as-is to any static host (Vercel, Netlify, Cloudflare Pages, S3). Set `Cache-Control` long for `assets/`, and add a redirect from `/` to `index.html` if the host does not do it. All page links are relative, so the site works from a subfolder.

## Accessibility and motion

Every control is keyboard reachable with a visible focus ring; carousels respond to arrow keys; accordions, dots and filters expose ARIA state. Scroll reveals and the hero word animation are disabled under `prefers-reduced-motion`, and every section is visible without JavaScript.
