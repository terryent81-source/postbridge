"use client"

import { useEffect, useMemo, useState } from "react"
import { PageHeader } from "@/components/app/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { PlatformIcon } from "@/components/platform-icon"
import { StatusBadge } from "@/components/app/status-badge"
import {
  getAdminLogs,
  listAdminUsers,
  type AdminLogRow,
  type AdminUserRow,
} from "@/lib/db"
import { Users, Send, AlertTriangle, Flag, MoreHorizontal } from "lucide-react"
import { toast } from "sonner"

const PLAN_TONE: Record<string, string> = {
  Free: "bg-muted text-muted-foreground",
  Starter: "bg-primary/10 text-primary",
  Pro: "bg-primary text-primary-foreground",
  Business: "bg-foreground text-background",
}

export default function AdminPage() {
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [logs, setLogs] = useState<AdminLogRow[]>([])

  useEffect(() => {
    let mounted = true
    Promise.all([listAdminUsers(), getAdminLogs()]).then(([userRows, logRows]) => {
      if (!mounted) return
      setUsers(userRows)
      setLogs(logRows)
    })
    return () => {
      mounted = false
    }
  }, [])

  const stats = useMemo(
    () => [
      { icon: Users, label: "전체 사용자 수", value: users.length.toLocaleString(), delta: "mock" },
      { icon: Send, label: "전체 업로드 로그", value: logs.length.toLocaleString(), delta: "누적" },
      {
        icon: AlertTriangle,
        label: "실패한 업로드",
        value: logs.filter((row) => row.log.status === "failed").length.toLocaleString(),
        delta: "확인 필요",
        danger: true,
      },
      { icon: Flag, label: "신고된 게시물", value: "0", delta: "mock" },
    ],
    [logs, users],
  )

  return (
    <>
      <PageHeader
        title="관리자"
        description="사용자, 사용량, 게시 로그를 한곳에서 모니터링합니다."
      />

      <div className="space-y-6 px-4 py-6 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((s) => (
            <Card key={s.label} className="border-border/80 shadow-sm">
              <CardContent className="flex flex-col gap-3 p-5">
                <div className="flex items-center justify-between">
                  <span
                    className={
                      "inline-flex h-9 w-9 items-center justify-center rounded-lg " +
                      (s.danger
                        ? "bg-destructive/10 text-destructive"
                        : "bg-primary/10 text-primary")
                    }
                  >
                    <s.icon className="h-4 w-4" />
                  </span>
                  <span className="text-xs font-semibold text-muted-foreground">{s.delta}</span>
                </div>
                <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
                <p className="text-3xl font-extrabold tracking-tight text-foreground">{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="users">
          <TabsList>
            <TabsTrigger value="users">사용자 관리</TabsTrigger>
            <TabsTrigger value="logs">게시 로그</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="mt-4">
            <Card className="border-border/80 shadow-sm">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>이름</TableHead>
                        <TableHead>이메일</TableHead>
                        <TableHead>플랜</TableHead>
                        <TableHead>게시물 수</TableHead>
                        <TableHead>가입일</TableHead>
                        <TableHead>상태</TableHead>
                        <TableHead className="text-right">액션</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((row) => {
                        const name = row.profile?.display_name ?? row.user.email
                        const planName = row.plan?.name ?? "Free"
                        return (
                          <TableRow key={row.user.email}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Avatar className="h-8 w-8">
                                  <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">
                                    {name.slice(0, 2)}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="font-medium text-foreground">{name}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {row.user.email}
                            </TableCell>
                            <TableCell>
                              <span
                                className={
                                  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold " +
                                  PLAN_TONE[planName]
                                }
                              >
                                {planName}
                              </span>
                            </TableCell>
                            <TableCell className="text-sm font-medium text-foreground">
                              {row.posts_count}건
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {row.user.created_at.slice(0, 10)}
                            </TableCell>
                            <TableCell>
                              <span
                                className={
                                  row.user.last_sign_in_at
                                    ? "inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400"
                                    : "inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground"
                                }
                              >
                                {row.user.last_sign_in_at ? "활성" : "비활성"}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreHorizontal className="h-4 w-4" />
                                    <span className="sr-only">액션</span>
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => toast.success("무료 업로드 3회를 추가했습니다.")}
                                  >
                                    무료 업로드 횟수 추가
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => toast.success("실패 로그를 조회합니다.")}
                                  >
                                    실패 로그 확인
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => toast.success("사용자가 비활성화되었습니다.")}
                                  >
                                    사용자 비활성화
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs" className="mt-4">
            <Card className="border-border/80 shadow-sm">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>사용자</TableHead>
                        <TableHead>게시물</TableHead>
                        <TableHead>플랫폼</TableHead>
                        <TableHead>상태</TableHead>
                        <TableHead>오류 로그</TableHead>
                        <TableHead>생성일</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium text-foreground">
                            {row.profile?.display_name ?? row.user?.email ?? "-"}
                          </TableCell>
                          <TableCell className="max-w-[220px]">
                            <span className="line-clamp-1 text-sm text-foreground">
                              {row.post?.title ?? "삭제된 게시물"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <PlatformIcon platform={row.log.platform} size="sm" />
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={row.log.status === "success" ? "published" : "failed"} />
                          </TableCell>
                          <TableCell>
                            {row.log.error_message ? (
                              <span className="text-sm font-medium text-destructive">
                                {row.log.error_message}
                              </span>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {row.log.attempted_at.slice(0, 16).replace("T", " ")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}
