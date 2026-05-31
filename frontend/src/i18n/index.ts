import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
// import LanguageDetector from 'i18next-browser-languagedetector'
// ↑ Uncomment + add .use(LanguageDetector) below to auto-detect the browser/OS language.
// Also restore the `detection` block in init() to control detection order and caching.

import en from './locales/en.json'
import de from './locales/de.json'
import ar from './locales/ar.json'
import fr from './locales/fr.json'

export const SUPPORTED_LANGUAGES = ['en', 'de', 'fr', 'ar'] as const
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]

export const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  en: 'EN',
  de: 'DE',
  ar: 'AR',
  fr: 'FR',
}

const STORAGE_KEY = 'ons_lang'

function savedLanguage(): SupportedLanguage {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && (SUPPORTED_LANGUAGES as readonly string[]).includes(saved))
      return saved as SupportedLanguage
  } catch {}
  return 'en'
}

function applyDocumentDirection(lang: string) {
  const dir = lang === 'ar' ? 'rtl' : 'ltr'
  document.documentElement.dir = dir
  document.documentElement.lang = lang
}

i18n
  // .use(LanguageDetector)   // ← restore this line to enable auto-detection from OS/browser
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en }, de: { translation: de }, ar: { translation: ar }, fr: { translation: fr } },
    lng: savedLanguage(),  // persisted choice, falls back to 'en' for first-time visitors
    fallbackLng: 'en',
    supportedLngs: SUPPORTED_LANGUAGES,
    interpolation: { escapeValue: false },
    // detection: {         // ← restore this block when using LanguageDetector
    //   order: ['localStorage', 'navigator'],
    //   lookupLocalStorage: STORAGE_KEY,
    //   caches: ['localStorage'],
    // },
  })

applyDocumentDirection(i18n.language)

i18n.on('languageChanged', (lang) => {
  applyDocumentDirection(lang)
  try { localStorage.setItem(STORAGE_KEY, lang) } catch {}
})

export default i18n
