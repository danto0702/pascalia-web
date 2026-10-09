-- PascalIA · solicitudes del sitio web.
-- Aplicado el 2026-10-09 en el proyecto Supabase "SI-APS HRNO" (temporal, todo con prefijo pascalia_).
-- Para trasladarlo a un proyecto propio: aplicar este archivo, desplegar supabase/functions/pascalia-solicitud,
-- copiar los datos de pascalia_solicitudes y pascalia_actividades, y cambiar URL y llave en contacto.js y panel/panel.js.

create table public.pascalia_admins (
  email text primary key check (email = lower(email))
);
alter table public.pascalia_admins enable row level security;
-- Sin políticas: solo se lee desde funciones security definer.

create or replace function public.pascalia_es_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.pascalia_admins a where a.email = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;
revoke all on function public.pascalia_es_admin() from public, anon;
grant execute on function public.pascalia_es_admin() to authenticated;

create sequence public.pascalia_radicado_seq;

create table public.pascalia_solicitudes (
  id uuid primary key default gen_random_uuid(),
  radicado text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  origen text not null default 'web' check (origen in ('web','manual')),
  nombre text not null check (length(nombre) between 2 and 120),
  correo text not null check (correo ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(correo) <= 160),
  whatsapp text check (whatsapp is null or length(whatsapp) <= 30),
  solucion text not null check (solucion in ('flota','nana_dnt','si_aps','mision_medica','cuentafacil','consultoria','desarrollo','capacitacion','otro')),
  tamano text check (tamano is null or length(tamano) <= 120),
  mensaje text not null check (length(mensaje) between 5 and 3000),
  fuente text check (fuente is null or fuente in ('recomendacion','redes_sociales','busqueda','evento','whatsapp','otro')),
  pagina_origen text,
  utm jsonb,
  acepta_datos boolean not null check (acepta_datos),
  acepta_datos_at timestamptz not null default now(),
  etapa text not null default 'nueva' check (etapa in ('nueva','contactada','reunion_agendada','demo_realizada','propuesta_enviada','negociacion','ganada','perdida','descartada')),
  prioridad text not null default 'media' check (prioridad in ('alta','media','baja')),
  valor_estimado bigint check (valor_estimado is null or valor_estimado >= 0),
  proxima_accion text check (proxima_accion is null or length(proxima_accion) <= 300),
  proxima_accion_fecha date,
  motivo_cierre text check (motivo_cierre is null or motivo_cierre in ('cliente_ganado','precio','sin_presupuesto','tiempos','eligio_otro_proveedor','no_responde','no_es_cliente_objetivo','duplicada_o_spam','otro')),
  cierre_detalle text,
  primer_contacto_at timestamptz,
  cerrada_at timestamptz,
  ip_hash text,
  user_agent text,
  correo_aviso_enviado boolean not null default false,
  correo_respuesta_enviado boolean not null default false
);
create index pascalia_solicitudes_created_idx on public.pascalia_solicitudes (created_at desc);
create index pascalia_solicitudes_etapa_idx on public.pascalia_solicitudes (etapa);
create index pascalia_solicitudes_ip_idx on public.pascalia_solicitudes (ip_hash, created_at);
create index pascalia_solicitudes_correo_idx on public.pascalia_solicitudes (lower(correo), created_at);

create table public.pascalia_actividades (
  id uuid primary key default gen_random_uuid(),
  solicitud_id uuid not null references public.pascalia_solicitudes(id) on delete cascade,
  created_at timestamptz not null default clock_timestamp(),
  fecha timestamptz not null default clock_timestamp(),
  tipo text not null check (tipo in ('llamada','whatsapp','correo','reunion','demo','nota','cambio_etapa','sistema')),
  descripcion text not null check (length(descripcion) between 1 and 3000),
  autor uuid default auth.uid()
);
create index pascalia_actividades_solicitud_idx on public.pascalia_actividades (solicitud_id, fecha desc);

create or replace function public.pascalia_solicitudes_bi()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.radicado is null or new.radicado = '' then
    new.radicado := 'PSC-' || to_char(now() at time zone 'America/Bogota', 'YYYY') || '-' || lpad(nextval('public.pascalia_radicado_seq')::text, 4, '0');
  end if;
  return new;
end $$;
create trigger pascalia_solicitudes_bi before insert on public.pascalia_solicitudes
  for each row execute function public.pascalia_solicitudes_bi();

create or replace function public.pascalia_solicitudes_bu()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  new.radicado := old.radicado;
  new.created_at := old.created_at;
  if new.etapa is distinct from old.etapa then
    if new.etapa in ('ganada','perdida','descartada') then
      new.cerrada_at := coalesce(new.cerrada_at, now());
    else
      new.cerrada_at := null;
    end if;
    if new.etapa <> 'nueva' and new.primer_contacto_at is null then
      new.primer_contacto_at := now();
    end if;
  end if;
  return new;
end $$;
create trigger pascalia_solicitudes_bu before update on public.pascalia_solicitudes
  for each row execute function public.pascalia_solicitudes_bu();

create or replace function public.pascalia_solicitudes_au()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.etapa is distinct from old.etapa then
    insert into public.pascalia_actividades (solicitud_id, tipo, descripcion)
    values (new.id, 'cambio_etapa', old.etapa || ' → ' || new.etapa);
  end if;
  return null;
end $$;
create trigger pascalia_solicitudes_au after update on public.pascalia_solicitudes
  for each row execute function public.pascalia_solicitudes_au();

create or replace function public.pascalia_actividades_ai()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.tipo in ('llamada','whatsapp','correo','reunion','demo') then
    update public.pascalia_solicitudes set primer_contacto_at = coalesce(primer_contacto_at, new.fecha)
     where id = new.solicitud_id and primer_contacto_at is null;
  end if;
  return null;
end $$;
create trigger pascalia_actividades_ai after insert on public.pascalia_actividades
  for each row execute function public.pascalia_actividades_ai();

revoke all on function public.pascalia_solicitudes_bi() from public, anon, authenticated;
revoke all on function public.pascalia_solicitudes_bu() from public, anon, authenticated;
revoke all on function public.pascalia_solicitudes_au() from public, anon, authenticated;
revoke all on function public.pascalia_actividades_ai() from public, anon, authenticated;

alter table public.pascalia_solicitudes enable row level security;
alter table public.pascalia_actividades enable row level security;
create policy pascalia_solicitudes_admin_select on public.pascalia_solicitudes for select to authenticated using (public.pascalia_es_admin());
create policy pascalia_solicitudes_admin_insert on public.pascalia_solicitudes for insert to authenticated with check (public.pascalia_es_admin() and origen = 'manual');
create policy pascalia_solicitudes_admin_update on public.pascalia_solicitudes for update to authenticated using (public.pascalia_es_admin()) with check (public.pascalia_es_admin());
create policy pascalia_solicitudes_admin_delete on public.pascalia_solicitudes for delete to authenticated using (public.pascalia_es_admin());
create policy pascalia_actividades_admin_all on public.pascalia_actividades for all to authenticated using (public.pascalia_es_admin()) with check (public.pascalia_es_admin());
revoke all on public.pascalia_solicitudes, public.pascalia_actividades, public.pascalia_admins from anon;
grant usage on sequence public.pascalia_radicado_seq to authenticated;
