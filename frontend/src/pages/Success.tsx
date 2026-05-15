import { useSearchParams, Link } from 'react-router-dom'

export default function Success() {
  const [params] = useSearchParams()
  const alias = params.get('alias') ?? 'Mystery Person'

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-form text-center flex flex-col items-center gap-6">
        {/* Icon */}
        <div className="flex items-center justify-center w-20 h-20 rounded-full bg-accent-light border border-accent/20 text-4xl mb-2" aria-hidden="true">
          ✨
        </div>

        {/* Heading */}
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-semibold text-primary tracking-tight">You're in.</h1>
          <p className="text-muted text-[16px] leading-relaxed">
            We'll reach out when we find your match.
          </p>
        </div>

        {/* Alias card */}
        <div className="w-full bg-surface rounded-2xl border border-border shadow-sm p-8 flex flex-col items-center gap-3">
          <p className="text-sm font-medium text-muted uppercase tracking-widest">
            Your alias is
          </p>
          <p
            className="text-[2.25rem] font-semibold text-accent tracking-tight leading-tight"
            style={{ fontVariant: 'small-caps' }}
          >
            {alias}
          </p>
          <div className="w-12 h-px bg-border" aria-hidden="true" />
          <p className="text-sm text-muted leading-relaxed text-center max-w-xs">
            Keep this alias safe — it's how we'll refer to you when we reach out.
          </p>
        </div>

        {/* Privacy note */}
        <div className="flex items-start gap-3 w-full rounded-xl bg-accent-light border border-accent/20 px-4 py-3.5 text-left">
          <svg
            className="h-4 w-4 text-accent flex-shrink-0 mt-0.5"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <p className="text-xs text-accent leading-relaxed">
            In the meantime, your identity is <strong>safely encrypted</strong>. We'll never share
            your information with third parties.
          </p>
        </div>

        {/* Back to home */}
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted hover:text-primary transition-colors duration-200 mt-2"
        >
          <svg
            className="h-3.5 w-3.5"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          Back to home
        </Link>
      </div>
    </div>
  )
}
