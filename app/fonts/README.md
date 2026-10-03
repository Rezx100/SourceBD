# Fonts

SourceBD v4 sets IBM Plex Sans and IBM Plex Mono (Paper, decision D-2), loaded in
`app/layout.tsx` with `next/font/google`: fetched once at build time and served from
this site, so a visitor's browser never calls a font CDN.

Geist and Geist Mono (the v3 kit's faces, SIL Open Font License 1.1) stay in this
folder only for the old gallery script `scripts/gallery/render-gallery-fixtures.ts`.
No page loads them. They go with the old kit (B11).
