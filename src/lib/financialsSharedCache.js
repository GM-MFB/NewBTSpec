import { supabase } from '../utils/supabase'

export async function getSharedCache(ticker) {
  const { data, error } = await supabase
    .from('financials_cache')
    .select('data')
    .eq('ticker', ticker)
    .maybeSingle()

  if (error || !data) return null
  return data.data
}

export async function saveSharedCache(ticker, data, userId) {
  await supabase
    .from('financials_cache')
    .upsert({ ticker, data, fetched_at: new Date().toISOString(), user_id: userId }, { onConflict: 'ticker' })
}
