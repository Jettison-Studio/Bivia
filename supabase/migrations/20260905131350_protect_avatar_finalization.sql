-- Storage performs permission checking and finalization in different transactions. RLS alone
-- cannot hold an account deletion lock through the entire upload. Route new writes through
-- the avatar-upload Edge Function, which holds the shared lock until Storage finishes.
drop policy avatar_own_insert on storage.objects;
drop policy avatar_own_update on storage.objects;
-- Own-folder SELECT and DELETE remain for viewing/listing and safe physical object cleanup.
