-- Run this once in the Supabase SQL Editor for the BT Speculation project.
-- Additive only: adds two nullable columns to `investments`. Nothing existing
-- is renamed, dropped, or altered, so the old site (which selects known
-- columns) is unaffected.

alter table investments
  add column if not exists strategy text,
  add column if not exists strike_2 numeric;

-- strategy holds one of: 'call', 'put', 'cash_secured_put', 'covered_call',
-- 'put_credit_spread', 'call_credit_spread' (enforced at the app layer, not
-- a DB constraint, so it stays flexible).
--
-- strike_2 is only populated for the two spread strategies (the second
-- leg's strike); existing `strike` continues to hold the primary/short leg.
--
-- All existing rows get strategy = NULL, strike_2 = NULL. No backfill is
-- performed — set each existing investment's strategy manually in the app
-- if you want it filled in.
