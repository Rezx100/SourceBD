# Fonts

SourceBD v4 sets IBM Plex Sans and IBM Plex Mono (Paper, decision D-2), loaded in
`app/layout.tsx` with `next/font/local` from the files in this folder (latin subset), so
the build never calls Google and a visitor's browser never calls a font CDN. The same
folder holds the faces for the sign-in pages (Archivo, Hanken Grotesk, IBM Plex Mono) and
the document error page (Bricolage Grotesque, Plus Jakarta Sans). All are SIL Open Font
License 1.1, downloaded once from Google Fonts on 5 Oct 2026 (latin subset, woff2). To add
a weight or a face, download the woff2 the same way and list it in the layout that uses it;
do not go back to `next/font/google` (a Google fetch failure fails the CI build).

Geist and Geist Mono (the v3 kit's faces, SIL Open Font License 1.1) stay in this
folder only for the old gallery script `scripts/gallery/render-gallery-fixtures.ts`.
No page loads them. They go with the old kit (B11).
