import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Privacy Policy | PostBridge",
  description: "Privacy Policy for PostBridge.",
}

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-white px-6 py-12 text-slate-900">
      <article className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-3 border-b border-slate-200 pb-6">
          <p className="text-sm font-medium text-slate-500">PostBridge</p>
          <h1 className="text-4xl font-bold tracking-normal">Privacy Policy</h1>
          <p className="text-sm text-slate-500">Last updated: May 9, 2026</p>
        </header>

        <section className="space-y-4 text-base leading-7">
          <p>
            PostBridge stores user account connection data only for social media
            publishing features, including account connection, upload,
            scheduling, and publishing workflows.
          </p>
          <p>
            PostBridge may process data related to Google login, Meta,
            Facebook, and Instagram account connection, uploaded media,
            scheduled posts, publishing history, and credits used by the
            service.
          </p>
          <p>
            Account connection tokens and related social account linkage data
            are used only to provide the requested publishing and scheduling
            features.
          </p>
          <p>
            User data is not sold. PostBridge does not sell personal data,
            uploaded media, social account connection data, scheduled post data,
            or credit information to third parties.
          </p>
          <p>
            For privacy questions, contact us at{" "}
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
