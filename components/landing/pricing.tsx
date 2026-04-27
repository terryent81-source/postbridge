"use client"

import Link from "next/link"
import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Check, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

type Cycle = "monthly" | "annual"

type Plan = {
  id: string
  name: string
  price: { monthly: string; annual: string }
  period: string
  description: string
  features: string[]
  cta: string
  highlight?: boolean
  free?: boolean
}

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: { monthly: "0원", annual: "0원" },
    period: "무료",
    description: "지금 바로 시작해보세요.",
    features: ["매주 무료 업로드 3회", "기본 게시물 작성", "업로드 기록 확인"],
    cta: "무료 시작",
    free: true,
  },
  {
    id: "starter",
    name: "Starter",
    price: { monthly: "9,900원", annual: "7,900원" },
    period: "/월",
    description: "1인 크리에이터에게 추천",
    features: ["월 100회 업로드", "예약 업로드", "기본 분석", "이메일 지원"],
    cta: "Starter 시작",
    highlight: true,
  },
  {
    id: "pro",
    name: "Pro",
    price: { monthly: "29,000원", annual: "23,200원" },
    period: "/월",
    description: "여러 브랜드를 관리하는 팀",
    features: ["월 500회 업로드", "고급 예약 기능", "여러 브랜드 관리", "팀 협업 준비", "우선 지원"],
    cta: "Pro 시작",
  },
  {
    id: "business",
    name: "Business",
    price: { monthly: "99,000원", annual: "79,200원" },
    period: "/월",
    description: "에이전시 / 대규모 운영",
    features: ["무제한 업로드", "팀 계정", "여러 브랜드 관리", "관리자 권한", "고급 로그 관리"],
    cta: "Business 문의",
  },
]

export function Pricing({ standalone = false }: { standalone?: boolean }) {
  const [cycle, setCycle] = useState<Cycle>("annual")

  return (
    <section
      id="pricing"
      className={cn("py-20 sm:py-24", !standalone && "border-y border-border bg-background")}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">Pricing</p>
          <h2 className="mt-2 text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            합리적인 요금제
          </h2>
          <p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground">
            무료로 시작해, 필요할 때 유연하게 업그레이드하세요. 언제든 취소 가능합니다.
          </p>
        </div>

        {/* Billing toggle */}
        <div className="mt-8 flex justify-center">
          <div
            role="tablist"
            aria-label="결제 주기"
            className="inline-flex items-center gap-1 rounded-full border border-border bg-card p-1 shadow-sm"
          >
            <button
              type="button"
              role="tab"
              aria-selected={cycle === "monthly"}
              onClick={() => setCycle("monthly")}
              className={cn(
                "press-effect rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
                cycle === "monthly"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              월간 결제
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={cycle === "annual"}
              onClick={() => setCycle("annual")}
              className={cn(
                "press-effect inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
                cycle === "annual"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              연간 결제
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                  cycle === "annual"
                    ? "bg-emerald-400/90 text-emerald-950"
                    : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
                )}
              >
                20% 절약
              </span>
            </button>
          </div>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan) => (
            <Card
              key={plan.id}
              className={cn(
                "card-hover relative flex flex-col border-border/80",
                plan.highlight
                  ? "border-primary/40 shadow-xl shadow-primary/10 ring-1 ring-primary/20"
                  : "shadow-sm hover:shadow-md",
              )}
            >
              {plan.highlight && (
                <Badge className="brand-gradient absolute -top-3 left-1/2 -translate-x-1/2 gap-1 text-primary-foreground shadow-md">
                  <Sparkles className="h-3 w-3" /> 가장 인기
                </Badge>
              )}
              <CardContent className="flex flex-1 flex-col gap-5 p-6">
                <div>
                  <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold tracking-tight text-foreground">
                      {plan.price[cycle]}
                    </span>
                    <span className="text-sm text-muted-foreground">{plan.period}</span>
                  </div>
                  {!plan.free && cycle === "annual" && (
                    <p className="text-xs text-muted-foreground line-through">
                      {plan.price.monthly}
                      <span className="ml-1.5 font-semibold not-italic text-emerald-600 no-underline dark:text-emerald-400">
                        20% 할인 적용
                      </span>
                    </p>
                  )}
                </div>
                <ul className="space-y-2.5">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-2">
                  <Button
                    asChild
                    className={cn(
                      "press-effect w-full",
                      plan.highlight ? "brand-gradient text-primary-foreground hover:opacity-95" : "",
                    )}
                    variant={plan.highlight ? "default" : "outline"}
                  >
                    <Link href="/signup">{plan.cta}</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
