// Source URL resolver — turns a (source_code, ref) or (cert_kind, cert_no)
// into a stable public deep link. Falls back to `null` (meaning the caller
// should render the ID as plain text, not a broken `Open ↗`).
//
// Spec context: I-010 in context/current-issues.md.
//
// Hard rule: never return a stale session-tokenised URL stored in the DB
// when a known-stable public pattern exists. For OEKO-TEX, GOTS, WRAP we
// prefer the verification search page over the document_url because the
// document_url is a tokenised PDF that returns "token expired".

const norm = (v: string | null | undefined): string =>
  (v ?? "").trim();

/**
 * Registry (membership / regulator ID) deep link.
 * @param sourceCode  source_records.code (BGMEA, BKMEA, BGAPMEA, EPB, RSC, BTMA, RJSC, BIN, ...)
 * @param ref         the membership / registry number for THIS supplier
 * @returns           stable URL or null when no useful target exists
 */
export function resolveRegistryUrl(
  sourceCode: string | null | undefined,
  ref: string | null | undefined,
): string | null {
  const code = norm(sourceCode).toUpperCase();
  const id = norm(ref);
  if (!code) return null;

  switch (code) {
    case "BGMEA":
      // BGMEA's per-member detail pages aren't keyed off membership # alone,
      // so we ship the public member search anchored on the ID.
      return id
        ? `https://www.bgmea.com.bd/member-directory?search=${encodeURIComponent(id)}`
        : "https://www.bgmea.com.bd/member-directory";

    case "BKMEA":
      return id
        ? `https://www.bkmea.com/?s=${encodeURIComponent(id)}`
        : "https://www.bkmea.com/members/";

    case "BGAPMEA":
      return id
        ? `https://www.bgapmea.org/?s=${encodeURIComponent(id)}`
        : "https://www.bgapmea.org/our_member/";

    case "BTMA":
      return id
        ? `https://www.btmadhaka.com/?s=${encodeURIComponent(id)}`
        : "https://www.btmadhaka.com/members/";

    case "RSC":
      // RSC public disclosure hub is keyed off FactoryID. Many of our rows
      // store the ID; surface the search page when only the membership # is
      // available.
      return id
        ? `https://accord.fairfactories.org/Pub.aspx?FactoryID=${encodeURIComponent(id)}`
        : "https://accord.fairfactories.org/Pub.aspx";

    case "EPB":
      // EPB does not publish per-company pages. Returning null tells the
      // caller to render the ID as plain text instead of a misleading
      // "Open ↗" to the homepage.
      return null;

    case "RJSC":
      // RJSC has no public registry search; the dashboard is auth-walled.
      return null;

    case "BIN":
    case "TIN":
      // NBR does not expose a public lookup for an individual BIN/TIN.
      return null;

    default:
      return null;
  }
}

/**
 * Certificate deep link. Prefers the issuing-authority verification page
 * over a stored `document_url` because document URLs are often tokenised
 * and expire.
 * @param kind          public.certifications.kind enum value
 * @param certNo        certificate number on file
 * @param documentUrl   stored document_url (used only as last resort if the
 *                      kind has no known public verification page)
 */
export function resolveCertificateUrl(
  kind: string | null | undefined,
  certNo: string | null | undefined,
  documentUrl: string | null | undefined,
): string | null {
  const k = norm(kind).toLowerCase();
  const no = norm(certNo);
  const fallback = norm(documentUrl) || null;

  switch (k) {
    case "oeko_tex":
      // OEKO-TEX label-check is the public, stable verification URL.
      return no
        ? `https://www.oeko-tex.com/en/label-check?certificateNumber=${encodeURIComponent(no)}`
        : "https://www.oeko-tex.com/en/label-check";

    case "gots":
      // GOTS public database search.
      return no
        ? `https://global-standard.org/find-suppliers-shops-and-inputs/certified-suppliers/database?search=${encodeURIComponent(no)}`
        : "https://global-standard.org/find-suppliers-shops-and-inputs/certified-suppliers/database";

    case "grs":
    case "rcs":
      // Textile Exchange runs both. The certified-companies search is the
      // canonical public lookup.
      return no
        ? `https://textileexchange.org/find-a-certified-company/?search=${encodeURIComponent(no)}`
        : "https://textileexchange.org/find-a-certified-company/";

    case "wrap":
      // WRAP certified-facility search.
      return no
        ? `https://www.wrapcompliance.org/certified-facility-search?certificate=${encodeURIComponent(no)}`
        : "https://www.wrapcompliance.org/certified-facility-search";

    case "bsci":
      // amfori BSCI uses a member-only Sustainability Platform; no public
      // per-cert page exists.
      return fallback;

    case "sedex_smeta":
      // SMETA audits live on the Sedex platform behind login.
      return fallback;

    case "fairtrade":
      return no
        ? `https://www.flocert.net/find-customer-or-product/?fid=${encodeURIComponent(no)}`
        : "https://www.flocert.net/find-customer-or-product/";

    case "iso9001":
    case "iso14001":
    case "iso45001":
    case "sa8000":
    case "bci":
      // No single public registry — fall back to whatever the supplier
      // uploaded, even if it may be tokenised.
      return fallback;

    default:
      return fallback;
  }
}
