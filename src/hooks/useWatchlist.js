import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../utils/supabase'
import { fromRow, toRow } from '../lib/watchlistMappers'

export function useWatchlist(userId) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('fund_watchlist')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      setLoading(false)
      return
    }
    setEntries(data.map(fromRow))
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function addEntry(symbol, note, displayName) {
    const { error } = await supabase
      .from('fund_watchlist')
      .insert(toRow({ userId, displayName, symbol, note }))
      .select()
      .single()
    if (error) throw error
    await load()
  }

  async function removeEntry(id) {
    const { error } = await supabase.from('fund_watchlist').delete().eq('id', id)
    if (error) throw error
    await load()
  }

  return { entries, loading, addEntry, removeEntry }
}
