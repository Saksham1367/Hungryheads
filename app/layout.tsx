import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  weight: ["500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "HungryHeads — Decide. Order. Eat. Together.",
    template: "%s · HungryHeads",
  },
  description:
    "AI-powered food companion. Solve allergies, budgets, group decisions and reorders — all from one shared profile. Built on Swiggy.",
  applicationName: "HungryHeads",
  authors: [{ name: "HungryHeads" }],
  keywords: [
    "food",
    "swiggy",
    "ai",
    "allergy",
    "budget",
    "group ordering",
    "voice ordering",
    "food huddle",
  ],
  openGraph: {
    title: "HungryHeads — Decide. Order. Eat. Together.",
    description:
      "AI-powered food companion built on Swiggy. SafePlate, SpendSmart, VoiceOrder, FoodHuddle.",
    type: "website",
    locale: "en_IN",
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${jakarta.variable}`}>
      <body className="font-sans antialiased min-h-screen bg-background text-foreground">
        {/* Keyboard-only skip-to-content — hidden until focused. Lighthouse
            a11y win and lets screen-reader users jump past the nav. The
            target is the <main id="features"> on the homepage and the
            <main> tag inside each app route. */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-lg focus:bg-hh-black focus:text-white focus:px-4 focus:py-2 focus:shadow-lg"
        >
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
