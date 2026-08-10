#!/usr/bin/env bash
# Vercel build entrypoint.
#
# Migrations run only for production builds. Preview builds share the same
# database, so migrating from a preview applies a branch's migrations to the
# database every other environment reads. That is how deployments broke on
# 2026-07-12: a preview build applied a fresh baseline migration to a database
# that already held another branch's schema, the migration failed partway, and
# Prisma then refused every later migration on every branch (P3009) until the
# failed row was resolved by hand.
set -euo pipefail

npx prisma generate

if [ "${VERCEL_ENV:-}" = "production" ]; then
  npx prisma migrate deploy
else
  echo "Skipping prisma migrate deploy (VERCEL_ENV=${VERCEL_ENV:-unset}, not production)."
fi

npx next build
