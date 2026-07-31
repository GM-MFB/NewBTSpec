import { supabase } from '../utils/supabase'

export async function getSharedCache(ticker) {
  const { data, error } = await supabase
    .from('financials_cache')
    .select('data, fetched_at')
    .eq('ticker', ticker)
    .maybeSingle()

  if (error || !data) return null
  return { data: data.data, fetchedAt: data.fetched_at ?? null }
}

export async function saveSharedCache(ticker, data, userId) {
  await supabase
    .from('financials_cache')
    .upsert({ ticker, data, fetched_at: new Date().toISOString(), user_id: userId }, { onConflict: 'ticker' })
}
