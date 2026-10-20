-- An expired document cannot be marked as verified.
create or replace function public.admin_review_document(p_doc uuid, p_status public.document_status, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not app_private.is_platform_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  if p_status = 'verified' and exists (select 1 from public.professional_documents
       where id = p_doc and expires_on is not null and expires_on < current_date) then
    raise exception 'This document is expired and cannot be verified' using errcode = '22023';
  end if;
  update public.professional_documents
     set status = p_status, review_note = p_note, reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_doc;
end $$;
