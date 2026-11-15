#!/bin/sh
# Schrijft een .env-bestand voor CI/e2e uit de draaiende lokale Supabase. Gebruik: sh scripts/ci-env.sh [.env.local]
set -eu
OUT="${1:-.env.local}"
STATUS="$(pnpm exec supabase status -o env)"
get() { printf '%s\n' "$STATUS" | sed -n "s/^$1=\"\(.*\)\"$/\1/p"; }
cat > "$OUT" <<ENV
SUPABASE_URL=$(get API_URL)
SUPABASE_ANON_KEY=$(get ANON_KEY)
SUPABASE_SERVICE_ROLE_KEY=$(get SERVICE_ROLE_KEY)
DATABASE_URL=$(get DB_URL)
NEXT_PUBLIC_SUPABASE_URL=$(get API_URL)
NEXT_PUBLIC_SUPABASE_ANON_KEY=$(get ANON_KEY)
STRIPE_WEBHOOK_SECRET=whsec_ci_e2e_only
RATE_LIMIT_SALT=ci-e2e-only
INBOUND_WEBHOOK_SECRET=ci-e2e-only
EMAIL_INBOX_DOMAIN=inbox.e2e.local
EMAIL_INBOUND_MODE=webhook
SCHEDULER_ENABLED=false
MCP_PUBLIC_URL=http://localhost:3333
WEB_PUBLIC_URL=http://localhost:3000
NEXT_PUBLIC_MCP_URL=http://localhost:3333
ENV
echo "env geschreven naar $OUT"
