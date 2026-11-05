<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { supabase } from '../supabase'
import { user } from '../auth'
import StatCard from '../components/StatCard.vue'
import FormField from '../components/FormField.vue'
import { INSTRUCTIONS } from '../utils'

const tab = ref('overview'), err = ref(''), ok = ref('')
let timer

function fail(msg) { ok.value = ''; err.value = msg }
function done(msg) { err.value = ''; ok.value = msg; setTimeout(() => { if (ok.value === msg) ok.value = '' }, 4000) }

// ===== ภาพรวมระบบ =====
const stats = ref(null), updated = ref('')
async function loadStats() {
  const { data, error } = await supabase.rpc('admin_stats')
  if (error) { fail('โหลดสถิติไม่สำเร็จ: ' + error.message); return }
  err.value = ''; stats.value = data; updated.value = new Date().toLocaleTimeString('th-TH')
}
const maxBar = computed(() => Math.max(1, ...(stats.value?.daily || []).map((x) => x.n)))

// ===== จัดการผู้ใช้ =====
const users = ref([]), uq = ref('')
const userList = computed(() => users.value.filter((u) => (u.email || '').toLowerCase().includes(uq.value.trim().toLowerCase())))
async function loadUsers() {
  const { data, error } = await supabase.rpc('admin_users')
  if (error) { fail('โหลดรายชื่อผู้ใช้ไม่สำเร็จ: ' + error.message); return }
  users.value = data || []
}
async function toggleRole(u) {
  const next = u.role === 'admin' ? 'user' : 'admin'
  const label = next === 'admin' ? 'ให้เป็นแอดมิน' : 'ลดเป็นผู้ใช้ทั่วไป'
  if (!confirm(`${label}: ${u.email} ?`)) return
  const { error } = await supabase.rpc('admin_set_role', { target: u.id, new_role: next })
  if (error) { fail('เปลี่ยนบทบาทไม่สำเร็จ: ' + error.message); return }
  done(`เปลี่ยนบทบาทของ ${u.email} แล้ว`); await loadUsers()
}
async function toggleExclude(u) {
  const { error } = await supabase.rpc('admin_set_exclude', { target: u.id, val: !u.exclude_stats })
  if (error) { fail('บันทึกไม่สำเร็จ: ' + error.message); return }
  await loadUsers()
}
async function delUser(u) {
  const typed = prompt(`ลบบัญชีนี้ถาวร รวมยาและประวัติการกินทั้งหมด\nพิมพ์อีเมล "${u.email}" เพื่อยืนยัน`)
  if (typed === null) return
  if (typed.trim() !== u.email) { fail('อีเมลที่พิมพ์ไม่ตรง ยกเลิกการลบ'); return }
  const { data, error } = await supabase.rpc('admin_delete_user', { target: u.id })
  if (error) { fail('ลบผู้ใช้ไม่สำเร็จ: ' + error.message); return }
  if (Array.isArray(data) && data.length) await supabase.storage.from('packets').remove(data) // ลบรูปซองยาที่ค้าง
  done(`ลบ ${u.email} แล้ว`); await Promise.all([loadUsers(), loadStats()])
}

