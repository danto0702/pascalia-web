-- PascalPDF y Pascal Sign: cuentas, planes, historial de firmas, pagos (Wompi) y códigos promocionales.
-- Proyecto: Supabase de CuentaFacil. Cuentas propias (no usan el Auth del panel de CuentaFacil).
-- Sin políticas RLS: solo la Edge Function pascalpdf-firma (service role) lee y escribe.

create table if not exists public.pascalpdf_usuarios (
  id uuid primary key default gen_random_uuid(),
  correo text not null unique check (char_length(correo) <= 254),
  nombre text check (char_length(nombre) <= 120),
  creado_en timestamptz not null default now(),
  plan text not null default 'prueba' check (plan in ('prueba', 'pro', 'suite')),
  vence_en timestamptz not null,
  solicitudes_extra int not null default 0 check (solicitudes_extra >= 0)
);

create table if not exists public.pascalpdf_sesiones (
  token_hash text primary key,
  usuario_id uuid not null references public.pascalpdf_usuarios (id) on delete cascade,
  creada_en timestamptz not null default now(),
  vence_en timestamptz not null,
  ultimo_uso timestamptz not null default now()
);
create index if not exists pascalpdf_sesiones_usuario_idx on public.pascalpdf_sesiones (usuario_id);

-- Historial de firmas: lo único que se guarda de cada documento firmado (nunca el documento ni la firma)
create table if not exists public.pascalpdf_eventos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.pascalpdf_usuarios (id) on delete cascade,
  firmado_en timestamptz not null default now(),
  app text not null check (app in ('pascalpdf', 'pascalsign')),
  documento_tipo text not null default 'Otro' check (char_length(documento_tipo) <= 40),
  firmante text check (char_length(firmante) <= 120),
  objeto text check (char_length(objeto) <= 120),          -- p. ej. «Certificado de cumplimiento»
  radicado text check (char_length(radicado) <= 60),       -- número de radicado del documento, si tiene
  documento_nombre text not null check (char_length(documento_nombre) <= 160),
  documento_hash text check (documento_hash is null or documento_hash ~ '^[0-9a-f]{64}$'),
  firma_id uuid not null,
  metodo text check (metodo in ('dibujada', 'escrita', 'imagen')),
  paginas int check (paginas is null or paginas between 1 and 10000)
);
create index if not exists pascalpdf_eventos_usuario_idx on public.pascalpdf_eventos (usuario_id, firmado_en desc);

create table if not exists public.pascalpdf_pagos (
  referencia text primary key,
  -- Los pagos son soporte contable: se conservan 10 años aunque se borre la cuenta
  usuario_id uuid references public.pascalpdf_usuarios (id) on delete set null,
  correo text not null,
  producto text not null,
  precio int not null check (precio >= 0),
  descuento int not null default 0 check (descuento >= 0),
  monto int not null check (monto >= 0),
  codigo text,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aprobado', 'rechazado', 'anulado')),
  wompi_id text,
  creado_en timestamptz not null default now(),
  aprobado_en timestamptz
);
create index if not exists pascalpdf_pagos_usuario_idx on public.pascalpdf_pagos (usuario_id, creado_en desc);

create table if not exists public.pascalpdf_promos (
  codigo text primary key check (codigo = upper(codigo) and char_length(codigo) between 3 and 30),
  tipo text not null check (tipo in ('porcentaje', 'valor')),
  valor int not null check (valor > 0),
  productos text[] not null default '{}',   -- vacío = aplica a todos
  vence_en timestamptz,
  max_usos int,
  usos int not null default 0,
  activo boolean not null default true,
  nota text
);

create table if not exists public.pascalpdf_promos_usos (
  codigo text not null references public.pascalpdf_promos (codigo) on delete cascade,
  usuario_id uuid not null references public.pascalpdf_usuarios (id) on delete cascade,
  usado_en timestamptz not null default now(),
  primary key (codigo, usuario_id)
);

-- Las solicitudes de firma a otras personas cuentan contra el plan de quien las crea
alter table public.pascalpdf_solicitudes add column if not exists usuario_id uuid references public.pascalpdf_usuarios (id) on delete set null;
create index if not exists pascalpdf_solicitudes_usuario_idx on public.pascalpdf_solicitudes (usuario_id, creada_en desc);

-- Aplica un pago aprobado una sola vez (idempotente): extiende el plan o suma solicitudes
create or replace function public.pascalpdf_aplicar_pago(p_referencia text, p_wompi_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pago public.pascalpdf_pagos;
  v_usuario public.pascalpdf_usuarios;
  v_plan text;
  v_dias int;
  v_base timestamptz;
begin
  select * into v_pago from public.pascalpdf_pagos where referencia = p_referencia for update;
  if not found or v_pago.estado = 'aprobado' then return false; end if;
  select * into v_usuario from public.pascalpdf_usuarios where id = v_pago.usuario_id for update;

  if v_pago.producto = 'paquete10' then
    update public.pascalpdf_usuarios set solicitudes_extra = solicitudes_extra + 10 where id = v_usuario.id;
  else
    v_plan := split_part(v_pago.producto, '_', 1);          -- pro | suite
    v_dias := case when v_pago.producto like '%_anual' then 365 else 30 end;
    -- Mismo plan vigente: se suma al vencimiento. Cambio de plan o vencido: empieza hoy
    -- (si pasa de Pro a Suite, los días de Pro que quedaban se convierten al 40 %).
    if v_usuario.plan = v_plan and v_usuario.vence_en > now() then
      v_base := v_usuario.vence_en;
    elsif v_usuario.plan = 'pro' and v_plan = 'suite' and v_usuario.vence_en > now() then
      v_base := now() + (v_usuario.vence_en - now()) * 0.4;
    else
      v_base := now();
    end if;
    update public.pascalpdf_usuarios set plan = v_plan, vence_en = v_base + make_interval(days => v_dias) where id = v_usuario.id;
  end if;

  update public.pascalpdf_pagos set estado = 'aprobado', aprobado_en = now(), wompi_id = coalesce(p_wompi_id, wompi_id) where referencia = p_referencia;
  if v_pago.codigo is not null then
    insert into public.pascalpdf_promos_usos (codigo, usuario_id) values (v_pago.codigo, v_usuario.id) on conflict do nothing;
    update public.pascalpdf_promos set usos = usos + 1 where codigo = v_pago.codigo;
  end if;
  return true;
end $$;

alter table public.pascalpdf_usuarios enable row level security;
alter table public.pascalpdf_sesiones enable row level security;
alter table public.pascalpdf_eventos enable row level security;
alter table public.pascalpdf_pagos enable row level security;
alter table public.pascalpdf_promos enable row level security;
alter table public.pascalpdf_promos_usos enable row level security;
revoke all on public.pascalpdf_usuarios, public.pascalpdf_sesiones, public.pascalpdf_eventos,
  public.pascalpdf_pagos, public.pascalpdf_promos, public.pascalpdf_promos_usos from anon, authenticated;
revoke execute on function public.pascalpdf_aplicar_pago(text, text) from public, anon, authenticated;

-- Sesiones vencidas fuera cada día
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('pascalpdf-sesiones-vencidas', '29 4 * * *',
      $q$delete from public.pascalpdf_sesiones where vence_en < now()$q$);
  end if;
end $$;
