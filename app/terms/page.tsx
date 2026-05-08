import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Terms of Service | PostBridge",
  description: "Terms of Service for PostBridge.",
}

export default function TermsOfServicePage() {
  return (
    <main className="min-h-screen bg-white px-6 py-12 text-slate-900">
      <article className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-3 border-b border-slate-200 pb-6">
          <p className="text-sm font-medium text-slate-500">PostBridge</p>
          <h1 className="text-4xl font-bold tracking-normal">Terms of Service</h1>
          <p className="text-sm text-slate-500">Last updated: May 9, 2026</p>
        </header>

        <section className="space-y-4 text-base leading-7">
          <p>
            PostBridge is an SNS upload and scheduling tool that helps users
            create, schedule, and publish content to connected social media
            accounts.
          </p>
          <p>
            Users are responsible for the content they upload, schedule, and
            publish through PostBridge. Users are also responsible for ensuring
            that they have the right to connect and use any social accounts
            connected to the service.
          </p>
          <p>
            The service may provide mock mode for testing publishing workflows
            and real publishing mode for sending content to supported social
            media platforms.
          </p>
          <p>
            Abuse, illegal content, copyright infringement, spam, unauthorized
            access, attempts to bypass platform rules, and misuse of connected
            accounts are prohibited.
          </p>
          <p>
            For terms questions, contact us at{" "}
            <a className="font-medium text-blue-700 underline" href="mailto:terryent81@gmail.com">
              terryent81@gmail.com
            </a>
            .
          </p>
        </section>
      </article>
    </main>
  )
}
