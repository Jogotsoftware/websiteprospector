import type { ColType, ColumnDef } from './columns'

export type Operator =
  | 'contains'
  | 'not_contains'
  | 'eq'
  | 'neq'
  | 'gt'
  | 'lt'
  | 'gte'
  | 'lte'
  | 'on'
  | 'before'
  | 'after'
  | 'empty'
  | 'not_empty'
  | 'is_true'
  | 'is_false'

export interface Condition {
  id: string // stable key for React
  columnId: string
  operator: Operator
  value: string
}

export type FilterLogic = 'all' | 'any' | 'custom'

const LABELS: Record<Operator, string> = {
  contains: 'contains',
  not_contains: 'does not contain',
  eq: 'equals',
  neq: 'not equal to',
  gt: 'greater than',
  lt: 'less than',
  gte: 'greater or equal',
  lte: 'less or equal',
  on: 'on',
  before: 'before',
  after: 'after',
  empty: 'is empty',
  not_empty: 'is not empty',
  is_true: 'is yes',
  is_false: 'is no',
}

const BY_TYPE: Record<ColType, Operator[]> = {
  text: ['contains', 'not_contains', 'eq', 'neq', 'empty', 'not_empty'],
  number: ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'empty', 'not_empty'],
  date: ['on', 'before', 'after', 'empty', 'not_empty'],
  enum: ['eq', 'neq', 'empty', 'not_empty'],
  boolean: ['is_true', 'is_false'],
}

export function operatorsForType(
  type: ColType,
): { value: Operator; label: string }[] {
  return BY_TYPE[type].map((op) => ({ value: op, label: LABELS[op] }))
}

/** Whether an operator needs a value input (empty/not_empty/boolean don't). */
export function operatorNeedsValue(op: Operator): boolean {
  return !['empty', 'not_empty', 'is_true', 'is_false'].includes(op)
}

const isBlank = (v: unknown) => v === null || v === undefined || v === ''

export function evaluateCondition(
  cell: unknown,
  col: ColumnDef,
  op: Operator,
  value: string,
): boolean {
  if (op === 'empty') return isBlank(cell)
  if (op === 'not_empty') return !isBlank(cell)
  if (op === 'is_true') return !!cell
  if (op === 'is_false') return !cell

  if (col.type === 'number') {
    if (isBlank(cell) || value === '') return false
    const a = Number(cell)
    const b = Number(value)
    switch (op) {
      case 'eq':
        return a === b
      case 'neq':
        return a !== b
      case 'gt':
        return a > b
      case 'lt':
        return a < b
      case 'gte':
        return a >= b
      case 'lte':
        return a <= b
    }
  }

  if (col.type === 'date') {
    if (isBlank(cell) || value === '') return false
    const a = new Date(String(cell)).getTime()
    const b = new Date(value).getTime()
    const dayA = new Date(String(cell)).toISOString().slice(0, 10)
    switch (op) {
      case 'on':
        return dayA === value
      case 'before':
        return a < b
      case 'after':
        return a > b
    }
  }

  // text / enum
  const s = String(cell ?? '').toLowerCase()
  const v = value.toLowerCase()
  switch (op) {
    case 'contains':
      return s.includes(v)
    case 'not_contains':
      return !s.includes(v)
    case 'eq':
      return s === v
    case 'neq':
      return s !== v
  }
  return true
}

// ---- combine results per logic ---------------------------------------------

/**
 * Combine per-condition results. 'all' = AND, 'any' = OR, 'custom' evaluates a
 * boolean expression referencing conditions by 1-based number, e.g.
 * "1 AND (2 OR 3)". Falsy/invalid expressions fall back to AND.
 */
export function combineResults(
  results: boolean[],
  logic: FilterLogic,
  expr: string,
): boolean {
  if (results.length === 0) return true
  if (logic === 'all') return results.every(Boolean)
  if (logic === 'any') return results.some(Boolean)
  try {
    return evalExpression(expr, results)
  } catch {
    return results.every(Boolean)
  }
}

// Tiny recursive-descent boolean parser (no eval). Grammar:
//   or   := and ('OR' and)*
//   and  := not ('AND' not)*
//   not  := 'NOT' not | atom
//   atom := number | '(' or ')'
type Token = { t: 'num'; v: number } | { t: 'op'; v: string }

function tokenize(expr: string): Token[] {
  const tokens: Token[] = []
  const re = /\s*(\d+|AND|OR|NOT|\(|\))\s*/giy
  let m: RegExpExecArray | null
  let pos = 0
  while (pos < expr.length) {
    re.lastIndex = pos
    m = re.exec(expr)
    if (!m) throw new Error('bad token')
    pos = re.lastIndex
    const raw = m[1].toUpperCase()
    if (/^\d+$/.test(raw)) tokens.push({ t: 'num', v: parseInt(raw, 10) })
    else tokens.push({ t: 'op', v: raw })
  }
  return tokens
}

function evalExpression(expr: string, results: boolean[]): boolean {
  const tokens = tokenize(expr)
  let i = 0
  const peek = () => tokens[i]
  const eat = () => tokens[i++]

  function parseOr(): boolean {
    let left = parseAnd()
    while (peek() && peek().t === 'op' && (peek() as any).v === 'OR') {
      eat()
      const right = parseAnd()
      left = left || right
    }
    return left
  }
  function parseAnd(): boolean {
    let left = parseNot()
    while (peek() && peek().t === 'op' && (peek() as any).v === 'AND') {
      eat()
      const right = parseNot()
      left = left && right
    }
    return left
  }
  function parseNot(): boolean {
    if (peek() && peek().t === 'op' && (peek() as any).v === 'NOT') {
      eat()
      return !parseNot()
    }
    return parseAtom()
  }
  function parseAtom(): boolean {
    const tok = eat()
    if (!tok) throw new Error('unexpected end')
    if (tok.t === 'num') {
      const idx = tok.v - 1
      if (idx < 0 || idx >= results.length) throw new Error('bad ref')
      return results[idx]
    }
    if (tok.t === 'op' && tok.v === '(') {
      const val = parseOr()
      const close = eat()
      if (!close || close.t !== 'op' || close.v !== ')') throw new Error('unbalanced')
      return val
    }
    throw new Error('unexpected token')
  }

  const out = parseOr()
  if (i !== tokens.length) throw new Error('trailing tokens')
  return out
}
