"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { PageHeader } from "@/components/app/page-header"
import { AdminPageGuard } from "@/components/app/admin-page-guard"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ArrowLeft, RefreshCw, ShieldCheck, UserPlus } from "lucide-react"
import { toast } from "sonner"

type AdminRole = "super_admin" | "admin"

type AdminUserRow = {
  id: string
  user_id: string
  email: string
  role: AdminRole
  is_active: boolean
  created_at: string
}

export default function AdminUsersPage() {
  const [rows, setRows] = useState<AdminUserRow[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<AdminRole>("admin")
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const loadRows = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/admin/users", { cache: "no-store" })
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load admin users")
      }

      setRows(payload.rows ?? [])
      setCurrentUserId(payload.currentUserId ?? null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load admin users")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRows()
  }, [])

  const activeCount = useMemo(
    () => rows.filter((row) => row.is_active).length,
    [rows],
  )

  const addAdminUser = async () => {
    setSubmitting(true)
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      })
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to add admin user")
      }

      toast.success("관리자를 등록했습니다.")
      setEmail("")
      setRole("admin")
      await loadRows()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add admin user")
    } finally {
      setSubmitting(false)
    }
  }

  const updateAdminUser = async (
    row: AdminUserRow,
    patch: Partial<Pick<AdminUserRow, "role" | "is_active">>,
  ) => {
    setUpdatingId(row.id)
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id, ...patch }),
      })
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to update admin user")
      }

      toast.success("관리자 정보를 변경했습니다.")
      await loadRows()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update admin user")
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <AdminPageGuard requiredRole="super_admin">
      <PageHeader
        title="Admin Users"
        description="Google 로그인 사용자를 관리자 권한에 등록하고 관리합니다."
        action={
          <>
            <Button asChild variant="outline" className="press-effect gap-2">
              <Link href="/dashboard/admin">
                <ArrowLeft className="h-4 w-4" /> Admin
              </Link>
            </Button>
            <Button variant="outline" className="press-effect gap-2" onClick={loadRows}>
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
          </>
        }
      />

      <div className="space-y-4 px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid gap-4 sm:grid-cols-3">
          <SummaryCard label="Admin Users" value={rows.length} />
          <SummaryCard label="Active" value={activeCount} />
          <SummaryCard
            label="Super Admins"
            value={rows.filter((row) => row.role === "super_admin").length}
          />
        </div>

        <Card className="border-border/80 shadow-sm">
          <CardContent className="grid gap-4 p-5 lg:grid-cols-[1fr_180px_auto] lg:items-end">
            <div className="grid gap-1.5">
              <Label htmlFor="admin-email">Email</Label>
              <Input
                id="admin-email"
                type="email"
                placeholder="user@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Role</Label>
              <Select value={role} onValueChange={(value) => setRole(value as AdminRole)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">admin</SelectItem>
                  <SelectItem value="super_admin">super_admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              className="brand-gradient press-effect gap-2 text-primary-foreground"
              disabled={submitting || !email.trim()}
              onClick={addAdminUser}
            >
              <UserPlus className="h-4 w-4" /> Add Admin
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-sm">
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 text-sm text-muted-foreground">Loading admin users...</div>
            ) : rows.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">
                등록된 관리자가 없습니다.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => {
                      const isOwnSuperAdmin =
                        row.user_id === currentUserId && row.role === "super_admin"
                      const isUpdating = updatingId === row.id

                      return (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {row.role === "super_admin" && (
                                <ShieldCheck
                                  className="h-4 w-4 text-primary"
                                  aria-hidden="true"
                                />
                              )}
                              {row.email}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={row.role}
                              disabled={isUpdating || isOwnSuperAdmin}
                              onValueChange={(value) =>
                                updateAdminUser(row, { role: value as AdminRole })
                              }
                            >
                              <SelectTrigger className="w-[150px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">admin</SelectItem>
                                <SelectItem value="super_admin">super_admin</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            {row.is_active ? (
                              <Badge className="bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/10">
                                active
                              </Badge>
                            ) : (
                              <Badge variant="secondary">inactive</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(row.created_at)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              className="press-effect"
                              disabled={isUpdating || !row.is_active || isOwnSuperAdmin}
                              onClick={() => updateAdminUser(row, { is_active: false })}
                            >
                              Deactivate
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminPageGuard>
  )
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="border-border/80 shadow-sm">
      <CardContent className="p-5">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="mt-2 text-3xl font-bold">{value.toLocaleString()}</p>
      </CardContent>
    </Card>
  )
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
  })
}
