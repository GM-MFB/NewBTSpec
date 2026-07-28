import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../utils/supabase'
import { fromRow, toRow } from '../lib/tradeMappers'

export function useTrades(accountId) {
  const [trades, setTrades] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!accountId) return
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('trades')
      .select('*')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false })

    if (err) {
      setError(err)
      setLoading(false)
      return
    }
    setTrades(data.map(fromRow))
    setLoading(false)
  }, [accountId])

  useEffect(() => {
    load()
  }, [load])

  async function addTrade(trade, userId) {
    const { data, error: err } = await supabase
      .from('trades')
      .insert({ account_id: accountId, user_id: userId, ...toRow({ ...trade, status: 'closed' }) })
      .select()
      .single()
    if (err) throw err
    await load()
    return fromRow(data)
  }

  async function updateTrade(id, patch) {
    const current = trades.find((t) => t.id === id)
    const { error: err } = await supabase.from('trades').update(toRow({ ...current, ...patch })).eq('id', id)
    if (err) throw err
    await load()
  }

  async function deleteTrade(id) {
    const { error: err } = await supabase.from('trades').delete().eq('id', id)
    if (err) throw err
    await load()
  }

  return { trades, loading, error, reload: load, addTrade, updateTrade, deleteTrade }
}
