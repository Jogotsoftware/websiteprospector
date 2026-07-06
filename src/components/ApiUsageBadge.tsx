import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { MONTHLY_API_CAP } from '../lib/constants'

interface Usage {
  text_search: number
  place_details: number
}

/**
 * Live "X / 4,500 calls used this month" indicator, split by call type.
 * Reads the current-month api_usage rows. Re-fetches on a light interval and
 * exposes a manual refresh via the `refreshKey` prop so a finished search run
 * can force an immediate update.
 */
export default function ApiUsageBadge({ refreshKey = 0 }: { refreshKey?: number }) {
  const [usage, setUsage] = useState<Usage>({ text_search: 0, place_details: 0 })

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data } = await supabase.rpc('current_month_usage')
      if (cancelled || !data) return
      const next: Usage = { text_search: 0, place_details: 0 }
      for (const row of data as { call_type: keyof Usage; count: number }[]) {
        next[row.call_type] = row.count
      }
      setUsage(next)
    }
    load()
    const t = setInterval(load, 15000)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [refreshKey])

  const worst = Math.max(usage.text_search, usage.place_details)
  const near = worst >= MONTHLY_API_CAP * 0.9
  const cap = MONTHLY_API_CAP.toLocaleString()

  return (
    <div className={`usage-badge${near ? ' usage-badge--warn' : ''}`}>
      <span className="usage-badge__title">API this month</span>
      <span title="Text Search calls">
        Search: {usage.text_search.toLocaleString()} / {cap}
      </span>
      <span title="Place Details calls">
        Details: {usage.place_details.toLocaleString()} / {cap}
      </span>
    </div>
  )
}
