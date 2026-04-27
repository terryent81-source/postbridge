import { Star } from "lucide-react"

const STATS = [
  { value: "12,400+", label: "활성 크리에이터" },
  { value: "850K+", label: "발행된 게시물" },
  { value: "5", label: "지원 플랫폼" },
  { value: "99.9%", label: "업로드 성공률" },
]

export function StatsStrip() {
  return (
    <section
      aria-label="서비스 지표"
      className="border-y border-border bg-card"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid divide-y divide-border md:grid-cols-4 md:divide-x md:divide-y-0">
          {STATS.map((s) => (
            <div key={s.label} className="flex flex-col items-center gap-1 px-6 py-7 text-center">
              <span className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                {s.value}
              </span>
              <span className="text-xs font-medium text-muted-foreground sm:text-sm">{s.label}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-center gap-2 border-t border-border py-4 text-sm text-muted-foreground">
          <span className="flex" aria-label="평점 4.9점">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden="true" />
            ))}
          </span>
          <span className="font-semibold text-foreground">4.9 / 5.0</span>
          <span className="hidden sm:inline">— 국내 1,200+ 크리에이터의 선택</span>
        </div>
      </div>
    </section>
  )
}
