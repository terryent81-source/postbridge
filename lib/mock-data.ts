export type Platform = "instagram" | "facebook" | "youtube" | "tiktok" | "x"

export const PLATFORMS: { id: Platform; name: string; color: string; charLimit: number }[] = [
  { id: "instagram", name: "Instagram", color: "#E1306C", charLimit: 2200 },
  { id: "facebook", name: "Facebook", color: "#1877F2", charLimit: 63206 },
  { id: "youtube", name: "YouTube", color: "#FF0000", charLimit: 5000 },
  { id: "tiktok", name: "TikTok", color: "#000000", charLimit: 2200 },
  { id: "x", name: "X", color: "#000000", charLimit: 280 },
]

export type PostStatus = "draft" | "scheduled" | "published" | "failed"

export const STATUS_LABELS: Record<PostStatus, string> = {
  draft: "임시저장",
  scheduled: "예약됨",
  published: "업로드 완료",
  failed: "실패",
}

export type Post = {
  id: string
  title: string
  platforms: Platform[]
  status: PostStatus
  scheduledAt?: string
  createdAt: string
  failReason?: string
}

export const RECENT_POSTS: Post[] = [
  {
    id: "p_001",
    title: "신규 메뉴 출시 안내 — 가을 시즌 한정",
    platforms: ["instagram", "facebook", "x"],
    status: "published",
    scheduledAt: "2026-04-26 10:00",
    createdAt: "2026-04-26 09:32",
  },
  {
    id: "p_002",
    title: "고객 리뷰 모아보기 #1",
    platforms: ["instagram", "tiktok"],
    status: "scheduled",
    scheduledAt: "2026-04-28 18:00",
    createdAt: "2026-04-25 14:10",
  },
  {
    id: "p_003",
    title: "유튜브 라이브 예고 — 4월 30일",
    platforms: ["youtube", "x"],
    status: "scheduled",
    scheduledAt: "2026-04-30 20:00",
    createdAt: "2026-04-24 11:02",
  },
  {
    id: "p_004",
    title: "브랜드 스토리 영상 (드래프트)",
    platforms: ["instagram", "youtube", "tiktok"],
    status: "draft",
    createdAt: "2026-04-23 16:45",
  },
  {
    id: "p_005",
    title: "이벤트 당첨자 발표",
    platforms: ["instagram", "facebook"],
    status: "failed",
    scheduledAt: "2026-04-22 09:00",
    createdAt: "2026-04-21 22:11",
    failReason: "API 권한 필요",
  },
  {
    id: "p_006",
    title: "주말 할인 쿠폰 배포",
    platforms: ["facebook", "x"],
    status: "published",
    scheduledAt: "2026-04-20 12:00",
    createdAt: "2026-04-20 11:14",
  },
]

export const UPLOAD_HISTORY: Post[] = [
  ...RECENT_POSTS,
  {
    id: "p_007",
    title: "쇼츠 영상 — 작업 비하인드",
    platforms: ["youtube", "tiktok"],
    status: "failed",
    scheduledAt: "2026-04-19 15:00",
    createdAt: "2026-04-19 14:42",
    failReason: "미디어 형식 오류",
  },
  {
    id: "p_008",
    title: "팀 인터뷰 컷",
    platforms: ["instagram", "facebook"],
    status: "failed",
    scheduledAt: "2026-04-18 11:00",
    createdAt: "2026-04-18 10:01",
    failReason: "연결된 계정 만료",
  },
  {
    id: "p_009",
    title: "월간 리캡 4월호",
    platforms: ["instagram", "x", "facebook", "youtube"],
    status: "published",
    scheduledAt: "2026-04-17 09:00",
    createdAt: "2026-04-17 08:30",
  },
]

export const SCHEDULED_POSTS: Post[] = RECENT_POSTS.filter((p) => p.status === "scheduled").concat([
  {
    id: "p_010",
    title: "5월 1일 신제품 티저",
    platforms: ["instagram", "tiktok", "x"],
    status: "scheduled",
    scheduledAt: "2026-05-01 09:00",
    createdAt: "2026-04-26 18:20",
  },
  {
    id: "p_011",
    title: "월간 뉴스레터 공유",
    platforms: ["facebook", "x"],
    status: "scheduled",
    scheduledAt: "2026-05-03 11:30",
    createdAt: "2026-04-26 19:05",
  },
])

