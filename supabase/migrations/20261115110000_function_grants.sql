-- Beveiligingsreview (Prompt 14): functies die alleen intern (triggers, service role) bedoeld zijn,
-- zijn niet meer aan te roepen door anon of ingelogde gebruikers via de REST API (/rpc).
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.ads_refresh_shop_count() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.shops_block_opted_out() from public, anon, authenticated;
revoke execute on function public.lookups_block_opted_out() from public, anon, authenticated;
revoke execute on function public.is_opted_out(text) from public, anon, authenticated;
