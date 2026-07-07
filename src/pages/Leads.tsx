import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Business, CustomFieldDef } from '../lib/types'
import {
  buildColumns,
  compareValues,
  getCellValue,
  DEFAULT_VISIBLE_COLUMN_IDS,
  type ColumnDef,
  type SortDir,
} from '../lib/columns'
import {
  combineResults,
  evaluateCondition,
  operatorNeedsValue,
  type Condition,
  type FilterLogic,
} from '../lib/filterModel'
import { coerceValue, persistCell } from '../lib/leadUpdates'
import EditableCell from '../components/EditableCell'
import AddFieldForm from '../components/AddFieldForm'
import ColumnChooser from '../components/ColumnChooser'
import FilterPanel from '../components/FilterPanel'

const LEAD_QUEUE_KEY = 'leadQueue'
const VISIBLE_COLS_KEY = 'leadVisibleColumns'

interface SortState {
  id: string
  dir: SortDir
}

function applyValue(b: Business, col: ColumnDef, value: unknown): Business {
  if (col.isCustom) {
    return { ...b, custom_fields: { ...b.custom_fields, [col.key]: value } }
  }
  return { ...b, [col.key]: value } as Business
}

function loadVisible(): string[] {
  try {
    const raw = localStorage.getItem(VISIBLE_COLS_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* ignore */
  }
  return DEFAULT_VISIBLE_COLUMN_IDS
}

export default function Leads() {
  const [rows, setRows] = useState<Business[]>([])
  const [defs, setDefs] = useState<CustomFieldDef[]>([])
  const [loading, setLoading] = useState(true)

  const [sort, setSort] = useState<SortState | null>({
    id: 'b:review_count',
    dir: 'desc',
  })
  const [conditions, setConditions] = useState<Condition[]>([])
  const [logic, setLogic] = useState<FilterLogic>('all')
  const [customExpr, setCustomExpr] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [visibleIds, setVisibleIds] = useState<string[]>(loadVisible)

  const [panel, setPanel] = useState<'none' | 'filters' | 'columns' | 'field'>(
    'none',
  )
  const [bulkColId, setBulkColId] = useState('')
  const [bulkRaw, setBulkRaw] = useState('')

  const condSeq = useRef(0)
  const nextCondId = () => `c${condSeq.current++}`

  const columns = useMemo(() => buildColumns(defs), [defs])
  const columnById = useMemo(
    () => new Map(columns.map((c) => [c.id, c])),
    [columns],
  )
  const visibleColumns = useMemo(
    () =>
      visibleIds
        .map((id) => columnById.get(id))
        .filter((c): c is ColumnDef => !!c),
    [visibleIds, columnById],
  )

  useEffect(() => {
    localStorage.setItem(VISIBLE_COLS_KEY, JSON.stringify(visibleIds))
  }, [visibleIds])

  async function reload() {
    setLoading(true)
    const [b, d, s] = await Promise.all([
      supabase
        .from('businesses')
        .select('*')
        .neq('website_tier', 'real_site')
        .order('review_count', { ascending: false }),
      supabase
        .from('custom_field_defs')
        .select('*')
        .order('created_at', { ascending: true }),
      supabase.from('business_activity_stats').select('*'),
    ])
    const stats = new Map(
      (s.data ?? []).map((r: any) => [r.business_id, r]),
    )
    const merged = ((b.data as Business[]) ?? []).map((biz) => {
      const st = stats.get(biz.id)
      return {
        ...biz,
        last_call_at: st?.last_call_at ?? null,
        last_connect_at: st?.last_connect_at ?? null,
        call_count: st?.call_count ?? 0,
      }
    })
    setRows(merged)
    setDefs((d.data as CustomFieldDef[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    reload()
  }, [])

  // Filter + sort entirely client-side so every field (built-in and custom) is
  // sortable and filterable uniformly. Dataset is small (two-person tool).
  const view = useMemo(() => {
    const passes = (b: Business): boolean => {
      if (conditions.length === 0) return true
      const done: boolean[] = []
      const results = conditions.map((c) => {
        const col = columnById.get(c.columnId)
        const incomplete =
          !col || (operatorNeedsValue(c.operator) && c.value.trim() === '')
        done.push(!incomplete)
        if (incomplete || !col) return true
        return evaluateCondition(getCellValue(b, col), col, c.operator, c.value)
      })
      if (logic === 'any') {
        const complete = results.filter((_, i) => done[i])
        return complete.length === 0 || complete.some(Boolean)
      }
      return combineResults(results, logic, customExpr)
    }

    let out = rows.filter(passes)
    if (sort) {
      const col = columnById.get(sort.id)
      if (col) {
        out = [...out].sort((a, b) =>
          compareValues(
            getCellValue(a, col),
            getCellValue(b, col),
            col.type,
            sort.dir,
          ),
        )
      }
    }
    return out
  }, [rows, columnById, conditions, logic, customExpr, sort])

  // Keep the detail view's "Log & Next" queue in sync with what's on screen.
  useEffect(() => {
    sessionStorage.setItem(LEAD_QUEUE_KEY, JSON.stringify(view.map((b) => b.id)))
  }, [view])

  function cycleSort(id: string) {
    setSort((s) => {
      if (!s || s.id !== id) return { id, dir: 'asc' }
      if (s.dir === 'asc') return { id, dir: 'desc' }
      return null
    })
  }

  async function saveCell(b: Business, col: ColumnDef, value: unknown) {
    setRows((prev) =>
      prev.map((r) => (r.id === b.id ? applyValue(r, col, value) : r)),
    )
    const err = await persistCell([b.id], col, value)
    if (err) {
      alert(`Save failed: ${err}`)
      reload()
    }
  }

  const allVisibleSelected =
    view.length > 0 && view.every((b) => selected.has(b.id))

  function toggleAll() {
    setSelected((prev) => {
      if (allVisibleSelected) {
        const next = new Set(prev)
        view.forEach((b) => next.delete(b.id))
        return next
      }
      return new Set([...prev, ...view.map((b) => b.id)])
    })
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const editableColumns = columns.filter((c) => c.editable)
  const bulkCol = columnById.get(bulkColId)

  async function applyBulk() {
    if (!bulkCol || selected.size === 0) return
    let value: unknown
    if (bulkCol.type === 'boolean') value = bulkRaw === 'yes'
    else if (bulkCol.type === 'enum') value = bulkRaw || null
    else value = coerceValue(bulkRaw, bulkCol)

    const ids = [...selected]
    setRows((prev) =>
      prev.map((r) => (selected.has(r.id) ? applyValue(r, bulkCol, value) : r)),
    )
    const err = await persistCell(ids, bulkCol, value)
    if (err) {
      alert(`Bulk update failed: ${err}`)
      reload()
    }
    setBulkRaw('')
  }

  const filterCount = conditions.length

  return (
    <div>
      <div className="page-head">
        <h1>Leads</h1>
        <div className="toolbar">
          <span className="muted">
            {view.length} of {rows.length}
          </span>
          <button
            className={`btn${panel === 'filters' ? ' btn--active' : ''}`}
            onClick={() => setPanel((p) => (p === 'filters' ? 'none' : 'filters'))}
          >
            Filters{filterCount ? ` (${filterCount})` : ''}
          </button>
          <button
            className={`btn${panel === 'columns' ? ' btn--active' : ''}`}
            onClick={() => setPanel((p) => (p === 'columns' ? 'none' : 'columns'))}
          >
            Columns
          </button>
          <button
            className="btn"
            onClick={() => setPanel((p) => (p === 'field' ? 'none' : 'field'))}
          >
            + Field
          </button>
        </div>
      </div>

      {panel === 'field' && (
        <div className="card">
          <AddFieldForm
            onDone={(key) => {
              setPanel('none')
              if (key) setVisibleIds((v) => [...v, `c:${key}`])
              reload()
            }}
          />
        </div>
      )}

      {panel === 'columns' && (
        <ColumnChooser
          columns={columns}
          visibleIds={visibleIds}
          onChange={setVisibleIds}
          onClose={() => setPanel('none')}
        />
      )}

      {panel === 'filters' && (
        <FilterPanel
          columns={columns}
          conditions={conditions}
          logic={logic}
          customExpr={customExpr}
          onConditions={setConditions}
          onLogic={setLogic}
          onCustomExpr={setCustomExpr}
          idSeq={nextCondId}
        />
      )}

      {selected.size > 0 && (
        <div className="bulk-bar card">
          <strong>{selected.size} selected</strong>
          <span>Set</span>
          <select
            value={bulkColId}
            onChange={(e) => {
              setBulkColId(e.target.value)
              setBulkRaw('')
            }}
          >
            <option value="">field…</option>
            {editableColumns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          {bulkCol && (
            <BulkValueInput col={bulkCol} value={bulkRaw} onChange={setBulkRaw} />
          )}
          <button
            className="btn btn--primary"
            onClick={applyBulk}
            disabled={!bulkCol}
          >
            Apply to {selected.size}
          </button>
          <button className="link-btn" onClick={() => setSelected(new Set())}>
            Clear selection
          </button>
        </div>
      )}

      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <div className="grid-scroll">
          <table className="grid">
            <thead>
              <tr>
                <th className="grid__check">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleAll}
                    aria-label="Select all"
                  />
                </th>
                {visibleColumns.map((c) => {
                  const active = sort?.id === c.id
                  return (
                    <th key={c.id}>
                      <button
                        className="grid__sort"
                        onClick={() => cycleSort(c.id)}
                        title="Sort"
                      >
                        {c.label}
                        <span className="grid__arrow">
                          {active ? (sort!.dir === 'asc' ? '▲' : '▼') : '↕'}
                        </span>
                      </button>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {view.map((b) => (
                <tr
                  key={b.id}
                  className={selected.has(b.id) ? 'is-selected' : ''}
                >
                  <td className="grid__check">
                    <input
                      type="checkbox"
                      checked={selected.has(b.id)}
                      onChange={() => toggleOne(b.id)}
                    />
                  </td>
                  {visibleColumns.map((c) => (
                    <td key={c.id}>
                      <EditableCell
                        business={b}
                        col={c}
                        onSave={(v) => saveCell(b, c, v)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
              {view.length === 0 && (
                <tr>
                  <td colSpan={visibleColumns.length + 1} className="muted">
                    No leads match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

function BulkValueInput({
  col,
  value,
  onChange,
}: {
  col: ColumnDef
  value: string
  onChange: (v: string) => void
}) {
  if (col.type === 'boolean') {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="no">No</option>
        <option value="yes">Yes</option>
      </select>
    )
  }
  if (col.type === 'enum') {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">—</option>
        {(col.options ?? []).map((o) => (
          <option key={o} value={o}>
            {col.labels?.[o] ?? o}
          </option>
        ))}
      </select>
    )
  }
  const inputType =
    col.type === 'number' ? 'number' : col.type === 'date' ? 'date' : 'text'
  return (
    <input
      type={inputType}
      value={value}
      placeholder="value"
      onChange={(e) => onChange(e.target.value)}
    />
  )
}