export type AccountStatus = "connected" | "needs_connection" | "expired"

export const ACCOUNT_STATUS_LABELS: Record<AccountStatus, string> = {
  connected: "연결됨",
  needs_connection: "연결 필요",
  expired: "권한 만료",
}

export const SNS_ACCOUNTS: {
  platform: Platform
  status: AccountStatus
  handle?: string
  description: string
}[] = [
  {
    platform: "instagram",
    status: "connected",
    handle: "@postbridge.kr",
    description: "비즈니스 계정으로 게시물, 릴스, 스토리 업로드를 지원합니다.",
  },
  {
    platform: "facebook",
    status: "connected",
    handle: "PostBridge Page",
    description: "페이지 게시 권한으로 텍스트, 이미지, 영상을 업로드합니다.",
  },
  {
    platform: "youtube",
    status: "expired",
    handle: "@PostBridge",
    description: "토큰이 만료되었습니다. 다시 연결해 주세요.",
  },
  {
    platform: "tiktok",
    status: "needs_connection",
    description: "Creator/Business 계정 인증 후 업로드가 가능합니다.",
  },
  {
    platform: "x",
    status: "needs_connection",
    description: "X API 권한 승인 후 텍스트 및 미디어 업로드가 가능합니다.",
  },
]

export const ADMIN_USERS = [
  { name: "김민준", email: "minjun.kim@example.com", plan: "Pro", uses: 87, joined: "2026-02-12", status: "활성" },
  { name: "이서연", email: "seoyeon.lee@example.com", plan: "Starter", uses: 24, joined: "2026-03-04", status: "활성" },
  { name: "박지호", email: "jiho.park@example.com", plan: "Free", uses: 3, joined: "2026-04-12", status: "활성" },
  { name: "최유나", email: "yuna.choi@example.com", plan: "Business", uses: 412, joined: "2025-11-20", status: "활성" },
  { name: "정하늘", email: "haneul.jung@example.com", plan: "Free", uses: 0, joined: "2026-04-25", status: "비활성" },
  { name: "한도윤", email: "doyun.han@example.com", plan: "Pro", uses: 142, joined: "2026-01-08", status: "활성" },
]

export const ADMIN_LOGS = [
  {
    user: "김민준",
    title: "신규 메뉴 출시 안내",
    platform: "instagram" as Platform,
    status: "published" as PostStatus,
    error: "—",
    createdAt: "2026-04-26 10:00",
  },
  {
    user: "이서연",
    title: "이벤트 당첨자 발표",
    platform: "facebook" as Platform,
    status: "failed" as PostStatus,
    error: "API 권한 필요",
    createdAt: "2026-04-22 09:00",
  },
  {
    user: "박지호",
    title: "쇼츠 영상 — 비하인드",
    platform: "tiktok" as Platform,
    status: "failed" as PostStatus,
    error: "미디어 형식 오류",
    createdAt: "2026-04-19 15:02",
  },
  {
    user: "최유나",
    title: "월간 리캡 4월호",
    platform: "youtube" as Platform,
    status: "published" as PostStatus,
    error: "—",
    createdAt: "2026-04-17 09:00",
  },
  {
    user: "한도윤",
    title: "주말 할인 쿠폰",
    platform: "x" as Platform,
    status: "published" as PostStatus,
    error: "—",
    createdAt: "2026-04-20 12:00",
  },
]

export const REFERRAL_HISTORY = [
  { name: "이지우", email: "jiwoo.l@example.com", joined: "2026-04-22", reward: "+3회" },
  { name: "오현우", email: "hyunwoo.o@example.com", joined: "2026-04-18", reward: "+3회" },
  { name: "신아린", email: "arin.s@example.com", joined: "2026-04-11", reward: "+3회" },
  { name: "강태민", email: "taemin.k@example.com", joined: "2026-04-02", reward: "+3회" },
]
