import type { MetadataRoute } from "next";

/**
 * Public sitemap. Only marketing/auth surfaces — every authenticated route is
 * gated by middleware and should be `disallow`-ed in robots.ts. Crawlers
 * shouldn't index the dashboard, huddles, etc.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "http://localhost:3000";
  const now = new Date();
  return [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/auth/sign-up`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/auth/sign-in`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
  ];
}
