<script setup>
import { reactive, ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '../supabase'
import { user } from '../auth'
import { loadAll } from '../store'
import FormField from '../components/FormField.vue'
import { INSTRUCTIONS, PRESETS, todayStr, resizeImage } from '../utils'

const route = useRoute(), router = useRouter()
const id = route.params.id
const f = reactive({ name: '', pills_per_dose: 1, instruction: 'หลังอาหาร', times: [], start_date: todayStr(), end_date: '', stock: '', notes: '' })
const errors = reactive({})
const catalog = ref([]), custom = ref(''), saving = ref(false), msg = ref('')
const blob = ref(null), preview = ref(''), oldPath = ref(null)

onMounted(async () => {
  const c = await supabase.from('medicine_catalog').select('name,default_instruction').order('name')
  catalog.value = c.data || []
  if (route.query.name) onName(String(route.query.name).slice(0, 120))
  if (id) {
    const { data, error } = await supabase.from('medicines').select('*').eq('id', id).single()
    if (error) { msg.value = 'ไม่พบยานี้'; return }
    Object.assign(f, { name: data.name, pills_per_dose: data.pills_per_dose, instruction: data.instruction || 'ไม่ระบุ',
      times: [...data.times], start_date: data.start_date, end_date: data.end_date || '', stock: data.stock ?? '', notes: data.notes || '' })
    oldPath.value = data.image_path
  }
})

function onName(v) {
  f.name = v
  const hit = catalog.value.find((c) => c.name === v)
  if (hit && !id) f.instruction = INSTRUCTIONS.includes(hit.default_instruction) ? hit.default_instruction : f.instruction
}
function togglePreset(t) {
  const i = f.times.indexOf(t)
  if (i >= 0) f.times.splice(i, 1); else f.times.push(t)
  f.times.sort()
}
function addCustom() {
  if (!/^\d{2}:\d{2}$/.test(custom.value)) { errors.times = 'เลือกเวลาให้ถูกต้อง'; return }
  if (!f.times.includes(custom.value)) f.times.push(custom.value)
  f.times.sort(); custom.value = ''; delete errors.times
}
async function pick(e) {
  const file = e.target.files[0]
  if (!file) return
  if (!file.type.startsWith('image/')) { errors.photo = 'เลือกไฟล์รูปภาพเท่านั้น'; return }
  delete errors.photo
  blob.value = await resizeImage(file); preview.value = URL.createObjectURL(blob.value)
}

function validate() {
  const e = {}
  const name = f.name.trim()
  if (!name) e.name = 'กรอกชื่อยา'
  else if (name.length > 120) e.name = 'ชื่อยายาวเกิน 120 ตัวอักษร'
  const n = Number(f.pills_per_dose)
  if (!Number.isInteger(n) || n < 1 || n > 10) e.pills = 'จำนวนเม็ดต่อครั้งต้องเป็นเลข 1–10'
  if (f.instruction !== 'เมื่อมีอาการ' && !f.times.length) e.times = 'เลือกเวลาอย่างน้อย 1 เวลา'
  if (!f.start_date) e.start = 'เลือกวันที่เริ่มกิน'
  if (f.end_date && f.end_date < f.start_date) e.end = 'วันสิ้นสุดต้องไม่ก่อนวันเริ่ม'
  if (f.stock !== '' && f.stock !== null) {
    const s = Number(f.stock)
    if (!Number.isInteger(s) || s < 0 || s > 9999) e.stock = 'จำนวนยาคงเหลือต้องเป็นเลข 0–9999'
  }
  if (f.notes.length > 300) e.notes = 'หมายเหตุยาวเกิน 300 ตัวอักษร'
  Object.keys(errors).forEach((k) => { if (k !== 'photo') delete errors[k] })
  Object.assign(errors, e)
  return !Object.keys(errors).length
}

async function save() {
  msg.value = ''
  if (!validate()) { msg.value = 'กรุณาแก้ช่องที่มีข้อความสีแดง'; return }
  saving.value = true
  try {
    let image_path = oldPath.value
    if (blob.value) {
      image_path = `${user.value.id}/${crypto.randomUUID()}.jpg`
      const up = await supabase.storage.from('packets').upload(image_path, blob.value, { contentType: 'image/jpeg' })
      if (up.error) throw up.error
    }
    const n = Number(f.pills_per_dose)
    const row = {
      name: f.name.trim(), pills_per_dose: n, dose: `${n} เม็ด`, instruction: f.instruction,
      times: f.instruction === 'เมื่อมีอาการ' ? [] : [...new Set(f.times)].sort(),
      start_date: f.start_date, end_date: f.end_date || null,
      stock: f.stock === '' || f.stock === null ? null : Number(f.stock), notes: f.notes.trim(), image_path
    }
    const { error } = id ? await supabase.from('medicines').update(row).eq('id', id) : await supabase.from('medicines').insert(row)
    if (error) throw error
    if (blob.value && oldPath.value) await supabase.storage.from('packets').remove([oldPath.value])
    await loadAll()
    router.push('/meds')
  } catch (ex) { msg.value = 'บันทึกไม่สำเร็จ: ' + ex.message } finally { saving.value = false }
}
</script>

<template>
  <h1>{{ id ? 'แก้ไขยา' : 'เพิ่มยา' }}</h1>
  <form class="card" novalidate @submit.prevent="save">
    <FormField label="ชื่อยา" for-id="name" :error="errors.name" hint="พิมพ์เองหรือเลือกจากรายการแนะนำ">
      <input id="name" :value="f.name" list="cat" maxlength="130" @input="onName($event.target.value)" />
      <datalist id="cat"><option v-for="c in catalog" :key="c.name" :value="c.name" /></datalist>
    </FormField>
    <FormField label="จำนวนเม็ดต่อครั้ง" for-id="pills" :error="errors.pills">
      <input id="pills" v-model="f.pills_per_dose" type="number" min="1" max="10" />
    </FormField>
    <FormField label="กินเมื่อไรเทียบกับอาหาร" for-id="ins">
      <select id="ins" v-model="f.instruction"><option v-for="o in INSTRUCTIONS" :key="o">{{ o }}</option></select>
    </FormField>
    <FormField v-if="f.instruction !== 'เมื่อมีอาการ'" label="เวลากินยา" :error="errors.times">
      <div class="chips-pick">
        <button v-for="p in PRESETS" :key="p.t" type="button" class="alt" :class="{ on: f.times.includes(p.t) }" @click="togglePreset(p.t)">{{ p.label }} {{ p.t }}</button>
      </div>
      <div class="row" style="margin-top:.5rem">
        <input v-model="custom" type="time" aria-label="เวลาอื่น" style="width:9rem" />
        <button type="button" class="alt" @click="addCustom">+ เพิ่มเวลาอื่น</button>
      </div>
      <p v-if="f.times.length" class="muted">เลือกแล้ว: {{ f.times.join(', ') }}</p>
    </FormField>
    <div class="row">
      <FormField label="วันที่เริ่มกิน" for-id="sd" :error="errors.start"><input id="sd" v-model="f.start_date" type="date" /></FormField>
      <FormField label="วันสุดท้าย (ไม่ใส่ = กินต่อเนื่อง)" for-id="ed" :error="errors.end"><input id="ed" v-model="f.end_date" type="date" /></FormField>
    </div>
    <FormField label="จำนวนยาคงเหลือ (เม็ด) ใส่หรือไม่ใส่ก็ได้" for-id="st" :error="errors.stock" hint="ระบบจะลดจำนวนเมื่อกด 'กินแล้ว' และเตือนเมื่อเหลือไม่เกิน 3 วัน">
      <input id="st" v-model="f.stock" type="number" min="0" max="9999" />
    </FormField>
    <FormField label="หมายเหตุ" for-id="nt" :error="errors.notes"><input id="nt" v-model="f.notes" maxlength="300" /></FormField>
    <FormField label="รูปซองยา (ไม่บังคับ แสดงตอนเตือน)" for-id="ph" :error="errors.photo">
      <input id="ph" type="file" accept="image/*" @change="pick" />
      <img v-if="preview" :src="preview" alt="ตัวอย่างรูปซองยา" class="preview" style="margin-top:.5rem" />
    </FormField>
    <p v-if="msg" class="err" role="alert">{{ msg }}</p>
    <div class="row" style="margin-top:1rem">
      <button type="submit" :disabled="saving">{{ saving ? 'กำลังบันทึก…' : 'บันทึก' }}</button>
      <router-link class="btn alt" to="/meds">ยกเลิก</router-link>
    </div>
  </form>
</template>
