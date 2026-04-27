import { Card, CardContent } from "@/components/ui/card"
import {
  Send,
  CalendarClock,
  ImageUp,
  Hash,
  History,
  Users,
  ShieldCheck,
} from "lucide-react"

const FEATURES = [
  {
    icon: Send,
    title: "원클릭 멀티 플랫폼 업로드",
    desc: "Instagram, Facebook, YouTube, TikTok, X에 한 번에 업로드합니다.",
    accent: true,
  },
  {
    icon: CalendarClock,
    title: "예약 업로드",
    desc: "원하는 날짜와 시간에 자동으로 게시되도록 예약하세요.",
  },
  {
    icon: ImageUp,
    title: "미디어 업로드",
    desc: "이미지, 영상, 쇼츠/릴스/숏츠 포맷을 통합 관리합니다.",
  },
  {
    icon: Hash,
    title: "해시태그 관리",
    desc: "재사용 가능한 해시태그 세트로 일관된 브랜딩을 유지하세요.",
  },
  {
    icon: History,
    title: "업로드 기록",
    desc: "성공·실패한 모든 업로드 내역을 한곳에서 추적합니다.",
  },
  {
    icon: Users,
    title: "추천 보상",
    desc: "친구를 초대하고 추가 업로드 횟수를 무료로 받으세요.",
  },
  {
    icon: ShieldCheck,
    title: "관리자 운영",
    desc: "팀 전체의 사용량, 로그, 권한을 한곳에서 관리합니다.",
  },
]

export function Features() {
  return (
    <section id="features" className="bg-secondary/30 py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">Features</p>
          <h2 className="mt-2 text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            주요 기능
          </h2>
          <p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground">
            반복 업로드를 자동화하고, 운영을 표준화하는 데 필요한 모든 것.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Card
              key={i}
              className={
                f.accent
                  ? "card-hover group relative overflow-hidden border-primary/30 shadow-md hover:shadow-xl sm:col-span-2 lg:col-span-1 lg:row-span-2"
                  : "card-hover group border-border/80 shadow-sm hover:border-primary/30 hover:shadow-lg"
              }
            >
              {f.accent && (
                <div
                  className="absolute inset-0 -z-0 brand-gradient opacity-[0.08]"
                  aria-hidden="true"
                />
              )}
              <CardContent className="relative flex flex-col gap-3 p-6">
                <span
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-lg transition-transform group-hover:scale-105 ${
                    f.accent ? "brand-gradient text-primary-foreground shadow-md" : "bg-primary/10 text-primary"
                  }`}
                >
                  <f.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="text-base font-bold text-foreground">{f.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
