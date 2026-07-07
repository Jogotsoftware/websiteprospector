import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { DEFAULT_CATEGORIES } from '../lib/constants'

const MILES_TO_METERS = 1609.34
const MAX_PAGES = 3 // Google Text Search returns up to 3 pages of 20
const PAGE_DELAY_MS = 2500 // Google requires a short delay before a page token is valid

interface RunSummary {
  newLeads: number
  newRealSites: number
  skipped: number
  textSearchCalls: number
  detailsCalls: number
}

interface PageResponse extends RunSummary {
  nextPageToken: string | null
  center: { latitude: number; longitude: number } | null
  limitReached: boolean
  message: string | null
  error?: string
}

const ZERO: RunSummary = {
  newLeads: 0,
  newRealSites: 0,
  skipped: 0,
  textSearchCalls: 0,
  detailsCalls: 0,
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export default function Search() {
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [radiusMiles, setRadiusMiles] = useState(15)
  const [minReviews, setMinReviews] = useState(0)
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES)
  const [newCategory, setNewCategory] = useState('')

  const [running, setRunning] = useState(false)
  const [log, setLog] = useState<string[]>([])
  const [summary, setSummary] = useState<RunSummary>(ZERO)
  const [limitHit, setLimitHit] = useState(false)
  const [done, setDone] = useState(false)

  const addLine = (line: string) => setLog((l) => [...l, line])

  function addCategory() {
    const c = newCategory.trim()
    if (c && !categories.includes(c)) setCategories([...categories, c])
    setNewCategory('')
  }

  function removeCategory(c: string) {
    setCategories(categories.filter((x) => x !== c))
  }

  async function callPage(body: Record<string, unknown>): Promise<PageResponse> {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const res = await fetch('/.netlify/functions/search-page', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token ?? ''}`,
      },
      body: JSON.stringify(body),
    })
    return (await res.json()) as PageResponse
  }

  async function run() {
    if (!city || !state || categories.length === 0) return
    setRunning(true)
    setDone(false)
    setLimitHit(false)
    setLog([])
    setSummary(ZERO)
    const totals: RunSummary = { ...ZERO }
    const radiusMeters = Math.round(radiusMiles * MILES_TO_METERS)

    outer: for (const category of categories) {
      addLine(`▶ ${category}…`)
      let pageToken: string | null = null
      let center: PageResponse['center'] = null

      for (let page = 0; page < MAX_PAGES; page++) {
        const resp = await callPage({
          city,
          state,
          radiusMeters,
          category,
          pageToken,
          center,
          minReviews,
        })

        if (resp.error) {
          addLine(`  ⚠ ${category}: ${resp.error}`)
          break
        }

        totals.newLeads += resp.newLeads
        totals.newRealSites += resp.newRealSites
        totals.skipped += resp.skipped
        totals.textSearchCalls += resp.textSearchCalls
        totals.detailsCalls += resp.detailsCalls
        setSummary({ ...totals })
        center = resp.center

        addLine(
          `  ${category} p${page + 1}: +${resp.newLeads} leads, ` +
            `${resp.skipped} skipped, ${resp.detailsCalls} details calls`,
        )

        if (resp.limitReached) {
          setLimitHit(true)
          addLine(`  ⛔ ${resp.message ?? 'API limit reached'}`)
          break outer
        }

        pageToken = resp.nextPageToken
        if (!pageToken) break
        await sleep(PAGE_DELAY_MS) // let the next_page_token become valid
      }
    }

    addLine('✔ Done.')
    setDone(true)
    setRunning(false)
  }

  return (
    <div>
      <div className="page-head">
        <h1>Run New Search</h1>
      </div>

      <div className="card">
        <div className="search-grid">
          <div className="field">
            <label>City</label>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Ann Arbor"
              disabled={running}
            />
          </div>
          <div className="field">
            <label>State</label>
            <input
              value={state}
              onChange={(e) => setState(e.target.value)}
              placeholder="e.g. MI"
              disabled={running}
            />
          </div>
          <div className="field">
            <label>Radius: {radiusMiles} mi</label>
            <input
              type="range"
              min={1}
              max={30}
              value={radiusMiles}
              onChange={(e) => setRadiusMiles(Number(e.target.value))}
              disabled={running}
            />
          </div>
          <div className="field">
            <label>Min reviews (optional)</label>
            <input
              type="number"
              min={0}
              value={minReviews || ''}
              onChange={(e) => setMinReviews(Number(e.target.value) || 0)}
              disabled={running}
            />
          </div>
        </div>

        <div className="field">
          <label>Categories</label>
          <div className="chips">
            {categories.map((c) => (
              <span className="chip" key={c}>
                {c}
                <button
                  type="button"
                  onClick={() => removeCategory(c)}
                  disabled={running}
                  aria-label={`Remove ${c}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="chip-add">
            <input
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addCategory()
                }
              }}
              placeholder="Add a category…"
              disabled={running}
            />
            <button
              type="button"
              className="btn"
              onClick={addCategory}
              disabled={running || !newCategory.trim()}
            >
              Add
            </button>
          </div>
        </div>

        <button
          className="btn btn--primary"
          onClick={run}
          disabled={running || !city || !state || categories.length === 0}
        >
          {running ? 'Searching…' : 'Run Search'}
        </button>
      </div>

      {(running || done) && (
        <div className="card">
          <h2>Progress</h2>
          {limitHit && (
            <p className="error">
              Monthly API limit reached — resets next month.
            </p>
          )}
          <div className="summary">
            <div>
              <strong>{summary.newLeads}</strong> new leads
            </div>
            <div>
              <strong>{summary.skipped}</strong> already existed
            </div>
            <div>
              <strong>{summary.newRealSites}</strong> real sites (not leads)
            </div>
            <div>
              <strong>{summary.textSearchCalls + summary.detailsCalls}</strong>{' '}
              API calls used
            </div>
          </div>
          <pre className="run-log">{log.join('\n')}</pre>
        </div>
      )}
    </div>
  )
}
