import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../utils/supabase'
import { fromRow, toRow } from '../lib/investmentMappers'

export function useInvestments(accountId) {
  const [investments, setInvestments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!accountId) return
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('investments')
      .select('*')
      .eq('account_id', accountId)
      .eq('status', 'open')
      .order('created_at', { ascending: false })

    if (err) {
      setError(err)
      setLoading(false)
      return
    }
    setInvestments(data.map(fromRow))
    setLoading(false)
  }, [accountId])

  useEffect(() => {
    load()
  }, [load])

  async function addInvestment(investment, userId) {
    const { data, error: err } = await supabase
      .from('investments')
      .insert({ account_id: accountId, user_id: userId, ...toRow({ ...investment, status: 'open' }) })
      .select()
      .single()
    if (err) throw err
    await load()
    return fromRow(data)
  }

  async function updateInvestment(id, patch) {
    const current = investments.find((i) => i.id === id)
    const { error: err } = await supabase.from('investments').update(toRow({ ...current, ...patch })).eq('id', id)
    if (err) throw err
    await load()
  }

  async function closeInvestment(id, { sellPrice, sellDate }) {
    const current = investments.find((i) => i.id === id)
    const { error: err } = await supabase
      .from('investments')
      .update(toRow({ ...current, status: 'closed', sellPrice, sellDate }))
      .eq('id', id)
    if (err) throw err
    await load()
  }

  async function rollInvestment(id, { closePrice, closeDate, newCredit, newExpiry, newStrike }, userId) {
    const current = investments.find((i) => i.id === id)

    const { error: closeErr } = await supabase
      .from('investments')
      .update(toRow({ ...current, status: 'closed', sellPrice: closePrice, sellDate: closeDate }))
      .eq('id', id)
    if (closeErr) throw closeErr

    const { error: insertErr } = await supabase
      .from('investments')
      .insert({
        account_id: accountId,
        user_id: userId,
        ...toRow({
          ...current,
          avgCost: newCredit,
          strike: newStrike,
          expiry: newExpiry,
          buyDate: closeDate,
          status: 'open',
          sellPrice: '',
          sellDate: '',
          currentPrice: '',
        }),
      })
    if (insertErr) throw insertErr

    await load()
  }

  async function deleteInvestment(id) {
    const { error: err } = await supabase.from('investments').delete().eq('id', id)
    if (err) throw err
    await load()
  }

  return { investments, loading, error, reload: load, addInvestment, updateInvestment, closeInvestment, rollInvestment, deleteInvestment }
}
