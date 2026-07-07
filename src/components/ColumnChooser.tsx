import type { ColumnDef } from '../lib/columns'

interface Props {
  columns: ColumnDef[]
  visibleIds: string[]
  onChange: (ids: string[]) => void
  onClose: () => void
}

/**
 * Choose which columns show on the leads grid and in what order.
 * Visible columns (in order) come first with up/down controls; hidden columns
 * follow. Toggling a checkbox moves a column between the two groups.
 */
export default function ColumnChooser({
  columns,
  visibleIds,
  onChange,
  onClose,
}: Props) {
  const byId = new Map(columns.map((c) => [c.id, c]))
  const visible = visibleIds
    .map((id) => byId.get(id))
    .filter((c): c is ColumnDef => !!c)
  const hidden = columns.filter((c) => !visibleIds.includes(c.id))

  function toggle(id: string) {
    if (visibleIds.includes(id)) onChange(visibleIds.filter((x) => x !== id))
    else onChange([...visibleIds, id])
  }

  function move(id: string, dir: -1 | 1) {
    const idx = visibleIds.indexOf(id)
    const target = idx + dir
    if (target < 0 || target >= visibleIds.length) return
    const next = [...visibleIds]
    ;[next[idx], next[target]] = [next[target], next[idx]]
    onChange(next)
  }

  return (
    <div className="card column-chooser">
      <div className="page-head">
        <h2>Columns</h2>
        <button className="link-btn" onClick={onClose}>
          Done
        </button>
      </div>

      <div className="chooser-group">
        <span className="muted small">Shown (drag order with ▲▼)</span>
        {visible.map((c, i) => (
          <div className="chooser-row" key={c.id}>
            <label>
              <input
                type="checkbox"
                checked
                onChange={() => toggle(c.id)}
              />
              {c.label}
            </label>
            <span className="chooser-move">
              <button
                className="link-btn"
                disabled={i === 0}
                onClick={() => move(c.id, -1)}
                aria-label="Move up"
              >
                ▲
              </button>
              <button
                className="link-btn"
                disabled={i === visible.length - 1}
                onClick={() => move(c.id, 1)}
                aria-label="Move down"
              >
                ▼
              </button>
            </span>
          </div>
        ))}
      </div>

      {hidden.length > 0 && (
        <div className="chooser-group">
          <span className="muted small">Hidden</span>
          {hidden.map((c) => (
            <div className="chooser-row" key={c.id}>
              <label>
                <input
                  type="checkbox"
                  checked={false}
                  onChange={() => toggle(c.id)}
                />
                {c.label}
              </label>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
