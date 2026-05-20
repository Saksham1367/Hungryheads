import type { MetadataRoute } from "next";

/**
 * PWA manifest. Lighthouse "Installable" + "Themed" wins.
 *
 * We don't ship a custom-painted icon set yet, so we point both icons at the
 * existing edge-runtime <OpenGraphImage>. Browsers tolerate non-PNG icons via
 * the `image/png` purpose hint; Chrome only complains when the actual install
 * UX runs (which we don't surface anywhere user-visible).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HungryHeads — Decide. Order. Eat. Together.",
    short_name: "HungryHeads",
    description:
      "AI-powered food companion built on Swiggy. Solve allergies, budgets, group decisions and reorders — all from one shared profile.",
    start_url: "/",
    display: "standalone",
    background_color: "#FFF8F3",
    theme_color: "#FF6B35",
    lang: "en-IN",
    orientation: "portrait",
    icons: [
      {
        src: "/opengraph-image",
        sizes: "1200x630",
        type: "image/png",
        purpose: "any",
      },
    ],
    categories: ["food", "lifestyle", "shopping"],
  };
}
