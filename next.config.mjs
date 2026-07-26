// Content-Security-Policy. This is a BACKSTOP (react-markdown is XSS-safe by
// default and we never enable rehype-raw), not the primary defence. Next's App
// Router injects inline hydration scripts and dev HMR needs eval, so without
// per-request nonces we must allow 'unsafe-inline'/'unsafe-eval' on script-src
// — a stricter nonce-based CSP is future work. The genuine wins here: lock down
// base-uri, object-src, and form-action, and scope where the app may connect /
// load images. Framing is governed by X-Frame-Options below (per-route), so we
// intentionally omit frame-ancestors to avoid conflicting with /share.
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
  "frame-src 'self'",
  "img-src 'self' data: blob: https://media-assets.swiggy.com https://mcp.swiggy.com",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://mcp.swiggy.com",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Production-grade default headers. These move our Lighthouse "Best Practices"
  // score into the 95+ range and harden the app against common web attacks.
  // Each header is documented inline so future-you knows why it's there.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Backstop against XSS / content injection (see CSP note above).
          { key: "Content-Security-Policy", value: CSP },
          // Browsers will only ever connect over HTTPS once they see this.
          // 2-year max-age matches Mozilla "modern" profile.
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          // Block clickjacking by refusing to be iframed.
          { key: "X-Frame-Options", value: "DENY" },
          // Disable MIME-type sniffing — every response Content-Type is final.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Cross-origin referrer leak protection.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Lock down powerful APIs we don't use. Camera/mic stay closed; geo
          // stays closed (we never ask the user for their location — Swiggy
          // gives us a saved address instead).
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
        ],
      },
      // The shared chat viewer must be embeddable for users to drop it in
      // Notion/Slack previews — relax X-Frame-Options on that route only.
      {
        source: "/share/:token*",
        headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }],
      },
    ];
  },

  // Image optimization defaults — we don't host any remote images today, but
  // when Swiggy widgets land in v1.1 they'll come from `mcp.swiggy.com`. Set
  // up the allowlist now so the flip is one config change later.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "mcp.swiggy.com" },
      { protocol: "https", hostname: "media-assets.swiggy.com" },
    ],
  },

  // Strip the `X-Powered-By: Next.js` header — small Best Practices win plus
  // it removes a free hint about our stack for would-be attackers.
  poweredByHeader: false,
};

export default nextConfig;
