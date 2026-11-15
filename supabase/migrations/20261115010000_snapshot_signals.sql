-- Extra signalen per dag voor het schattingsmodel (zie docs/estimation.md).
alter table public.shop_snapshots
  add column removed_products integer,
  add column price_changes integer,
  add column sellouts integer,
  -- Som van prijs × uitverkochte varianten t.o.v. de vorige snapshot (null op de eerste dag).
  add column sellout_value numeric(14, 2),
  add column review_count integer,
  add column total_reach bigint,
  add column est_daily_revenue_low numeric(14, 2),
  add column est_daily_revenue_high numeric(14, 2),
  add column est_confidence real check (est_confidence between 0 and 1);

alter table public.shops
  add column est_monthly_orders_low integer,
  add column est_monthly_orders_high integer,
  add column est_updated_at timestamptz,
  -- Welke signalen de schatting droegen, bv. {"ads": 0.35, "sellouts": 0.3}
  add column est_signals jsonb;

create index shops_last_crawled_idx on public.shops (last_crawled_at nulls first) where status = 'active';
