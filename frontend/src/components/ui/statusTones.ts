import type { BadgeTone } from './Badge'

/** Single source of truth for status → badge tone, shared by admin + portal. */

export function applicantStatusTone(status: string): BadgeTone {
  switch (status) {
    case 'applied':  return 'info'
    case 'matched':  return 'accent'
    case 'dating':   return 'success'
    case 'inactive': return 'neutral'
    default:         return 'neutral'
  }
}

export function matchStatusTone(status: string): BadgeTone {
  switch (status) {
    case 'in_progress': return 'info'
    case 'dating':      return 'success'
    case 'success':     return 'accent'
    case 'failed':      return 'danger'
    case 'proposed':
    case 'declined':
    case 'expired':
    default:            return 'neutral'
  }
}
