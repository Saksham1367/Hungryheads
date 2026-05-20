import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "http://localhost:3000";
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/auth/sign-up", "/auth/sign-in"],
        disallow: [
          "/api/",
          "/dashboard",
          "/dashboard/*",
          "/onboarding",
          "/connect-swiggy",
          "/profile",
          "/voiceorder",
          "/huddle/",
          "/huddle/*",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
