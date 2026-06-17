import { useTranslation } from 'react-i18next'
import type { MatchStatus } from '../types'

export function useStatusLabels() {
  const { t } = useTranslation()
  const STATUS_LABEL: Record<MatchStatus, string> = {
    proposed:    t('admin.matches.proposed'),
    in_progress: t('admin.matches.in_progress'),
    dating:      t('admin.matches.dating'),
    success:     t('admin.matches.success'),
    failed:      t('admin.matches.failed'),
    declined:    t('admin.matches.declined'),
    expired:     t('admin.matches.expired'),
  }
  const ACTION_LABEL: Record<MatchStatus, string> = {
    proposed:    t('admin.matches.markProposed'),
    in_progress: t('admin.matches.markInProgress'),
    dating:      t('admin.matches.markDating'),
    success:     t('admin.matches.markSuccess'),
    failed:      t('admin.matches.markFailed'),
    declined:    t('admin.matches.markDeclined'),
    expired:     t('admin.matches.markExpired'),
  }
  return { STATUS_LABEL, ACTION_LABEL }
}
