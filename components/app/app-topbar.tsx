"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Bell, LogOut, Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { WeeklyUploadCounter } from "@/components/app/weekly-upload-counter"
import { Kbd } from "@/components/ui/kbd"
import { signOutCurrentUser } from "@/lib/supabase/auth"
import {
  getCurrentUserWithProfile,
  getProfileInitials,
  SUPABASE_PROFILE_CHANGED_EVENT,
  type CurrentUserProfile,
} from "@/lib/supabase/profile"

export function AppTopbar() {
  const router = useRouter()
  const [currentProfile, setCurrentProfile] = useState<CurrentUserProfile | null>(null)
  const displayName = currentProfile?.displayName ?? "사용자"
  const email = currentProfile?.email ?? ""
  const initials = getProfileInitials(displayName, email)

  useEffect(() => {
    let isMounted = true
    const loadProfile = () => getCurrentUserWithProfile()
      .then((profile) => {
        if (isMounted) {
          setCurrentProfile(profile)
        }
      })
      .catch(() => {
        if (isMounted) {
          setCurrentProfile(null)
        }
      })

    loadProfile()
    window.addEventListener(SUPABASE_PROFILE_CHANGED_EVENT, loadProfile)

    return () => {
      isMounted = false
      window.removeEventListener(SUPABASE_PROFILE_CHANGED_EVENT, loadProfile)
    }
  }, [])

  async function handleSignOut(event: Event) {
    event.preventDefault()

    const { error } = await signOutCurrentUser()

    if (error) {
      toast.error("로그아웃에 실패했습니다", {
        description: error.message,
      })
      return
    }

    toast.success("로그아웃되었습니다")
    router.replace("/login")
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/85 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:px-4">
      <SidebarTrigger className="press-effect" />
      <Separator orientation="vertical" className="mx-1 h-5 hidden sm:block" />

      <div className="flex flex-1 items-center gap-3">
        <InputGroup className="hidden max-w-sm md:flex">
          <InputGroupAddon align="inline-start">
            <Search className="h-4 w-4 text-muted-foreground" />
          </InputGroupAddon>
          <InputGroupInput placeholder="게시물, 플랫폼, 사용자 검색..." />
          <InputGroupAddon align="inline-end" className="hidden lg:flex">
            <Kbd className="text-[10px]">⌘K</Kbd>
          </InputGroupAddon>
        </InputGroup>
      </div>

      <div className="hidden md:block">
        <WeeklyUploadCounter variant="compact" />
      </div>

      <Button
        asChild
        size="sm"
        className="brand-gradient press-effect hidden gap-1.5 text-primary-foreground shadow-sm hover:opacity-95 hover:shadow-md sm:inline-flex"
      >
        <Link href="/dashboard/posts/new">
          <Plus className="h-3.5 w-3.5" /> 새 게시물
        </Link>
      </Button>

      {/* Mobile search */}
      <Button variant="ghost" size="icon" className="md:hidden" aria-label="검색">
        <Search className="h-4 w-4" />
      </Button>

      <Button variant="ghost" size="icon" aria-label="알림 (1개의 새 알림)" className="relative">
        <Bell className="h-4 w-4" />
        <span
          className="absolute right-2 top-2 h-2 w-2 rounded-full bg-destructive ring-2 ring-background"
          aria-hidden="true"
        />
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="press-effect flex items-center gap-2 rounded-full p-1 pr-1 hover:bg-muted sm:pr-3"
            aria-label="프로필 메뉴"
          >
            <Avatar className="h-8 w-8 border border-border">
              <AvatarFallback className="brand-gradient text-xs font-bold text-primary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="hidden text-sm font-medium text-foreground sm:inline">
              {displayName}
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="flex flex-col">
              <span className="font-semibold">{displayName}</span>
              <span className="text-xs font-normal text-muted-foreground">{email}</span>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/dashboard/settings">설정</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/dashboard/pricing">요금제</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/dashboard/referral">추천 보상</Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive"
            variant="destructive"
            onSelect={handleSignOut}
          >
            <LogOut className="h-4 w-4" />
            로그아웃
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
