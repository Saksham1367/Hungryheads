import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "HungryHeads — Decide. Order. Eat. Together.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Open Graph image — generated at edge runtime via Next.js's opengraph-image
 * file convention. Renders the brand wordmark + tagline + a coral wash
 * background. Loaded automatically when anyone shares the homepage URL.
 *
 * Note: Tailwind class names DO NOT work inside ImageResponse — only inline
 * style objects. Tracked in Next docs.
 */
export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background:
            "linear-gradient(135deg, #FFE4D6 0%, #FFF8F3 50%, #ffffff 100%)",
          display: "flex",
          flexDirection: "column",
          padding: "80px",
          fontFamily: "system-ui, -apple-system, sans-serif",
          position: "relative",
        }}
      >
        {/* Floating accent blobs */}
        <div
          style={{
            position: "absolute",
            top: "-160px",
            right: "-160px",
            width: "480px",
            height: "480px",
            borderRadius: "9999px",
            background: "rgba(255, 107, 53, 0.25)",
            filter: "blur(40px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-160px",
            left: "-160px",
            width: "480px",
            height: "480px",
            borderRadius: "9999px",
            background: "rgba(255, 107, 53, 0.15)",
            filter: "blur(40px)",
          }}
        />

        {/* Logo mark + wordmark */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            zIndex: 1,
          }}
        >
          <div
            style={{
              width: "72px",
              height: "72px",
              borderRadius: "9999px",
              background: "#FF6B35",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontWeight: 800,
              fontSize: "36px",
            }}
          >
            🍴
          </div>
          <div
            style={{
              fontSize: "44px",
              fontWeight: 800,
              letterSpacing: "-0.02em",
              color: "#1A1A1A",
              display: "flex",
            }}
          >
            <span>Hungry</span>
            <span style={{ color: "#FF6B35" }}>Heads</span>
          </div>
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Headline */}
        <div
          style={{
            fontSize: "96px",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            color: "#1A1A1A",
            lineHeight: 1.0,
            zIndex: 1,
            display: "flex",
          }}
        >
          Decide. Order. Eat.
        </div>
        <div
          style={{
            fontSize: "96px",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            color: "#FF6B35",
            lineHeight: 1.0,
            marginTop: "8px",
            zIndex: 1,
            display: "flex",
          }}
        >
          Together.
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: "28px",
            color: "#404040",
            marginTop: "32px",
            zIndex: 1,
            display: "flex",
          }}
        >
          AI food companion · Built on Swiggy · Powered by Claude
        </div>

        {/* Bottom row */}
        <div
          style={{
            display: "flex",
            gap: "24px",
            marginTop: "48px",
            zIndex: 1,
          }}
        >
          {["SafePlate", "SpendSmart", "VoiceOrder", "FoodHuddle"].map((f) => (
            <div
              key={f}
              style={{
                background: "white",
                border: "1px solid #E5E7EB",
                borderRadius: "9999px",
                padding: "10px 24px",
                fontSize: "20px",
                fontWeight: 600,
                color: "#404040",
                display: "flex",
              }}
            >
              {f}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
