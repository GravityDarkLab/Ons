import { useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export default function Success() {
  const { t } = useTranslation()
  const [params] = useSearchParams()
  const alias = params.get('alias') ?? 'Mystery Person'
  const token = params.get('token') ?? null

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const profileUrl = token
    ? `${origin}/profile/login?token=${token}`
    : `${origin}/profile/login?token=YOUR_TOKEN_HERE`

  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(profileUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleDownload() {
    const content = `Your Ons profile link:\n${profileUrl}\n\nKeep this safe — you need it to log in.`
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'ons-profile-link.txt'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-lg flex flex-col items-center gap-6">

        {/* Icon */}
        <div
          className="flex items-center justify-center w-20 h-20 rounded-full bg-accent-light border border-accent/20 text-4xl mb-2"
          aria-hidden="true"
        >
          ✨
        </div>

        {/* Header */}
        <div className="flex flex-col gap-2 text-center">
          <h1 className="text-4xl font-semibold text-primary tracking-tight">{t('success.title')}</h1>
          <p className="text-muted text-[16px] leading-relaxed">{t('success.subtitle')}</p>
        </div>

        {/* Alias card */}
        <div className="w-full bg-surface rounded-2xl border border-border shadow-sm p-8 flex flex-col items-center gap-3">
          <p className="text-sm font-medium text-muted uppercase tracking-widest">{t('success.aliasLabel')}</p>
          <p
            className="text-[2.25rem] font-semibold text-accent tracking-tight leading-tight"
            style={{ fontVariant: 'small-caps' }}
          >
            {alias}
          </p>
          <div className="w-12 h-px bg-border" aria-hidden="true" />
          <p className="text-sm text-muted leading-relaxed text-center max-w-xs">{t('success.aliasHint')}</p>
        </div>

        {/* Warning banner */}
        <div
          className="flex items-start gap-3 w-full rounded-xl px-4 py-3.5 text-left"
          style={{ backgroundColor: '#F5ECD7', borderWidth: 1, borderColor: '#C9A96E', borderStyle: 'solid' }}
        >
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
          <p className="text-xs text-accent leading-relaxed">{t('success.warning')}</p>
        </div>

        {/* Magic link block */}
        <div className="w-full bg-surface rounded-2xl border border-border shadow-sm p-6 flex flex-col gap-4">
          <p className="text-xs font-medium text-muted uppercase tracking-widest">{t('success.linkLabel')}</p>

          <code
            className="block bg-bg rounded-xl p-4 border border-border text-sm font-mono break-all text-primary leading-relaxed"
          >
            {profileUrl}
          </code>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleCopy}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-accent text-white font-medium text-sm px-4 py-2.5 hover:opacity-90 transition-opacity duration-150"
            >
              {copied ? t('success.copied') : t('success.copyLink')}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-surface border border-border text-primary font-medium text-sm px-4 py-2.5 hover:bg-bg transition-colors duration-150"
            >
              {t('success.download')}
            </button>
          </div>
        </div>

        {/* Bottom */}
        <div className="flex flex-col items-center gap-2 mt-2">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-accent transition-colors duration-200"
          >
            {t('success.done')}
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
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
          <p className="text-xs text-muted text-center max-w-xs leading-relaxed">{t('success.laterHint')}</p>
        </div>

      </div>
    </div>
  )
}
