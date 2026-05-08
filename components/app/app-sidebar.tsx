"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  CalendarClock,
  CreditCard,
  Database,
  FileClock,
  Gift,
  History,
  LayoutDashboard,
  PenSquare,
  PlugZap,
  Settings,
  UserCog,
} from "lucide-react"
import { BrandLogo } from "@/components/brand-logo"
import { WeeklyUploadCounter } from "@/components/app/weekly-upload-counter"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"

const NAV_MAIN = [
  { href: "/dashboard", label: "대시보드", icon: LayoutDashboard },
  { href: "/dashboard/posts/new", label: "새 게시물", icon: PenSquare },
  {
    href: "/dashboard/posts/scheduled",
    label: "예약 게시물",
    icon: CalendarClock,
    badge: "5",
    badgeTone: "primary" as const,
  },
  { href: "/dashboard/posts/history", label: "업로드 기록", icon: History },
  {
    href: "/dashboard/accounts",
    label: "연결 계정",
    icon: PlugZap,
  },
  { href: "/dashboard/referral", label: "추천 보상", icon: Gift },
  { href: "/dashboard/pricing", label: "요금제", icon: CreditCard },
]

const NAV_ADMIN = [
  { href: "/dashboard/admin/upload-logs", label: "Upload Logs", icon: FileClock },
  {
    href: "/dashboard/admin/storage-cleanup",
    label: "Storage Cleanup",
    icon: Database,
  },
]

const NAV_SUPER_ADMIN = [
  { href: "/dashboard/admin/users", label: "Admin Users", icon: UserCog },
]

const NAV_BOTTOM = [{ href: "/dashboard/settings", label: "설정", icon: Settings }]

export function AppSidebar() {
  const pathname = usePathname()
  const [adminRole, setAdminRole] = useState<"admin" | "super_admin" | null>(null)
  const adminNavItems =
    adminRole === "super_admin" ? [...NAV_ADMIN, ...NAV_SUPER_ADMIN] : NAV_ADMIN

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href)

  useEffect(() => {
    let mounted = true

    const loadAdminStatus = async () => {
      try {
        const response = await fetch("/api/admin/me", { cache: "no-store" })

        if (!mounted) {
          return
        }

        if (!response.ok) {
          setAdminRole(null)
          return
        }

        const payload = (await response.json()) as { role?: string }
        setAdminRole(payload.role === "super_admin" ? "super_admin" : "admin")
      } catch {
        if (mounted) {
          setAdminRole(null)
        }
      }
    }

    loadAdminStatus()

    return () => {
      mounted = false
    }
  }, [])

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-border/60">
        <Link
          href="/dashboard"
          className="flex h-12 items-center gap-2 px-2 group-data-[collapsible=icon]:justify-center"
          aria-label="PostBridge 대시보드"
        >
          <BrandLogo />
        </Link>
      </SidebarHeader>

      <SidebarContent className="gap-4 py-3">
        <SidebarGroup>
          <SidebarGroupLabel>워크스페이스</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_MAIN.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.href)}
                    tooltip={item.label}
                    className="press-effect"
                  >
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" aria-hidden="true" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                  {"badge" in item && item.badge && (
                    <SidebarMenuBadge
                      className={
                        item.badgeTone === "primary"
                          ? "bg-primary/15 text-primary"
                          : ""
                      }
                    >
                      {item.badge}
                    </SidebarMenuBadge>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {adminRole && (
          <SidebarGroup>
            <SidebarGroupLabel>관리자</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminNavItems.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.href)}
                      tooltip={item.label}
                      className="press-effect"
                    >
                      <Link href={item.href}>
                        <item.icon className="h-4 w-4" aria-hidden="true" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup>
          <SidebarGroupLabel>계정</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_BOTTOM.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.href)}
                    tooltip={item.label}
                    className="press-effect"
                  >
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" aria-hidden="true" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          <SidebarGroupContent className="px-2">
            <WeeklyUploadCounter variant="sidebar" />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="relative overflow-hidden rounded-xl bg-primary p-4 text-primary-foreground shadow-md group-data-[collapsible=icon]:hidden">
          <p className="relative text-sm font-bold">Pro 업그레이드</p>
          <p className="relative mt-1 text-xs text-primary-foreground/85">
            더 많은 업로드와 고급 예약 기능을 사용할 수 있습니다.
          </p>
          <Link
            href="/dashboard/pricing"
            className="press-effect relative mt-3 inline-flex h-8 items-center rounded-md bg-card px-3 text-xs font-semibold text-foreground shadow-sm hover:bg-card/90 hover:shadow"
          >
            요금제 보기
          </Link>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
