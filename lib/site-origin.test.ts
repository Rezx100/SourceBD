import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { FALLBACK_SITE_ORIGIN, siteOriginFromEnv, urlOnSite } from "./site-origin";

describe("siteOriginFromEnv", () => {
  it("prefers a valid SITE_URL", () => {
    assert.equal(
      siteOriginFromEnv({
        NEXT_PUBLIC_SITE_URL: "https://sourcebd.net",
        NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3100",
      }),
      "https://sourcebd.net",
    );
  });

  it("falls through to APP_URL when SITE_URL is missing or unparseable", () => {
    assert.equal(
      siteOriginFromEnv({
        NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3100",
      }),
      "http://127.0.0.1:3100",
    );
    assert.equal(
      siteOriginFromEnv({
        NEXT_PUBLIC_SITE_URL: "sourcebd.net",
        NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3100",
      }),
      "http://127.0.0.1:3100",
    );
  });

  it("uses the public site when both are missing, empty, or unparseable", () => {
    assert.equal(siteOriginFromEnv({}), FALLBACK_SITE_ORIGIN);
    assert.equal(
      siteOriginFromEnv({
        NEXT_PUBLIC_SITE_URL: "",
        NEXT_PUBLIC_APP_URL: "",
      }),
      FALLBACK_SITE_ORIGIN,
    );
    assert.equal(
      siteOriginFromEnv({
        NEXT_PUBLIC_SITE_URL: "sourcebd.net",
        NEXT_PUBLIC_APP_URL: "not-a-url",
      }),
      FALLBACK_SITE_ORIGIN,
    );
  });
});

describe("urlOnSite", () => {
  it("keeps protocol-relative paths on the site origin", () => {
    const empty = { NEXT_PUBLIC_SITE_URL: "", NEXT_PUBLIC_APP_URL: "" };
    for (const path of ["//evil.example/phish", "///evil.example"]) {
      const dest = urlOnSite(path, "", empty);
      assert.equal(dest.origin, FALLBACK_SITE_ORIGIN);
      assert.doesNotMatch(dest.host, /evil\.example/i);
      assert.doesNotMatch(dest.pathname, /^\/\//);
      assert.doesNotMatch(dest.href, /^https?:\/\/evil\.example/i);
    }
  });
});
