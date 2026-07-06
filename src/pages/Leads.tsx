import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Business, PipelineStatus, WebsiteTier } from '../lib/types'
import {
  LEAD_TIERS,
  PIPELINE_STATUSES,
  PIPELINE_STATUS_LABELS,
  WEBSITE_TIER_LABELS,
} from '../lib/constants'

const LEAD_QUEUE_KEY = 'leadQueue'

interface Filters {
  status: PipelineStatus | ''
  category: string
  tier: WebsiteTier | ''
  minRating: number
  minReviews: number
}

const DEFAULT_FILTERS: Filters = {
  status: '',
  category: '',
  tier: '',
  minRating: 0,
  minReviews: 0,
}

export default function Leads() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<Business[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [loading, setLoading] = useState(true)

  // Distinct categories for the filter dropdown.
  useEffect(() => {
    supabase
      .from('businesses')
      .select('category')
      .neq('website_tier', 'real_site')
      .then(({ data }) => {
        const set = new Set<string>()
        for (const r of data ?? []) if (r.category) set.add(r.category)
        setCategories([...set].sort())
      })
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    // Only leads (tier != real_site). Default sort: review_count desc.
    let q = supabase
      .from('businesses')
      .select('*')
      .neq('website_tier', 'real_site')
      .order('review_count', { ascending: false })
      .order('rating', { ascending: false, nullsFirst: false })

    if (filters.status) q = q.eq('pipeline_status', filters.status)
    if (filters.category) q = q.eq('category', filters.category)
    if (filters.tier) q = q.eq('website_tier', filters.tier)
    if (filters.minRating > 0) q = q.gte('rating', filters.minRating)
    if (filters.minReviews > 0) q = q.gte('review_count', filters.minReviews)

    q.then(({ data }) => {
      if (cancelled) return
      const list = (data ?? []) as Business[]
      setRows(list)
      // Persist ordered id queue so the detail view's "Log & Next" can advance
      // through exactly this filtered/sorted list.
      sessionStorage.setItem(
        LEAD_QUEUE_KEY,
        JSON.stringify(list.map((b) => b.id)),
      )
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [filters])

  const update = (patch: Partial<Filters>) =>
    setFilters((f) => ({ ...f, ...patch }))

  const resultLabel = useMemo(
    () => `${rows.length} lead${rows.length === 1 ? '' : 's'}`,
    [rows.length],
  )

  return (
    <div>
      <div className="page-head">
        <h1>Leads</h1>
        <span className="muted">{resultLabel}</span>
      </div>

      <div className="filters card">
        <div className="field">
          <label>Status</label>
          <select
            value={filters.status}
            onChange={(e) =>
              update({ status: e.target.value as PipelineStatus | '' })
            }
          >
            <option value="">All</option>
            {PIPELINE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {PIPELINE_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Category</label>
          <select
            value={filters.category}
            onChange={(e) => update({ category: e.target.value })}
          >
            <option value="">All</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Website</label>
          <select
            value={filters.tier}
            onChange={(e) => update({ tier: e.target.value as WebsiteTier | '' })}
          >
            <option value="">All leads</option>
            {LEAD_TIERS.map((t) => (
              <option key={t} value={t}>
                {WEBSITE_TIER_LABELS[t]}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Min rating</label>
          <input
            type="number"
            min={0}
            max={5}
            step={0.5}
            value={filters.minRating || ''}
            onChange={(e) => update({ minRating: Number(e.target.value) || 0 })}
          />
        </div>

        <div className="field field--wide">
          <label>Min reviews: {filters.minReviews}</label>
          <input
            type="range"
            min={0}
            max={500}
            step={5}
            value={filters.minReviews}
            onChange={(e) => update({ minReviews: Number(e.target.value) })}
          />
        </div>

        <button className="link-btn" onClick={() => setFilters(DEFAULT_FILTERS)}>
          Reset
        </button>
      </div>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="muted">No leads match these filters.</p>
      ) : (
        <table className="leads-table">
          <thead>
            <tr>
              <th>Name</th>
              <th className="num">Reviews</th>
              <th className="num">Rating</th>
              <th>Website</th>
              <th>Category</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.id} onClick={() => navigate(`/leads/${b.id}`)}>
                <td>
                  <strong>{b.name}</strong>
                  <div className="muted small">{b.address}</div>
                </td>
                <td className="num">{b.review_count}</td>
                <td className="num">{b.rating ?? '—'}</td>
                <td>
                  <span className={`tier tier--${b.website_tier}`}>
                    {WEBSITE_TIER_LABELS[b.website_tier]}
                  </span>
                </td>
                <td>{b.category ?? '—'}</td>
                <td>
                  <span className={`status status--${b.pipeline_status}`}>
                    {PIPELINE_STATUS_LABELS[b.pipeline_status]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
