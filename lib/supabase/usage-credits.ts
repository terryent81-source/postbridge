"use client"

import { createBrowserSupabaseClient } from "@/lib/supabase/client"

export type SupabaseUsageCreditRow = {
  id: string
  user_id: string
  plan_id: string
  week_start: string
  used_count: number
  bonus_count: number
  plan_limit: number
}

export const SUPABASE_USAGE_CREDITS_CHANGED_EVENT =
  "postbridge:supabase-usage-credits-changed"

export async function getMyUsageCredits(): Promise<SupabaseUsageCreditRow | null> {
  const supabase = createBrowserSupabaseClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return null
  }

  const { data, error } = await supabase.rpc("get_my_current_usage_credit")

  if (error) {
    throw error
  }

  return data as SupabaseUsageCreditRow
}

export async function consumeMyWeeklyUploadCredit(): Promise<SupabaseUsageCreditRow> {
  const supabase = createBrowserSupabaseClient()
  const { data, error } = await supabase.rpc("consume_my_weekly_upload_credit")

  if (error) {
    throw new Error(normalizeUsageCreditError(error.message))
  }

  notifySupabaseUsageCreditsChanged()

  return data as SupabaseUsageCreditRow
}

export function getUsageCreditTotal(row: SupabaseUsageCreditRow) {
  return row.plan_limit + row.bonus_count
}

export function hasAvailableUploadCredit(row: SupabaseUsageCreditRow) {
  if (row.plan_limit < 0) {
    return true
  }

  return row.used_count < getUsageCreditTotal(row)
}

export function notifySupabaseUsageCreditsChanged() {
  if (typeof window === "undefined") return

  window.dispatchEvent(new Event(SUPABASE_USAGE_CREDITS_CHANGED_EVENT))
}

function normalizeUsageCreditError(message: string) {
  if (message.includes("무료 업로드 횟수를 모두 사용했습니다")) {
    return "무료 업로드 횟수를 모두 사용했습니다"
  }

  return message
}
