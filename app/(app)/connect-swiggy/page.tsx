import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Check,
  Lock,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSwiggyToken } from "@/lib/swiggy/tokens";
import { isMcpMockMode } from "@/lib/swiggy/oauth";
import { Button } from "@/components/ui/button";
import { AppHeader } from "@/components/app/header";

export const metadata: Metadata = { title: "Connect Swiggy" };

export default async function ConnectSwiggyPage({
  searchParams,
}: {
  searchParams?: { connected?: string; disconnected?: string; mock?: string; error?: string; detail?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in?redirect=/connect-swiggy");

  const token = await getSwiggyToken(user.id);
  const connected = !!token;
  const mock = isMcpMockMode();

  const showSuccess = !!searchParams?.connected || !!searchParams?.mock;
  const showDisconnected = !!searchParams?.disconnected;
  const showError = !!searchParams?.error;
  const errorCode = searchParams?.error;
  const errorDetail = searchParams?.detail;

  return (
    <div className="min-h-screen bg-hh-cream">
    <AppHeader />
    <div className="container max-w-2xl py-10 md:py-16 space-y-8">
      <div className="space-y-2 text-center">
        <span className="inline-block rounded-full bg-hh-orange-light px-3 py-1 text-xs font-bold text-hh-orange-dark uppercase tracking-wider">
          {mock ? "Mock mode · MCP_MODE=mock" : "Live · OAuth 2.1 PKCE"}
        </span>
        <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight text-hh-black">
          {connected ? "Swiggy connected" : "Connect your Swiggy account"}
        </h1>
        <p className="text-hh-charcoal max-w-md mx-auto">
          {connected
            ? "We're linked up. FoodHuddle, SafePlate and SpendSmart can now use your Swiggy data."
            : "Link your Swiggy account so we can pull menus, place COD orders, and respect your real order history."}
        </p>
      </div>

      {showSuccess && (
        <Banner tone="success">
          <Check className="h-4 w-4" />
          {searchParams?.mock
            ? "Mock token issued (5-day TTL). MCP_MODE=mock — set MCP_MODE=live in .env.local once Swiggy approves your Builders Club application."
            : "Swiggy account linked successfully."}
        </Banner>
      )}
      {showDisconnected && (
        <Banner tone="info">Swiggy disconnected.</Banner>
      )}
      {showError && (
        <Banner tone="danger">
          OAuth error: <span className="font-mono">{errorCode}</span>
          {errorDetail ? (
            <span className="block text-xs mt-1 opacity-80 font-mono">
              {errorDetail}
            </span>
          ) : null}
        </Banner>
      )}

      {/* Status card */}
      <div className="rounded-2xl border border-hh-gray-light bg-white p-6 md:p-8 space-y-5">
        <div className="flex items-start gap-4">
          <span
            className={
              connected
                ? "h-12 w-12 rounded-xl bg-emerald-50 text-hh-success inline-flex items-center justify-center shrink-0"
                : "h-12 w-12 rounded-xl bg-hh-orange-light text-hh-orange-dark inline-flex items-center justify-center shrink-0"
            }
          >
            {connected ? (
              <Check className="h-5 w-5" />
            ) : (
              <Sparkles className="h-5 w-5" />
            )}
          </span>
          <div className="flex-1 space-y-1">
            <div className="font-display font-bold text-lg text-hh-black">
              {connected ? "Connection active" : "Not connected"}
            </div>
            {connected && token ? (
              <div className="text-sm text-hh-gray space-y-0.5">
                <div>
                  Expires{" "}
                  <span className="font-semibold text-hh-charcoal tabular">
                    {token.expires_at.toLocaleString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div className="text-xs">
                  Scopes:{" "}
                  <span className="font-mono">{token.scopes.join(" ")}</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-hh-gray">
                {mock
                  ? "Mock mode will instantly issue a fake 5-day token so you can build downstream features without real Swiggy credentials."
                  : "You'll be redirected to Swiggy's official OAuth screen — we never see your password."}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          {connected ? (
            <>
              <Link href="/dashboard" className="flex-1">
                <Button variant="primary" size="md" className="w-full">
                  Back to dashboard
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <form action="/api/swiggy-oauth/disconnect" method="post">
                <Button type="submit" variant="secondary" size="md">
                  Disconnect
                </Button>
              </form>
            </>
          ) : (
            <Link
              href="/api/swiggy-oauth/start"
              className="flex-1"
            >
              <Button variant="primary" size="md" className="w-full">
                {mock ? "Issue mock token" : "Connect with Swiggy"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Trust pillars */}
      <div className="grid sm:grid-cols-3 gap-3">
        <TrustItem
          icon={Lock}
          title="OAuth 2.1 PKCE"
          blurb="Industry-standard. We never see your Swiggy password."
        />
        <TrustItem
          icon={ShieldCheck}
          title="Encrypted at rest"
          blurb="Tokens RLS-gated. Phase 2 wires Supabase Vault."
        />
        <TrustItem
          icon={Sparkles}
          title="5-day token"
          blurb="Auto-expires per Swiggy v1. Reconnect when prompted."
        />
      </div>
    </div>
    </div>
  );
}

function Banner({
  tone,
  children,
}: {
  tone: "success" | "info" | "danger";
  children: React.ReactNode;
}) {
  const cls =
    tone === "success"
      ? "bg-emerald-50 border-hh-success/40 text-hh-success"
      : tone === "info"
        ? "bg-blue-50 border-hh-info/40 text-hh-info"
        : "bg-red-50 border-hh-danger/40 text-hh-danger";
  return (
    <div
      role="alert"
      className={`rounded-xl border px-4 py-3 text-sm flex items-start gap-2 ${cls}`}
    >
      {children}
    </div>
  );
}

function TrustItem({
  icon: Icon,
  title,
  blurb,
}: {
  icon: typeof Lock;
  title: string;
  blurb: string;
}) {
  return (
    <div className="rounded-xl border border-hh-gray-light bg-white p-4 space-y-1.5">
      <span className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-hh-orange-light text-hh-orange-dark">
        <Icon className="h-4 w-4" />
      </span>
      <div className="font-semibold text-sm text-hh-black">{title}</div>
      <div className="text-xs text-hh-gray">{blurb}</div>
    </div>
  );
}
