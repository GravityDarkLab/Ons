// Vitest 5 declares its assertion types in `Matchers`; jest-dom's own
// '@testing-library/jest-dom/vitest' entry still augments `Assertion`, which
// no longer reaches `expect(...)`. Attach the DOM matchers where Vitest 5
// looks for custom matchers.
import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers'

declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Matchers<T = any> extends TestingLibraryMatchers<unknown, T> {}
}
