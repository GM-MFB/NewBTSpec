import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../utils/supabase'

const STORAGE_KEY = 'bt_finnhub_key'

export function useUserSettings(userId) {
  const [finnhubKey, setFinnhubKey] = useState(() => localStorage.getItem(STORAGE_KEY) ?? '')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('user_settings')
      .select('finnhub_key, display_name')
      .eq('user_id', userId)
      .maybeSingle()

    if (err) {
      setError(err)
      setLoading(false)
      return
    }
    if (data?.finnhub_key) {
      setFinnhubKey(data.finnhub_key)
      localStorage.setItem(STORAGE_KEY, data.finnhub_key)
    }
    if (data?.display_name) {
      setDisplayName(data.display_name)
    }
    setLoading(false)
  }, [userId])

  useEffect(() => {
    load()
  }, [load])

  async function saveFinnhubKey(key) {
    const { error: err } = await supabase
      .from('user_settings')
      .upsert({ user_id: userId, finnhub_key: key }, { onConflict: 'user_id' })
    if (err) throw err
    setFinnhubKey(key)
    localStorage.setItem(STORAGE_KEY, key)
  }

  async function saveDisplayName(name) {
    const { error: err } = await supabase
      .from('user_settings')
      .upsert({ user_id: userId, display_name: name }, { onConflict: 'user_id' })
    if (err) throw err
    setDisplayName(name)
  }

  return { finnhubKey, displayName, loading, error, saveFinnhubKey, saveDisplayName }
}
