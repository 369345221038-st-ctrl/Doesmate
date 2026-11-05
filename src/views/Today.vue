<script setup>
import { computed, ref } from 'vue'
import { state, clock, todayDoses, reminder, enableReminder, disableReminder, toggleDose } from '../store'
import DoseRow from '../components/DoseRow.vue'
import StatCard from '../components/StatCard.vue'
import { nowHM, toMin, daysLeft, buildICS, downloadText, todayStr } from '../utils'

const err = ref('')
const hm = computed(() => nowHM(clock.value))
const nextKey = computed(() => todayDoses.value.find((d) => !d.taken && toMin(d.time) >= toMin(hm.value))?.key)
function statusOf(d) {
  if (d.taken) return 'taken'
  if (toMin(hm.value) - toMin(d.time) > 30) return 'missed'
  return d.key === nextKey.value ? 'next' : 'upcoming'
}
const takenCount = computed(() => todayDoses.value.filter((d) => d.taken).length)
const missed = computed(() => todayDoses.value.filter((d) => statusOf(d) === 'missed').length)
const asNeeded = computed(() => state.meds.filter((m) => m.active && !m.times.length))
const low = computed(() => state.meds.filter((m) => m.active && daysLeft(m) !== null && daysLeft(m) <= 3))
async function onToggle(d) { err.value = ''; try { await toggleDose(d) } catch (e) { err.value = e.message } }
const exportICS = () => downloadText('medicine-reminder.ics', buildICS(state.meds.filter((m) => m.active && m.times.length)))
</script>

<template>
  <h1>ตารางยาวันนี้</h1>
  <p class="muted">วันที่ {{ todayStr(clock) }} · เวลา {{ hm }} · ข้อมูลอัปเดตอัตโนมัติ</p>
  <p v-if="state.error" class="err" role="alert">{{ state.error }}</p>

  <div class="grid" style="margin-bottom:1rem">
    <StatCard label="กินแล้ววันนี้" :value="`${takenCount}/${todayDoses.length}`" />
    <StatCard label="เลยเวลาไม่ได้กิน" :value="missed" :tone="missed ? 'warn' : ''" />
    <StatCard label="ยาใกล้หมด" :value="low.length" :tone="low.length ? 'warn' : ''" hint="เหลือไม่เกิน 3 วัน" />
  </div>

  <div class="row" style="margin-bottom:1rem">
    <button v-if="!reminder.enabled" class="amber" @click="enableReminder">เปิดการแจ้งเตือน</button>
    <button v-else class="alt" @click="disableReminder">ปิดการแจ้งเตือน</button>
    <button class="alt" :disabled="!todayDoses.length" @click="exportICS">บันทึกลงปฏิทินมือถือ (.ics)</button>
    <router-link class="btn alt" to="/meds/new">+ เพิ่มยา</router-link>
  </div>
  <p v-if="reminder.enabled" class="notice">แจ้งเตือนเปิดอยู่ ต้องเปิดเว็บนี้ค้างไว้ ถ้าปิดเว็บให้ใช้ไฟล์ปฏิทิน (.ics)</p>
  <p v-if="err" class="err" role="alert">{{ err }}</p>

  <div v-if="low.length" class="notice" style="margin-bottom:1rem">
    ยาใกล้หมด: {{ low.map((m) => m.name).join(', ') }} ควรไปรับยาเพิ่ม
  </div>

  <p v-if="!state.loaded">กำลังโหลด…</p>
  <div v-else-if="!state.meds.length" class="card">
    <h2>ยังไม่มียาในตาราง</h2>
    <p>เพิ่มยาตัวแรก ระบบจะสร้างตารางและเตือนตามเวลาที่ตั้ง</p>
    <router-link class="btn" to="/meds/new">เพิ่มยา</router-link>
  </div>
  <template v-else>
    <p v-if="!todayDoses.length" class="muted">วันนี้ไม่มียาที่ต้องกินตามเวลา</p>
    <DoseRow v-for="d in todayDoses" :key="d.key" :dose="d" :status="statusOf(d)" :url="state.urls[d.med.image_path]" @toggle="onToggle" />
    <div v-if="asNeeded.length" class="card">
      <h2>กินเมื่อมีอาการ</h2>
      <p v-for="m in asNeeded" :key="m.id">{{ m.name }} <span class="muted">{{ m.pills_per_dose }} เม็ด</span></p>
    </div>
  </template>
</template>
