export const INSTRUCTIONS = ['หลังอาหาร', 'ก่อนอาหาร', 'พร้อมอาหาร', 'ก่อนนอน', 'เมื่อมีอาการ', 'ไม่ระบุ']
export const PRESETS = [
  { label: 'เช้า', t: '08:00' }, { label: 'กลางวัน', t: '12:00' },
  { label: 'เย็น', t: '18:00' }, { label: 'ก่อนนอน', t: '21:00' }
]
export const DAY_TH = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']
const p2 = (n) => String(n).padStart(2, '0')

export const todayStr = (d = new Date()) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
export const nowHM = (d = new Date()) => `${p2(d.getHours())}:${p2(d.getMinutes())}`
export const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
export function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x }

// จำนวนวันที่ยาเหลือพอกิน (null = ไม่ได้ใส่จำนวนยาคงเหลือ)
export function daysLeft(m) {
  if (m.stock == null || !m.times.length) return null
  const perDay = m.pills_per_dose * m.times.length
  return perDay ? Math.floor(m.stock / perDay) : null
}

export function resizeImage(file, max = 1024) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s)
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('แปลงรูปไม่สำเร็จ'))), 'image/jpeg', 0.85)
    }
    img.onerror = () => reject(new Error('เปิดไฟล์รูปไม่ได้'))
    img.src = url
  })
}

// ไฟล์ปฏิทิน .ics เตือนซ้ำทุกวัน ใช้ได้แม้ปิดเว็บ
export function buildICS(meds) {
  const esc = (s = '') => String(s).replace(/\\/g, '\\\\').replace(/[,;]/g, (m) => '\\' + m).replace(/\r?\n/g, '\\n')
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const out = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MedReminder//TH//EN', 'CALSCALE:GREGORIAN']
  for (const m of meds) {
    const start = (m.start_date || todayStr()).replace(/-/g, '')
    const until = m.end_date ? `;UNTIL=${m.end_date.replace(/-/g, '')}T235959` : ''
    for (const t of m.times) {
      const title = `กินยา ${m.name} ${m.pills_per_dose} เม็ด${m.instruction && m.instruction !== 'ไม่ระบุ' ? ' (' + m.instruction + ')' : ''}`
      out.push('BEGIN:VEVENT', `UID:${m.id}-${t.replace(':', '')}@medreminder`, `DTSTAMP:${stamp}`,
        `DTSTART:${start}T${t.replace(':', '')}00`, 'DURATION:PT10M', `RRULE:FREQ=DAILY${until}`,
        `SUMMARY:${esc(title)}`, 'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:PT0M', `DESCRIPTION:${esc(title)}`, 'END:VALARM', 'END:VEVENT')
    }
  }
  out.push('END:VCALENDAR')
  return out.join('\r\n')
}

export function downloadText(filename, text, type = 'text/calendar') {
  const url = URL.createObjectURL(new Blob([text], { type: type + ';charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    ;[0, 0.35, 0.7].forEach((t) => {
      const o = ctx.createOscillator(), g = ctx.createGain()
      o.frequency.value = 880; g.gain.value = 0.2
      o.connect(g).connect(ctx.destination)
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.2)
    })
  } catch { /* บางเบราว์เซอร์ไม่อนุญาตเสียง */ }
}
