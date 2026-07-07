import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type {
  Activity,
  ActivityOutcome,
  Business,
  Contact,
  EventType,
  PipelineStatus,
} from '../lib/types'
import {
  EVENT_TYPES,
  EVENT_TYPE_LABELS,
  OUTCOME_LABELS,
  OUTCOME_OPTIONS,
  PIPELINE_STATUSES,
  PIPELINE_STATUS_LABELS,
  WEBSITE_TIER_LABELS,
} from '../lib/constants'
import ContactsSection from '../components/ContactsSection'
import OpportunitiesSection from '../components/OpportunitiesSection'

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

  const [eventType, setEventType] = useState<EventType>('call')
  const [outcome, setOutcome] = useState<ActivityOutcome | ''>('')
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
    setEventType('call')
    setOutcome('')
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

  // A call event REQUIRES a disposition; meeting/demo events do not.
  const canLog = eventType !== 'call' || outcome !== ''

  const logAndNext = useCallback(async () => {
    if (!id || !email || saving || !canLog) return
    setSaving(true)
    await supabase.from('activities').insert({
      business_id: id,
      logged_by: email,
      event_type: eventType,
      outcome: eventType === 'call' ? (outcome as ActivityOutcome) : null,
      notes: notes.trim() || null,
    })
    // First logged event moves a "new" account to "contacted".
    if (business?.pipeline_status === 'new') {
      await supabase
        .from('businesses')
        .update({ pipeline_status: 'contacted' })
        .eq('id', id)
    }
    setSaving(false)
    goToNext()
  }, [id, email, saving, canLog, eventType, outcome, notes, business?.pipeline_status, goToNext])

  const triggerCall = useCallback(() => {
    callRef.current?.click()
  }, [])

  // Keyboard: c = call, 1-6 = disposition, Enter = log & next.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Enter' && !e.shiftKey) {
        const inNotes = e.target === notesRef.current
        const inField = isEditableTarget(e.target)
        if (!inField || inNotes) {
          e.preventDefault()
          logAndNext()
        }
        return
      }
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
  if (!business) return <p className="muted">Account not found.</p>

  return (
    <div className="detail">
      <button className="link-btn" onClick={() => navigate('/')}>
        ← Back to leads
      </button>

      <div className="detail__grid">
        {/* ---- Left: account info + event log ---- */}
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

          {/* ---- Log event ---- */}
          <div className="card">
            <h2>Log event</h2>
            <div className="field">
              <label>Event type</label>
              <div className="event-types">
                {EVENT_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    className={`btn${eventType === t.value ? ' btn--active' : ''}`}
                    onClick={() => setEventType(t.value)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {eventType === 'call' && (
              <div className="field">
                <label>Disposition (required)</label>
                <select
                  value={outcome}
                  onChange={(e) =>
                    setOutcome(e.target.value as ActivityOutcome | '')
                  }
                >
                  <option value="">— choose disposition —</option>
                  {OUTCOME_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label} ({o.key})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="field">
              <label>Notes (optional)</label>
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
              disabled={saving || !canLog}
            >
              {saving ? 'Saving…' : 'Log & Next →'}
            </button>
            {eventType === 'call' && !canLog && (
              <p className="muted small">Pick a disposition to log this call.</p>
            )}

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

        {/* ---- Right: contacts, opportunities, event history ---- */}
        <div>
          <ContactsSection
            businessId={business.id}
            contacts={contacts}
            onChange={load}
          />

          <OpportunitiesSection businessId={business.id} contacts={contacts} />

          <div className="card">
            <h2>Activity history</h2>
            {activities.length === 0 ? (
              <p className="muted">No activity yet.</p>
            ) : (
              <ul className="activity-log">
                {activities.map((a) => (
                  <li key={a.id}>
                    <div className="activity-log__head">
                      <span>
                        <span className={`event event--${a.event_type}`}>
                          {EVENT_TYPE_LABELS[a.event_type]}
                        </span>
                        {a.outcome && (
                          <span className={`outcome outcome--${a.outcome}`}>
                            {OUTCOME_LABELS[a.outcome]}
                          </span>
                        )}
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
