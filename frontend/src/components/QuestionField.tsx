import { useTranslation } from 'react-i18next'
import RadioCardGroup from './ui/RadioCard'
import type { AnswerValue, Question } from '../lib/questions'

interface QuestionFieldProps {
  question: Question
  value: AnswerValue | undefined
  onChange: (value: AnswerValue) => void
  error?: string
  /** id of a heading that already names the question; omit to render the label here. */
  labelledBy?: string
}

const SCALE = ['1', '2', '3', '4', '5']

/**
 * Renders any tap question as a choice group: select → radios, multiselect →
 * checkboxes with a limit, boolean → Yes/No, range → five agreement options.
 * Stored values are language-independent; only the labels are translated.
 */
export default function QuestionField({ question, value, onChange, error, labelledBy }: QuestionFieldProps) {
  const { t } = useTranslation()
  const naming = labelledBy ? { labelledBy } : { label: t(`questions.${question.id}.label`) }
  const optionLabel = (v: string) => t(`questions.${question.id}.options.${v}`)

  if (question.type === 'multiselect') {
    return (
      <RadioCardGroup
        {...naming}
        multiple
        max={question.maxSelect}
        columns={2}
        error={error}
        options={(question.options ?? []).map(o => ({ value: o.value, label: optionLabel(o.value) }))}
        value={Array.isArray(value) ? value : []}
        onChange={onChange}
      />
    )
  }

  if (question.type === 'boolean') {
    return (
      <RadioCardGroup
        {...naming}
        columns={1}
        error={error}
        options={[{ value: 'yes', label: t('questions.yes') }, { value: 'no', label: t('questions.no') }]}
        value={value === true ? 'yes' : value === false ? 'no' : ''}
        onChange={v => onChange(v === 'yes')}
      />
    )
  }

  if (question.type === 'range') {
    return (
      <RadioCardGroup
        {...naming}
        columns={1}
        error={error}
        options={SCALE.map(n => ({ value: n, label: t(`questions.scale.${n}`) }))}
        value={typeof value === 'number' ? String(value) : ''}
        onChange={v => onChange(Number(v))}
      />
    )
  }

  return (
    <RadioCardGroup
      {...naming}
      columns={1}
      error={error}
      options={(question.options ?? []).map(o => ({ value: o.value, label: optionLabel(o.value) }))}
      value={typeof value === 'string' ? value : ''}
      onChange={onChange}
    />
  )
}
