import type { ColumnDef } from '../lib/columns'
import {
  operatorNeedsValue,
  operatorsForType,
  type Condition,
  type FilterLogic,
  type Operator,
} from '../lib/filterModel'

interface Props {
  columns: ColumnDef[]
  conditions: Condition[]
  logic: FilterLogic
  customExpr: string
  onConditions: (c: Condition[]) => void
  onLogic: (l: FilterLogic) => void
  onCustomExpr: (e: string) => void
  idSeq: () => string
}

/**
 * Salesforce-style report filter builder: numbered conditions
 * (field · operator · value) combined by Match All / Match Any / Custom logic
 * such as "1 AND (2 OR 3)".
 */
export default function FilterPanel({
  columns,
  conditions,
  logic,
  customExpr,
  onConditions,
  onLogic,
  onCustomExpr,
  idSeq,
}: Props) {
  const byId = new Map(columns.map((c) => [c.id, c]))

  function addCondition() {
    const first = columns[0]
    onConditions([
      ...conditions,
      {
        id: idSeq(),
        columnId: first.id,
        operator: operatorsForType(first.type)[0].value,
        value: '',
      },
    ])
  }

  function update(id: string, patch: Partial<Condition>) {
    onConditions(conditions.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }

  function remove(id: string) {
    onConditions(conditions.filter((c) => c.id !== id))
  }

  function changeColumn(id: string, columnId: string) {
    const col = byId.get(columnId)
    if (!col) return
    update(id, {
      columnId,
      operator: operatorsForType(col.type)[0].value,
      value: '',
    })
  }

  return (
    <div className="card filter-panel">
      <div className="page-head">
        <h2>Filters</h2>
      </div>

      {conditions.length === 0 && (
        <p className="muted small">No conditions. Add one to filter the list.</p>
      )}

      {conditions.map((cond, i) => {
        const col = byId.get(cond.columnId)
        const ops = col ? operatorsForType(col.type) : []
        return (
          <div className="filter-row" key={cond.id}>
            <span className="filter-num">{i + 1}</span>
            <select
              value={cond.columnId}
              onChange={(e) => changeColumn(cond.id, e.target.value)}
            >
              {columns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            <select
              value={cond.operator}
              onChange={(e) =>
                update(cond.id, { operator: e.target.value as Operator })
              }
            >
              {ops.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {col && operatorNeedsValue(cond.operator) ? (
              col.type === 'enum' ? (
                <select
                  value={cond.value}
                  onChange={(e) => update(cond.id, { value: e.target.value })}
                >
                  <option value="">—</option>
                  {(col.options ?? []).map((o) => (
                    <option key={o} value={o}>
                      {col.labels?.[o] ?? o}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={
                    col.type === 'number'
                      ? 'number'
                      : col.type === 'date'
                        ? 'date'
                        : 'text'
                  }
                  value={cond.value}
                  placeholder="value"
                  onChange={(e) => update(cond.id, { value: e.target.value })}
                />
              )
            ) : (
              <span />
            )}
            <button
              className="link-btn"
              onClick={() => remove(cond.id)}
              aria-label="Remove condition"
            >
              ✕
            </button>
          </div>
        )
      })}

      <div className="filter-actions">
        <button className="btn" onClick={addCondition}>
          + Add condition
        </button>

        {conditions.length > 1 && (
          <div className="filter-logic">
            <label>
              <input
                type="radio"
                checked={logic === 'all'}
                onChange={() => onLogic('all')}
              />
              Match all (AND)
            </label>
            <label>
              <input
                type="radio"
                checked={logic === 'any'}
                onChange={() => onLogic('any')}
              />
              Match any (OR)
            </label>
            <label>
              <input
                type="radio"
                checked={logic === 'custom'}
                onChange={() => onLogic('custom')}
              />
              Custom
            </label>
            {logic === 'custom' && (
              <input
                className="filter-expr"
                value={customExpr}
                placeholder="e.g. 1 AND (2 OR 3)"
                onChange={(e) => onCustomExpr(e.target.value)}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
