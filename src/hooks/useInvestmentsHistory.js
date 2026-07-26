import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../utils/supabase'
import { fromRow } from '../lib/investmentMappers'

export function useInvestmentsHistory(accountId) {
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

  async function deleteInvestment(id) {
    const { error: err } = await supabase.from('investments').delete().eq('id', id)
    if (err) throw err
    await load()
  }

  return { investments, loading, error, reload: load, deleteInvestment }
}
