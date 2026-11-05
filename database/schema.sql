-- รันทั้งไฟล์ใน Supabase → SQL Editor (รันซ้ำได้ และใช้อัปเกรดจากเวอร์ชันเก่าได้)

-- ===== ตารางหลัก =====
create table if not exists public.medicines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  dose text check (char_length(dose) <= 120),
  instruction text check (char_length(instruction) <= 60),
  notes text check (char_length(notes) <= 300),
  times text[] not null default '{}',
  image_path text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.medicines add column if not exists pills_per_dose int not null default 1 check (pills_per_dose between 1 and 10);
alter table public.medicines add column if not exists start_date date not null default current_date;
alter table public.medicines add column if not exists end_date date;
alter table public.medicines add column if not exists stock int check (stock is null or stock between 0 and 9999);

create table if not exists public.dose_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  medicine_id uuid not null references public.medicines(id) on delete cascade,
  dose_date date not null,
  dose_time time not null,
  taken_at timestamptz not null default now(),
  unique (medicine_id, dose_date, dose_time)
);

create table if not exists public.impact_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_code text not null,
  consent text,
  quote text
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.medicine_catalog (
  id bigint generated always as identity primary key,
  name text not null unique check (char_length(name) between 1 and 120),
  category text check (char_length(category) <= 60),
  default_instruction text check (char_length(default_instruction) <= 60),
  note text check (char_length(note) <= 300),
  created_at timestamptz not null default now()
);

-- ===== ฟังก์ชันและทริกเกอร์ =====
create or replace function public.is_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email) on conflict do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
insert into public.profiles (id, email) select id, email from auth.users on conflict do nothing;

-- ลด/คืนจำนวนยาคงเหลือเมื่อกด "กินแล้ว" / ยกเลิก
create or replace function public.adjust_stock() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.medicines set stock = greatest(stock - pills_per_dose, 0) where id = new.medicine_id and stock is not null;
  elsif tg_op = 'DELETE' then
    update public.medicines set stock = least(stock + pills_per_dose, 9999) where id = old.medicine_id and stock is not null;
  end if;
  return null;
end $$;
drop trigger if exists dose_logs_stock on public.dose_logs;
create trigger dose_logs_stock after insert or delete on public.dose_logs for each row execute function public.adjust_stock();

-- สถิติรวมสำหรับหน้าแอดมิน (ไม่เปิดรายการยาของผู้ใช้ให้แอดมินเห็น)
create or replace function public.admin_stats() returns json
language plpgsql security definer set search_path = public as $$
declare r json; d0 date := (now() at time zone 'Asia/Bangkok')::date;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select json_build_object(
    'users', (select count(*) from public.profiles),
    'medicines', (select count(*) from public.medicines where active),
    'logs_today', (select count(*) from public.dose_logs where dose_date = d0),
    'daily', (select coalesce(json_agg(json_build_object('d', to_char(g, 'YYYY-MM-DD'), 'n', (select count(*) from public.dose_logs where dose_date = g)) order by g), '[]'::json)
              from generate_series(d0 - 6, d0, interval '1 day') as g),
    'users_list', (select coalesce(json_agg(json_build_object('email', p.email, 'role', p.role,
        'meds', (select count(*) from public.medicines m where m.user_id = p.id and m.active),
        'logs7', (select count(*) from public.dose_logs l where l.user_id = p.id and l.dose_date >= d0 - 6)) order by p.created_at), '[]'::json)
        from public.profiles p)
  ) into r;
  return r;
end $$;
revoke all on function public.admin_stats() from public, anon;
grant execute on function public.admin_stats() to authenticated;

-- ===== RLS =====
alter table public.medicines enable row level security;
alter table public.dose_logs enable row level security;
alter table public.impact_log enable row level security;
alter table public.profiles enable row level security;
alter table public.medicine_catalog enable row level security;

drop policy if exists "own medicines" on public.medicines;
create policy "own medicines" on public.medicines for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "own dose logs" on public.dose_logs;
create policy "own dose logs" on public.dose_logs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
-- profiles ไม่มี policy แก้ไข: ผู้ใช้เปลี่ยนบทบาทตัวเองไม่ได้

drop policy if exists "public read catalog" on public.medicine_catalog;
create policy "public read catalog" on public.medicine_catalog for select to anon, authenticated using (true);
drop policy if exists "admin write catalog" on public.medicine_catalog;
create policy "admin write catalog" on public.medicine_catalog for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "public read impact" on public.impact_log;
create policy "public read impact" on public.impact_log for select to anon, authenticated using (true);
drop policy if exists "admin write impact" on public.impact_log;
create policy "admin write impact" on public.impact_log for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ===== ที่เก็บรูปซองยา (private) =====
insert into storage.buckets (id, name, public) values ('packets', 'packets', false) on conflict (id) do nothing;
drop policy if exists "packets read own" on storage.objects;
create policy "packets read own" on storage.objects for select to authenticated
  using (bucket_id = 'packets' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "packets insert own" on storage.objects;
create policy "packets insert own" on storage.objects for insert to authenticated
  with check (bucket_id = 'packets' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "packets delete own" on storage.objects;
create policy "packets delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'packets' and (storage.foldername(name))[1] = auth.uid()::text);

-- ===== Realtime =====
do $$ begin
  begin alter publication supabase_realtime add table public.dose_logs; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.medicines; exception when duplicate_object then null; end;
end $$;

-- ===== รายการยาแนะนำเริ่มต้น (ข้อมูลทั่วไป ไม่ใช่ข้อมูลผู้ใช้) =====
insert into public.medicine_catalog (name, category, default_instruction, note) values
  ('Paracetamol 500 mg', 'แก้ปวด ลดไข้', 'เมื่อมีอาการ', 'ตามที่แพทย์หรือเภสัชกรสั่งเท่านั้น'),
  ('Ibuprofen 400 mg', 'แก้ปวด ลดอักเสบ', 'หลังอาหาร', 'ตามที่แพทย์หรือเภสัชกรสั่งเท่านั้น'),
  ('Omeprazole 20 mg', 'ยาลดกรด', 'ก่อนอาหาร', 'ตามที่แพทย์หรือเภสัชกรสั่งเท่านั้น'),
  ('Metformin 500 mg', 'เบาหวาน', 'พร้อมอาหาร', 'ตามที่แพทย์สั่งเท่านั้น'),
  ('Amlodipine 5 mg', 'ความดันโลหิต', 'ไม่ระบุ', 'ตามที่แพทย์สั่งเท่านั้น'),
  ('Simvastatin 20 mg', 'ไขมันในเลือด', 'ก่อนนอน', 'ตามที่แพทย์สั่งเท่านั้น'),
  ('Cetirizine 10 mg', 'แพ้ ภูมิแพ้', 'ก่อนนอน', 'อาจทำให้ง่วง ตามที่แพทย์หรือเภสัชกรสั่ง'),
  ('Vitamin B complex', 'วิตามิน', 'หลังอาหาร', 'ตามที่แพทย์หรือเภสัชกรสั่งเท่านั้น')
on conflict (name) do nothing;

-- ไม่มีข้อมูลตัวอย่างใน impact_log โดยตั้งใจ ต้องเป็นผู้ใช้จริงที่ขออนุญาตแล้วเท่านั้น

-- ===== ตั้งผู้ดูแล (ทำหลังสร้างบัญชีแอดมินแล้ว แก้อีเมลก่อนรัน) =====
-- update public.profiles set role = 'admin' where email = 'admin-test@example.com';
