import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, MessageCircle, Mic, RefreshCcw, Phone } from "lucide-react";
import { AppHeader } from "@/components/app/header";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "VoiceOrder" };

export default function VoiceOrderPage() {
  return (
    <div className="min-h-screen bg-hh-cream">
      <AppHeader />
      <div className="container max-w-3xl py-8 md:py-12 space-y-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-hh-gray hover:text-hh-charcoal"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </Link>

        {/* Hero */}
        <div className="space-y-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-hh-info uppercase tracking-wider">
            <Mic className="h-3 w-3" />
            Coming soon
          </span>
          <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight text-hh-black">
            VoiceOrder
          </h1>
          <p className="text-hh-charcoal text-base md:text-lg max-w-xl">
            Speak-to-order on WhatsApp. Smart reorder learns your cadence
            (milk every 5 days, atta every 3 weeks) and pings you when items
            are due. Designed for elderly parents who can&apos;t navigate
            apps, anyone driving, anyone who wants their <em>usual</em>{" "}
            without 12 taps.
          </p>
        </div>

        {/* WhatsApp mockup */}
        <div className="grid lg:grid-cols-[1fr_auto] gap-6 items-start">
          <WhatsAppMockup />

          <div className="space-y-4 max-w-sm">
            <Capability
              icon={MessageCircle}
              title="Voice notes via WhatsApp"
              blurb="No app to install. Speak in English, Hindi, or a mix — Whisper transcribes, Claude parses intent, the agent confirms cart + total before placing."
            />
            <Capability
              icon={RefreshCcw}
              title="Smart reorder cadence"
              blurb="Learns over weeks. After 3 reorders of milk every 5 days, the agent proactively pings you on day 4 — one tap to reorder."
            />
            <Capability
              icon={Phone}
              title="Phone-call surface (later)"
              blurb="Twilio inbound number for users without WhatsApp. Same agent, same memory, same SafePlate guards."
            />
          </div>
        </div>

        {/* When */}
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6 space-y-3">
          <h2 className="font-display font-bold text-lg text-hh-black">
            Why it&apos;s not live yet
          </h2>
          <p className="text-sm text-hh-charcoal leading-relaxed">
            VoiceOrder needs WhatsApp Cloud API access plus a voice-transcription
            hookup. We&apos;re shipping the chat-first experience first — then
            we&apos;ll wire the WhatsApp webhook and route voice notes through
            the same agent core that powers the dashboard chat today.
          </p>
          <p className="text-sm text-hh-charcoal">
            Until then, every capability VoiceOrder will do — search, order,
            allergy-check, smart reorder — is already working in the dashboard
            chat. WhatsApp is just a different channel into the same brain.
          </p>
          <Link href="/dashboard" className="inline-block pt-2">
            <Button variant="primary" size="md">
              Try it in chat now
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function Capability({
  icon: Icon,
  title,
  blurb,
}: {
  icon: typeof Mic;
  title: string;
  blurb: string;
}) {
  return (
    <div className="rounded-xl border border-hh-gray-light bg-white p-4 space-y-1.5">
      <span className="inline-flex items-center justify-center h-9 w-9 rounded-xl bg-hh-orange-light text-hh-orange-dark">
        <Icon className="h-4 w-4" />
      </span>
      <h3 className="font-display font-bold text-hh-black text-sm">{title}</h3>
      <p className="text-xs text-hh-charcoal leading-relaxed">{blurb}</p>
    </div>
  );
}

/**
 * Static WhatsApp-style mockup of a VoiceOrder exchange. Pure CSS — no
 * images, no JS. Demonstrates the flow at a glance.
 */
function WhatsAppMockup() {
  return (
    <div className="rounded-3xl border border-hh-gray-light bg-white shadow-xl overflow-hidden max-w-[360px] mx-auto lg:mx-0">
      {/* WhatsApp-style header */}
      <div className="bg-[#075E54] text-white px-4 py-3 flex items-center gap-3">
        <span className="h-9 w-9 rounded-full bg-hh-orange flex items-center justify-center text-sm font-bold">
          HH
        </span>
        <div>
          <div className="font-semibold text-sm">HungryHeads</div>
          <div className="text-[10px] opacity-80">online · powered by Claude</div>
        </div>
      </div>

      {/* Conversation */}
      <div className="bg-[#ECE5DD] p-4 space-y-2.5 min-h-[440px]">
        {/* Voice note from user */}
        <div className="ml-auto max-w-[80%] bg-[#DCF8C6] rounded-lg rounded-tr-none p-3 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-[#075E54] flex items-center justify-center text-white">
              <Mic className="h-3.5 w-3.5" />
            </div>
            <div className="flex-1">
              <WaveformBars />
            </div>
            <span className="text-[10px] text-hh-gray font-mono">0:09</span>
          </div>
          <div className="text-[10px] text-hh-gray mt-1.5 italic">
            &ldquo;Order my usual milk and bread&rdquo;
          </div>
          <div className="text-[9px] text-right text-hh-gray mt-1">9:42 ✓✓</div>
        </div>

        {/* Agent confirms */}
        <div className="max-w-[85%] bg-white rounded-lg rounded-tl-none p-3 shadow-sm">
          <div className="text-[13px] text-hh-charcoal leading-relaxed space-y-1.5">
            <div className="font-semibold text-hh-black">Got it — confirming:</div>
            <ul className="space-y-0.5 text-[12px]">
              <li>· Amul Taaza Milk 1L × 2</li>
              <li>· Britannia Brown Bread × 1</li>
            </ul>
            <div className="flex items-center justify-between pt-1.5 border-t border-hh-gray-light">
              <span className="text-hh-gray text-[11px]">Total · COD</span>
              <span className="font-bold tabular text-hh-black">₹178</span>
            </div>
            <div className="text-[11px] text-hh-gray pt-0.5">
              Reply <strong className="text-hh-orange-dark">YES</strong> to
              place. SafePlate cleared everything.
            </div>
          </div>
          <div className="text-[9px] text-hh-gray mt-1.5">9:42</div>
        </div>

        {/* User confirms */}
        <div className="ml-auto max-w-[60%] bg-[#DCF8C6] rounded-lg rounded-tr-none px-3 py-2 shadow-sm">
          <div className="text-[13px] font-bold text-hh-black">YES</div>
          <div className="text-[9px] text-right text-hh-gray mt-0.5">9:42 ✓✓</div>
        </div>

        {/* Agent placed */}
        <div className="max-w-[85%] bg-white rounded-lg rounded-tl-none p-3 shadow-sm">
          <div className="text-[13px] text-hh-charcoal leading-relaxed">
            <div className="font-semibold text-hh-success">
              ✓ Order placed
            </div>
            <div className="text-[11px] text-hh-gray mt-0.5">
              Track:{" "}
              <span className="font-mono text-hh-orange-dark">IM3F8K2</span>
            </div>
          </div>
          <div className="text-[9px] text-hh-gray mt-1.5">9:43</div>
        </div>
      </div>
    </div>
  );
}

function WaveformBars() {
  // Tiny inline waveform — just decorative bars.
  const heights = [4, 8, 12, 6, 10, 14, 9, 5, 11, 7, 13, 6, 8, 4, 10, 12];
  return (
    <div className="flex items-center gap-px h-6">
      {heights.map((h, i) => (
        <span
          key={i}
          className="w-0.5 bg-[#075E54]"
          style={{ height: `${h}px` }}
        />
      ))}
    </div>
  );
}
