-- PascalPDF: solicitudes de firma a otras personas.
-- Proyecto: Supabase de CuentaFacil (tablas aisladas con prefijo pascalpdf_).
-- El documento se guarda cifrado en Storage; la clave nunca llega al servidor.
-- Sin políticas RLS: solo la Edge Function (service role) lee y escribe.

create table if not exists public.pascalpdf_solicitudes (
  id uuid primary key default gen_random_uuid(),
  creada_en timestamptz not null default now(),
  vence_en timestamptz not null default now() + interval '7 days',
  estado text not null default 'pendiente' check (estado in ('pendiente', 'firmada', 'vencida', 'cancelada')),
  remitente_nombre text not null check (char_length(remitente_nombre) <= 120),
  remitente_correo text not null check (char_length(remitente_correo) <= 254),
  firmante_nombre text not null check (char_length(firmante_nombre) <= 120),
  firmante_correo text not null check (char_length(firmante_correo) <= 254),
  mensaje text check (char_length(mensaje) <= 500),
  documento_nombre text not null check (char_length(documento_nombre) <= 160),
  documento_tipo text not null,
  documento_hash text not null check (documento_hash ~ '^[0-9a-f]{64}$'),
  campos jsonb not null default '[]'::jsonb,
  token_remitente_hash text not null,
  otp_hash text,
  otp_vence timestamptz,
  otp_intentos int not null default 0,
  otp_enviados int not null default 0,
  verificado_en timestamptz,
  sesion_hash text,
  sesion_vence timestamptz,
  firmado_en timestamptz,
  firma_id uuid,
  firmado_hash text check (firmado_hash is null or firmado_hash ~ '^[0-9a-f]{64}$'),
  aceptacion_version text,
  archivos_borrados boolean not null default false
);

create index if not exists pascalpdf_solicitudes_remitente_idx on public.pascalpdf_solicitudes (remitente_correo, creada_en desc);
create index if not exists pascalpdf_solicitudes_limpieza_idx on public.pascalpdf_solicitudes (archivos_borrados, vence_en);

create table if not exists public.pascalpdf_codigos (
  correo text not null,
  creado_en timestamptz not null default now(),
  codigo_hash text not null,
  vence_en timestamptz not null,
  intentos int not null default 0,
  primary key (correo, creado_en)
);

alter table public.pascalpdf_solicitudes enable row level security;
alter table public.pascalpdf_codigos enable row level security;
revoke all on public.pascalpdf_solicitudes from anon, authenticated;
revoke all on public.pascalpdf_codigos from anon, authenticated;

-- Bucket privado para los documentos cifrados (máx. 25 MB por archivo)
insert into storage.buckets (id, name, public, file_size_limit)
values ('pascalpdf-sobres', 'pascalpdf-sobres', false, 26214400)
on conflict (id) do nothing;

-- Los códigos viejos no sirven para nada: se borran cada día
-- (requiere la extensión pg_cron, prevista para CuentaFacil)
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('pascalpdf-codigos-viejos', '17 4 * * *',
      $q$delete from public.pascalpdf_codigos where creado_en < now() - interval '2 days'$q$);
  end if;
end $$;
