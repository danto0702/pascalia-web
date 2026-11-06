-- Delegación de firma: el titular autoriza a otra cuenta a usar su firma durante un periodo,
-- con opción de restringirla a ciertos objetos. Se puede suspender o revocar en cualquier momento.
create table if not exists public.pascalpdf_delegaciones (
  id uuid primary key default gen_random_uuid(),
  titular_id uuid not null references public.pascalpdf_usuarios (id) on delete cascade,
  delegado_correo text not null check (char_length(delegado_correo) <= 254),
  firma_id uuid not null,
  firma_nombre text not null check (char_length(firma_nombre) <= 120),
  -- imagen de la firma cifrada con AES-GCM en la función (nunca en claro en la base de datos)
  firma_cifrada text not null check (char_length(firma_cifrada) <= 900000),
  objetos text[] not null default '{}',          -- vacío = abierta a cualquier objeto
  desde timestamptz not null,
  hasta timestamptz not null,
  estado text not null default 'activa' check (estado in ('activa', 'suspendida', 'revocada')),
  usos int not null default 0,
  creada_en timestamptz not null default now(),
  actualizada_en timestamptz not null default now(),
  check (hasta > desde)
);
create index if not exists pascalpdf_delegaciones_titular_idx on public.pascalpdf_delegaciones (titular_id, creada_en desc);
create index if not exists pascalpdf_delegaciones_delegado_idx on public.pascalpdf_delegaciones (delegado_correo, creada_en desc);
alter table public.pascalpdf_delegaciones enable row level security;

-- Las firmas hechas por delegación quedan en el historial del titular (con su consecutivo) y del delegado
alter table public.pascalpdf_eventos
  add column if not exists delegacion_id uuid references public.pascalpdf_delegaciones (id) on delete set null,
  add column if not exists delegado_id uuid references public.pascalpdf_usuarios (id) on delete set null,
  add column if not exists delegado_nombre text check (char_length(delegado_nombre) <= 160);
create index if not exists pascalpdf_eventos_delegado_idx on public.pascalpdf_eventos (delegado_id, firmado_en desc) where delegado_id is not null;

-- Resumen para la página de administración (solo la llama la función con la llave de servicio)
create or replace function public.pascalpdf_admin_resumen()
returns json
language sql
security definer
set search_path = public
as $$
  select json_build_object(
    'usuarios', (select count(*) from pascalpdf_usuarios),
    'usuarios_mes', (select count(*) from pascalpdf_usuarios where creado_en >= date_trunc('month', now() at time zone 'America/Bogota') at time zone 'America/Bogota'),
    'activos', (select json_object_agg(plan, n) from (select plan, count(*) n from pascalpdf_usuarios where vence_en > now() group by plan) p),
    'pagos_aprobados', (select count(*) from pascalpdf_pagos where estado = 'aprobado'),
    'ingresos_total', (select coalesce(sum(monto), 0) from pascalpdf_pagos where estado = 'aprobado'),
    'ingresos_mes', (select coalesce(sum(monto), 0) from pascalpdf_pagos where estado = 'aprobado' and aprobado_en >= date_trunc('month', now() at time zone 'America/Bogota') at time zone 'America/Bogota'),
    'firmas_mes', (select count(*) from pascalpdf_eventos where firmado_en >= date_trunc('month', now() at time zone 'America/Bogota') at time zone 'America/Bogota'),
    'firmas_total', (select count(*) from pascalpdf_eventos),
    'delegaciones_activas', (select count(*) from pascalpdf_delegaciones where estado = 'activa' and now() between desde and hasta)
  );
$$;
revoke all on function public.pascalpdf_admin_resumen() from public, anon, authenticated;
