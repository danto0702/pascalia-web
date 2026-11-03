-- Consecutivo de cada firma registrada: iniciales-número-año (DTB-0001-2026), por cuenta y año.
alter table public.pascalpdf_eventos
  add column if not exists anio int check (anio is null or anio between 2000 and 2999),
  add column if not exists numero int check (numero is null or numero > 0),
  add column if not exists consecutivo text check (char_length(consecutivo) <= 40);
create unique index if not exists pascalpdf_eventos_consecutivo_idx
  on public.pascalpdf_eventos (usuario_id, anio, numero) where numero is not null;
