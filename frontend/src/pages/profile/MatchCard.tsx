import { useState } from 'react'
import type { MatchView, ContactResult } from '../../api/profile.client'

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 60) return 'just now'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  return `${Math.floor(diffHr / 24)}d ago`
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface MatchCardProps {
  match: MatchView
  onContactRequest?: (matchId: string) => Promise<ContactResult>
  onRespond?: (matchId: string, accept: boolean) => Promise<void>
  onOutcome?: (matchId: string, outcome: 'success' | 'failed') => Promise<void>
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="bg-border rounded-full h-1.5 w-32">
        <div
          className="bg-accent rounded-full h-1.5"
          style={{ width: `${score * 100}%` }}
        />
      </div>
      <span className="text-sm text-muted">{Math.round(score * 100)}%</span>
    </div>
  )
}

function IceBreakersSection({ iceBreakers, dateIdeas }: { iceBreakers?: string[]; dateIdeas?: string[] }) {
  if (!iceBreakers?.length && !dateIdeas?.length) return null
  return (
    <>
      {iceBreakers && iceBreakers.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium text-muted uppercase tracking-wider mb-2">
            Ice-breakers
          </p>
          <ul className="space-y-1">
            {iceBreakers.map((item, i) => (
              <li key={i} className="text-sm text-primary flex gap-2">
                <span className="text-muted shrink-0">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {dateIdeas && dateIdeas.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium text-muted uppercase tracking-wider mb-2">
            Date ideas
          </p>
          <ul className="space-y-1">
            {dateIdeas.map((item, i) => (
              <li key={i} className="text-sm text-primary flex gap-2">
                <span className="text-muted shrink-0">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function MatchCard({ match, onContactRequest, onRespond, onOutcome }: MatchCardProps) {
  const [displayMatch, setDisplayMatch] = useState<MatchView>(match)
  const [loadingContact, setLoadingContact] = useState(false)
  const [loadingAccept, setLoadingAccept] = useState(false)
  const [loadingDecline, setLoadingDecline] = useState(false)
  const [loadingSuccess, setLoadingSuccess] = useState(false)
  const [loadingFailed, setLoadingFailed] = useState(false)

  const { matchId, partnerAlias, score, status, perspective, contactRequestedAt } = displayMatch

  // ── Case 5: Terminal statuses ──────────────────────────────────────────────
  if (status === 'declined' || status === 'failed' || status === 'success' || status === 'expired') {
    const badgeClass =
      status === 'success'
        ? 'bg-green-50 text-green-700'
        : status === 'expired'
        ? 'bg-gray-100 text-gray-400'
        : 'bg-gray-100 text-gray-500'

    return (
      <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm hover-card transition-card">
        <div className="flex items-center justify-between gap-3">
          <span className="text-base font-medium text-primary">{partnerAlias}</span>
          <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${badgeClass}`}>
            {status}
          </span>
        </div>
      </div>
    )
  }

  // ── Case 3: in_progress + target ──────────────────────────────────────────
  if (status === 'in_progress' && perspective === 'target') {
    const handleRespond = async (accept: boolean) => {
      if (!onRespond) return
      if (accept) setLoadingAccept(true)
      else setLoadingDecline(true)
      try {
        await onRespond(matchId, accept)
        setDisplayMatch(prev => ({
          ...prev,
          status: accept ? 'dating' : 'declined',
        }))
      } finally {
        if (accept) setLoadingAccept(false)
        else setLoadingDecline(false)
      }
    }

    return (
      <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm hover-card transition-card">
        <p className="text-base font-medium text-primary">
          {partnerAlias} wants to meet you
        </p>
        {contactRequestedAt && (
          <p className="text-sm text-muted mt-0.5">
            requested {timeAgo(contactRequestedAt)}
          </p>
        )}
        <div className="flex gap-3 mt-4">
          <button
            onClick={() => handleRespond(true)}
            disabled={loadingAccept || loadingDecline}
            className="flex-1 inline-flex items-center justify-center gap-2 bg-accent text-white rounded-full px-4 py-2.5 text-sm font-medium transition-all duration-200 hover:bg-[#B05538] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingAccept ? (
              <LoadingSpinner />
            ) : null}
            Accept
          </button>
          <button
            onClick={() => handleRespond(false)}
            disabled={loadingAccept || loadingDecline}
            className="flex-1 inline-flex items-center justify-center gap-2 bg-surface border border-border text-muted rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 hover:bg-bg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingDecline ? (
              <LoadingSpinner />
            ) : null}
            Decline
          </button>
        </div>
      </div>
    )
  }

  // ── Case 2: in_progress + initiator ──────────────────────────────────────
  if (status === 'in_progress' && perspective === 'initiator') {
    return (
      <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm hover-card transition-card">
        <div className="flex items-center justify-between gap-3">
          <span className="text-base font-medium text-primary">{partnerAlias}</span>
          <span className="bg-amber-50 text-amber-700 text-xs rounded-full px-2 py-0.5 font-medium">
            Waiting
          </span>
        </div>
        {displayMatch.targetInstagram && (
          <p className="text-accent font-medium text-sm mt-1">
            @{displayMatch.targetInstagram}
          </p>
        )}
        <IceBreakersSection
          iceBreakers={displayMatch.iceBreakers}
          dateIdeas={displayMatch.dateIdeas}
        />
      </div>
    )
  }

  // ── Case 4: dating ────────────────────────────────────────────────────────
  if (status === 'dating') {
    const handleOutcome = async (outcome: 'success' | 'failed') => {
      if (!onOutcome) return
      if (outcome === 'success') setLoadingSuccess(true)
      else setLoadingFailed(true)
      try {
        await onOutcome(matchId, outcome)
        setDisplayMatch(prev => ({ ...prev, status: outcome }))
      } finally {
        if (outcome === 'success') setLoadingSuccess(false)
        else setLoadingFailed(false)
      }
    }

    return (
      <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm hover-card transition-card">
        <div className="flex items-center justify-between gap-3">
          <span className="text-base font-medium text-primary">
            You're dating {partnerAlias}
          </span>
          <span className="text-sm text-muted">Match: {Math.round(score * 100)}%</span>
        </div>
        {displayMatch.targetInstagram && (
          <p className="text-accent font-medium text-sm mt-1">
            @{displayMatch.targetInstagram}
          </p>
        )}
        {perspective === 'initiator' && (
          <IceBreakersSection
            iceBreakers={displayMatch.iceBreakers}
            dateIdeas={displayMatch.dateIdeas}
          />
        )}
        <div className="mt-4">
          <p className="text-sm text-muted mb-3">How did it go?</p>
          <div className="flex gap-3">
            <button
              onClick={() => handleOutcome('success')}
              disabled={loadingSuccess || loadingFailed}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-success text-white rounded-full px-4 py-2.5 text-sm font-medium transition-all duration-200 hover:bg-[#2d7a57] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingSuccess ? <LoadingSpinner /> : null}
              It worked out ✓
            </button>
            <button
              onClick={() => handleOutcome('failed')}
              disabled={loadingSuccess || loadingFailed}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-surface border border-border text-muted rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 hover:bg-bg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingFailed ? <LoadingSpinner /> : null}
              It didn't
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Case 1: proposed + none ───────────────────────────────────────────────
  const handleContactRequest = async () => {
    if (!onContactRequest) return
    setLoadingContact(true)
    try {
      const result = await onContactRequest(matchId)
      setDisplayMatch(prev => ({
        ...prev,
        status: 'in_progress',
        perspective: 'initiator',
        targetInstagram: result.targetInstagram,
        iceBreakers: result.iceBreakers,
        dateIdeas: result.dateIdeas,
      }))
    } finally {
      setLoadingContact(false)
    }
  }

  return (
    <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm hover-card transition-card">
      <div className="flex items-center justify-between gap-3">
        <span className="text-base font-medium text-primary">{partnerAlias}</span>
        <ScoreBar score={score} />
      </div>
      <div className="mt-4">
        <button
          onClick={handleContactRequest}
          disabled={loadingContact || !onContactRequest}
          className="inline-flex items-center justify-center gap-2 bg-accent text-white rounded-full px-5 py-2.5 text-sm font-medium transition-all duration-200 hover:bg-[#B05538] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loadingContact ? <LoadingSpinner /> : null}
          I want to reach out
        </button>
      </div>
    </div>
  )
}

// ── Spinner helper ────────────────────────────────────────────────────────────

function LoadingSpinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  )
}
