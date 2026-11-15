-- Seed voor lokale ontwikkeling: plannen, 3 voorbeeldshops, producten, adverteerders en 10 ads.
-- Alle data is verzonnen.

insert into public.plans (id, name, monthly_price_cents, sort_order, limits) values
  ('free',    'Gratis',  0,     0, '{"shop_lookups_per_week": 5,  "ad_searches_per_day": 20, "folders": 1, "tracked_brands": 0, "api": false}'),
  ('starter', 'Starter', 2900,  1, '{"shop_lookups_per_week": 50, "ad_searches_per_day": null, "folders": null, "tracked_brands": 3, "api": false}'),
  ('pro',     'Pro',     5900,  2, '{"shop_lookups_per_week": null, "ad_searches_per_day": null, "folders": null, "tracked_brands": 15, "api": true, "api_calls_per_month": 10000}'),
  ('agency',  'Agency',  11900, 3, '{"shop_lookups_per_week": null, "ad_searches_per_day": null, "folders": null, "tracked_brands": 40, "api": true, "api_calls_per_month": 50000, "seats": 3}');

insert into public.shops (id, domain, name, country, currency, platform, theme_name, apps, status,
                          est_monthly_revenue_low, est_monthly_revenue, est_monthly_revenue_high,
                          est_monthly_orders, est_confidence, growth_score, last_crawled_at) values
  ('11111111-0000-0000-0000-000000000001', 'zilverzand.nl', 'Zilverzand Sieraden', 'NL', 'EUR', 'shopify', 'Dawn',
   '["klaviyo", "judge-me", "vitals"]', 'active', 18000, 26000, 37000, 520, 0.45, 0.72, now()),
  ('11111111-0000-0000-0000-000000000002', 'bosbad.be', 'Bosbad Verzorging', 'BE', 'EUR', 'shopify', 'Impulse',
   '["klaviyo", "loox", "recharge"]', 'active', 9000, 14000, 21000, 310, 0.38, 0.31, now()),
  ('11111111-0000-0000-0000-000000000003', 'fietsfabriekje.nl', 'Het Fietsfabriekje', 'NL', 'EUR', 'shopify', 'Prestige',
   '["judge-me"]', 'active', 40000, 58000, 80000, 140, 0.30, -0.12, now());

insert into public.products (shop_id, external_id, handle, title, product_type, vendor, price_min, price_max, compare_at_price, tags, published_at) values
  ('11111111-0000-0000-0000-000000000001', '9001', 'schakelketting-zilver', 'Schakelketting zilver', 'Kettingen', 'Zilverzand', 39.95, 49.95, 59.95, '{zilver,ketting}', now() - interval '40 days'),
  ('11111111-0000-0000-0000-000000000001', '9002', 'oorbellen-parel', 'Parel oorbellen', 'Oorbellen', 'Zilverzand', 24.95, 24.95, null, '{parel,oorbellen}', now() - interval '5 days'),
  ('11111111-0000-0000-0000-000000000001', '9003', 'naamring-goud', 'Naamring goud vergulden', 'Ringen', 'Zilverzand', 44.95, 54.95, null, '{goud,ring,gepersonaliseerd}', now() - interval '2 days'),
  ('11111111-0000-0000-0000-000000000002', '7001', 'baardolie-ceder', 'Baardolie ceder', 'Verzorging', 'Bosbad', 19.95, 19.95, null, '{baard,olie}', now() - interval '90 days'),
  ('11111111-0000-0000-0000-000000000002', '7002', 'shampoo-bar', 'Shampoo bar rozemarijn', 'Haar', 'Bosbad', 12.50, 12.50, 14.95, '{zerowaste,haar}', now() - interval '12 days'),
  ('11111111-0000-0000-0000-000000000003', '5001', 'stadsfiets-mila', 'Stadsfiets Mila', 'Fietsen', 'Fietsfabriekje', 899.00, 999.00, null, '{fiets,stad}', now() - interval '200 days'),
  ('11111111-0000-0000-0000-000000000003', '5002', 'fietstas-waxed', 'Waxed canvas fietstas', 'Accessoires', 'Fietsfabriekje', 79.00, 79.00, null, '{tas}', now() - interval '20 days');

insert into public.advertisers (id, platform, page_id, page_name, shop_id, country) values
  ('22222222-0000-0000-0000-000000000001', 'meta', '100000000000001', 'Zilverzand Sieraden', '11111111-0000-0000-0000-000000000001', 'NL'),
  ('22222222-0000-0000-0000-000000000002', 'meta', '100000000000002', 'Bosbad', '11111111-0000-0000-0000-000000000002', 'BE'),
  ('22222222-0000-0000-0000-000000000003', 'meta', '100000000000003', 'Het Fietsfabriekje', '11111111-0000-0000-0000-000000000003', 'NL');

