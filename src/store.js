// สถานะกลางที่แชร์ทุกหน้า: ยา, บันทึกการกิน, นาฬิกา, ระบบเตือน
import { reactive, ref, computed } from 'vue'
import { supabase } from './supabase'
import { user } from './auth'
import { todayStr, nowHM, addDays, toMin, beep } from './utils'

export const state = reactive({ meds: [], logs: [], urls: {}, loaded: false, error: '' })
export const clock = ref(new Date())
export const reminder = reactive({ enabled: false, ringing: null })
try { reminder.enabled = localStorage.getItem('reminder_on') === '1' } catch { /* ไม่มี storage */ }

export async function loadAll() {
  if (!user.value) return
  state.error = ''
  const since = todayStr(addDays(new Date(), -13))
  const [m, l] = await Promise.all([
    supabase.from('medicines').select('*').order('created_at'),
    supabase.from('dose_logs').select('id,medicine_id,dose_date,dose_time').gte('dose_date', since)
  ])
  if (m.error || l.error) { state.error = 'โหลดข้อมูลไม่สำเร็จ: ' + (m.error || l.error).message; return }
  state.meds = m.data; state.logs = l.data; state.loaded = true
  const need = [...new Set(m.data.map((x) => x.image_path).filter((p) => p && !state.urls[p]))]
  if (need.length) {
    const s = await supabase.storage.from('packets').createSignedUrls(need, 21600)
    for (const x of s.data || []) if (x.signedUrl) state.urls[x.path] = x.signedUrl
  }
}

let channel = null, debounce = null
export function subscribe() {
  if (channel || !user.value) return
  const later = () => { clearTimeout(debounce); debounce = setTimeout(loadAll, 300) }
  channel = supabase.channel('rt-' + user.value.id)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'dose_logs' }, later)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'medicines' }, later)
    .subscribe()
}
export function unsubscribe() {
  if (channel) supabase.removeChannel(channel)
  channel = null
  state.meds = []; state.logs = []; state.loaded = false; reminder.ringing = null
}

export function dosesFor(dateStr, untilNow = false) {
  const today = todayStr(clock.value), hm = nowHM(clock.value)
  return state.meds
    .filter((m) => m.active && m.start_date <= dateStr && (!m.end_date || m.end_date >= dateStr))
    .flatMap((m) => m.times.map((t) => ({ key: `${m.id}|${t}`, date: dateStr, med: m, time: t })))
    .filter((d) => !untilNow || dateStr < today || (dateStr === today && d.time <= hm))
    .map((d) => ({ ...d, taken: state.logs.some((l) => l.medicine_id === d.med.id && l.dose_date === d.date && l.dose_time.slice(0, 5) === d.time) }))
    .sort((a, b) => a.time.localeCompare(b.time))
}
export const todayDoses = computed(() => dosesFor(todayStr(clock.value)))

export async function toggleDose(d) {
  const q = d.taken
    ? supabase.from('dose_logs').delete().eq('medicine_id', d.med.id).eq('dose_date', d.date).eq('dose_time', d.time)
    : supabase.from('dose_logs').insert({ medicine_id: d.med.id, dose_date: d.date, dose_time: d.time })
  const { error } = await q
  if (error) throw error
  await loadAll()
}

// ---- ระบบเตือน ----
const fired = new Set(), snoozed = new Map()

export async function enableReminder() {
  if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission()
  reminder.enabled = true
  try { localStorage.setItem('reminder_on', '1') } catch { /* ignore */ }
  beep()
}
export function disableReminder() {
  reminder.enabled = false
  try { localStorage.setItem('reminder_on', '0') } catch { /* ignore */ }
}
function ring(d) {
  reminder.ringing = d
  beep()
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(`ถึงเวลากินยา ${d.med.name}`, { body: `${d.med.pills_per_dose} เม็ด ${d.med.instruction || ''}`.trim() })
  }
}
export function tick() {
  clock.value = new Date()
  if (!reminder.enabled || !user.value || reminder.ringing) return
  const hm = nowHM(clock.value)
  for (const d of todayDoses.value) {
    if (d.taken) continue
    const id = d.date + d.key
    if (snoozed.has(id)) {
      if (Date.now() >= snoozed.get(id)) { snoozed.delete(id); ring(d); return }
      continue
    }
    if (d.time === hm && !fired.has(id)) { fired.add(id); ring(d); return }
  }
}
export function snoozeRinging(min = 5) {
  const d = reminder.ringing
  if (d) snoozed.set(d.date + d.key, Date.now() + min * 60000)
  reminder.ringing = null
}
export async function takeRinging() {
  const d = reminder.ringing
  reminder.ringing = null
  if (d) await toggleDose(d)
}
