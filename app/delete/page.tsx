import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "User Data Deletion Instructions | PostBridge",
  description: "User data deletion instructions for PostBridge.",
}

export default function DeletePage() {
  return (
    <main className="min-h-screen bg-white px-6 py-12 text-slate-900">
      <article className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-3 border-b border-slate-200 pb-6">
          <p className="text-sm font-medium text-slate-500">PostBridge</p>
          <h1 className="text-4xl font-bold tracking-normal">
            User Data Deletion Instructions
          </h1>
          <p className="text-sm text-slate-500">Last updated: May 9, 2026</p>
        </header>

        <section className="space-y-4 text-base leading-7">
          <p>
            Users can request deletion of their PostBridge account connection
            data at any time.
          </p>

          <ol className="list-decimal space-y-2 pl-6">
            <li>Log in to PostBridge.</li>
            <li>Go to Dashboard &gt; Accounts.</li>
            <li>Disconnect connected Meta, Facebook, or Instagram accounts.</li>
            <li>
              For a full deletion request, email{" "}
              <a className="font-medium text-blue-700 underline" href="mailto:terryent81@gmail.com">
                terryent81@gmail.com
              </a>{" "}
              with the subject "PostBridge Data Deletion Request".
            </li>
          </ol>

          <p>
            Account connection tokens, social account linkage data, uploaded
            media, and scheduled post data can be deleted upon request.
          </p>
          <p>
            Deletion requests are processed within a reasonable period after the
            request is received and verified.
          </p>
        </section>
      </article>
    </main>
  )
}
