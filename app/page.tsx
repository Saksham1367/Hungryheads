import { MarketingNav } from "@/components/marketing/nav";
import { Hero } from "@/components/marketing/hero";
import { ProblemStrip } from "@/components/marketing/problem-strip";
import { TrustBar } from "@/components/marketing/trust-bar";
import {
  FeatureSection,
  FEATURE_COPY,
} from "@/components/marketing/feature-section";
import { WhatsNext } from "@/components/marketing/whats-next";
import { WhoItsFor } from "@/components/marketing/who-its-for";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { Faq } from "@/components/marketing/faq";
import { FinalCta } from "@/components/marketing/final-cta";
import { MarketingFooter } from "@/components/marketing/footer";
import { MarketingChatDock } from "@/components/marketing/chat-dock";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <MarketingNav />

      <main id="main" className="flex-1">
        <Hero />
        <ProblemStrip />
        <TrustBar />

        <div id="features">
          {FEATURE_COPY.map((feature, i) => (
            <FeatureSection key={feature.id} feature={feature} index={i} />
          ))}
        </div>

        <WhatsNext />
        <WhoItsFor />
        <HowItWorks />
        <Faq />
        <FinalCta />
      </main>

      <MarketingFooter />
      <MarketingChatDock />
    </div>
  );
}
