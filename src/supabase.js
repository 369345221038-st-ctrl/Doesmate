import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_KEY
export const configured = Boolean(url && key)
// ถ้ายังไม่ตั้งค่า .env.local จะไม่ให้แอปล่มทั้งหน้า แต่จะแจ้งเตือนบนหน้าจอแทน
export const supabase = createClient(url || 'https://example.supabase.co', key || 'missing-key')
