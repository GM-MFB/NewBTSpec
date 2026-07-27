import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../utils/supabase'

export function useScreenerSaves(accountId, userId) {
  const [saves, setSaves] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!accountId) return
    setLoading(true)

    const { data: own } = await supabase
      .from('screener_saves')
      .select('*')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false })

    let merged = own ?? []

    if (accountId !== 'default') {
      const { data: shared } = await supabase
        .from('screener_saves')
        .select('*')
        .eq('account_id', 'default')
        .order('created_at', { ascending: false })

      const ownIds = new Set(merged.map((s) => s.id))
      merged = [...merged, ...(shared ?? []).filter((s) => !ownIds.has(s.id))]
    }

    setSaves(merged)
    setLoading(false)
  }, [accountId])

  useEffect(() => {
    load()
  }, [load])

  async function savePreset(name, filters) {
    const { error } = await supabase
      .from('screener_saves')
      .insert({ account_id: accountId, user_id: userId, name, filters })
      .select()
      .single()
    if (error) throw error
    await load()
  }

  async function deletePreset(id) {
    const { error } = await supabase.from('screener_saves').delete().eq('id', id)
    if (error) throw error
    await load()
  }

  return { saves, loading, savePreset, deletePreset }
}
