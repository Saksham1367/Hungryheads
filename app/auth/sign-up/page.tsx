import Link from "next/link";
import type { Metadata } from "next";
import { GoogleButton } from "@/components/auth/google-button";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { OrDivider } from "@/components/auth/divider";

export const metadata: Metadata = { title: "Sign up" };

export default function SignUpPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-hh-black">
          Create your account
        </h1>
        <p className="text-hh-gray">
          Free forever for Phase 1. No credit card needed.
        </p>
      </div>

      <GoogleButton next="/onboarding" label="Sign up with Google" />

      <OrDivider />

      <SignUpForm />

      <p className="text-sm text-center text-hh-gray">
        Already have an account?{" "}
        <Link
          href="/auth/sign-in"
          className="font-semibold text-hh-orange-dark hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
