import { supabase } from './supabase'
import type { ColumnDef } from './columns'

/**
 * Persist a single value to one or many businesses for a given column.
 * Built-in columns update the row directly; custom columns go through the
 * set_custom_field RPC (jsonb merge). Returns an error message or null.
 */
export async function persistCell(
  ids: string[],
  col: ColumnDef,
  value: unknown,
): Promise<string | null> {
  if (ids.length === 0) return null
  if (col.isCustom) {
    const { error } = await supabase.rpc('set_custom_field', {
      p_ids: ids,
      p_key: col.key,
      p_value: value ?? null,
    })
    return error?.message ?? null
  }
  const { error } = await supabase
    .from('businesses')
    .update({ [col.key]: value })
    .in('id', ids)
  return error?.message ?? null
}

/** Coerce a raw input string into the typed value a column expects. */
export function coerceValue(raw: string, col: ColumnDef): unknown {
  const trimmed = raw.trim()
  if (col.type === 'number') {
    if (trimmed === '') return null
    const n = Number(trimmed)
    return Number.isFinite(n) ? n : null
  }
  if (col.type === 'boolean') return raw === 'true' || raw === 'yes'
  if (trimmed === '') return null
  return trimmed
}
