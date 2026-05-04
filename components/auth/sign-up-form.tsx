"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { signUpWithEmail, type AuthActionState } from "@/app/auth/actions";

const initialState: AuthActionState = { ok: false };

export function SignUpForm() {
  const [state, action] = useFormState(signUpWithEmail, initialState);

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="fullName">Your name</Label>
        <Input
          id="fullName"
          name="fullName"
          type="text"
          autoComplete="name"
          required
          placeholder="Saksham Dhingra"
          aria-invalid={!!state.fieldErrors?.fullName}
        />
        {state.fieldErrors?.fullName && (
          <p className="text-xs text-hh-danger">
            {state.fieldErrors.fullName}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          aria-invalid={!!state.fieldErrors?.email}
        />
        {state.fieldErrors?.email && (
          <p className="text-xs text-hh-danger">{state.fieldErrors.email}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          placeholder="At least 8 characters"
          aria-invalid={!!state.fieldErrors?.password}
        />
        {state.fieldErrors?.password && (
          <p className="text-xs text-hh-danger">
            {state.fieldErrors.password}
          </p>
        )}
      </div>

      {state.error && (
        <div
          role="alert"
          className="rounded-xl border border-hh-danger/40 bg-red-50 px-3 py-2 text-sm text-hh-danger"
        >
          {state.error}
        </div>
      )}

      <SubmitButton />

      <p className="text-xs text-hh-gray text-center">
        By creating an account you agree to our terms and our DPDP-compliant
        privacy practices.
      </p>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="primary"
      size="md"
      className="w-full"
      disabled={pending}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      Create account
    </Button>
  );
}
