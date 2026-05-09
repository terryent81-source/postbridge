import { PageHeader } from "@/components/app/page-header"
import { PostComposer } from "@/components/app/post-composer"
import { parseYouTubePrivacyStatus } from "@/lib/youtube/privacy"

export default function NewPostPage() {
  const youtubeDefaultPrivacyStatus = parseYouTubePrivacyStatus(
    process.env.YOUTUBE_DEFAULT_PRIVACY_STATUS,
    "private",
  )

  return (
    <>
      <PageHeader
        title="새 게시물"
        description="콘텐츠를 작성하고 여러 SNS에 동시에 게시하세요."
      />
      <PostComposer youtubeDefaultPrivacyStatus={youtubeDefaultPrivacyStatus} />
    </>
  )
}
