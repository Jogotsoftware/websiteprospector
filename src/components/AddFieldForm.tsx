import { useState } from 'react'
import { supabase } from '../lib/supabase'
import type { CustomFieldType } from '../lib/types'

const TYPES: { value: CustomFieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Yes / No' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Select (choices)' },
]

function slugify(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export default function AddFieldForm({
  onDone,
}: {
  onDone: (newKey?: string) => void
}) {
  const [label, setLabel] = useState('')
  const [type, setType] = useState<CustomFieldType>('text')
  const [optionsText, setOptionsText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const key = slugify(label)
    if (!key) {
      setError('Enter a field name.')
      return
    }
    setSaving(true)
    setError(null)
    const options =
      type === 'select'
        ? optionsText
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : []
    const { error } = await supabase
      .from('custom_field_defs')
      .insert({ key, label: label.trim(), type, options })
    setSaving(false)
    if (error) {
      setError(
        error.code === '23505'
          ? 'A field with that name already exists.'
          : error.message,
      )
      return
    }
    onDone(key)
  }

  return (
    <form className="add-field" onSubmit={submit}>
      <div className="field">
        <label>Field name</label>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Owner name"
          autoFocus
        />
      </div>
      <div className="field">
        <label>Type</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as CustomFieldType)}
        >
          {TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      {type === 'select' && (
        <div className="field">
          <label>Choices (comma-separated)</label>
          <input
            value={optionsText}
            onChange={(e) => setOptionsText(e.target.value)}
            placeholder="Hot, Warm, Cold"
          />
        </div>
      )}
      {error && <p className="error">{error}</p>}
      <div className="add-field__actions">
        <button className="btn btn--primary" type="submit" disabled={saving}>
          {saving ? 'Adding…' : 'Add field'}
        </button>
        <button className="link-btn" type="button" onClick={() => onDone()}>
          Cancel
        </button>
      </div>
    </form>
  )
}
