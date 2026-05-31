// Spec M4 — Public robots.txt.
//
// Next 15 `MetadataRoute.Robots` convention. Politeness signal to
// compliant crawlers — auth is enforced by middleware on every
// `/app/**`, `/supplier/**`, `/admin/**` route; this file is not a
// security boundary.
//
// `/compliance/*` and `/pricing` are deliberately NOT in the disallow
// list (they are the indexable money pages); the M4 smoke check (b.2)
// guards against typos.

import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://sourcebd.net";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/app/",
          "/supplier/",
          "/admin/",
          "/api/",
          "/auth/",
          "/dev/",
          "/suspended/",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
