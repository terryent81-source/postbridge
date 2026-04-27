"use client"

import { useState } from "react"
import Link from "next/link"
import { Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { BrandLogo } from "@/components/brand-logo"

const LINKS = [
  { href: "#features", label: "기능" },
  { href: "#why", label: "서비스 소개" },
  { href: "#pricing", label: "요금제" },
  { href: "#faq", label: "자주 묻는 질문" },
  { href: "/dashboard", label: "대시보드" },
]

export function MobileMenu() {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="메뉴 열기">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full max-w-sm p-0">
        <SheetHeader className="flex flex-row items-center justify-between border-b border-border px-5 py-4">
          <SheetTitle asChild>
            <BrandLogo />
          </SheetTitle>
          <button
            type="button"
            onClick={close}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="메뉴 닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </SheetHeader>
        <nav className="flex flex-col px-2 py-3" aria-label="모바일 메뉴">
          {LINKS.map((l) =>
            l.href.startsWith("#") ? (
              <a
                key={l.href}
                href={l.href}
                onClick={close}
                className="rounded-lg px-3 py-3 text-base font-medium text-foreground transition-colors hover:bg-secondary"
              >
                {l.label}
              </a>
            ) : (
              <Link
                key={l.href}
                href={l.href}
                onClick={close}
                className="rounded-lg px-3 py-3 text-base font-medium text-foreground transition-colors hover:bg-secondary"
              >
                {l.label}
              </Link>
            ),
          )}
        </nav>
        <div className="mt-2 space-y-2 border-t border-border px-5 py-5">
          <Button asChild variant="outline" className="w-full" onClick={close}>
            <Link href="/login">로그인</Link>
          </Button>
          <Button
            asChild
            className="brand-gradient w-full text-primary-foreground hover:opacity-95"
            onClick={close}
          >
            <Link href="/signup">무료로 시작하기</Link>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
