<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { supabase } from '../supabase'
import { isAdmin } from '../auth'
import FormField from '../components/FormField.vue'
import { INSTRUCTIONS } from '../utils'

const items = ref([]), q = ref(''), err = ref(''), loading = ref(true)
const form = reactive({ id: null, name: '', category: '', default_instruction: 'ไม่ระบุ', note: '' })
const ferr = reactive({})
const list = computed(() => items.value.filter((i) => (i.name + ' ' + (i.category || '')).toLowerCase().includes(q.value.trim().toLowerCase())))

async function load() {
  const { data, error } = await supabase.from('medicine_catalog').select('*').order('name')
  if (error) err.value = 'โหลดรายการไม่สำเร็จ'
  else items.value = data
  loading.value = false
}
function edit(i) { Object.assign(form, { id: i.id, name: i.name, category: i.category || '', default_instruction: i.default_instruction || 'ไม่ระบุ', note: i.note || '' }) }
function reset() { Object.assign(form, { id: null, name: '', category: '', default_instruction: 'ไม่ระบุ', note: '' }); Object.keys(ferr).forEach((k) => delete ferr[k]) }
async function save() {
  Object.keys(ferr).forEach((k) => delete ferr[k])
  if (!form.name.trim()) ferr.name = 'กรอกชื่อยา'
  if (form.name.length > 120) ferr.name = 'ชื่อยาเกิน 120 ตัวอักษร'
  if (form.note.length > 300) ferr.note = 'หมายเหตุเกิน 300 ตัวอักษร'
  if (Object.keys(ferr).length) return
  const row = { name: form.name.trim(), category: form.category.trim() || null, default_instruction: form.default_instruction, note: form.note.trim() || null }
  const { error } = form.id ? await supabase.from('medicine_catalog').update(row).eq('id', form.id) : await supabase.from('medicine_catalog').insert(row)
  if (error) { err.value = error.message.includes('duplicate') ? 'มีชื่อยานี้แล้ว' : error.message; return }
  err.value = ''; reset(); await load()
}
async function del(i) {
  if (!confirm(`ลบ "${i.name}" ออกจากรายการ?`)) return
  const { error } = await supabase.from('medicine_catalog').delete().eq('id', i.id)
  if (error) err.value = error.message; else await load()
}
onMounted(load)
</script>

<template>
  <h1>รายการยาแนะนำ</h1>
  <p class="muted">รายการนี้ช่วยกรอกชื่อยาและวิธีกินเบื้องต้นเท่านั้น วิธีกินจริงให้ยึดตามที่แพทย์หรือเภสัชกรสั่ง</p>
  <label for="q">ค้นหา</label>
  <input id="q" v-model="q" maxlength="60" placeholder="ชื่อยาหรือหมวด" />
  <p v-if="err" class="err" role="alert">{{ err }}</p>
  <p v-if="loading">กำลังโหลด…</p>
  <p v-else-if="!list.length" class="muted" style="margin-top:1rem">ไม่พบรายการ</p>
  <div v-for="i in list" :key="i.id" class="card">
    <strong>{{ i.name }}</strong> <span v-if="i.category" class="badge">{{ i.category }}</span>
    <div class="muted">วิธีกินที่พบบ่อย: {{ i.default_instruction || 'ไม่ระบุ' }}</div>
    <div v-if="i.note" class="muted">{{ i.note }}</div>
    <div class="row" style="margin-top:.5rem">
      <router-link class="btn alt" :to="{ path: '/meds/new', query: { name: i.name } }">เพิ่มลงยาของฉัน</router-link>
      <template v-if="isAdmin">
        <button class="alt" @click="edit(i)">แก้ไข</button>
        <button class="warn" @click="del(i)">ลบ</button>
      </template>
    </div>
  </div>

  <form v-if="isAdmin" class="card" novalidate @submit.prevent="save">
    <h2>{{ form.id ? 'แก้ไขรายการ' : 'เพิ่มรายการ (แอดมิน)' }}</h2>
    <FormField label="ชื่อยา" for-id="cn" :error="ferr.name"><input id="cn" v-model="form.name" maxlength="130" /></FormField>
    <FormField label="หมวด" for-id="cc"><input id="cc" v-model="form.category" maxlength="60" /></FormField>
    <FormField label="วิธีกินที่พบบ่อย" for-id="ci"><select id="ci" v-model="form.default_instruction"><option v-for="o in INSTRUCTIONS" :key="o">{{ o }}</option></select></FormField>
    <FormField label="หมายเหตุ" for-id="cnote" :error="ferr.note"><input id="cnote" v-model="form.note" maxlength="300" /></FormField>
    <div class="row"><button type="submit">บันทึก</button><button v-if="form.id" type="button" class="alt" @click="reset">ยกเลิกแก้ไข</button></div>
  </form>
</template>
