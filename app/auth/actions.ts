"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const credentialsSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(72, "Password is too long."),
});

const signUpSchema = credentialsSchema.extend({
  fullName: z.string().trim().min(1, "Tell us your name.").max(80),
});

export type AuthActionState = {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

/** Server action — email + password sign-in. */
export async function signInWithEmail(
  _prev: AuthActionState | null,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join(".")] = issue.message;
    }
    return { ok: false, fieldErrors };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { ok: false, error: error.message };
  }

  const redirectTo =
    typeof formData.get("redirect") === "string"
      ? (formData.get("redirect") as string)
      : "/dashboard";

  revalidatePath("/", "layout");
  redirect(redirectTo || "/dashboard");
}

/** Server action — email + password sign-up. */
export async function signUpWithEmail(
  _prev: AuthActionState | null,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    fullName: formData.get("fullName"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join(".")] = issue.message;
    }
    return { ok: false, fieldErrors };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${
        process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
      }/auth/callback`,
    },
  });
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/", "layout");
  // After sign-up land on onboarding (Step 5). The middleware will gate it.
  redirect("/onboarding");
}

/** Server action — sign out and bounce home. */
export async function signOut(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
