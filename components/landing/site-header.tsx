import Link from "next/link"
import { Button } from "@/components/ui/button"
import { BrandLogo } from "@/components/brand-logo"
import { MobileMenu } from "@/components/landing/mobile-menu"

const NAV = [
  { href: "#features", label: "기능" },
  { href: "#why", label: "서비스 소개" },
  { href: "#pricing", label: "요금제" },
  { href: "#faq", label: "FAQ" },
]

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="PostBridge 홈" className="shrink-0">
          <BrandLogo />
        </Link>
        <nav className="hidden items-center gap-1 text-sm md:flex" aria-label="주요 메뉴">
          {NAV.map((n) => (
            <a
              key={n.href}
              href={n.href}
              className="rounded-md px-3 py-2 font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              {n.label}
            </a>
          ))}
          <Link
            href="/dashboard"
            className="rounded-md px-3 py-2 font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            대시보드
          </Link>
        </nav>
        <div className="flex items-center gap-1 sm:gap-2">
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href="/login">로그인</Link>
          </Button>
          <Button
            asChild
            size="sm"
            className="brand-gradient press-effect text-primary-foreground shadow-sm hover:opacity-95 hover:shadow-md"
          >
            <Link href="/signup">무료로 시작</Link>
          </Button>
          <MobileMenu />
        </div>
      </div>
    </header>
  )
}
