import { SiteHeader } from "@/components/landing/site-header"
import { Hero } from "@/components/landing/hero"
import { StatsStrip } from "@/components/landing/stats-strip"
import { Why } from "@/components/landing/why"
import { Features } from "@/components/landing/features"
import { Testimonials } from "@/components/landing/testimonials"
import { Pricing } from "@/components/landing/pricing"
import { Faq } from "@/components/landing/faq"
import { FinalCta } from "@/components/landing/final-cta"
import { SiteFooter } from "@/components/landing/site-footer"

export default function HomePage() {
  return (
    <main className="min-h-dvh bg-background">
      <SiteHeader />
      <Hero />
      <StatsStrip />
      <Why />
      <Features />
      <Testimonials />
      <Pricing />
      <Faq />
      <FinalCta />
      <SiteFooter />
    </main>
  )
}
