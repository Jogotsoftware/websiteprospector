import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Contact, Opportunity, OpportunityStage } from '../lib/types'
import { OPPORTUNITY_STAGES, OPPORTUNITY_STAGE_LABELS } from '../lib/constants'

interface OppLink {
  opportunity_id: string
  contact_id: string
  name: string | null
}

/**
 * Opportunities (deals) on an account. Each opportunity has a stage, amount,
 * and close date, and can be related to any of the account's contacts
 * (many-to-many via opportunity_contacts).
 */
export default function OpportunitiesSection({
  businessId,
  contacts,
}: {
  businessId: string
  contacts: Contact[]
}) {
  const [opps, setOpps] = useState<Opportunity[]>([])
  const [links, setLinks] = useState<OppLink[]>([])
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [stage, setStage] = useState<OpportunityStage>('prospecting')
  const [amount, setAmount] = useState('')
  const [closeDate, setCloseDate] = useState('')

  const load = useCallback(async () => {
    const { data: oppRows } = await supabase
      .from('opportunities')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
    const list = (oppRows as Opportunity[]) ?? []
    setOpps(list)
    if (list.length > 0) {
      const { data: linkRows } = await supabase
        .from('opportunity_contacts')
        .select('opportunity_id, contact_id, contacts(name)')
        .in(
          'opportunity_id',
          list.map((o) => o.id),
        )
      setLinks(
        ((linkRows as any[]) ?? []).map((r) => ({
          opportunity_id: r.opportunity_id,
          contact_id: r.contact_id,
          name: r.contacts?.name ?? null,
        })),
      )
    } else {
      setLinks([])
    }
  }, [businessId])

  useEffect(() => {
    load()
  }, [load])

  async function addOpp(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    await supabase.from('opportunities').insert({
      business_id: businessId,
      name: name.trim(),
      stage,
      amount: amount ? Number(amount) : null,
      close_date: closeDate || null,
    })
    setName('')
    setStage('prospecting')
    setAmount('')
    setCloseDate('')
    setOpen(false)
    load()
  }

  async function updateOpp(id: string, patch: Partial<Opportunity>) {
    setOpps((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)))
    await supabase.from('opportunities').update(patch).eq('id', id)
  }

  async function removeOpp(id: string) {
    await supabase.from('opportunities').delete().eq('id', id)
    load()
  }

  async function linkContact(oppId: string, contactId: string) {
    if (!contactId) return
    await supabase
      .from('opportunity_contacts')
      .insert({ opportunity_id: oppId, contact_id: contactId })
    load()
  }

  async function unlinkContact(oppId: string, contactId: string) {
    await supabase
      .from('opportunity_contacts')
      .delete()
      .eq('opportunity_id', oppId)
      .eq('contact_id', contactId)
    load()
  }

  return (
    <div className="card">
      <div className="page-head">
        <h2>Opportunities ({opps.length})</h2>
        <button className="link-btn" onClick={() => setOpen((o) => !o)}>
          {open ? 'Cancel' : '+ Add opportunity'}
        </button>
      </div>

      {open && (
        <form className="opp-form" onSubmit={addOpp}>
          <input
            placeholder="Opportunity name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <select
            value={stage}
            onChange={(e) => setStage(e.target.value as OpportunityStage)}
          >
            {OPPORTUNITY_STAGES.map((s) => (
              <option key={s} value={s}>
                {OPPORTUNITY_STAGE_LABELS[s]}
              </option>
            ))}
          </select>
          <input
            type="number"
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <input
            type="date"
            value={closeDate}
            onChange={(e) => setCloseDate(e.target.value)}
          />
          <button className="btn btn--primary" type="submit">
            Save
          </button>
        </form>
      )}

      {opps.length === 0 ? (
        <p className="muted">No opportunities yet.</p>
      ) : (
        <ul className="opp-list">
          {opps.map((o) => {
            const oppLinks = links.filter((l) => l.opportunity_id === o.id)
            const linkedIds = new Set(oppLinks.map((l) => l.contact_id))
            const available = contacts.filter((c) => !linkedIds.has(c.id))
            return (
              <li key={o.id}>
                <div className="opp-head">
                  <strong>{o.name}</strong>
                  <button
                    className="link-btn"
                    onClick={() => removeOpp(o.id)}
                    aria-label="Delete opportunity"
                  >
                    ✕
                  </button>
                </div>
                <div className="opp-fields">
                  <select
                    value={o.stage}
                    onChange={(e) =>
                      updateOpp(o.id, {
                        stage: e.target.value as OpportunityStage,
                      })
                    }
                  >
                    {OPPORTUNITY_STAGES.map((s) => (
                      <option key={s} value={s}>
                        {OPPORTUNITY_STAGE_LABELS[s]}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    placeholder="Amount"
                    defaultValue={o.amount ?? ''}
                    onBlur={(e) =>
                      updateOpp(o.id, {
                        amount: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                  />
                  <input
                    type="date"
                    defaultValue={o.close_date ?? ''}
                    onBlur={(e) =>
                      updateOpp(o.id, { close_date: e.target.value || null })
                    }
                  />
                </div>

                <div className="opp-contacts">
                  <span className="muted small">Contacts:</span>
                  {oppLinks.length === 0 && <span className="muted small">none</span>}
                  {oppLinks.map((l) => (
                    <span className="chip" key={l.contact_id}>
                      {l.name ?? '(no name)'}
                      <button
                        onClick={() => unlinkContact(o.id, l.contact_id)}
                        aria-label="Unlink"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  {available.length > 0 && (
                    <select
                      value=""
                      onChange={(e) => linkContact(o.id, e.target.value)}
                    >
                      <option value="">+ link contact…</option>
                      {available.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name ?? '(no name)'}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
