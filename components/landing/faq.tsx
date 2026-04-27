import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

const FAQS = [
  {
    q: "정말 5개 SNS에 동시에 업로드되나요?",
    a: "네, Instagram·Facebook·YouTube·TikTok·X 5개 플랫폼에 한 번의 클릭으로 동시 업로드됩니다. 각 플랫폼의 글자 수, 미디어 형식, 해시태그 정책을 자동으로 검사해 실패율을 최소화합니다.",
  },
  {
    q: "무료로 어디까지 사용할 수 있나요?",
    a: "Free 플랜에서는 매주 3회의 업로드를 영구 무료로 제공합니다. 신용카드 등록이 필요 없으며, 추천 코드로 친구를 초대할 때마다 +3회가 추가됩니다.",
  },
  {
    q: "예약된 게시물은 안전하게 발행되나요?",
    a: "예약된 시간 5분 전부터 자동 큐가 시작되며, 일시적인 API 오류 시 최대 3회까지 자동 재시도합니다. 모든 발행 결과는 업로드 기록 페이지에서 즉시 확인할 수 있습니다.",
  },
  {
    q: "어떤 플랫폼 계정이 필요하나요?",
    a: "Instagram은 Business 또는 Creator 계정, Facebook은 Page 권한, YouTube는 채널 소유자, TikTok은 Creator/Business 계정, X는 API 액세스가 필요합니다. 각 페이지에서 단계별 가이드를 제공합니다.",
  },
  {
    q: "팀원과 함께 사용할 수 있나요?",
    a: "Pro 플랜부터 여러 브랜드 관리가 가능하며, Business 플랜에서는 팀 계정과 권한 관리, 사용량 통계 등 에이전시 운영에 필요한 기능을 모두 제공합니다.",
  },
  {
    q: "환불 정책은 어떻게 되나요?",
    a: "결제 후 7일 이내 미사용 상태라면 100% 환불해 드립니다. 기업 고객은 별도 계약 조건에 따라 환불 정책이 적용됩니다.",
  },
]

export function Faq() {
  return (
    <section id="faq" className="border-t border-border bg-secondary/30 py-20 sm:py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">FAQ</p>
          <h2 className="mt-2 text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            자주 묻는 질문
          </h2>
          <p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground">
            궁금한 점이 있다면 먼저 아래에서 확인해 보세요.
          </p>
        </div>

        <Accordion
          type="single"
          collapsible
          defaultValue="faq-0"
          className="mt-10 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card"
        >
          {FAQS.map((f, i) => (
            <AccordionItem key={i} value={`faq-${i}`} className="border-0 px-5">
              <AccordionTrigger className="py-5 text-left text-sm font-semibold text-foreground hover:no-underline sm:text-base">
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="pb-5 text-sm leading-relaxed text-muted-foreground">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}
