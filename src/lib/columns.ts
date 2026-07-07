import type { Business, CustomFieldDef } from './types'
import {
  LEAD_TIERS,
  PIPELINE_STATUSES,
  PIPELINE_STATUS_LABELS,
  WEBSITE_TIER_LABELS,
} from './constants'

export type ColType = 'text' | 'number' | 'enum' | 'boolean' | 'date'

export interface ColumnDef {
  id: string // stable identity for state/React keys (namespaced: b:* / c:*)
  key: string // built-in: business field name; custom: the custom_fields key
  label: string
  type: ColType
  editable: boolean
  isCustom: boolean
  link?: boolean // render as a link to the detail view (the name column)
  options?: string[] // enum values
  labels?: Record<string, string> // optional display labels for enum values
}

// Built-in columns. Google-derived fields are sortable/filterable but not
// editable; the fields we own are editable inline.
const BUILTIN_COLUMNS: Omit<ColumnDef, 'id'>[] = [
  { key: 'name', label: 'Name', type: 'text', editable: true, isCustom: false, link: true },
  { key: 'review_count', label: 'Reviews', type: 'number', editable: false, isCustom: false },
  { key: 'rating', label: 'Rating', type: 'number', editable: false, isCustom: false },
  {
    key: 'website_tier',
    label: 'Website',
    type: 'enum',
    editable: false,
    isCustom: false,
    options: LEAD_TIERS,
    labels: WEBSITE_TIER_LABELS,
  },
  { key: 'category', label: 'Category', type: 'text', editable: true, isCustom: false },
  {
    key: 'pipeline_status',
    label: 'Status',
    type: 'enum',
    editable: true,
    isCustom: false,
    options: PIPELINE_STATUSES,
    labels: PIPELINE_STATUS_LABELS,
  },
  { key: 'phone', label: 'Phone', type: 'text', editable: true, isCustom: false },
  { key: 'address', label: 'Address', type: 'text', editable: false, isCustom: false },
  {
    key: 'disqualify_reason',
    label: 'Disqualify reason',
    type: 'text',
    editable: true,
    isCustom: false,
  },
  { key: 'created_at', label: 'Added', type: 'date', editable: false, isCustom: false },
  { key: 'last_call_at', label: 'Last call', type: 'date', editable: false, isCustom: false },
  {
    key: 'last_connect_at',
    label: 'Last connect',
    type: 'date',
    editable: false,
    isCustom: false,
  },
  { key: 'call_count', label: 'Calls', type: 'number', editable: false, isCustom: false },
]

// Columns shown by default (in this order) until the user customizes.
export const DEFAULT_VISIBLE_COLUMN_IDS = [
  'b:name',
  'b:review_count',
  'b:rating',
  'b:website_tier',
  'b:category',
  'b:pipeline_status',
  'b:phone',
  'b:last_call_at',
  'b:last_connect_at',
  'b:call_count',
  'b:created_at',
]

const CUSTOM_TYPE_MAP: Record<CustomFieldDef['type'], ColType> = {
  text: 'text',
  number: 'number',
  boolean: 'boolean',
  date: 'date',
  select: 'enum',
}

export function buildColumns(defs: CustomFieldDef[]): ColumnDef[] {
  const builtin: ColumnDef[] = BUILTIN_COLUMNS.map((c) => ({
    ...c,
    id: `b:${c.key}`,
  }))
  const custom: ColumnDef[] = defs.map((d) => ({
    id: `c:${d.key}`,
    key: d.key,
    label: d.label,
    type: CUSTOM_TYPE_MAP[d.type],
    editable: true,
    isCustom: true,
    options: d.type === 'select' ? d.options : undefined,
  }))
  return [...builtin, ...custom]
}

export function getCellValue(b: Business, col: ColumnDef): unknown {
  if (col.isCustom) return b.custom_fields?.[col.key] ?? null
  return (b as unknown as Record<string, unknown>)[col.key] ?? null
}

export function formatCell(value: unknown, col: ColumnDef): string {
  if (value === null || value === undefined || value === '') return '—'
  if (col.type === 'enum' && col.labels) {
    return col.labels[String(value)] ?? String(value)
  }
  if (col.type === 'boolean') return value ? 'Yes' : 'No'
  if (col.type === 'date') {
    const d = new Date(String(value))
    return isNaN(d.getTime()) ? String(value) : d.toLocaleDateString()
  }
  return String(value)
}

// ---- sorting ----------------------------------------------------------------

export type SortDir = 'asc' | 'desc'

export function compareValues(
  a: unknown,
  b: unknown,
  type: ColType,
  dir: SortDir,
): number {
  const factor = dir === 'asc' ? 1 : -1
  const aNull = a === null || a === undefined || a === ''
  const bNull = b === null || b === undefined || b === ''
  if (aNull && bNull) return 0
  if (aNull) return 1 // nulls always sort last, regardless of direction
  if (bNull) return -1

  let cmp: number
  if (type === 'number') {
    cmp = Number(a) - Number(b)
  } else if (type === 'boolean') {
    cmp = (a ? 1 : 0) - (b ? 1 : 0)
  } else if (type === 'date') {
    cmp = new Date(String(a)).getTime() - new Date(String(b)).getTime()
  } else {
    cmp = String(a).localeCompare(String(b), undefined, { sensitivity: 'base' })
  }
  return cmp * factor
}
