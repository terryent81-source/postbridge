"use client"

import { PageHeader } from "@/components/app/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="설정" description="프로필, 보안, 알림 등을 관리하세요." />

      <div className="px-4 py-6 sm:px-6">
        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="flex-wrap">
            <TabsTrigger value="profile">프로필</TabsTrigger>
            <TabsTrigger value="password">비밀번호</TabsTrigger>
            <TabsTrigger value="language">언어</TabsTrigger>
            <TabsTrigger value="notifications">알림</TabsTrigger>
            <TabsTrigger value="danger">계정 삭제</TabsTrigger>
          </TabsList>

          {/* Profile */}
          <TabsContent value="profile" className="mt-4">
            <Card className="border-border/80 shadow-sm">
              <CardContent className="p-6">
                <h2 className="text-base font-bold text-foreground">프로필 정보</h2>
                <p className="text-xs text-muted-foreground">계정에 표시되는 정보를 수정합니다.</p>

                <div className="mt-5 flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarFallback className="brand-gradient text-base font-bold text-primary-foreground">
                      MJ
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      이미지 변경
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive">
                      제거
                    </Button>
                  </div>
                </div>

                <FieldGroup className="mt-6 grid gap-5 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="p-name">이름</FieldLabel>
                    <Input id="p-name" defaultValue="김민준" />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="p-email">이메일</FieldLabel>
                    <Input id="p-email" type="email" defaultValue="minjun@postbridge.kr" />
                  </Field>
                  <Field className="sm:col-span-2">
                    <FieldLabel htmlFor="p-bio">자기소개</FieldLabel>
                    <Input id="p-bio" defaultValue="콘텐츠 디렉터 · 1인 브랜드 운영" />
                    <FieldDescription>일부 플랫폼 미리보기에 표시될 수 있습니다.</FieldDescription>
                  </Field>
                </FieldGroup>

                <div className="mt-6 flex justify-end">
                  <Button
                    className="brand-gradient text-primary-foreground hover:opacity-95"
                    onClick={() => toast.success("프로필이 저장되었습니다.")}
                  >
                    저장하기
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Password */}
          <TabsContent value="password" className="mt-4">
            <Card className="border-border/80 shadow-sm">
              <CardContent className="p-6">
                <h2 className="text-base font-bold text-foreground">비밀번호 변경</h2>
                <p className="text-xs text-muted-foreground">
                  최소 8자 이상, 영문/숫자 조합을 권장합니다.
                </p>
                <FieldGroup className="mt-5 grid gap-5">
                  <Field>
                    <FieldLabel htmlFor="cur">현재 비밀번호</FieldLabel>
                    <Input id="cur" type="password" />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="new">새 비밀번호</FieldLabel>
                    <Input id="new" type="password" />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="new2">새 비밀번호 확인</FieldLabel>
                    <Input id="new2" type="password" />
                  </Field>
                </FieldGroup>
                <div className="mt-6 flex justify-end">
                  <Button
                    className="brand-gradient text-primary-foreground hover:opacity-95"
                    onClick={() => toast.success("비밀번호가 변경되었습니다.")}
                  >
                    비밀번호 변경
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Language */}
          <TabsContent value="language" className="mt-4">
            <Card className="border-border/80 shadow-sm">
              <CardContent className="p-6">
                <h2 className="text-base font-bold text-foreground">언어 설정</h2>
                <p className="text-xs text-muted-foreground">UI 표시 언어를 선택합니다.</p>
                <div className="mt-5 max-w-sm">
                  <Label htmlFor="lang" className="mb-1.5 block">
                    언어
                  </Label>
                  <Select defaultValue="ko">
                    <SelectTrigger id="lang">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ko">한국어 (기본)</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="ja">日本語</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="mt-6 flex justify-end">
                  <Button
                    className="brand-gradient text-primary-foreground hover:opacity-95"
                    onClick={() => toast.success("언어 설정이 저장되었습니다.")}
                  >
                    저장하기
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications */}
          <TabsContent value="notifications" className="mt-4">
            <Card className="border-border/80 shadow-sm">
              <CardContent className="p-6">
                <h2 className="text-base font-bold text-foreground">알림 설정</h2>
                <p className="text-xs text-muted-foreground">받고 싶은 알림 종류를 선택하세요.</p>
                <div className="mt-5 space-y-1">
                  <NotificationRow
                    title="업로드 완료 알림"
                    desc="모든 플랫폼 업로드가 완료되면 이메일을 보냅니다."
                    defaultChecked
                  />
                  <NotificationRow
                    title="실패 알림"
                    desc="업로드 실패 시 즉시 알림을 받습니다."
                    defaultChecked
                  />
                  <NotificationRow
                    title="예약 시작 알림"
                    desc="예약된 업로드가 시작될 때 알림을 받습니다."
                  />
                  <NotificationRow
                    title="추천 보상 알림"
                    desc="추천 가입이 확인되면 보너스 적립을 알립니다."
                    defaultChecked
                  />
                  <NotificationRow
                    title="마케팅 / 기능 업데이트"
                    desc="새로운 기능, 프로모션 정보를 이메일로 받습니다."
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Danger */}
          <TabsContent value="danger" className="mt-4">
            <Card className="border-destructive/30 shadow-sm">
              <CardContent className="p-6">
                <h2 className="text-base font-bold text-destructive">계정 삭제</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  계정 삭제 시 모든 게시물, 예약, 연결된 SNS 계정 정보가 영구적으로 삭제됩니다.
                  이 작업은 되돌릴 수 없습니다.
                </p>
                <div className="mt-5 flex flex-col items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">정말 계정을 삭제하시겠어요?</p>
                    <p className="text-xs text-muted-foreground">
                      삭제 전 데이터를 내보내는 것을 권장합니다.
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    className="gap-1.5"
                    onClick={() => toast.error("계정 삭제 요청이 접수되었습니다.")}
                  >
                    <Trash2 className="h-4 w-4" /> 계정 삭제
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}

function NotificationRow({
  title,
  desc,
  defaultChecked,
}: {
  title: string
  desc: string
  defaultChecked?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-4 last:border-b-0">
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <Switch defaultChecked={defaultChecked} />
    </div>
  )
}
