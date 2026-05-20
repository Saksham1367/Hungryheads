import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";
import { BRAND } from "@/lib/constants";

export const metadata: Metadata = { title: "DPDP Compliance" };

export default function DpdpPage() {
  return (
    <LegalPage eyebrow="Compliance" title="DPDP 2023 compliance">
      <p>
        HungryHeads is built to comply with India&apos;s Digital Personal
        Data Protection Act, 2023. Here&apos;s how we honour each principle.
      </p>

      <h2>Lawful processing</h2>
      <p>
        We process your data only with your explicit consent. You consent
        when you sign up, complete onboarding, and connect Swiggy.
      </p>

      <h2>Purpose limitation</h2>
      <p>
        Onboarding answers feed the AI agent&apos;s recommendations.
        Allergies are used by SafePlate to filter menus and block unsafe
        orders. Swiggy tokens are used to fetch menus and place orders on
        your behalf. None of this data is used for any other purpose.
      </p>

      <h2>Data localisation</h2>
      <p>
        HungryHeads&apos; database and Swiggy tokens live in Supabase Mumbai
        (<code>ap-south-1</code>). Swiggy MCP itself runs in AWS Mumbai with
        Singapore (<code>ap-southeast-1</code>) failover; no Swiggy data
        leaves India / Singapore.
      </p>
      <p>
        <strong>Cross-border processing disclosure.</strong> Chat messages
        are sent to Anthropic&apos;s Claude API (US-East) to generate the
        agent&apos;s replies. We minimise what crosses the border — we ship
        the conversation turn plus your preferences and allergies, but never
        raw Swiggy session tokens or full order history. Before production,
        we&apos;ll execute a Data Processing Agreement (DPA) with Swiggy
        and rely on Anthropic&apos;s Standard Contractual Clauses.
      </p>

      <h2>Who&apos;s the Data Fiduciary for Swiggy data</h2>
      <p>
        Under DPDP 2023, <strong>Swiggy is the Data Fiduciary</strong> for
        every piece of data the Swiggy MCP servers return — your saved
        addresses, restaurant history, order details, delivery tracking.
        HungryHeads acts as a Data Processor on that data, scoped to the
        immediate task you asked us to do. We never use Swiggy-originated
        data for analytics, ads, or model training.
      </p>
      <p>
        <strong>Deletion of Swiggy data goes through the Swiggy app.</strong>{" "}
        If you remove your Swiggy account, the corresponding history
        disappears for HungryHeads too on the next session — we don&apos;t
        cache it independently.
      </p>

      <h2>Security</h2>
      <p>
        Row-Level Security on every table. Swiggy access tokens are stored
        encrypted at rest (Phase 2 wires Supabase Vault; Phase 1 uses
        service-role-gated rows). All transit is HTTPS.
      </p>

      <h2>Your rights</h2>
      <p>
        Access, correction, erasure, grievance redressal — all available via{" "}
        <a
          href={`mailto:${BRAND.contactEmail}`}
          className="text-hh-orange-dark underline hover:no-underline"
        >
          {BRAND.contactEmail}
        </a>{" "}
        during Phase 1. Self-serve flows land in Phase 2.
      </p>

      <h2>Data Protection Officer</h2>
      <p>
        For Phase 1 the founding team is the DPO contact. Once we expand
        beyond beta, we&apos;ll appoint a dedicated DPO and update this
        page.
      </p>
    </LegalPage>
  );
}
