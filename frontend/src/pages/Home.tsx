import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LanguageSwitcher from '../components/LanguageSwitcher'
import LifeBackground from '../components/LifeBackground'

export default function Home() {
  const { t, i18n } = useTranslation()
  const isRTL = i18n.dir() === 'rtl'
  const cards = t('home.cards', { returnObjects: true }) as Array<{ emoji: string; title: string; desc: string }>

  return (
    <div className="relative min-h-screen bg-bg flex flex-col overflow-hidden">
      <LifeBackground />

      <div className="relative z-10 flex flex-1 flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-5 mx-auto w-full max-w-form">
          <span className="font-display text-2xl font-semibold text-primary select-none">Ons</span>
          <LanguageSwitcher />
        </div>

        {/* Hero */}
        <section className="flex-1 flex flex-col justify-center px-6 pb-10 mx-auto w-full max-w-form">
          <div className="home-rise inline-flex items-center gap-2 self-start mb-8 rounded-full bg-surface/70 backdrop-blur-md border border-accent/25 px-4 py-2 shadow-card">
            <svg className="h-3.5 w-3.5 text-accent-ink flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span className="text-xs font-medium text-accent-ink tracking-wide">{t('home.badge')}</span>
          </div>

          <h1
            className="home-rise font-display text-[3.5rem] sm:text-[4.25rem] leading-[1.04] font-semibold text-primary tracking-tight mb-5 whitespace-pre-line"
            style={{ animationDelay: '90ms' }}
          >
            {t('home.headline')}
          </h1>
          <p className="home-rise text-[17px] text-muted leading-relaxed mb-10 max-w-sm" style={{ animationDelay: '180ms' }}>
            {t('home.subline')}
          </p>

          <Link
            to="/apply"
            className="home-rise cta-gold inline-flex items-center justify-center gap-2 w-full rounded-full text-white px-6 py-4 text-[16px] font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2"
            style={{ animationDelay: '270ms' }}
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
          <h2 className="home-rise text-xs font-semibold text-muted uppercase tracking-widest mb-5" style={{ animationDelay: '340ms' }}>
            {t('home.howItWorks')}
          </h2>
          <div className="flex flex-col gap-3">
            {cards.map((card, i) => (
              <div
                key={card.title}
                className="home-rise bg-surface/70 backdrop-blur-md rounded-2xl border border-border/80 p-5 shadow-card flex items-start gap-4 transition-all duration-300 hover:shadow-raised hover:-translate-y-0.5 hover:border-accent/30"
                style={{ animationDelay: `${410 + i * 90}ms` }}
              >
                <div className="flex-shrink-0 h-11 w-11 rounded-xl bg-accent-light border border-accent/20 flex items-center justify-center text-xl leading-none" aria-hidden="true">
                  {card.emoji}
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold text-primary mb-1">{card.title}</h3>
                  <p className="text-sm text-muted leading-relaxed">{card.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <footer className="pb-8 px-6 text-center">
          <p className="text-xs text-muted">{t('home.footer', { year: new Date().getFullYear() })}</p>
        </footer>
      </div>
    </div>
  )
}
