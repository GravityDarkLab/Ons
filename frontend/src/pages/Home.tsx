import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LanguageSwitcher from '../components/LanguageSwitcher'

export default function Home() {
  const { t, i18n } = useTranslation()
  const isRTL = i18n.dir() === 'rtl'
  const cards = t('home.cards', { returnObjects: true }) as Array<{ emoji: string; title: string; desc: string }>

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <div className="flex justify-end px-6 py-4">
        <LanguageSwitcher />
      </div>

      {/* Hero */}
      <section className="flex-1 flex flex-col justify-center px-6 pb-10 mx-auto w-full max-w-form">
        <div className="inline-flex items-center gap-2 self-start mb-8 rounded-full bg-accent-light border border-accent/20 px-4 py-2">
          <svg className="h-3.5 w-3.5 text-accent flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span className="text-xs font-medium text-accent tracking-wide">{t('home.badge')}</span>
        </div>

        <h1 className="text-[3.5rem] leading-[1.05] font-semibold text-primary tracking-tight mb-5 whitespace-pre-line">
          {t('home.headline')}
        </h1>
        <p className="text-[17px] text-muted leading-relaxed mb-10 max-w-sm">{t('home.subline')}</p>

        <Link
          to="/apply"
          className="inline-flex items-center justify-center gap-2 w-full rounded-xl bg-accent text-white px-6 py-4 text-[16px] font-medium transition-all duration-200 hover:bg-[#B05538] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          {t('home.cta')}
          {/* Arrow flipped in RTL: forward = left in Arabic */}
          <svg
            className="h-4 w-4"
            style={isRTL ? { transform: 'scaleX(-1)' } : undefined}
            xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
          >
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </Link>
      </section>

      {/* How it works */}
      <section className="px-6 pb-16 mx-auto w-full max-w-form">
        <h2 className="text-xs font-semibold text-muted uppercase tracking-widest mb-5">{t('home.howItWorks')}</h2>
        <div className="flex flex-col gap-3">
          {cards.map((card) => (
            <div key={card.title} className="bg-surface rounded-2xl border border-border p-5 shadow-sm flex items-start gap-4 transition-all duration-200">
              <div className="flex-shrink-0 text-2xl leading-none mt-0.5" aria-hidden="true">{card.emoji}</div>
              <div>
                <h3 className="text-[15px] font-semibold text-primary mb-1">{card.title}</h3>
                <p className="text-sm text-muted leading-relaxed">{card.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer className="pb-8 px-6 text-center">
        <p className="text-xs text-muted">{t('home.footer')}</p>
      </footer>
    </div>
  )
}
