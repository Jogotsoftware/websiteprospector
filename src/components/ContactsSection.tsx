import { useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Contact, Phone } from '../lib/types'

const telHref = (n: string) => `tel:${n.replace(/[^\d+]/g, '')}`

const EMPTY = {
  name: '',
  role: '',
  email: '',
  phone: '',
  notes: '',
}

/**
 * Account contacts. Each contact has a primary phone plus any number of
 * additional labeled numbers (stored in the contacts.phones jsonb array).
 */
export default function ContactsSection({
  businessId,
  contacts,
  onChange,
}: {
  businessId: string
  contacts: Contact[]
  onChange: () => void
}) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [extraPhones, setExtraPhones] = useState<Phone[]>([])
  const [saving, setSaving] = useState(false)

  async function addContact(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name && !form.phone && !form.email) return
    setSaving(true)
    await supabase.from('contacts').insert({
      business_id: businessId,
      name: form.name || null,
      role: form.role || null,
      phone: form.phone || null,
      phones: extraPhones.filter((p) => p.number),
      email: form.email || null,
      notes: form.notes || null,
      source: 'manual',
    })
    setSaving(false)
    setForm(EMPTY)
    setExtraPhones([])
    setOpen(false)
    onChange()
  }

  async function updatePhones(contact: Contact, phones: Phone[]) {
    await supabase.from('contacts').update({ phones }).eq('id', contact.id)
    onChange()
  }

  return (
    <div className="card">
      <div className="page-head">
        <h2>Contacts ({contacts.length})</h2>
        <button className="link-btn" onClick={() => setOpen((o) => !o)}>
          {open ? 'Cancel' : '+ Add contact'}
        </button>
      </div>

      {open && (
        <form className="contact-form" onSubmit={addContact}>
          <input
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            placeholder="Role"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          />
          <input
            placeholder="Primary phone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <input
            placeholder="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <input
            placeholder="Notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />

          {extraPhones.map((p, i) => (
            <div className="phone-row" key={i}>
              <input
                placeholder="Label (e.g. cell)"
                value={p.label}
                onChange={(e) => {
                  const next = [...extraPhones]
                  next[i] = { ...p, label: e.target.value }
                  setExtraPhones(next)
                }}
              />
              <input
                placeholder="Number"
                value={p.number}
                onChange={(e) => {
                  const next = [...extraPhones]
                  next[i] = { ...p, number: e.target.value }
                  setExtraPhones(next)
                }}
              />
              <button
                type="button"
                className="link-btn"
                onClick={() => setExtraPhones(extraPhones.filter((_, j) => j !== i))}
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            className="link-btn"
            onClick={() => setExtraPhones([...extraPhones, { label: '', number: '' }])}
          >
            + Add another number
          </button>

          <button className="btn btn--primary" type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save contact'}
          </button>
        </form>
      )}

      {contacts.length === 0 ? (
        <p className="muted">No contacts yet.</p>
      ) : (
        <ul className="contact-list">
          {contacts.map((c) => (
            <li key={c.id}>
              <div>
                <strong>{c.name ?? '(no name)'}</strong>
                {c.role && <span className="muted"> · {c.role}</span>}
                <span className={`source source--${c.source}`}>{c.source}</span>
              </div>
              <div className="muted small">
                {c.phone && <a href={telHref(c.phone)}>{c.phone}</a>}
                {c.phone && c.email && ' · '}
                {c.email && <a href={`mailto:${c.email}`}>{c.email}</a>}
              </div>

              <PhoneList contact={c} onSave={(phones) => updatePhones(c, phones)} />

              {c.notes && <div className="small">{c.notes}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function PhoneList({
  contact,
  onSave,
}: {
  contact: Contact
  onSave: (phones: Phone[]) => void
}) {
  const [adding, setAdding] = useState(false)
  const [label, setLabel] = useState('')
  const [number, setNumber] = useState('')
  const phones = contact.phones ?? []

  return (
    <div className="phone-list">
      {phones.map((p, i) => (
        <span className="phone-chip" key={i}>
          {p.label && <span className="muted">{p.label}: </span>}
          <a href={telHref(p.number)}>{p.number}</a>
          <button
            className="link-btn"
            onClick={() => onSave(phones.filter((_, j) => j !== i))}
            aria-label="Remove number"
          >
            ✕
          </button>
        </span>
      ))}
      {adding ? (
        <span className="phone-row">
          <input
            placeholder="Label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <input
            placeholder="Number"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
          />
          <button
            className="link-btn"
            onClick={() => {
              if (number.trim()) onSave([...phones, { label, number }])
              setLabel('')
              setNumber('')
              setAdding(false)
            }}
          >
            Save
          </button>
        </span>
      ) : (
        <button className="link-btn small" onClick={() => setAdding(true)}>
          + number
        </button>
      )}
    </div>
  )
}
