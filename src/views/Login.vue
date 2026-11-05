<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../supabase'

const router = useRouter()
const email = ref(''), password = ref(''), mode = ref('login')
const busy = ref(false), err = ref(''), info = ref('')

async function submit() {
  err.value = ''; info.value = ''
  if (!/^\S+@\S+\.\S+$/.test(email.value)) { err.value = 'กรอกอีเมลให้ถูกต้อง'; return }
  if (password.value.length < 6) { err.value = 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'; return }
  busy.value = true
  try {
    if (mode.value === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email: email.value.trim(), password: password.value })
      if (error) throw error
      router.push('/today')
    } else {
      const { data, error } = await supabase.auth.signUp({ email: email.value.trim(), password: password.value })
      if (error) throw error
      if (data.session) router.push('/today')
      else info.value = 'สมัครแล้ว กรุณายืนยันอีเมล แล้วกลับมาเข้าสู่ระบบ'
    }
  } catch (e) {
    err.value = e.message === 'Invalid login credentials' ? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' : e.message
  } finally { busy.value = false }
}
</script>

<template>
  <h1>{{ mode === 'login' ? 'เข้าสู่ระบบ' : 'สมัครใช้งาน' }}</h1>
  <p>ถ่ายรูปซองยา ระบบอ่านแล้วสร้างตารางเตือนกินยาให้ทันที</p>
  <form class="card" @submit.prevent="submit">
    <label for="email">อีเมล</label>
    <input id="email" v-model="email" type="email" autocomplete="email" maxlength="120" required />
    <label for="pw">รหัสผ่าน</label>
    <input id="pw" v-model="password" type="password" autocomplete="current-password" maxlength="72" required />
    <p v-if="err" class="err" role="alert">{{ err }}</p>
    <p v-if="info" class="ok">{{ info }}</p>
    <div class="row" style="margin-top:1rem">
      <button type="submit" :disabled="busy">{{ mode === 'login' ? 'เข้าสู่ระบบ' : 'สมัครใช้งาน' }}</button>
      <button type="button" class="alt" @click="mode = mode === 'login' ? 'signup' : 'login'">
        {{ mode === 'login' ? 'สมัครใช้งานใหม่' : 'มีบัญชีแล้ว' }}
      </button>
    </div>
  </form>
  <p class="muted">ห้ามกรอกข้อมูลสุขภาพจริงของบุคคลในการทดสอบ ใช้ซองยาตัวอย่างหรือข้อมูลสมมุติ</p>
</template>
