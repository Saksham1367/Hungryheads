import Link from "next/link";
import type { Metadata } from "next";
import { GoogleButton } from "@/components/auth/google-button";
import { SignInForm } from "@/components/auth/sign-in-form";
import { OrDivider } from "@/components/auth/divider";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage({
  searchParams,
}: {
  searchParams?: { redirect?: string; error?: string };
}) {
  const redirect = searchParams?.redirect;
  const oauthError = searchParams?.error;

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-hh-black">
          Welcome back
        </h1>
        <p className="text-hh-gray">
          Sign in to your HungryHeads account.
        </p>
      </div>

      {oauthError && (
        <div
          role="alert"
          className="rounded-xl border border-hh-danger/40 bg-red-50 px-3 py-2 text-sm text-hh-danger"
        >
          {oauthError === "missing_code"
            ? "Sign-in was cancelled. Try again."
            : oauthError}
        </div>
      )}

      <GoogleButton next={redirect ?? "/dashboard"} />

      <OrDivider />

      <SignInForm redirectTo={redirect} />

      <p className="text-sm text-center text-hh-gray">
        New to HungryHeads?{" "}
        <Link
          href="/auth/sign-up"
          className="font-semibold text-hh-orange-dark hover:underline"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}
