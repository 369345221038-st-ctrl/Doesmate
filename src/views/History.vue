<script setup>
import { computed } from 'vue'
import { state, clock, dosesFor } from '../store'
import StatCard from '../components/StatCard.vue'
import { todayStr, addDays, DAY_TH, daysLeft } from '../utils'

const days = computed(() => Array.from({ length: 7 }, (_, i) => {
  const dt = addDays(clock.value, i - 6)
  const doses = dosesFor(todayStr(dt), true)
  const taken = doses.filter((d) => d.taken).length
  return { date: todayStr(dt), label: DAY_TH[dt.getDay()], doses, expected: doses.length, taken, pct: doses.length ? Math.round((taken * 100) / doses.length) : null }
}))
const total = computed(() => {
  const e = days.value.reduce((s, d) => s + d.expected, 0), t = days.value.reduce((s, d) => s + d.taken, 0)
  return { e, t, pct: e ? Math.round((t * 100) / e) : 0 }
})
const perfect = computed(() => days.value.filter((d) => d.expected && d.taken === d.expected).length)
const perMed = computed(() => state.meds.map((m) => {
  const ds = days.value.flatMap((d) => d.doses).filter((d) => d.med.id === m.id)
  const t = ds.filter((d) => d.taken).length
  return { m, e: ds.length, t, pct: ds.length ? Math.round((t * 100) / ds.length) : null, left: daysLeft(m) }
}))
const tone = (p) => (p === null ? 'none' : p < 50 ? 'low' : p < 80 ? 'mid' : '')
</script>

<template>
  <h1>ประวัติการกินยา 7 วัน</h1>
  <div class="grid" style="margin-bottom:1rem">
    <StatCard label="กินตรงตามแผน" :value="total.pct + '%'" :hint="`${total.t} จาก ${total.e} มื้อ`" :tone="total.e && total.pct < 50 ? 'warn' : ''" />
    <StatCard label="วันที่กินครบ" :value="`${perfect}/7`" />
  </div>
  <div class="card">
    <div class="bars" role="img" aria-label="กราฟเปอร์เซ็นต์การกินยาครบรายวัน">
      <div v-for="d in days" :key="d.date" class="col">
        <span>{{ d.pct === null ? '–' : d.pct + '%' }}</span>
        <div class="bar" :class="tone(d.pct)" :style="{ height: (d.pct ?? 0) + '%' }"></div>
        <span class="muted">{{ d.label }}</span>
      </div>
    </div>
  </div>
  <h2>แยกตามยา</h2>
  <div class="card scroll-x">
    <table>
      <thead><tr><th>ยา</th><th>กิน/ทั้งหมด</th><th>ตรงแผน</th><th>ยาเหลือ</th></tr></thead>
      <tbody>
        <tr v-for="r in perMed" :key="r.m.id">
          <td>{{ r.m.name }}</td><td>{{ r.t }}/{{ r.e }}</td>
          <td>{{ r.pct === null ? '–' : r.pct + '%' }}</td>
          <td :class="r.left !== null && r.left <= 3 ? 'err' : ''">{{ r.left === null ? '–' : r.left + ' วัน' }}</td>
        </tr>
        <tr v-if="!perMed.length"><td colspan="4" class="muted">ยังไม่มีข้อมูล</td></tr>
      </tbody>
    </table>
  </div>
</template>
