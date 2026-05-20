import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";
import { BRAND } from "@/lib/constants";

export const metadata: Metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <LegalPage eyebrow="Terms" title="Terms of Service">
      <p>
        HungryHeads is an AI-powered food companion built on top of
        Swiggy&apos;s Builders Club MCP platform. We are not Swiggy. Orders
        you place through us go through Swiggy&apos;s normal flow and are
        subject to Swiggy&apos;s own terms.
      </p>

      <h2>What you can do with HungryHeads</h2>
      <p>
        Sign up free, connect a Swiggy account, chat with our AI agent,
        create or join FoodHuddles, place COD orders. That&apos;s it for
        Phase 1.
      </p>

      <h2>What you can&apos;t do</h2>
      <p>
        Don&apos;t try to circumvent the safety guards (allergen checks,
        budget caps, ₹1000 cart limit). Don&apos;t scrape our endpoints.
        Don&apos;t impersonate other users. Don&apos;t use HungryHeads to
        order on someone else&apos;s behalf without their permission.
      </p>

      <h2>Liability</h2>
      <p>
        HungryHeads is provided as-is during Phase 1. We try our best on
        allergen safety (SafePlate filters every order), but ALWAYS verify
        ingredient lists with the restaurant before eating if you have
        severe allergies. We can&apos;t be liable for restaurant-side
        mistakes.
      </p>

      <h2>Changes</h2>
      <p>
        We&apos;ll email you before any material change to these terms.
        Phase 2 brings the full Builders Club v1 launch terms — this stub
        will be replaced.
      </p>

      <p>
        Questions:{" "}
        <a
          href={`mailto:${BRAND.contactEmail}`}
          className="text-hh-orange-dark underline hover:no-underline"
        >
          {BRAND.contactEmail}
        </a>
      </p>
    </LegalPage>
  );
}
