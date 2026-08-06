# SalahNearMe Operations Centre — Batch 1 Installation

## Included files

- lib/requireAdminCompat.ts
- lib/systemHealthTypes.ts
- lib/supabaseMonitoring.ts
- lib/supabaseAlertEngine.ts
- app/api/admin/system-health/route.ts
- app/api/admin/system-health/check/route.ts
- sql/system-health.sql
- .env.operations-centre.example

## What this batch does

- supports both requireAdmin() and requireAdmin(request)
- avoids generated Supabase table-type red lines
- checks the homepage
- checks Supabase Auth
- checks a lightweight Supabase database query
- checks the Supabase Management API when credentials exist
- stores lightweight and daily snapshots
- automatically calculates quota percentages
- detects service failures
- detects sharp latency increases versus the previous snapshot
- creates, updates and resolves alerts
- keeps lightweight history for 30 days
- keeps daily history for 365 days

## Important

This batch has passed standalone TypeScript syntax/transpilation checks. Run npm run build inside the real project to verify integration with the exact local project.
