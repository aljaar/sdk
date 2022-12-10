## Sign Up Response 
```json
{
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNjY3NDY5Mjk2LCJzdWIiOiJlN2QwZTdlNi1lY2FjLTQ2YTEtODAwOS1iZDRmOGI2ZTY2YjIiLCJlbWFpbCI6InJ5YW5hdW51ckBnbWFpbC5jb20iLCJwaG9uZSI6IiIsImFwcF9tZXRhZGF0YSI6eyJwcm92aWRlciI6ImVtYWlsIiwicHJvdmlkZXJzIjpbImVtYWlsIl19LCJ1c2VyX21ldGFkYXRhIjp7Im5hbWUiOiJSeWFuIEF1bnVyIFJhc3N5aWQiLCJwaG9uZSI6Iis2Mjg1NzU1NTA0OTkwIn0sInJvbGUiOiJhdXRoZW50aWNhdGVkIiwic2Vzc2lvbl9pZCI6IjBlOWQwODIzLWRhZWUtNDIzMy1iYjcyLWUwYjE0ZjY5OTkzMCJ9.MJop8Kz9etDpeq2s6Q9vrUzy3XKHKziIHASEybnibg8",
    "token_type": "bearer",
    "expires_in": 3600,
    "refresh_token": "qNVH8P3CmraxsYf11A1HVQ",
    "user": {
        "id": "e7d0e7e6-ecac-46a1-8009-bd4f8b6e66b2",
        "aud": "authenticated",
        "role": "authenticated",
        "email": "ryanaunur@gmail.com",
        "email_confirmed_at": "2022-11-03T08:54:56.903877634Z",
        "phone": "",
        "last_sign_in_at": "2022-11-03T08:54:56.907658274Z",
        "app_metadata": {
            "provider": "email",
            "providers": [
                "email"
            ]
        },
        "user_metadata": {
            "name": "Ryan Aunur Rassyid",
            "phone": "+6285755504990"
        },
        "identities": [
            {
                "id": "e7d0e7e6-ecac-46a1-8009-bd4f8b6e66b2",
                "user_id": "e7d0e7e6-ecac-46a1-8009-bd4f8b6e66b2",
                "identity_data": {
                    "sub": "e7d0e7e6-ecac-46a1-8009-bd4f8b6e66b2"
                },
                "provider": "email",
                "last_sign_in_at": "2022-11-03T08:54:56.901119508Z",
                "created_at": "2022-11-03T08:54:56.901207Z",
                "updated_at": "2022-11-03T08:54:56.901213Z"
            }
        ],
        "created_at": "2022-11-03T08:54:56.893295Z",
        "updated_at": "2022-11-03T08:54:56.915217Z"
    },
    "expires_at": 1667469297
}
```

```sql

insert into storage.buckets (id, name, public)
  values ('avatars', 'avatars', true);
  
create policy "Avatar images are publicly accessible." on storage.objects
  for select using (bucket_id = 'avatars');

create policy "Anyone can upload an avatar." on storage.objects
  for insert with check (bucket_id = 'avatars');

create policy "Anyone can update their own avatar." on storage.objects
  for update using (auth.uid() = owner) with check (bucket_id = 'avatars');



insert into storage.buckets (id, name, public)
  values ('products', 'products', true);

create policy "Products images are publicly accessible." on storage.objects
  for select using (bucket_id = 'products');

create policy "Anyone can upload an product." on storage.objects
  for insert to authenticated with check (bucket_id = 'products');

create policy "Anyone can update their own product." on storage.objects
  for update using (auth.uid() = owner) with check (bucket_id = 'products');

create policy "Allow individual insert access" on public.messages for insert with check ( auth.uid() = user_id );
-- Clear Data

DELETE FROM storage.objects WHERE bucket_id = 'products';

DELETE FROM storage.buckets WHERE id = 'products';

-- Handle New User

create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (user_id, avatar_url, full_name, phone)
  values (new.id, new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'phone');
  return new;
end;
$$ language plpgsql security definer;

ST_SetSRID(ST_MakePoint(location->'long'::double precision, location->'lat'::double precision), 4326)
```