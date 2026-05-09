import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Platform } from "@/lib/db"
import type { UploadMode } from "@/lib/server/upload/mode"

export type PublishablePost = {
  id: string
  user_id: string
  title: string
  content: string
  platforms: Platform[]
}

export type MediaAssetForUpload = {
  id: string
  storage_bucket: string
  storage_path: string
  file_name: string
  mime_type: string
  media_type: "image" | "video"
  status: string
  deleted_at: string | null
}

export type SocialAccountForUpload = {
  id: string
  user_id: string
  platform: Platform
  status: string
  page_id: string | null
  page_name?: string | null
  has_page_access_token?: boolean | null
  instagram_business_account_id: string | null
  token_expires_at: string | null
  youtube_shorts_auto_hashtag?: boolean | null
  youtube_shorts_hashtag_location?: "title" | "description" | null
}

export type SocialAccountSecretForUpload = {
  social_account_id: string
  access_token: string
  refresh_token: string | null
  scopes: string[]
  provider_account_id: string | null
}

export type PlatformUploadContext = {
  supabase: SupabaseClient
  post: PublishablePost
  platform: Platform
  mediaAssets: MediaAssetForUpload[]
  account: SocialAccountForUpload | null
  secret: SocialAccountSecretForUpload | null
  uploadMode: UploadMode
}

export type PlatformUploadResult = {
  platform: Platform
  status: "success" | "failed"
  platformPostId?: string | null
  errorMessage?: string | null
}
