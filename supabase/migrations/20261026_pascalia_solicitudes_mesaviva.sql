-- MesaViva se suma a las soluciones del formulario de pascalia.lat.
alter table public.pascalia_solicitudes drop constraint pascalia_solicitudes_solucion_check;
alter table public.pascalia_solicitudes add constraint pascalia_solicitudes_solucion_check
  check (solucion in ('flota','nana_dnt','si_aps','mision_medica','cuentafacil','mesaviva','consultoria','desarrollo','capacitacion','otro'));
