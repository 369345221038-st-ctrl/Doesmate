-- สร้างบัญชีแอดมินทดสอบด้วย SQL (ทางเลือก ใช้แทนการกด Add user ใน Dashboard)
-- 1) แก้อีเมลและรหัสผ่านด้านล่างก่อนรัน  2) รันใน Supabase → SQL Editor  (รันซ้ำได้ ถ้ามีอีเมลนี้แล้วจะแค่ตั้งเป็นแอดมิน)
-- ห้ามใช้อีเมลหรือรหัสผ่านจริงของใคร และเปลี่ยนรหัสผ่านก่อนใช้งานจริงทุกครั้ง
-- หมายเหตุ: ต้องรัน schema.sql ก่อน (เพราะต้องมีตาราง profiles และทริกเกอร์สร้างโปรไฟล์)
do $$
declare
  v_email text := 'admin-test@example.com';   -- <<< แก้ตรงนี้
  v_pass  text := 'ChangeMe-123456';          -- <<< แก้ตรงนี้ (อย่างน้อย 6 ตัวอักษร)
  v_id uuid;
begin
  select id into v_id from auth.users where email = v_email;
  if v_id is null then
    v_id := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new)
    values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
      extensions.crypt(v_pass, extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_id, v_id::text,
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true), 'email', now(), now(), now());
  end if;
  insert into public.profiles (id, email) values (v_id, v_email) on conflict do nothing;
  update public.profiles set role = 'admin' where id = v_id;
end $$;
