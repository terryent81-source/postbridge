import type { Metadata, Viewport } from "next"
import { Noto_Sans_KR } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { Toaster } from "@/components/ui/sonner"
import "./globals.css"

const pretendard = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-pretendard",
  display: "swap",
})

export const metadata: Metadata = {
  title: "PostBridge — SNS 업로드를 하나로 연결하다",
  description:
    "한 번의 클릭으로 Instagram, Facebook, YouTube, TikTok, X에 동시에 업로드하세요. PostBridge는 콘텐츠 작성, 예약, 기록 관리를 한곳에서 처리합니다.",
  generator: "v0.app",
  keywords: ["SNS", "소셜미디어", "다중 업로드", "스케줄러", "Instagram", "TikTok"],
}

export const viewport: Viewport = {
  themeColor: "#3b4ee8",
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko" className={`${pretendard.variable} bg-background`}>
      <body className="font-sans antialiased">
        {children}
        <Toaster richColors position="top-center" />
        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  )
}
