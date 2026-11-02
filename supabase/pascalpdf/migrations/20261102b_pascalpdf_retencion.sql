-- PascalPDF: el registro de cada solicitud de firma se conserva 24 meses
-- (política de datos de PascalPDF v1.0, sección Conservación). Solo se borran
-- filas cuyos archivos cifrados ya se eliminaron de Storage.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('pascalpdf-retencion-24-meses', '23 4 * * *',
      $q$delete from public.pascalpdf_solicitudes where creada_en < now() - interval '24 months' and archivos_borrados$q$);
  end if;
end $$;
