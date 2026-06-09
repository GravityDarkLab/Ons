import { MatchCard } from './MatchCard'
import type { MatchView, ContactResult } from '../../api/profile.client'
import { requestContact, respondToContact, reportOutcome } from '../../api/profile.client'

interface Props {
  matches: MatchView[]
  onMatchesChange: (updatedMatches: MatchView[]) => void
}

export default function MatchList({ matches, onMatchesChange }: Props) {
  async function handleContact(matchId: string): Promise<ContactResult> {
    const result = await requestContact(matchId)
    onMatchesChange(
      matches.map(m =>
        m.matchId === matchId
          ? {
              ...m,
              status: 'in_progress' as const,
              perspective: 'initiator' as const,
              targetInstagram: result.targetInstagram,
              iceBreakers: result.iceBreakers,
              dateIdeas: result.dateIdeas,
            }
          : m,
      ),
    )
    return result
  }

  async function handleRespond(matchId: string, accept: boolean): Promise<void> {
    await respondToContact(matchId, accept)
    onMatchesChange(
      matches.map(m =>
        m.matchId === matchId
          ? { ...m, status: accept ? ('dating' as const) : ('declined' as const) }
          : m,
      ),
    )
  }

  async function handleOutcome(matchId: string, outcome: 'success' | 'failed'): Promise<void> {
    await reportOutcome(matchId, outcome)
    onMatchesChange(matches.map(m => (m.matchId === matchId ? { ...m, status: outcome } : m)))
  }

  if (matches.length === 0) {
    return <p className="text-sm text-muted py-8 text-center">No matches to show.</p>
  }

  return (
    <div className="space-y-4">
      {matches.map(m => (
        <MatchCard
          key={m.matchId}
          match={m}
          onContactRequest={handleContact}
          onRespond={handleRespond}
          onOutcome={handleOutcome}
        />
      ))}
    </div>
  )
}
