import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type {
  Activity,
  ActivityOutcome,
  Business,
  Contact,
  PipelineStatus,
} from '../lib/types'
import {
  OUTCOME_LABELS,
  OUTCOME_OPTIONS,
  PIPELINE_STATUSES,
  PIPELINE_STATUS_LABELS,
  WEBSITE_TIER_LABELS,
} from '../lib/constants'

const LEAD_QUEUE_KEY = 'leadQueue'

function isEditableTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'SELECT' || el.isContentEditable
}

export default function LeadDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { email } = useAuth()

  const [business, setBusiness] = useState<Business | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)

  const [outcome, setOutcome] = useState<ActivityOutcome>('no_answer')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const callRef = useRef<HTMLAnchorElement>(null)
  const notesRef = useRef<HTMLTextAreaElement>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    const [b, c, a] = await Promise.all([
      supabase.from('businesses').select('*').eq('id', id).maybeSingle(),
      supabase
        .from('contacts')
        .select('*')
        .eq('business_id', id)
        .order('created_at', { ascending: true }),
      supabase
        .from('activities')
        .select('*')
        .eq('business_id', id)
        .order('created_at', { ascending: false }),
    ])
    setBusiness((b.data as Business) ?? null)
    setContacts((c.data as Contact[]) ?? [])
    setActivities((a.data as Activity[]) ?? [])
    setOutcome('no_answer')
    setNotes('')
    setLoading(false)
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const goToNext = useCallback(() => {
    let queue: string[] = []
    try {
      queue = JSON.parse(sessionStorage.getItem(LEAD_QUEUE_KEY) ?? '[]')
    } catch {
      queue = []
    }
    const idx = queue.indexOf(id ?? '')
    const next = idx >= 0 ? queue[idx + 1] : undefined
    if (next) navigate(`/leads/${next}`)
    else navigate('/')
  }, [id, navigate])

  const logAndNext = useCallback(async () => {
    if (!id || !email || saving) return
    setSaving(true)
    await supabase.from('activities').insert({
      business_id: id,
      logged_by: email,
      outcome,
      notes: notes.trim() || null,
    })
    // Reduce clicks: first logged activity moves a "new" lead to "contacted".
    if (business?.pipeline_status === 'new') {
      await supabase
        .from('businesses')
        .update({ pipeline_status: 'contacted' })
        .eq('id', id)
    }
    setSaving(false)
    goToNext()
  }, [id, email, saving, outcome, notes, business?.pipeline_status, goToNext])

  const triggerCall = useCallback(() => {
    callRef.current?.click()
  }, [])

  // Keyboard shortcuts: c = call, 1-7 = outcome, Enter = log & next.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Enter (without Shift) always submits, even from the notes textarea.
      if (e.key === 'Enter' && !e.shiftKey) {
        const inNotes = e.target === notesRef.current
        const inField = isEditableTarget(e.target)
        if (!inField || inNotes) {
          e.preventDefault()
          logAndNext()
        }
        return
      }
      // Other shortcuts are ignored while typing in a field.
      if (isEditableTarget(e.target) || e.target === notesRef.current) return
      if (e.key.toLowerCase() === 'c') {
        e.preventDefault()
        triggerCall()
        return
      }
      const opt = OUTCOME_OPTIONS.find((o) => o.key === e.key)
      if (opt) {
        e.preventDefault()
        setOutcome(opt.value)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [logAndNext, triggerCall])

  if (loading) return <p className="muted">Loading…</p>
  if (!business) return <p className="muted">Lead not found.</p>

  return (
    <div className="detail">
      <button className="link-btn" onClick={() => navigate('/')}>
        ← Back to leads
      </button>

      <div className="detail__grid">
        {/* ---- Left: business info + call/log flow ---- */}
        <div>
          <div className="card">
            <div className="page-head">
              <h1>{business.name}</h1>
              <span className={`tier tier--${business.website_tier}`}>
                {WEBSITE_TIER_LABELS[business.website_tier]}
              </span>
            </div>
            <dl className="info">
              <dt>Address</dt>
              <dd>{business.address ?? '—'}</dd>
              <dt>Phone</dt>
              <dd>{business.phone ?? '—'}</dd>
              <dt>Category</dt>
              <dd>{business.category ?? '—'}</dd>
              <dt>Rating</dt>
              <dd>
                {business.rating ?? '—'} ({business.review_count} reviews)
              </dd>
              <dt>Website</dt>
              <dd>
                {business.website_uri ? (
                  <a href={business.website_uri} target="_blank" rel="noreferrer">
                    {business.website_uri}
                  </a>
                ) : (
                  '—'
                )}
              </dd>
              <dt>Maps</dt>
              <dd>
                {business.google_maps_uri ? (
                  <a
                    href={business.google_maps_uri}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open in Google Maps
                  </a>
                ) : (
                  '—'
                )}
              </dd>
            </dl>

            {business.phone ? (
              <a
                ref={callRef}
                className="btn btn--call"
                href={`tel:${business.phone.replace(/[^\d+]/g, '')}`}
              >
                📞 Call ({business.phone})
              </a>
            ) : (
              <p className="muted">No phone number on file.</p>
            )}
          </div>

          {/* ---- Log & Next ---- */}
          <div className="card">
            <h2>Log call</h2>
            <div className="field">
              <label>Outcome</label>
              <select
                value={outcome}
                onChange={(e) => setOutcome(e.target.value as ActivityOutcome)}
              >
                {OUTCOME_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label} ({o.key})
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Notes</label>
              <textarea
                ref={notesRef}
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes… (Enter to log & next, Shift+Enter for newline)"
              />
            </div>
            <button
              className="btn btn--primary"
              onClick={logAndNext}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Log & Next →'}
            </button>

            <div className="legend">
              <strong>Shortcuts:</strong> <kbd>C</kbd> call · <kbd>Enter</kbd>{' '}
              log &amp; next ·{' '}
              {OUTCOME_OPTIONS.map((o) => (
                <span key={o.value}>
                  <kbd>{o.key}</kbd> {o.label}{' '}
                </span>
              ))}
            </div>
          </div>

          <PipelineControl business={business} onChange={load} />
        </div>

        {/* ---- Right: contacts + activity history ---- */}
        <div>
          <ContactsSection
            businessId={business.id}
            contacts={contacts}
            onChange={load}
          />

          <div className="card">
            <h2>Activity history</h2>
            {activities.length === 0 ? (
              <p className="muted">No activity yet.</p>
            ) : (
              <ul className="activity-log">
                {activities.map((a) => (
                  <li key={a.id}>
                    <div className="activity-log__head">
                      <span className={`outcome outcome--${a.outcome}`}>
                        {OUTCOME_LABELS[a.outcome]}
                      </span>
                      <span className="muted small">
                        {new Date(a.created_at).toLocaleString()} · {a.logged_by}
                      </span>
                    </div>
                    {a.notes && <p>{a.notes}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

function PipelineControl({
  business,
  onChange,
}: {
  business: Business
  onChange: () => void
}) {
  const [status, setStatus] = useState<PipelineStatus>(business.pipeline_status)
  const [reason, setReason] = useState(business.disqualify_reason ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setStatus(business.pipeline_status)
    setReason(business.disqualify_reason ?? '')
  }, [business.pipeline_status, business.disqualify_reason])

  const needsReason = status === 'disqualified'
  const dirty =
    status !== business.pipeline_status ||
    (needsReason && reason !== (business.disqualify_reason ?? ''))

  async function save() {
    if (needsReason && !reason.trim()) return
    setSaving(true)
    await supabase
      .from('businesses')
      .update({
        pipeline_status: status,
        disqualify_reason: needsReason ? reason.trim() : null,
      })
      .eq('id', business.id)
    setSaving(false)
    onChange()
  }

  return (
    <div className="card">
      <h2>Pipeline status</h2>
      <div className="field">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as PipelineStatus)}
        >
          {PIPELINE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {PIPELINE_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>
      {needsReason && (
        <div className="field">
          <label>Disqualify reason (required)</label>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why disqualified?"
          />
        </div>
      )}
      <button
        className="btn"
        onClick={save}
        disabled={saving || !dirty || (needsReason && !reason.trim())}
      >
        {saving ? 'Saving…' : 'Update status'}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------

const EMPTY_CONTACT = { name: '', role: '', phone: '', email: '', notes: '' }

function ContactsSection({
  businessId,
  contacts,
  onChange,
}: {
  businessId: string
  contacts: Contact[]
  onChange: () => void
}) {
  const [form, setForm] = useState(EMPTY_CONTACT)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name && !form.phone && !form.email) return
    setSaving(true)
    await supabase.from('contacts').insert({
      business_id: businessId,
      name: form.name || null,
      role: form.role || null,
      phone: form.phone || null,
      email: form.email || null,
      notes: form.notes || null,
      source: 'manual',
    })
    setSaving(false)
    setForm(EMPTY_CONTACT)
    setOpen(false)
    onChange()
  }

  return (
    <div className="card">
      <div className="page-head">
        <h2>Contacts</h2>
        <button className="link-btn" onClick={() => setOpen((o) => !o)}>
          {open ? 'Cancel' : '+ Add contact'}
        </button>
      </div>

      {open && (
        <form className="contact-form" onSubmit={add}>
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
            placeholder="Phone"
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
          <button className="btn" type="submit" disabled={saving}>
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
                {c.phone && (
                  <a href={`tel:${c.phone.replace(/[^\d+]/g, '')}`}>{c.phone}</a>
                )}
                {c.phone && c.email && ' · '}
                {c.email && <a href={`mailto:${c.email}`}>{c.email}</a>}
              </div>
              {c.notes && <div className="small">{c.notes}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
