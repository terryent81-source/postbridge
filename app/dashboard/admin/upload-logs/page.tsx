"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { PageHeader } from "@/components/app/page-header"
import { AdminPageGuard } from "@/components/app/admin-page-guard"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PlatformIcon } from "@/components/platform-icon"
import type { Platform } from "@/lib/db"
import { ArrowLeft, FileX2, RefreshCw } from "lucide-react"
import { toast } from "sonner"

type AdminUploadLogRow = {
  log: {
    id: string
    post_id: string
    user_id: string
    platform: Platform
    status: "pending" | "success" | "failed"
    error_message: string | null
    attempted_at: string
    completed_at: string | null
  }
  post: {
    id: string
    title: string
    status: string
    platforms: Platform[]
  } | null
  profile: {
    user_id: string
    display_name: string
  } | null
}

export default function AdminUploadLogsPage() {
  const [rows, setRows] = useState<AdminUploadLogRow[]>([])
  const [loading, setLoading] = useState(true)

  const loadRows = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/admin/upload-logs", { cache: "no-store" })
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load upload logs")
      }

      setRows(payload.rows ?? [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load upload logs")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRows()
  }, [])

  const failedCount = useMemo(
    () => rows.filter((row) => row.log.status === "failed").length,
    [rows],
  )

  return (
    <AdminPageGuard>
      <PageHeader
        title="Admin Upload Logs"
        description="All platform upload attempts, including missing media failures."
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
          <SummaryCard label="Total Logs" value={rows.length} />
          <SummaryCard label="Failed" value={failedCount} tone="danger" />
          <SummaryCard label="Missing Media" value={countMissingMedia(rows)} tone="danger" />
        </div>

        <Card className="border-border/80 shadow-sm">
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 text-sm text-muted-foreground">Loading upload logs...</div>
            ) : rows.length === 0 ? (
              <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
                <FileX2 className="h-4 w-4" /> No upload logs found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Post</TableHead>
                      <TableHead>Platform</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Error</TableHead>
                      <TableHead>Attempted</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.log.id}>
                        <TableCell className="font-medium">
                          {row.profile?.display_name ?? row.log.user_id.slice(0, 8)}
                        </TableCell>
                        <TableCell className="max-w-[280px]">
                          <span className="line-clamp-1">
                            {row.post?.title ?? row.log.post_id}
                          </span>
                        </TableCell>
                        <TableCell>
                          <PlatformIcon platform={row.log.platform} size="sm" />
                        </TableCell>
                        <TableCell>
                          <UploadStatusBadge status={row.log.status} />
                        </TableCell>
                        <TableCell className="max-w-[320px]">
                          {row.log.error_message ? (
                            <span className="line-clamp-2 text-sm font-medium text-destructive">
                              {row.log.error_message}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(row.log.attempted_at)}
                        </TableCell>
                      </TableRow>
                    ))}
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

function SummaryCard({
  label,
  value,
  tone = "default",
}: {
  label: string
  value: number
  tone?: "default" | "danger"
}) {
  return (
    <Card className="border-border/80 shadow-sm">
      <CardContent className="p-5">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className={tone === "danger" ? "mt-2 text-3xl font-bold text-destructive" : "mt-2 text-3xl font-bold"}>
          {value.toLocaleString()}
        </p>
      </CardContent>
    </Card>
  )
}

function UploadStatusBadge({ status }: { status: AdminUploadLogRow["log"]["status"] }) {
  if (status === "success") {
    return <Badge className="bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/10">Success</Badge>
  }

  if (status === "failed") {
    return <Badge variant="destructive">Failed</Badge>
  }

  return <Badge variant="secondary">Pending</Badge>
}

function countMissingMedia(rows: AdminUploadLogRow[]) {
  return rows.filter((row) => row.log.error_message === "missing_media_file").length
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
  })
}
