"use client"

import { useEffect, useState } from "react"
import { PageHeader } from "@/components/app/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  getReferralCode,
  getReferralRewards,
  getUserUsageCredits,
  listAdminUsers,
} from "@/lib/db"
import { Copy, Gift, Users, Sparkles } from "lucide-react"
import { toast } from "sonner"

export default function ReferralPage() {
  const [referralCode, setReferralCode] = useState("")
  const [bonusCount, setBonusCount] = useState(0)
  const [rows, setRows] = useState<
    { name: string; email: string; joined: string; reward: string }[]
  >([])
  const referralLink = referralCode ? `https://postbridge.kr/r/${referralCode}` : ""

  useEffect(() => {
    let mounted = true
    Promise.all([
      getReferralCode(),
      getReferralRewards(),
      getUserUsageCredits(),
      listAdminUsers(),
    ]).then(([code, rewards, usage, users]) => {
      if (!mounted) return
      const userById = new Map(users.map((u) => [u.user.id, u]))
      setReferralCode(code.code)
      setBonusCount(usage.bonus_count)
      setRows(
        rewards.map((reward) => {
          const referred = userById.get(reward.referred_user_id)
          return {
            name: referred?.profile?.display_name ?? reward.referred_user_id,
            email: referred?.user.email ?? "-",
            joined: reward.created_at.slice(0, 10),
            reward: `+${reward.reward_credits}회`,
          }
        }),
      )
    })
    return () => {
      mounted = false
    }
  }, [])

  const stats = [
    { icon: Users, label: "초대한 친구 수", value: `${rows.length}명` },
    { icon: Gift, label: "받은 추가 업로드", value: `${rows.length * 3}회` },
    { icon: Sparkles, label: "사용 가능한 보너스", value: `${bonusCount}회` },
  ]

  return (
    <>
      <PageHeader
        title="추천 보상"
        description="친구를 초대하고 추가 업로드 횟수를 무료로 받으세요."
      />
      <div className="space-y-6 px-4 py-6 sm:px-6">
        {/* Referral code card */}
        <Card className="brand-gradient relative overflow-hidden border-0 text-primary-foreground shadow-xl shadow-primary/20">
          <CardContent className="relative grid gap-6 p-6 sm:p-8 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary-foreground/80">
                나의 추천 코드
              </p>
              <h2 className="mt-1 text-balance text-2xl font-extrabold tracking-tight sm:text-3xl">
                친구가 가입하면 업로드 3회가 추가됩니다.
              </h2>
              <p className="mt-2 text-sm text-primary-foreground/90">
                친구는 가입 즉시 무료 보너스 1회를 받고, 본인은 가입이 확인되면 +3회가 적립됩니다.
              </p>
            </div>
            <div className="flex flex-col gap-2 rounded-2xl bg-card/15 p-4 ring-1 ring-primary-foreground/20 backdrop-blur md:min-w-[280px]">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-primary-foreground/80">
                추천 코드
              </span>
              <div className="flex items-center justify-between rounded-lg bg-card px-3 py-2 text-foreground">
                <span className="font-mono text-sm font-bold">{referralCode || "로딩 중"}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1 text-xs"
                  onClick={() => {
                    navigator.clipboard?.writeText(referralCode)
                    toast.success("추천 코드가 복사되었습니다.")
                  }}
                >
                  <Copy className="h-3.5 w-3.5" /> 복사
                </Button>
              </div>
              <Button
                className="bg-card text-foreground hover:bg-card/90"
                onClick={() => {
                  navigator.clipboard?.writeText(referralLink)
                  toast.success("추천 링크가 복사되었습니다.")
                }}
              >
                <Copy className="h-4 w-4" /> 추천 링크 복사
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-3">
          {stats.map((s) => (
            <Card key={s.label} className="border-border/80 shadow-sm">
              <CardContent className="flex items-center gap-4 p-5">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <s.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
                  <p className="text-2xl font-extrabold text-foreground">{s.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Table */}
        <Card className="border-border/80 shadow-sm">
          <CardContent className="p-0">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-base font-bold text-foreground">추천 기록</h2>
              <p className="text-xs text-muted-foreground">내 추천 코드로 가입한 친구 목록입니다.</p>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>친구</TableHead>
                    <TableHead>이메일</TableHead>
                    <TableHead>가입일</TableHead>
                    <TableHead className="text-right">받은 보상</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.email}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">
                              {r.name.slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-foreground">{r.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.email}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.joined}</TableCell>
                      <TableCell className="text-right">
                        <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                          {r.reward}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
