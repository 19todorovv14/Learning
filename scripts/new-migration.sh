#!/usr/bin/env bash
# Създава нова миграция от разликата между текущата база и schema.prisma
# (неинтерактивна алтернатива на `prisma migrate dev`).
# Употреба: npm run db:new-migration -- име_на_миграцията
set -euo pipefail
NAME="${1:?Задайте име на миграцията}"
TS="$(date -u +%Y%m%d%H%M%S)"
DIR="prisma/migrations/${TS}_${NAME}"
SQL="$(npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script 2>/dev/null | grep -v '^Loaded Prisma config')"
if [ -z "$(echo "$SQL" | grep -v '^--' | tr -d '[:space:]')" ]; then
  echo "Няма промени в схемата."
  exit 0
fi
mkdir -p "$DIR"
echo "$SQL" > "$DIR/migration.sql"
echo "Създадена: $DIR/migration.sql"
npx prisma migrate deploy
npx prisma generate
