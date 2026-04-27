import { PageHeader } from "@/components/app/page-header"
import { Pricing } from "@/components/landing/pricing"

export default function PricingPage() {
  return (
    <>
      <PageHeader
        title="요금제"
        description="필요에 맞는 플랜을 선택하고 언제든 업그레이드 또는 다운그레이드하세요."
      />
      <div className="bg-background">
        <Pricing standalone />
      </div>
    </>
  )
}
