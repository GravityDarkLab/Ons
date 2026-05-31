import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { SUPPORTED_LANGUAGES, LANGUAGE_LABELS, type SupportedLanguage } from '../i18n'

const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  en: 'English',
  de: 'Deutsch',
  fr: 'Français',
  ar: 'العربية',
}

interface Props {
  className?: string
}

export default function LanguageSwitcher({ className = '' }: Props) {
  const { i18n } = useTranslation()
  const current = (i18n.language?.slice(0, 2) ?? 'en') as SupportedLanguage
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function select(lang: SupportedLanguage) {
    i18n.changeLanguage(lang)
    setOpen(false)
  }

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm text-muted hover:text-primary hover:bg-border/50 transition-colors"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <svg className="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
        <span className="font-medium">{LANGUAGE_LABELS[current]}</span>
        <svg className={`w-3 h-3 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute end-0 top-full mt-1 w-36 bg-surface border border-border rounded-xl shadow-md py-1 z-50" role="listbox">
          {SUPPORTED_LANGUAGES.map(lang => (
            <button
              key={lang}
              role="option"
              aria-selected={lang === current}
              onClick={() => select(lang)}
              className={`w-full text-start px-3 py-2 text-sm flex items-center justify-between transition-colors ${
                lang === current
                  ? 'text-accent bg-accent-light font-medium'
                  : 'text-primary hover:bg-bg'
              }`}
            >
              <span>{LANGUAGE_NAMES[lang]}</span>
              <span className="text-xs text-muted">{LANGUAGE_LABELS[lang]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
