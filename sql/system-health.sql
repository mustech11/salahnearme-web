begin;

create extension if not exists pgcrypto;

create table if not exists public.system_health_snapshots (
  id uuid primary key default gen_random_uuid(),

  overall_status text not null
    check (
      overall_status in (
        'healthy',
        'warning',
        'critical',
        'offline'
      )
    ),

  mode text not null default 'lightweight'
    check (
      mode in (
        'lightweight',
        'daily'
      )
    ),

  service_status jsonb not null default '[]'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  error_summary jsonb not null default '{}'::jsonb,
  usage_summary jsonb not null default '[]'::jsonb,
  response_time_ms integer,
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists system_health_snapshots_checked_at_idx
  on public.system_health_snapshots (
    checked_at desc
  );

create index if not exists system_health_snapshots_mode_checked_at_idx
  on public.system_health_snapshots (
    mode,
    checked_at desc
  );

create table if not exists public.system_health_alerts (
  id uuid primary key default gen_random_uuid(),
  alert_key text not null,

  severity text not null
    check (
      severity in (
        'info',
        'warning',
        'high',
        'critical'
      )
    ),

  title text not null,
  message text not null,
  metric_name text,
  metric_value numeric,
  threshold_value numeric,

  status text not null default 'active'
    check (
      status in (
        'active',
        'acknowledged',
        'resolved'
      )
    ),

  first_detected_at timestamptz not null default now(),
  last_detected_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists system_health_open_alert_key_idx
  on public.system_health_alerts (
    alert_key
  )
  where status in (
    'active',
    'acknowledged'
  );

create index if not exists system_health_alerts_status_severity_idx
  on public.system_health_alerts (
    status,
    severity,
    last_detected_at desc
  );

create table if not exists public.system_health_settings (
  id uuid primary key default gen_random_uuid(),
  setting_key text not null unique,
  setting_value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.system_health_snapshots
  enable row level security;

alter table public.system_health_alerts
  enable row level security;

alter table public.system_health_settings
  enable row level security;

revoke all
  on public.system_health_snapshots
  from anon, authenticated;

revoke all
  on public.system_health_alerts
  from anon, authenticated;

revoke all
  on public.system_health_settings
  from anon, authenticated;

grant all
  on public.system_health_snapshots
  to service_role;

grant all
  on public.system_health_alerts
  to service_role;

grant all
  on public.system_health_settings
  to service_role;

insert into public.system_health_settings (
  setting_key,
  setting_value
)
values
  (
    'monitoring_schedule',
    '{
      "hourly_lightweight": true,
      "daily_deep_scan": true,
      "daily_scan_hour_utc": 3
    }'::jsonb
  ),
  (
    'retention',
    '{
      "lightweight_days": 30,
      "daily_days": 365
    }'::jsonb
  ),
  (
    'alert_thresholds',
    '{
      "usage_percent": [50, 70, 85, 95],
      "consecutive_outage_failures": 2,
      "slow_check_ms": 5000,
      "latency_multiplier": 3
    }'::jsonb
  )
on conflict (
  setting_key
)
do update
set
  setting_value =
    excluded.setting_value,
  updated_at = now();

commit;
