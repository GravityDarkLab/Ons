import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Hero */}
      <section className="flex-1 flex flex-col justify-center px-6 pt-16 pb-10 mx-auto w-full max-w-form">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 self-start mb-8 rounded-full bg-accent-light border border-accent/20 px-4 py-2">
          <svg
            className="h-3.5 w-3.5 text-accent flex-shrink-0"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span className="text-xs font-medium text-accent tracking-wide">
            Privacy first · Invite only
          </span>
        </div>

        {/* Headline */}
        <h1 className="text-[3.5rem] leading-[1.05] font-semibold text-primary tracking-tight mb-5">
          Find your<br />person.
        </h1>

        {/* Subline */}
        <p className="text-[17px] text-muted leading-relaxed mb-10 max-w-sm">
          A curated matchmaking experience where your identity stays private until we make the
          connection.
        </p>

        {/* CTA */}
        <Link
          to="/apply"
          className="inline-flex items-center justify-center gap-2 w-full rounded-xl bg-accent text-white px-6 py-4 text-[16px] font-medium transition-all duration-200 hover:bg-[#B05538] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          Apply Now
          <svg
            className="h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </Link>
      </section>

      {/* How it works */}
      <section className="px-6 pb-16 mx-auto w-full max-w-form">
        <h2 className="text-xs font-semibold text-muted uppercase tracking-widest mb-5">
          How it works
        </h2>
        <div className="flex flex-col gap-3">
          <HowItWorksCard
            emoji="🗒️"
            title="Fill the form"
            description="Answer a short questionnaire about you and what you're looking for."
          />
          <HowItWorksCard
            emoji="🔒"
            title="We protect your identity"
            description="Your Instagram handle is encrypted. You get a codename. Only admins know the link."
          />
          <HowItWorksCard
            emoji="💌"
            title="We make the match"
            description="If we see a connection, we reach out directly. No algorithm swiping."
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="pb-8 px-6 text-center">
        <p className="text-xs text-muted">
          &copy; 2025 Matching &middot; Built with care
        </p>
      </footer>
    </div>
  )
}

function HowItWorksCard({
  emoji,
  title,
  description,
}: {
  emoji: string
  title: string
  description: string
}) {
  return (
    <div className="bg-surface rounded-2xl border border-border p-5 shadow-sm flex items-start gap-4 transition-all duration-200">
      <div className="flex-shrink-0 text-2xl leading-none mt-0.5" aria-hidden="true">
        {emoji}
      </div>
      <div>
        <h3 className="text-[15px] font-semibold text-primary mb-1">{title}</h3>
        <p className="text-sm text-muted leading-relaxed">{description}</p>
      </div>
    </div>
  )
}
