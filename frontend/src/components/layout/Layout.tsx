import React from 'react'

interface LayoutProps {
  children: React.ReactNode
  className?: string
}

export default function Layout({ children, className = '' }: LayoutProps) {
  return (
    <div className="min-h-screen bg-bg">
      <div
        className={[
          'mx-auto w-full max-w-form px-4 py-8 safe-area-inset',
          className,
        ].join(' ')}
      >
        {children}
      </div>
    </div>
  )
}
