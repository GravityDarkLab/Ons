import en from '../../i18n/locales/en.json'
import fr from '../../i18n/locales/fr.json'
import de from '../../i18n/locales/de.json'
import ar from '../../i18n/locales/ar.json'

/** Every leaf key path in a nested translation object, sorted. */
function keyPaths(node: unknown, prefix = ''): string[] {
  if (typeof node !== 'object' || node === null) return [prefix]
  return Object.entries(node).flatMap(([k, v]) => keyPaths(v, prefix ? `${prefix}.${k}` : k)).sort()
}

describe.each([['fr', fr], ['de', de], ['ar', ar]] as const)('%s locale', (_name, locale) => {
  it.each(['questions', 'apply', 'steps'] as const)('has exactly the same %s keys as English', (section) => {
    expect(keyPaths(locale[section])).toEqual(keyPaths(en[section]))
  })

  it('keeps every interpolation placeholder used in English', () => {
    const flat = (node: unknown, prefix = ''): [string, string][] =>
      typeof node === 'string'
        ? [[prefix, node]]
        : Object.entries(node as object).flatMap(([k, v]) => flat(v, prefix ? `${prefix}.${k}` : k))
    const translated = new Map(flat({ questions: locale.questions, apply: locale.apply }))
    for (const [path, text] of flat({ questions: en.questions, apply: en.apply })) {
      for (const placeholder of text.match(/\{\{\w+\}\}/g) ?? []) {
        expect(translated.get(path), path).toContain(placeholder)
      }
    }
  })
})