// ===== รายการยาแนะนำ (เพิ่ม/แก้/ลบ) =====
const items = ref([]), cq = ref('')
const emptyCat = () => ({ id: null, name: '', category: '', default_instruction: 'ไม่ระบุ', note: '' })
const cform = reactive(emptyCat()), cerr = reactive({})
const catList = computed(() => items.value.filter((i) => (i.name + ' ' + (i.category || '')).toLowerCase().includes(cq.value.trim().toLowerCase())))
async function loadCatalog() {
  const { data, error } = await supabase.from('medicine_catalog').select('*').order('name')
  if (error) { fail('โหลดรายการยาไม่สำเร็จ: ' + error.message); return }
  items.value = data
}
function editCat(i) { Object.assign(cform, { id: i.id, name: i.name, category: i.category || '', default_instruction: i.default_instruction || 'ไม่ระบุ', note: i.note || '' }); window.scrollTo({ top: 0, behavior: 'smooth' }) }
function resetCat() { Object.assign(cform, emptyCat()); Object.keys(cerr).forEach((k) => delete cerr[k]) }
async function saveCat() {
  Object.keys(cerr).forEach((k) => delete cerr[k])
  if (!cform.name.trim()) cerr.name = 'กรอกชื่อยา'
  else if (cform.name.trim().length > 120) cerr.name = 'ชื่อยาเกิน 120 ตัวอักษร'
  if (cform.category.length > 60) cerr.category = 'หมวดเกิน 60 ตัวอักษร'
  if (cform.note.length > 300) cerr.note = 'หมายเหตุเกิน 300 ตัวอักษร'
  if (Object.keys(cerr).length) return
  const row = { name: cform.name.trim(), category: cform.category.trim() || null, default_instruction: cform.default_instruction, note: cform.note.trim() || null }
  const { error } = cform.id ? await supabase.from('medicine_catalog').update(row).eq('id', cform.id) : await supabase.from('medicine_catalog').insert(row)
  if (error) { fail(error.message.includes('duplicate') ? 'มีชื่อยานี้อยู่แล้ว' : error.message); return }
  done(cform.id ? 'แก้ไขรายการแล้ว' : 'เพิ่มรายการแล้ว'); resetCat(); await loadCatalog()
}
async function delCat(i) {
  if (!confirm(`ลบ "${i.name}" ออกจากรายการแนะนำ?`)) return
  const { error } = await supabase.from('medicine_catalog').delete().eq('id', i.id)
  if (error) { fail(error.message); return }
  done('ลบรายการแล้ว'); await loadCatalog()
}

// ===== บันทึกผู้ใช้จริง (หน้า /impact) =====
const impact = ref([]), form = reactive({ user_code: '', consent: 'quote+data', quote: '' }), ferr = reactive({})
const uniqueUsers = computed(() => new Set(impact.value.map((r) => r.user_code)).size)
async function loadImpact() {
  const { data } = await supabase.from('impact_log').select('*').order('created_at', { ascending: false })
  impact.value = data || []
}
async function addImpact() {
  Object.keys(ferr).forEach((k) => delete ferr[k])
  const code = form.user_code.trim()
  if (!code) ferr.code = 'ใส่รหัสผู้ใช้ เช่น U1'
  else if (code.length > 20) ferr.code = 'ยาวเกิน 20 ตัวอักษร'
  const wantsQuote = form.consent.includes('quote')
  if (wantsQuote && !form.quote.trim()) ferr.quote = 'ผู้ใช้อนุญาตคำพูด ต้องใส่ข้อความ'
  if (form.quote.length > 300) ferr.quote = 'ยาวเกิน 300 ตัวอักษร'
  if (Object.keys(ferr).length) return
  const { error } = await supabase.from('impact_log').insert({ user_code: code, consent: form.consent, quote: wantsQuote ? form.quote.trim() : null })
  if (error) { fail(error.message); return }
  err.value = ''; form.user_code = ''; form.quote = ''; await loadImpact()
}
async function delImpact(r) {
  if (!confirm(`ลบบันทึกของ ${r.user_code}?`)) return
  await supabase.from('impact_log').delete().eq('id', r.id)
  await loadImpact()
}

onMounted(() => { loadStats(); loadUsers(); loadCatalog(); loadImpact(); timer = setInterval(loadStats, 15000) })
onUnmounted(() => clearInterval(timer))
</script>

