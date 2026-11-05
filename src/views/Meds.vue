<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../supabase'
import { state, loadAll } from '../store'
import MedCard from '../components/MedCard.vue'
import { buildICS, downloadText } from '../utils'

const router = useRouter()
const q = ref(''), showPaused = ref(true), err = ref('')
const list = computed(() => state.meds.filter((m) =>
  (showPaused.value || m.active) && m.name.toLowerCase().includes(q.value.trim().toLowerCase())))

async function remove(m) {
  if (!confirm(`ลบ "${m.name}" และประวัติการกินของยานี้?`)) return
  const { error } = await supabase.from('medicines').delete().eq('id', m.id)
  if (error) { err.value = error.message; return }
  const shared = state.meds.some((x) => x.id !== m.id && x.image_path === m.image_path)
  if (m.image_path && !shared) await supabase.storage.from('packets').remove([m.image_path])
  await loadAll()
}
async function toggleActive(m) {
  const { error } = await supabase.from('medicines').update({ active: !m.active }).eq('id', m.id)
  if (error) err.value = error.message
  else await loadAll()
}
const exportICS = () => downloadText('medicine-reminder.ics', buildICS(state.meds.filter((m) => m.active && m.times.length)))
</script>

<template>
  <h1>ยาของฉัน</h1>
  <div class="row" style="margin-bottom:1rem">
    <router-link class="btn" to="/meds/new">+ เพิ่มยา</router-link>
    <button class="alt" @click="exportICS">ส่งออกปฏิทิน (.ics)</button>
  </div>
  <label for="q">ค้นหาชื่อยา</label>
  <input id="q" v-model="q" maxlength="60" placeholder="พิมพ์ชื่อยา" />
  <label style="display:flex;gap:.5rem;align-items:center"><input v-model="showPaused" type="checkbox" style="width:auto" /> แสดงยาที่หยุดชั่วคราว</label>
  <p v-if="err" class="err" role="alert">{{ err }}</p>
  <p v-if="!list.length" class="muted" style="margin-top:1rem">ไม่พบรายการยา</p>
  <MedCard v-for="m in list" :key="m.id" :med="m" :url="state.urls[m.image_path]"
    @edit="router.push(`/meds/${m.id}/edit`)" @remove="remove" @toggle-active="toggleActive" />
</template>
