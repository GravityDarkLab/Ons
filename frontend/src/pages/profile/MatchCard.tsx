import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Badge from '../../components/ui/Badge'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { matchStatusTone } from '../../components/ui/statusTones'
import { useTimeAgo } from '../../admin/utils/timeAgo'
import { getBreakdownEntry } from './matchBreakdownLabels'
import type { MatchView, ContactResult } from '../../api/profile.client'

// ── Props ─────────────────────────────────────────────────────────────────────

interface MatchCardProps {
  match: MatchView
  onContactRequest?: (matchId: string) => Promise<ContactResult>
  onRespond?: (matchId: string, accept: boolean) => Promise<void>
  onWithdraw?: (matchId: string) => Promise<void>
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

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`h-4 w-4 text-muted shrink-0 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

/**
 * Card header row. When `hasDetails` is true the whole row becomes a toggle
 * button (with a chevron) for the partner profile + score breakdown;
 * otherwise it's a static row.
 */
function ExpandableHeader({
  expanded,
  onToggle,
  hasDetails,
  left,
  right,
}: {
  expanded: boolean
  onToggle: () => void
  hasDetails: boolean
  left: React.ReactNode
  right: React.ReactNode
}) {
  const content = (
    <>
      {left}
      <div className="flex items-center gap-2">
        {right}
        {hasDetails && <ChevronIcon expanded={expanded} />}
      </div>
    </>
  )

  if (!hasDetails) {
    return <div className="flex items-center justify-between gap-3">{content}</div>
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      className="flex items-center justify-between gap-3 w-full text-left"
    >
      {content}
    </button>
  )
}

function MatchBreakdown({ breakdown }: { breakdown: Record<string, number> }) {
  const { t } = useTranslation()
  const entries = Object.entries(breakdown)
    .map(([key, value]) => ({ key, value, ...getBreakdownEntry(t, key) }))
    .sort((a, b) => b.value - a.value)

  return (
    <div className="mt-4 pt-4 border-t border-border">
      <p className="text-xs font-medium text-muted uppercase tracking-wider mb-3">
        {t('portal.matches.scoreBreakdown')}
      </p>
      <div className="space-y-3">
        {entries.map(({ key, value, label, description }) => (
          <div key={key}>
            <p className="text-sm font-medium text-primary mb-1">{label}</p>
            <ScoreBar score={value} />
            {description && <p className="text-xs text-muted mt-1">{description}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}

function formatAnswerValue(value: unknown, yes: string, no: string): string {
  if (typeof value === 'boolean') return value ? yes : no
  if (Array.isArray(value)) return value.map(v => String(v)).join(', ')
  if (value === null || value === undefined || String(value).trim() === '') return '—'
  return String(value)
}

/** Partner's public questionnaire answers — rendered raw, keyed by question id. */
function PartnerProfileSection({ profile, alias }: { profile: Record<string, unknown>; alias: string }) {
  const { t } = useTranslation()
  return (
    <div className="mt-4 pt-4 border-t border-border">
      <p className="text-xs font-medium text-muted uppercase tracking-wider mb-3">
        {t('portal.matches.aboutPartner', { alias })}
      </p>
      <div className="space-y-2.5">
        {Object.entries(profile).map(([key, value]) => (
          <div key={key} className="flex justify-between gap-3 text-sm">
            <span className="text-muted capitalize shrink-0">{key.replace(/_/g, ' ')}</span>
            <span className="text-primary text-end break-words">
              {formatAnswerValue(value, t('common.yes'), t('common.no'))}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function IceBreakersSection({ iceBreakers, dateIdeas }: { iceBreakers?: string[]; dateIdeas?: string[] }) {
  const { t } = useTranslation()
  if (!iceBreakers?.length && !dateIdeas?.length) return null
  return (
    <>
      {iceBreakers && iceBreakers.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium text-muted uppercase tracking-wider mb-2">
            {t('portal.matches.iceBreakers')}
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
            {t('portal.matches.dateIdeas')}
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

export function MatchCard({ match, onContactRequest, onRespond, onWithdraw, onOutcome }: MatchCardProps) {
  const { t } = useTranslation()
  const timeAgo = useTimeAgo()
  const [displayMatch, setDisplayMatch] = useState<MatchView>(match)
  const [loadingContact, setLoadingContact] = useState(false)
  // Contact has succeeded server-side (identity revealed, other matches
  // released) but the user hasn't confirmed/passed in the dialog yet
  const [pendingContact, setPendingContact] = useState<ContactResult | null>(null)
  const [withdrawing, setWithdrawing] = useState(false)
  const [loadingAccept, setLoadingAccept] = useState(false)
  const [loadingDecline, setLoadingDecline] = useState(false)
  const [loadingSuccess, setLoadingSuccess] = useState(false)
  const [loadingFailed, setLoadingFailed] = useState(false)
  const [actionError, setActionError] = useState('')
  const [expanded, setExpanded] = useState(false)

  function failAction(err: unknown) {
    setActionError(err instanceof Error ? err.message : t('portal.matches.genericError'))
  }

  const { matchId, partnerAlias, score, status, perspective, contactRequestedAt, breakdown, partnerProfile } = displayMatch
  const hasBreakdown = !!breakdown && Object.keys(breakdown).length > 0
  const hasProfile = !!partnerProfile && Object.keys(partnerProfile).length > 0
  const hasDetails = hasBreakdown || hasProfile
  const toggleExpanded = () => setExpanded(prev => !prev)

  // Partner profile first (who they are), then the score breakdown (why this score)
  const detailsSection = expanded ? (
    <>
      {hasProfile && <PartnerProfileSection profile={partnerProfile!} alias={partnerAlias} />}
      {hasBreakdown && <MatchBreakdown breakdown={breakdown!} />}
    </>
  ) : null

  // ── Case 5: Terminal statuses ──────────────────────────────────────────────
  if (status === 'declined' || status === 'failed' || status === 'success' || status === 'expired') {
    // Terminal cards are visually quieter than active ones: subtle bg, no lift
    return (
      <div className="bg-surface-subtle border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-base font-medium text-muted">{partnerAlias}</span>
          <Badge tone={matchStatusTone(status)} size="sm">
            {t(`portal.matches.status.${status}`)}
          </Badge>
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
      setActionError('')
      try {
        await onRespond(matchId, accept)
        setDisplayMatch(prev => ({
          ...prev,
          status: accept ? 'dating' : 'declined',
        }))
      } catch (err) {
        failAction(err)
      } finally {
        if (accept) setLoadingAccept(false)
        else setLoadingDecline(false)
      }
    }

    return (
      <div className="bg-surface border border-border rounded-2xl p-5 shadow-card hover-card transition-card">
        <p className="text-base font-medium text-primary">
          {t('portal.matches.wantsToMeet', { alias: partnerAlias })}
        </p>
        {contactRequestedAt && (
          <p className="text-sm text-muted mt-0.5">
            {t('portal.matches.requested', { time: timeAgo(new Date(contactRequestedAt).getTime()) })}
          </p>
        )}
        <div className="flex gap-3 mt-4">
          <button
            onClick={() => handleRespond(true)}
            disabled={loadingAccept || loadingDecline}
            className="flex-1 inline-flex items-center justify-center gap-2 bg-accent text-bg rounded-full px-4 py-2.5 text-sm font-medium transition-all duration-200 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingAccept ? (
              <LoadingSpinner />
            ) : null}
            {t('portal.matches.accept')}
          </button>
          <button
            onClick={() => handleRespond(false)}
            disabled={loadingAccept || loadingDecline}
            className="flex-1 inline-flex items-center justify-center gap-2 bg-surface border border-border text-muted rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 hover:bg-bg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingDecline ? (
              <LoadingSpinner />
            ) : null}
            {t('portal.matches.decline')}
          </button>
        </div>
        {actionError && <p role="alert" className="text-sm text-error mt-3">{actionError}</p>}
      </div>
    )
  }

  // ── Case 2: in_progress + initiator ──────────────────────────────────────
  if (status === 'in_progress' && perspective === 'initiator') {
    return (
      <div className="bg-surface border border-border rounded-2xl p-5 shadow-card hover-card transition-card">
        <ExpandableHeader
          expanded={expanded}
          onToggle={toggleExpanded}
          hasDetails={hasDetails}
          left={<span className="text-base font-medium text-primary">{partnerAlias}</span>}
          right={<Badge tone="warning" size="sm">{t('portal.matches.waiting')}</Badge>}
        />
        {displayMatch.targetInstagram && (
          <p className="text-accent font-medium text-sm mt-1">
            @{displayMatch.targetInstagram}
          </p>
        )}
        <IceBreakersSection
          iceBreakers={displayMatch.iceBreakers}
          dateIdeas={displayMatch.dateIdeas}
        />
        {detailsSection}
      </div>
    )
  }

  // ── Case 4: dating ────────────────────────────────────────────────────────
  if (status === 'dating') {
    const handleOutcome = async (outcome: 'success' | 'failed') => {
      if (!onOutcome) return
      if (outcome === 'success') setLoadingSuccess(true)
      else setLoadingFailed(true)
      setActionError('')
      try {
        await onOutcome(matchId, outcome)
        setDisplayMatch(prev => ({ ...prev, status: outcome }))
      } catch (err) {
        failAction(err)
      } finally {
        if (outcome === 'success') setLoadingSuccess(false)
        else setLoadingFailed(false)
      }
    }

    return (
      <div className="bg-surface border border-border rounded-2xl p-5 shadow-card hover-card transition-card">
        <ExpandableHeader
          expanded={expanded}
          onToggle={toggleExpanded}
          hasDetails={hasDetails}
          left={
            <span className="text-base font-medium text-primary">
              {t('portal.matches.dating', { alias: partnerAlias })}
            </span>
          }
          right={<span className="text-sm text-muted">{t('portal.matches.matchScore', { percent: Math.round(score * 100) })}</span>}
        />
        {detailsSection}
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
          <p className="text-sm text-muted mb-3">{t('portal.matches.howDidItGo')}</p>
          <div className="flex gap-3">
            <button
              onClick={() => handleOutcome('success')}
              disabled={loadingSuccess || loadingFailed}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-success text-bg rounded-full px-4 py-2.5 text-sm font-medium transition-all duration-200 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingSuccess ? <LoadingSpinner /> : null}
              {t('portal.matches.workedOut')}
            </button>
            <button
              onClick={() => handleOutcome('failed')}
              disabled={loadingSuccess || loadingFailed}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-surface border border-border text-muted rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 hover:bg-bg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingFailed ? <LoadingSpinner /> : null}
              {t('portal.matches.didntWork')}
            </button>
          </div>
          {actionError && <p role="alert" className="text-sm text-error mt-3">{actionError}</p>}
        </div>
      </div>
    )
  }

  // ── Case 1: proposed + none ───────────────────────────────────────────────
  const handleContactRequest = async () => {
    if (!onContactRequest) return
    setLoadingContact(true)
    setActionError('')
    try {
      const result = await onContactRequest(matchId)
      // Reveal happened server-side — let the user confirm or pass in a dialog
      setPendingContact(result)
    } catch (err) {
      failAction(err)
    } finally {
      setLoadingContact(false)
    }
  }

  // Confirm (and any plain dismiss — Escape/backdrop must never decline
  // permanently by accident): proceed to the waiting "contact status" view
  const confirmContact = () => {
    if (!pendingContact) return
    setDisplayMatch(prev => ({
      ...prev,
      status: 'in_progress',
      perspective: 'initiator',
      targetInstagram: pendingContact.targetInstagram,
      iceBreakers: pendingContact.iceBreakers,
      dateIdeas: pendingContact.dateIdeas,
    }))
    setPendingContact(null)
  }

  // Explicit "No": withdraw — the match is declined for good and the user
  // waits for the next matching phase
  const cancelContact = async () => {
    if (!onWithdraw) {
      confirmContact()
      return
    }
    setWithdrawing(true)
    try {
      await onWithdraw(matchId)
      // Parent clears the list — this card unmounts
    } catch (err) {
      // Withdraw failed: fall back to the waiting view, the contact is still live
      failAction(err)
      confirmContact()
    } finally {
      setWithdrawing(false)
    }
  }

  return (
    <div className="bg-surface border border-border rounded-2xl p-5 shadow-card hover-card transition-card">
      <ExpandableHeader
        expanded={expanded}
        onToggle={toggleExpanded}
        hasDetails={hasDetails}
        left={<span className="text-base font-medium text-primary">{partnerAlias}</span>}
        right={<ScoreBar score={score} />}
      />
      {detailsSection}
      <div className="mt-4">
        <button
          onClick={handleContactRequest}
          disabled={loadingContact || !onContactRequest}
          className="inline-flex items-center justify-center gap-2 bg-accent text-bg rounded-full px-5 py-2.5 text-sm font-medium transition-all duration-200 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loadingContact ? <LoadingSpinner /> : null}
          {t('portal.matches.reachOut')}
        </button>
        {actionError && <p role="alert" className="text-sm text-error mt-3">{actionError}</p>}
      </div>
      <ConfirmDialog
        open={pendingContact !== null}
        title={t('portal.matches.confirmContactTitle')}
        description={t('portal.matches.confirmContactBody', {
          alias: partnerAlias,
          handle: pendingContact?.targetInstagram ?? '',
        })}
        confirmLabel={t('portal.matches.confirmContactYes')}
        cancelLabel={t('portal.matches.confirmContactNo')}
        loading={withdrawing}
        onConfirm={confirmContact}
        onCancel={() => { void cancelContact() }}
        onClose={confirmContact}
      />
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
