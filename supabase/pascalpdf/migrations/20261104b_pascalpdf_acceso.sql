-- Acceso con contraseña (PBKDF2) y con Google. El código al correo queda para entrar o recuperar la contraseña.
alter table public.pascalpdf_usuarios
  add column if not exists clave_hash text check (clave_hash is null or char_length(clave_hash) <= 200),
  add column if not exists clave_fallos int not null default 0,
  add column if not exists clave_bloqueo timestamptz,
  add column if not exists google_sub text check (google_sub is null or char_length(google_sub) <= 64);
create unique index if not exists pascalpdf_usuarios_google_idx on public.pascalpdf_usuarios (google_sub) where google_sub is not null;