insert into public.ads (platform, external_id, advertiser_id, shop_id, body, title, cta, landing_url, landing_domain,
                        media_type, started_at, ended_at, is_active, eu_total_reach, est_spend_low, est_spend_high,
                        countries, languages) values
  ('meta', '800001', '22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'Gratis verzending op alle zilveren kettingen! Bestel nu.', 'Schakelketting zilver', 'SHOP_NOW', 'https://zilverzand.nl/products/schakelketting-zilver', 'zilverzand.nl', 'image', now() - interval '64 days', null, true, 412000, 2472, 4944, '{NL,BE}', '{nl}'),
  ('meta', '800002', '22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'Nieuw: parel oorbellen. 20% korting met code PAREL20.', 'Parel oorbellen', 'SHOP_NOW', 'https://zilverzand.nl/products/oorbellen-parel', 'zilverzand.nl', 'video', now() - interval '6 days', null, true, 58000, 348, 696, '{NL}', '{nl}'),
  ('meta', '800003', '22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'Jouw naam in goud. Het perfecte cadeau.', 'Naamring', 'LEARN_MORE', 'https://zilverzand.nl/products/naamring-goud', 'zilverzand.nl', 'carousel', now() - interval '35 days', now() - interval '3 days', false, 190000, 1140, 2280, '{NL,BE}', '{nl}'),
  ('meta', '800004', '22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'Black Friday: tot 40% korting op alle sieraden.', 'Black Friday', 'SHOP_NOW', 'https://zilverzand.nl/collections/sale', 'zilverzand.nl', 'image', now() - interval '2 days', null, true, 12000, 72, 144, '{NL}', '{nl}'),
  ('meta', '800005', '22222222-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000002', 'Natuurlijke baardolie met ceder. Gemaakt in Gent.', 'Baardolie ceder', 'SHOP_NOW', 'https://bosbad.be/products/baardolie-ceder', 'bosbad.be', 'video', now() - interval '120 days', null, true, 640000, 3840, 7680, '{BE,NL}', '{nl}'),
  ('meta', '800006', '22222222-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000002', 'Huile à barbe naturelle au cèdre. Livraison gratuite.', 'Huile à barbe', 'SHOP_NOW', 'https://bosbad.be/fr/products/baardolie-ceder', 'bosbad.be', 'video', now() - interval '90 days', null, true, 210000, 1260, 2520, '{BE}', '{fr}'),
  ('meta', '800007', '22222222-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000002', 'Zero waste haarverzorging: probeer de shampoo bar.', 'Shampoo bar', 'LEARN_MORE', 'https://bosbad.be/products/shampoo-bar', 'bosbad.be', 'image', now() - interval '14 days', now() - interval '1 day', false, 33000, 198, 396, '{BE}', '{nl}'),
  ('meta', '800008', '22222222-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000003', 'Handgemaakte stadsfietsen uit Utrecht. Proefrit? Boek nu.', 'Stadsfiets Mila', 'BOOK_NOW', 'https://fietsfabriekje.nl/products/stadsfiets-mila', 'fietsfabriekje.nl', 'video', now() - interval '45 days', null, true, 98000, 588, 1176, '{NL}', '{nl}'),
  ('meta', '800009', '22222222-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000003', 'Waxed canvas fietstas. Waterdicht en tijdloos.', 'Fietstas', 'SHOP_NOW', 'https://fietsfabriekje.nl/products/fietstas-waxed', 'fietsfabriekje.nl', 'image', now() - interval '18 days', null, true, 41000, 246, 492, '{NL,BE}', '{nl}'),
  ('meta', '800010', '22222222-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000003', 'Gratis onderhoudsbeurt bij elke nieuwe fiets.', 'Gratis onderhoud', 'LEARN_MORE', 'https://fietsfabriekje.nl/pages/service', 'fietsfabriekje.nl', 'image', now() - interval '80 days', now() - interval '30 days', false, 150000, 900, 1800, '{NL}', '{nl}');

insert into public.shop_snapshots (shop_id, captured_on, product_count, new_products, est_daily_revenue, active_ads_count) values
  ('11111111-0000-0000-0000-000000000001', current_date - 1, 3, 1, 850, 3),
  ('11111111-0000-0000-0000-000000000002', current_date - 1, 2, 0, 460, 2),
  ('11111111-0000-0000-0000-000000000003', current_date - 1, 2, 0, 1900, 2);
