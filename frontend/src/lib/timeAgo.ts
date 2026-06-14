import { useTranslation } from 'react-i18next'

export function useTimeAgo() {
  const { t } = useTranslation()

  return (ms: number): string => {
    const secs = Math.floor((Date.now() - ms) / 1000)
    if (secs < 60) return t('common.timeAgo.justNow')

    const mins = Math.floor(secs / 60)
    if (mins < 60) return t('common.timeAgo.minutesAgo', { count: mins })

    const hours = Math.floor(mins / 60)
    if (hours < 24) return t('common.timeAgo.hoursAgo', { count: hours })

    const days = Math.floor(hours / 24)
    return t('common.timeAgo.daysAgo', { count: days })
  }
}
