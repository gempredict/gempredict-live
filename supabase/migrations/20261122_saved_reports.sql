-- Apply to each dedicated library project separately.
begin;

create table public.saved_reports (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  card_name text not null check (char_length(card_name) between 1 and 160),
  card_number text check (char_length(card_number) <= 40),
  category text not null check (char_length(category) between 1 and 24),
  analysis_revision text check (analysis_revision ~ '^[0-9a-f]{40}$'),
  model text not null check (char_length(model) between 1 and 48),
  model_version text check (model_version ~ '^[a-zA-Z0-9._-]{1,80}$'),
  schema_version integer not null check (schema_version > 0),
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 262144),
  search_text text generated always as (card_name || ' ' || coalesce(card_number, '')) stored,
  unique (owner_id, scan_id)
);
create index saved_reports_owner_date_idx on public.saved_reports (owner_id, created_at desc, id desc);

alter table public.saved_reports enable row level security;
alter table public.saved_reports force row level security;
revoke all on public.saved_reports from public, anon, authenticated, service_role;
grant select, delete on public.saved_reports to authenticated;
-- The service role can invoke only the insertion RPC. The RPC itself runs
-- as a non-login, non-bypass role, so writes also pass through RLS.
create role gempredict_saved_report_writer nologin nobypassrls;
grant gempredict_saved_report_writer to postgres;
grant usage, create on schema public to gempredict_saved_report_writer;
grant select, insert on public.saved_reports to gempredict_saved_report_writer;
create policy saved_report_writer_read on public.saved_reports for select to gempredict_saved_report_writer
  using (owner_id::text = current_setting('gempredict.library_owner', true));
create policy saved_report_writer_insert on public.saved_reports for insert to gempredict_saved_report_writer
  with check (owner_id::text = current_setting('gempredict.library_owner', true));

create function public.store_completed_saved_report(
  report_owner uuid, report_scan uuid, report_card_name text, report_card_number text,
  report_category text, report_model text, report_revision text, report_model_version text, report_version integer,
  report_payload jsonb
) returns void
language plpgsql security definer
set search_path = ''
as $function$
begin
  perform pg_catalog.set_config('gempredict.library_owner', report_owner::text, true);
  insert into public.saved_reports
    (owner_id, scan_id, card_name, card_number, category, model, model_version, analysis_revision, schema_version, payload)
  values
    (report_owner, report_scan, report_card_name, report_card_number, report_category, report_model,
     report_model_version, report_revision, report_version, report_payload)
  on conflict (owner_id, scan_id) do nothing;
end;
$function$;
alter function public.store_completed_saved_report(uuid,uuid,text,text,text,text,text,text,integer,jsonb)
  owner to gempredict_saved_report_writer;
revoke create on schema public from gempredict_saved_report_writer;
revoke all on function public.store_completed_saved_report(uuid,uuid,text,text,text,text,text,text,integer,jsonb)
  from public, anon, authenticated;
grant execute on function public.store_completed_saved_report(uuid,uuid,text,text,text,text,text,text,integer,jsonb)
  to service_role;
create policy saved_report_owner_read on public.saved_reports for select to authenticated
  using (owner_id = (select auth.uid()));
create policy saved_report_owner_delete on public.saved_reports for delete to authenticated
  using (owner_id = (select auth.uid()));

commit;
