import { Hero } from "@/components/Hero";
import { LiveProof } from "@/components/LiveProof";
import { Pillars } from "@/components/Pillars";
import { ProtocolStrip } from "@/components/ProtocolStrip";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <ProtocolStrip />
        <Pillars />
        <LiveProof />
      </main>
      <SiteFooter />
    </>
  );
}
