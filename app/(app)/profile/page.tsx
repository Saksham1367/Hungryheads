import type { Metadata } from "next";
import { ComingSoon } from "@/components/app/coming-soon";

export const metadata: Metadata = { title: "Profile" };

export default function ProfilePage() {
  return (
    <ComingSoon
      step="Phase 2"
      title="Profile"
      blurb="Edit your allergies, diet, monthly budget, delivery radius and food personality. Today these are set during onboarding only."
      badge="Phase 2"
    />
  );
}
