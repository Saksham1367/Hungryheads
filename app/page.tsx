import { MarketingNav } from "@/components/marketing/nav";
import { Hero } from "@/components/marketing/hero";
import {
  FeatureSection,
  FEATURE_COPY,
} from "@/components/marketing/feature-section";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { TrustBar } from "@/components/marketing/trust-bar";
import { FinalCta } from "@/components/marketing/final-cta";
import { MarketingFooter } from "@/components/marketing/footer";
import { MarketingChatDock } from "@/components/marketing/chat-dock";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <MarketingNav />

      <main id="features" className="flex-1">
        <Hero />
        <TrustBar />

        {FEATURE_COPY.map((feature, i) => (
          <FeatureSection key={feature.id} feature={feature} index={i} />
        ))}

        <HowItWorks />
        <FinalCta />
      </main>

      <MarketingFooter />
      <MarketingChatDock />
    </div>
  );
}
