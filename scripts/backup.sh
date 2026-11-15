#!/bin/sh
# Dagelijkse backup van de database (pg_dump, custom formaat). Draait in de backup-container
# (docker-compose.yml) of los: DATABASE_URL=... BACKUP_DIR=./backups sh scripts/backup.sh
# Terugzetten: pg_restore --clean --if-exists --no-owner -d "$DATABASE_URL" <bestand>
set -eu

: "${DATABASE_URL:?DATABASE_URL ontbreekt}"
DIR="${BACKUP_DIR:-/backups}"
KEEP="${BACKUP_KEEP_DAYS:-14}"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
FILE="$DIR/trendtrack-$STAMP.dump"

mkdir -p "$DIR"
# Alleen het public-schema en auth (gebruikers); storage-bestanden staan in Supabase zelf.
pg_dump "$DATABASE_URL" --format=custom --no-owner --no-privileges \
  --schema=public --schema=auth --file="$FILE.tmp"
mv "$FILE.tmp" "$FILE"
echo "backup: $FILE ($(du -h "$FILE" | cut -f1))"

# Controle: het bestand is leesbaar voor pg_restore.
pg_restore --list "$FILE" > /dev/null

find "$DIR" -name 'trendtrack-*.dump' -mtime +"$KEEP" -delete

if [ -n "${BACKUP_RCLONE_REMOTE:-}" ] && command -v rclone > /dev/null; then
  rclone copy "$FILE" "$BACKUP_RCLONE_REMOTE" && echo "kopie naar $BACKUP_RCLONE_REMOTE"
fi
