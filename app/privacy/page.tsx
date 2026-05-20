import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";
import { BRAND } from "@/lib/constants";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <LegalPage eyebrow="Privacy" title="Privacy at HungryHeads">
      <p>
        We&apos;re a small team building on top of Swiggy&apos;s Builders Club
        platform. The short version of how we treat your data: we collect only
        what we need to make HungryHeads work, your data stays in India, and
        we never sell or share with third parties.
      </p>

      <h2>What we collect</h2>
      <p>
        Email and name from sign-up. Cuisine preferences, allergies, monthly
        budget, delivery radius and food personality from onboarding. Chat
        messages with our AI agent so we can recall context across
        conversations. An encrypted Swiggy access token only when you
        explicitly connect your account, used to fetch your menus and place
        orders on your behalf.
      </p>

      <h2>What we don&apos;t do</h2>
      <p>
        We don&apos;t sell your data. We don&apos;t share it with advertisers.
        We don&apos;t store your Swiggy password (we never see it — OAuth 2.1
        PKCE handles authentication on Swiggy&apos;s side).
      </p>

      <h2>Where it lives</h2>
      <p>
        Supabase Postgres in the Mumbai (ap-south-1) region. Row-Level
        Security ensures only you can read your own rows. Anthropic Claude
        processes your chat messages to generate replies — Anthropic&apos;s
        privacy policy applies to that processing.
      </p>

      <h2>Your rights</h2>
      <p>
        You can request data export or deletion any time before public
        launch by emailing{" "}
        <a
          href={`mailto:${BRAND.contactEmail}`}
          className="text-hh-orange-dark underline hover:no-underline"
        >
          {BRAND.contactEmail}
        </a>
        . A self-serve account-deletion flow lands in Phase 2.
      </p>

      <p className="text-xs text-hh-gray italic">
        This stub will be replaced with the full DPDP-compliant policy before
        we go public. If anything here is unclear, ping us.
      </p>
    </LegalPage>
  );
}
