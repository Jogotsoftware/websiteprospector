import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Business } from '../lib/types'
import { formatCell, getCellValue, type ColumnDef } from '../lib/columns'
import { coerceValue } from '../lib/leadUpdates'

interface Props {
  business: Business
  col: ColumnDef
  onSave: (value: unknown) => void
}

/**
 * A single grid cell. Read-only columns just render; editable columns turn into
 * the appropriate input on click (text/number/date), toggle immediately
 * (boolean), or open a dropdown (enum/select).
 */
export default function EditableCell({ business, col, onSave }: Props) {
  const value = getCellValue(business, col)
  const [editing, setEditing] = useState(false)

  const display = formatCell(value, col)
  const linked = col.link ? (
    <Link to={`/leads/${business.id}`} onClick={(e) => e.stopPropagation()}>
      {display}
    </Link>
  ) : (
    display
  )

  if (!col.editable) {
    return <span className={col.type === 'number' ? 'num' : ''}>{linked}</span>
  }

  // Boolean toggles inline without an edit mode.
  if (col.type === 'boolean') {
    return (
      <input
        type="checkbox"
        checked={!!value}
        onChange={(e) => onSave(e.target.checked)}
        onClick={(e) => e.stopPropagation()}
      />
    )
  }

  // Enum / select dropdowns edit in place.
  if (col.type === 'enum') {
    return (
      <select
        className="cell-select"
        value={value == null ? '' : String(value)}
        onChange={(e) => onSave(e.target.value || null)}
        onClick={(e) => e.stopPropagation()}
      >
        <option value="">—</option>
        {(col.options ?? []).map((o) => (
          <option key={o} value={o}>
            {col.labels?.[o] ?? o}
          </option>
        ))}
      </select>
    )
  }

  if (!editing) {
    return (
      <span
        className={`cell-editable${col.type === 'number' ? ' num' : ''}`}
        onClick={(e) => {
          e.stopPropagation()
          if (!col.link) setEditing(true)
        }}
        title={col.link ? undefined : 'Click to edit'}
      >
        {col.link ? (
          <>
            {linked}
            <button
              className="cell-edit-btn"
              onClick={(e) => {
                e.stopPropagation()
                setEditing(true)
              }}
              aria-label="Edit"
            >
              ✎
            </button>
          </>
        ) : (
          linked
        )}
      </span>
    )
  }

  const inputType =
    col.type === 'number' ? 'number' : col.type === 'date' ? 'date' : 'text'

  return (
    <input
      className="cell-input"
      type={inputType}
      autoFocus
      defaultValue={value == null ? '' : String(value)}
      onClick={(e) => e.stopPropagation()}
      onBlur={(e) => {
        onSave(coerceValue(e.target.value, col))
        setEditing(false)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          onSave(coerceValue((e.target as HTMLInputElement).value, col))
          setEditing(false)
        } else if (e.key === 'Escape') {
          setEditing(false)
        }
      }}
    />
  )
}
