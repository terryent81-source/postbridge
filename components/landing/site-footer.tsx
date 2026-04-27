import Link from "next/link"
import { BrandLogo } from "@/components/brand-logo"

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <BrandLogo />
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
            SNS 업로드를 하나로 연결하다. 콘텐츠 제작자와 비즈니스를 위한 멀티 플랫폼
            발행 워크스페이스.
          </p>
        </div>
        <div>
          <p className="mb-3 text-sm font-semibold text-foreground">제품</p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <a href="#features" className="hover:text-foreground">
                기능
              </a>
            </li>
            <li>
              <a href="#pricing" className="hover:text-foreground">
                요금제
              </a>
            </li>
            <li>
              <Link href="/dashboard" className="hover:text-foreground">
                대시보드
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="mb-3 text-sm font-semibold text-foreground">회사</p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <a href="#" className="hover:text-foreground">
                이용약관
              </a>
            </li>
            <li>
              <a href="#" className="hover:text-foreground">
                개인정보처리방침
              </a>
            </li>
            <li>
              <a href="#" className="hover:text-foreground">
                고객지원
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-2 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:px-6">
          <span>© {new Date().getFullYear()} PostBridge. All rights reserved.</span>
          <span>Made with ♥ in Seoul</span>
        </div>
      </div>
    </footer>
  )
}
