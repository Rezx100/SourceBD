# Fonts

SourceBD sets Geist and Geist Mono (founder, 9 Oct 2026, replacing the IBM Plex pair Paper
picked on 5 Oct), loaded once in `app/layout.tsx` with `next/font/local` from the two
variable files in this folder, so the build never calls Google and a visitor's browser never
calls a font CDN. Geist is Vercel's face, SIL Open Font License 1.1. Mono is for what a
register filed (a number, a date beside it) and for short labels; a caption that is a
sentence is sans. To add a face, download its woff2 from Google Fonts (latin subset) and
list it in the layout that uses it; do not go back to `next/font/google` (a Google fetch
failure fails the CI build).

Archivo, Hanken Grotesk, Bricolage Grotesque and Plus Jakarta Sans (also SIL OFL 1.1,
downloaded 5 Oct 2026) are not loaded by any page.
