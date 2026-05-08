"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { PageHeader } from "@/components/app/page-header"
import { AdminPageGuard } from "@/components/app/admin-page-guard"
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
import { ArrowLeft, FileX2, RefreshCw } from "lucide-react"
import { toast } from "sonner"

type CleanupError = {
  id?: string
  storagePath: string
  stage: string
  message: string
}

type StorageCleanupRun = {
  id: string
  scanned: number
  deleted: number
  skipped: number
  errors: CleanupError[]
  skipped_reasons: Record<string, number>
  deleted_files: string[]
  ran_at: string
}

export default function AdminStorageCleanupPage() {
  const [rows, setRows] = useState<StorageCleanupRun[]>([])
  const [loading, setLoading] = useState(true)

  const loadRows = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/admin/storage-cleanups", { cache: "no-store" })
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load cleanup summaries")
      }

      setRows(payload.rows ?? [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load cleanup summaries")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRows()
  }, [])

  const latest = rows[0]
  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, row) => ({
          scanned: acc.scanned + row.scanned,
          deleted: acc.deleted + row.deleted,
          skipped: acc.skipped + row.skipped,
          errors: acc.errors + row.errors.length,
        }),
        { scanned: 0, deleted: 0, skipped: 0, errors: 0 },
      ),
    [rows],
  )

  return (
    <AdminPageGuard>
      <PageHeader
        title="Storage Cleanup Summary"
        description="Media cleanup results: scanned, deleted, skipped, errors, and skipped reasons."
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
        <div className="grid gap-4 sm:grid-cols-4">
          <SummaryCard label="Runs" value={rows.length} />
          <SummaryCard label="Scanned" value={totals.scanned} />
          <SummaryCard label="Deleted" value={totals.deleted} />
          <SummaryCard label="Errors" value={totals.errors} tone="danger" />
        </div>

        {latest && (
          <Card className="border-border/80 shadow-sm">
            <CardContent className="grid gap-4 p-5 lg:grid-cols-[220px_1fr_1fr]">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Latest Run</p>
                <p className="mt-1 text-sm font-semibold">{formatDate(latest.ran_at)}</p>
              </div>
              <ReasonList title="Skipped Reasons" items={latest.skipped_reasons} />
              <ErrorList errors={latest.errors} />
            </CardContent>
          </Card>
        )}

        <Card className="border-border/80 shadow-sm">
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 text-sm text-muted-foreground">Loading cleanup summaries...</div>
            ) : rows.length === 0 ? (
              <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
                <FileX2 className="h-4 w-4" /> No cleanup runs found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Run</TableHead>
                      <TableHead>Scanned</TableHead>
                      <TableHead>Deleted</TableHead>
                      <TableHead>Skipped</TableHead>
                      <TableHead>Errors</TableHead>
                      <TableHead>Skipped Reasons</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{formatDate(row.ran_at)}</TableCell>
                        <TableCell>{row.scanned.toLocaleString()}</TableCell>
                        <TableCell>{row.deleted.toLocaleString()}</TableCell>
                        <TableCell>{row.skipped.toLocaleString()}</TableCell>
                        <TableCell className={row.errors.length > 0 ? "text-destructive" : ""}>
                          {row.errors.length.toLocaleString()}
                        </TableCell>
                        <TableCell className="max-w-[360px]">
                          <span className="line-clamp-2 text-sm text-muted-foreground">
                            {formatReasons(row.skipped_reasons)}
                          </span>
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

function ReasonList({ title, items }: { title: string; items: Record<string, number> }) {
  const entries = Object.entries(items).filter(([, value]) => value > 0)

  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {entries.length === 0 ? (
          <span className="text-sm text-muted-foreground">None</span>
        ) : (
          entries.map(([reason, count]) => (
            <span
              key={reason}
              className="rounded-full border border-border bg-card px-2 py-0.5 text-xs font-medium"
            >
              {reason}: {count}
            </span>
          ))
        )}
      </div>
    </div>
  )
}

function ErrorList({ errors }: { errors: CleanupError[] }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">Errors</p>
      {errors.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">None</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {errors.slice(0, 3).map((error, index) => (
            <li key={`${error.storagePath}-${index}`} className="text-xs text-destructive">
              {error.stage}: {error.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function formatReasons(items: Record<string, number>) {
  const entries = Object.entries(items).filter(([, value]) => value > 0)
  return entries.length
    ? entries.map(([reason, count]) => `${reason}: ${count}`).join(", ")
    : "-"
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
  })
}
