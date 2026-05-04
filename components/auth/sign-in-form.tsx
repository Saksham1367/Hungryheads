"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { signInWithEmail, type AuthActionState } from "@/app/auth/actions";

const initialState: AuthActionState = { ok: false };

export function SignInForm({ redirectTo }: { redirectTo?: string }) {
  const [state, action] = useFormState(signInWithEmail, initialState);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="redirect" value={redirectTo ?? "/dashboard"} />

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
          autoComplete="current-password"
          required
          placeholder="••••••••"
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
      Sign in
    </Button>
  );
}
