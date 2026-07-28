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
    const { data: own, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })

    if (error) {
      setLoading(false)
      return
    }

    let ownAccounts = own
    if (ownAccounts.length === 0) {
      const { data: created } = await supabase
        .from('accounts')
        .insert({ user_id: userId, name: 'Main Account', cash: 0 })
        .select()
        .single()
      ownAccounts = [created]
    }

    const { data: mattCapAccounts } = await supabase
      .from('accounts')
      .select('*')
      .eq('name', 'Matt Cap')
      .order('created_at', { ascending: true })

    const ownIds = new Set(ownAccounts.map((a) => a.id))
    const list = [...ownAccounts, ...(mattCapAccounts ?? []).filter((a) => !ownIds.has(a.id))]

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

  async function deleteAccount(id) {
    const { error: tradesError } = await supabase.from('trades').delete().eq('account_id', id)
    if (tradesError) throw tradesError

    const { error: investmentsError } = await supabase.from('investments').delete().eq('account_id', id)
    if (investmentsError) throw investmentsError

    const { error } = await supabase.from('accounts').delete().eq('id', id)
    if (error) throw error

    setAccounts((prev) => {
      const remaining = prev.filter((a) => a.id !== id)
      if (id === activeAccountId && remaining.length > 0) {
        switchAccount(remaining[0].id)
      }
      return remaining
    })
  }

  return {
    accounts,
    activeAccountId,
    activeAccount: accounts.find((a) => a.id === activeAccountId) ?? null,
    loading,
    switchAccount,
    createAccount,
    deleteAccount,
  }
}
