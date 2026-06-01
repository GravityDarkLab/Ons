// Minimal setup for Bun's native test runner.
// Vitest handles its own environment via vitest.config.ts + setup.ts.
import { JSDOM } from 'jsdom'
import { afterEach } from 'bun:test'

// Wire up a jsdom environment so @testing-library/react can render components.
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost',
  pretendToBeVisual: true,
})

const g = global as Record<string, unknown>
g.window    = dom.window
g.document  = dom.window.document
g.navigator = dom.window.navigator
g.location  = dom.window.location
g.HTMLElement        = dom.window.HTMLElement
g.Element            = dom.window.Element
g.Node               = dom.window.Node
g.Text               = dom.window.Text
g.Comment            = dom.window.Comment
g.DocumentFragment   = dom.window.DocumentFragment
g.NodeList           = dom.window.NodeList
g.HTMLCollection     = dom.window.HTMLCollection
g.MutationObserver   = dom.window.MutationObserver
g.getComputedStyle   = dom.window.getComputedStyle.bind(dom.window)

// Register jest-dom matchers after globals are set.
await import('@testing-library/jest-dom')

const { cleanup } = await import('@testing-library/react')

afterEach(() => {
  cleanup()
  try { localStorage.clear() } catch { /* not available outside browser ctx */ }
})
