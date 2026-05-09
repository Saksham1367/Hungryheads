import type { Metadata } from "next";
import { ComingSoon } from "@/components/app/coming-soon";

export const metadata: Metadata = { title: "VoiceOrder" };

export default function VoiceOrderPage() {
  return (
    <ComingSoon
      step="Phase 3"
      title="VoiceOrder"
      blurb="Order on WhatsApp by voice. Smart reorder learns your cadence (milk every 5 days, atta every 3 weeks) and pings when items are due."
      badge="Phase 3"
    />
  );
}
