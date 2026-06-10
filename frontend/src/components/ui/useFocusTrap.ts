import { useEffect, useRef } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Traps Tab focus inside the returned ref's element while `active`, focuses
 * the first focusable element on activation, and restores focus to the
 * previously focused element on deactivation. Also locks body scroll.
 */
export function useFocusTrap<T extends HTMLElement>(active: boolean) {
  const ref = useRef<T>(null)

  useEffect(() => {
    if (!active || !ref.current) return

    const container = ref.current
    const previouslyFocused = document.activeElement as HTMLElement | null

    const focusables = container.querySelectorAll<HTMLElement>(FOCUSABLE)
    ;(focusables[0] ?? container).focus()

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return
      const items = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prevOverflow
      previouslyFocused?.focus()
    }
  }, [active])

  return ref
}
