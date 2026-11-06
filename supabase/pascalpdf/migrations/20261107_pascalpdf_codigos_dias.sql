-- Códigos de días gratis: no pasan por Wompi; se canjean en «Mi cuenta» y suman días de un plan.
alter table public.pascalpdf_promos drop constraint if exists pascalpdf_promos_tipo_check;
alter table public.pascalpdf_promos add constraint pascalpdf_promos_tipo_check check (tipo in ('porcentaje', 'valor', 'dias'));
alter table public.pascalpdf_promos add column if not exists plan text check (plan is null or plan in ('pro', 'suite'));

-- Canje atómico: valida el código, evita que la misma cuenta lo use dos veces y suma los días.
-- Si la cuenta ya tiene un plan activo de nivel igual o mayor, conserva ese plan y solo suma los días.
create or replace function public.pascalpdf_canjear_dias(p_codigo text, p_usuario uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p pascalpdf_promos;
  v_u pascalpdf_usuarios;
  v_plan text;
  v_vence timestamptz;
  nivel_actual int;
  nivel_codigo int;
begin
  select * into v_p from pascalpdf_promos where codigo = p_codigo for update;
  if not found or v_p.tipo <> 'dias' then raise exception 'codigo_invalido'; end if;
  if not v_p.activo or (v_p.vence_en is not null and v_p.vence_en < now())
     or (v_p.max_usos is not null and v_p.usos >= v_p.max_usos) then raise exception 'codigo_vencido'; end if;
  select * into v_u from pascalpdf_usuarios where id = p_usuario for update;
  if not found then raise exception 'sin_cuenta'; end if;
  begin
    insert into pascalpdf_promos_usos (codigo, usuario_id) values (p_codigo, p_usuario);
  exception when unique_violation then
    raise exception 'ya_usado';
  end;
  nivel_actual := case when v_u.vence_en > now() then (case v_u.plan when 'pro' then 1 else 2 end) else 0 end;
  nivel_codigo := case coalesce(v_p.plan, 'suite') when 'pro' then 1 else 2 end;
  v_plan := case when nivel_actual >= nivel_codigo then v_u.plan else coalesce(v_p.plan, 'suite') end;
  v_vence := greatest(now(), v_u.vence_en) + make_interval(days => v_p.valor);
  update pascalpdf_usuarios set plan = v_plan, vence_en = v_vence where id = p_usuario;
  update pascalpdf_promos set usos = usos + 1 where codigo = p_codigo;
  return json_build_object('plan', v_plan, 'vence_en', v_vence, 'dias', v_p.valor);
end;
$$;
revoke all on function public.pascalpdf_canjear_dias(text, uuid) from public, anon, authenticated;
