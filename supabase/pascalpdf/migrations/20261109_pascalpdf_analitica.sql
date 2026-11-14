-- Analítica propia de Pascal Sign y PascalPDF: visitas anónimas (solo con el permiso de «Analítica» del banner de cookies),
-- origen de cada cuenta nueva (utm de la primera visita) y el embudo para la página de administración.
-- Sin IP, sin correo, sin huella del navegador: el visitante es un identificador aleatorio que guarda su propio navegador.
-- RLS activa y sin políticas: solo la Edge Function pascalpdf-firma (service role) lee y escribe.

create table if not exists public.pascalpdf_visitas (
  id bigint generated always as identity primary key,
  creado_en timestamptz not null default now(),
  visitante text not null check (visitante ~ '^[A-Za-z0-9_-]{8,40}$'),
  evento text not null check (evento in ('visita', 'cta')),
  pagina text not null check (char_length(pagina) between 1 and 120),
  etiqueta text check (char_length(etiqueta) <= 40),            -- qué botón, en los eventos «cta»
  fuente text check (char_length(fuente) <= 60),                -- utm_source (o el sitio de donde vino)
  medio text check (char_length(medio) <= 60),                  -- utm_medium
  campana text check (char_length(campana) <= 80),              -- utm_campaign
  referente text check (char_length(referente) <= 120),         -- solo el dominio de origen
  dispositivo text not null default 'otro' check (dispositivo in ('android', 'ios', 'escritorio', 'otro'))
);
alter table public.pascalpdf_visitas enable row level security;
revoke all on table public.pascalpdf_visitas from anon, authenticated;
create index if not exists pascalpdf_visitas_creado_idx on public.pascalpdf_visitas (creado_en);
create index if not exists pascalpdf_visitas_pagina_idx on public.pascalpdf_visitas (pagina, creado_en);

-- De dónde vino cada cuenta (primera visita con permiso de analítica); null si no hubo permiso
alter table public.pascalpdf_usuarios add column if not exists origen jsonb
  check (origen is null or (jsonb_typeof(origen) = 'object' and pg_column_size(origen) <= 1000));

-- Embudo del periodo [p_desde, p_hasta). p_app: 'pascalsign' o 'pascalpdf' para las firmas (null = ambas).
-- Las visitas de más de 13 meses se borran aquí mismo (retención declarada en la política de cookies).
create or replace function public.pascalpdf_admin_analitica(p_desde timestamptz, p_hasta timestamptz, p_app text default 'pascalsign')
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  r json;
begin
  delete from pascalpdf_visitas where creado_en < now() - interval '13 months';
  with
  v as (select * from pascalpdf_visitas where creado_en >= p_desde and creado_en < p_hasta),
  u as (select * from pascalpdf_usuarios where creado_en >= p_desde and creado_en < p_hasta),
  act as (select distinct e.usuario_id from pascalpdf_eventos e join u on u.id = e.usuario_id where p_app is null or e.app = p_app),
  pag as (select distinct p.usuario_id from pascalpdf_pagos p join u on u.id = p.usuario_id where p.estado = 'aprobado'),
  fuentes as (
    select coalesce(nullif(fuente, ''), 'directo') f, count(distinct visitante) visitantes,
           count(distinct visitante) filter (where pagina like '/PascalSign/%' and pagina not like '/PascalSign/contratistas%') app
    from v where evento = 'visita' group by 1
  ),
  cuentas_f as (
    select coalesce(nullif(u.origen->>'fuente', ''), case when u.origen is null then 'sin dato' else 'directo' end) f,
           count(*) cuentas, count(act.usuario_id) activadas, count(pag.usuario_id) pagaron
    from u left join act on act.usuario_id = u.id left join pag on pag.usuario_id = u.id group by 1
  ),
  dias as (
    select d::date dia,
      (select count(distinct visitante) from v where evento = 'visita' and (v.creado_en at time zone 'America/Bogota')::date = d::date) visitantes,
      (select count(*) from u where (u.creado_en at time zone 'America/Bogota')::date = d::date) cuentas
    from generate_series((p_desde at time zone 'America/Bogota')::date, ((p_hasta - interval '1 second') at time zone 'America/Bogota')::date, interval '1 day') d
  )
  select json_build_object(
    'embudo', json_build_object(
      'visitantes', (select count(distinct visitante) from v where evento = 'visita'),
      'visitas', (select count(*) from v where evento = 'visita'),
      'landing', (select count(distinct visitante) from v where evento = 'visita' and pagina like '/PascalSign/contratistas%'),
      'cta', (select count(distinct visitante) from v where evento = 'cta'),
      'app', (select count(distinct visitante) from v where evento = 'visita' and pagina like '/PascalSign/%' and pagina not like '/PascalSign/contratistas%'),
      'cuentas', (select count(*) from u),
      'cuentas_con_origen', (select count(*) from u where origen is not null),
      'activadas', (select count(*) from act),
      'pagaron', (select count(*) from pag),
      'ingresos', (select coalesce(sum(monto), 0) from pascalpdf_pagos where estado = 'aprobado' and aprobado_en >= p_desde and aprobado_en < p_hasta)
    ),
    'fuentes', (select coalesce(json_agg(json_build_object('fuente', coalesce(a.f, b.f), 'visitantes', coalesce(a.visitantes, 0), 'app', coalesce(a.app, 0),
                 'cuentas', coalesce(b.cuentas, 0), 'activadas', coalesce(b.activadas, 0), 'pagaron', coalesce(b.pagaron, 0))
                 order by coalesce(b.pagaron, 0) desc, coalesce(b.cuentas, 0) desc, coalesce(a.visitantes, 0) desc), '[]'::json)
                from fuentes a full join cuentas_f b on a.f = b.f),
    'campanas', (select coalesce(json_agg(x order by x.visitantes desc), '[]'::json) from (
                 select coalesce(campana, '—') campana, coalesce(fuente, 'directo') fuente, count(distinct visitante) visitantes
                 from v where evento = 'visita' and campana is not null group by 1, 2 order by 3 desc limit 20) x),
    'dispositivos', (select coalesce(json_object_agg(dispositivo, n), '{}'::json) from (
                 select dispositivo, count(distinct visitante) n from v where evento = 'visita' group by 1) x),
    'paginas', (select coalesce(json_agg(x order by x.visitantes desc), '[]'::json) from (
                 select pagina, count(distinct visitante) visitantes, count(*) visitas from v where evento = 'visita' group by 1 order by 2 desc limit 15) x),
    'botones', (select coalesce(json_agg(x order by x.clics desc), '[]'::json) from (
                 select pagina, coalesce(etiqueta, '—') etiqueta, count(*) clics from v where evento = 'cta' group by 1, 2 order by 3 desc limit 15) x),
    'dias', (select coalesce(json_agg(json_build_object('dia', dia, 'visitantes', visitantes, 'cuentas', cuentas) order by dia), '[]'::json) from dias)
  ) into r;
  return r;
end;
$$;
revoke all on function public.pascalpdf_admin_analitica(timestamptz, timestamptz, text) from public, anon, authenticated;