<template>
  <h1>หลังบ้านแอดมิน</h1>
  <div class="tabs" role="tablist">
    <button :class="tab === 'overview' ? '' : 'alt'" @click="tab = 'overview'">ภาพรวมระบบ</button>
    <button :class="tab === 'users' ? '' : 'alt'" @click="tab = 'users'">ผู้ใช้ ({{ users.length }})</button>
    <button :class="tab === 'catalog' ? '' : 'alt'" @click="tab = 'catalog'">รายการยา ({{ items.length }})</button>
    <button :class="tab === 'impact' ? '' : 'alt'" @click="tab = 'impact'">บันทึกผู้ใช้จริง</button>
  </div>
  <p v-if="err" class="err" role="alert">{{ err }}</p>
  <p v-if="ok" class="ok" role="status">{{ ok }}</p>

  <!-- ภาพรวม -->
  <template v-if="tab === 'overview' && stats">
    <p class="muted">อัปเดตทุก 15 วินาที · ล่าสุด {{ updated }}</p>
    <div class="grid" style="margin-bottom:1rem">
      <StatCard label="ผู้ใช้ทั้งหมด" :value="stats.users" />
      <StatCard label="ยาที่ใช้งานอยู่" :value="stats.medicines" />
      <StatCard label="กินยาแล้ววันนี้" :value="stats.logs_today" hint="ทุกผู้ใช้รวมกัน" />
      <StatCard label="รายการยาแนะนำ" :value="items.length" />
    </div>
    <h2>จำนวนครั้งที่กินยา 7 วันล่าสุด</h2>
    <div class="card">
      <div class="bars" role="img" aria-label="กราฟจำนวนครั้งที่กินยารายวัน">
        <div v-for="d in stats.daily" :key="d.d" class="col">
          <span>{{ d.n }}</span>
          <div class="bar" :style="{ height: (d.n * 100 / maxBar) + '%' }"></div>
          <span class="muted">{{ d.d.slice(5) }}</span>
        </div>
      </div>
    </div>
    <p class="muted">เพื่อความเป็นส่วนตัว แอดมินเห็นเฉพาะตัวเลขรวม ไม่เห็นชื่อยาหรือรูปซองยาของผู้ใช้</p>
  </template>

  <!-- ผู้ใช้ -->
  <template v-if="tab === 'users'">
    <label for="uq">ค้นหาอีเมล</label>
    <input id="uq" v-model="uq" maxlength="80" placeholder="เช่น test@" />
    <div class="card scroll-x" style="margin-top:1rem">
      <table>
        <thead><tr><th>อีเมล</th><th>บทบาท</th><th>สมัครเมื่อ</th><th>ยา</th><th>กิน 7 วัน</th><th>นับในผลใช้งานจริง</th><th></th></tr></thead>
        <tbody>
          <tr v-for="u in userList" :key="u.id">
            <td>{{ u.email }} <span v-if="u.id === user?.id" class="badge next">คุณ</span></td>
            <td><span class="badge" :class="u.role === 'admin' ? 'next' : ''">{{ u.role === 'admin' ? 'แอดมิน' : 'ผู้ใช้' }}</span></td>
            <td>{{ new Date(u.created_at).toLocaleDateString('th-TH') }}</td>
            <td>{{ u.meds }}</td><td>{{ u.logs7 }}</td>
            <td>
              <span v-if="u.role === 'admin'" class="muted">ไม่นับ (แอดมิน)</span>
              <label v-else style="display:flex;gap:.4rem;align-items:center;margin:0"><input type="checkbox" style="width:auto" :checked="!u.exclude_stats" @change="toggleExclude(u)" /> {{ u.exclude_stats ? 'ไม่นับ' : 'นับ' }}</label>
            </td>
            <td>
              <div v-if="u.id !== user?.id" class="row">
                <button class="alt" @click="toggleRole(u)">{{ u.role === 'admin' ? 'ลดเป็นผู้ใช้' : 'ตั้งเป็นแอดมิน' }}</button>
                <button class="warn" @click="delUser(u)">ลบ</button>
              </div>
              <span v-else class="muted">แก้ไขตัวเองไม่ได้</span>
            </td>
          </tr>
          <tr v-if="!userList.length"><td colspan="7" class="muted">ไม่พบผู้ใช้</td></tr>
        </tbody>
      </table>
    </div>
    <p class="muted">เพิ่มบัญชีใหม่: ให้ผู้ใช้กด "สมัครใช้งานใหม่" ที่หน้าเข้าสู่ระบบ แล้วกลับมาตั้งเป็นแอดมินที่นี่ หรือสร้างใน Supabase → Authentication → Users</p>
  </template>

  <!-- รายการยา -->
  <template v-if="tab === 'catalog'">
    <form class="card" novalidate @submit.prevent="saveCat">
      <h2>{{ cform.id ? 'แก้ไขรายการ' : 'เพิ่มรายการยาแนะนำ' }}</h2>
      <FormField label="ชื่อยา" for-id="cn" :error="cerr.name"><input id="cn" v-model="cform.name" maxlength="130" /></FormField>
      <FormField label="หมวด" for-id="cc" :error="cerr.category"><input id="cc" v-model="cform.category" maxlength="60" /></FormField>
      <FormField label="วิธีกินที่พบบ่อย" for-id="ci"><select id="ci" v-model="cform.default_instruction"><option v-for="o in INSTRUCTIONS" :key="o">{{ o }}</option></select></FormField>
      <FormField label="หมายเหตุ" for-id="cnote" :error="cerr.note"><input id="cnote" v-model="cform.note" maxlength="300" /></FormField>
      <div class="row"><button type="submit">{{ cform.id ? 'บันทึกการแก้ไข' : 'เพิ่มรายการ' }}</button><button v-if="cform.id" type="button" class="alt" @click="resetCat">ยกเลิกแก้ไข</button></div>
    </form>
    <label for="cq">ค้นหา</label>
    <input id="cq" v-model="cq" maxlength="60" placeholder="ชื่อยาหรือหมวด" />
    <div class="card scroll-x" style="margin-top:1rem">
      <table>
        <thead><tr><th>ชื่อยา</th><th>หมวด</th><th>วิธีกิน</th><th></th></tr></thead>
        <tbody>
          <tr v-for="i in catList" :key="i.id">
            <td>{{ i.name }}</td><td>{{ i.category }}</td><td>{{ i.default_instruction }}</td>
            <td><div class="row"><button class="alt" @click="editCat(i)">แก้ไข</button><button class="warn" @click="delCat(i)">ลบ</button></div></td>
          </tr>
          <tr v-if="!catList.length"><td colspan="4" class="muted">ไม่พบรายการ</td></tr>
        </tbody>
      </table>
    </div>
  </template>

  <!-- บันทึกผู้ใช้จริง -->
  <template v-if="tab === 'impact'">
    <div class="card">
      <strong>ผู้ใช้ที่บันทึกแล้ว {{ uniqueUsers }} / 5 คน</strong>
      <p class="muted" style="margin:.3rem 0 0">เพิ่มเฉพาะผู้ใช้จริงที่ขออนุญาตแล้ว ตัวเลขต้องตรงกับตารางลงพื้นที่ในรายงาน</p>
    </div>
    <form class="card" novalidate @submit.prevent="addImpact">
      <h2>เพิ่มบันทึก</h2>
      <FormField label="รหัสผู้ใช้ (ห้ามใช้ชื่อจริง)" for-id="uc" :error="ferr.code"><input id="uc" v-model="form.user_code" maxlength="20" placeholder="U1" /></FormField>
      <FormField label="สิ่งที่ผู้ใช้อนุญาต" for-id="cs">
        <select id="cs" v-model="form.consent">
          <option value="data">ข้อมูลการใช้งานเท่านั้น</option>
          <option value="quote+data">คำพูด + ข้อมูล</option>
          <option value="quote+photo+data">คำพูด + ภาพ + ข้อมูล</option>
        </select>
      </FormField>
      <FormField v-if="form.consent.includes('quote')" label="คำพูดของผู้ใช้" for-id="qt" :error="ferr.quote"><textarea id="qt" v-model="form.quote" rows="3" maxlength="320"></textarea></FormField>
      <button type="submit">เพิ่มบันทึก</button>
    </form>
    <div class="card scroll-x">
      <table>
        <thead><tr><th>เวลา</th><th>ผู้ใช้</th><th>อนุญาต</th><th>คำพูด</th><th></th></tr></thead>
        <tbody>
          <tr v-for="r in impact" :key="r.id">
            <td>{{ new Date(r.created_at).toLocaleString('th-TH') }}</td><td>{{ r.user_code }}</td><td>{{ r.consent }}</td><td>{{ r.quote }}</td>
            <td><button class="warn" @click="delImpact(r)">ลบ</button></td>
          </tr>
          <tr v-if="!impact.length"><td colspan="5" class="muted">ยังไม่มีบันทึก</td></tr>
        </tbody>
      </table>
    </div>
  </template>
</template>