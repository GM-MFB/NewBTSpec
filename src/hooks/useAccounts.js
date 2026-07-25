import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../utils/supabase'

const STORAGE_KEY = 'bt_active_account'

export function useAccounts(userId) {
  const [accounts, setAccounts] = useState([])
  const [activeAccountId, setActiveAccountId] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })

    if (error) {
      setLoading(false)
      return
    }

    let list = data
    if (list.length === 0) {
      const { data: created } = await supabase
        .from('accounts')
        .insert({ user_id: userId, name: 'Main Account', cash: 0 })
        .select()
        .single()
      list = [created]
    }

    setAccounts(list)
    const stored = localStorage.getItem(STORAGE_KEY)
    const valid = list.find((a) => a.id === stored)
    const active = valid ? valid.id : list[0].id
    setActiveAccountId(active)
    localStorage.setItem(STORAGE_KEY, active)
    setLoading(false)
  }, [userId])

  useEffect(() => {
    load()
  }, [load])

  function switchAccount(id) {
    setActiveAccountId(id)
    localStorage.setItem(STORAGE_KEY, id)
  }

  async function createAccount(name) {
    const { data, error } = await supabase
      .from('accounts')
      .insert({ user_id: userId, name, cash: 0 })
      .select()
      .single()
    if (error) throw error
    setAccounts((prev) => [...prev, data])
    switchAccount(data.id)
    return data
  }

  return {
    accounts,
    activeAccountId,
    activeAccount: accounts.find((a) => a.id === activeAccountId) ?? null,
    loading,
    switchAccount,
    createAccount,
  }
}
