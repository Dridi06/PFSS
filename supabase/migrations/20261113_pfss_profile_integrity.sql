-- PFSS profile identity integrity.

begin;

create unique index if not exists pfss_profiles_username_lower_unique
on public.profiles (lower(username))
where username is not null;

alter table public.profiles
  add constraint pfss_profiles_username_format_check
  check (username is null or username ~ '^[A-Za-z0-9_.-]{3,20}$');

commit;
