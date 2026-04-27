import { PageHeader } from "@/components/app/page-header"
import { PostComposer } from "@/components/app/post-composer"

export default function NewPostPage() {
  return (
    <>
      <PageHeader
        title="새 게시물"
        description="콘텐츠를 작성하고 여러 SNS에 동시에 게시하세요."
      />
      <PostComposer />
    </>
  )
}
