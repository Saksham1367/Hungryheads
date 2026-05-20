import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app/header";
import {
  ProfileEditForm,
  type ProfileInitialValues,
} from "@/components/profile/edit-form";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in?redirect=/profile");

  const [{ data: profile }, { data: prefs }, { data: allergies }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("email, full_name")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("user_preferences")
        .select(
          "cuisines, diet, monthly_budget, delivery_radius_km, personality",
        )
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("user_allergies")
        .select("allergen")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true }),
    ]);

  const fullName =
    profile?.full_name?.trim() ||
    profile?.email.split("@")[0] ||
    user.email?.split("@")[0] ||
    "Friend";

  const initial: ProfileInitialValues = {
    cuisines: prefs?.cuisines ?? [],
    allergies: (allergies ?? []).map((a) => a.allergen),
    diet: prefs?.diet ?? null,
    monthlyBudget: prefs?.monthly_budget ?? null,
    deliveryRadiusKm: prefs?.delivery_radius_km ?? 5,
    personality: prefs?.personality ?? null,
  };

  return (
    <div className="min-h-screen bg-hh-cream">
      <AppHeader />
      <div className="container max-w-2xl py-8 md:py-12 space-y-8">
        <div className="space-y-1">
          <span className="inline-block rounded-full bg-hh-orange-light px-3 py-1 text-xs font-bold text-hh-orange-dark uppercase tracking-wider">
            Profile
          </span>
          <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight text-hh-black">
            Edit your profile
          </h1>
          <p className="text-hh-charcoal">
            Update what you love eating, your allergies, budget, and food
            personality. The agent reads these on every chat — changes take
            effect immediately.
          </p>
        </div>

        <ProfileEditForm
          initial={initial}
          email={profile?.email ?? user.email ?? ""}
          fullName={fullName}
        />
      </div>
    </div>
  );
}
