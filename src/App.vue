<script setup>
import { watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase, configured } from './supabase'
import { user, isAdmin } from './auth'
import { loadAll, subscribe, unsubscribe, tick } from './store'
import ReminderModal from './components/ReminderModal.vue'

const router = useRouter()
let timer
watch(user, (u) => { if (u) { loadAll(); subscribe() } else unsubscribe() }, { immediate: true })
onMounted(() => { timer = setInterval(tick, 10000) })
onUnmounted(() => clearInterval(timer))

async function logout() {
  await supabase.auth.signOut()
  router.push('/login')
}
</script>

<template>
  <header class="top">
    <div class="wrap">
      <strong>ตารางเตือนกินยา</strong>
      <template v-if="user">
        <router-link to="/today">วันนี้</router-link>
        <router-link to="/meds">ยาของฉัน</router-link>
        <router-link to="/history">ประวัติ</router-link>
      </template>
      <router-link to="/catalog">รายการยา</router-link>
      <router-link to="/impact">ผลใช้งานจริง</router-link>
      <router-link v-if="isAdmin" to="/admin">แอดมิน</router-link>
      <button v-if="user" class="link" @click="logout">ออกจากระบบ</button>
      <router-link v-else to="/login">เข้าสู่ระบบ</router-link>
    </div>
  </header>
  <main class="wrap">
    <p v-if="!configured" class="notice">ยังไม่ได้ตั้งค่า Supabase: สร้างไฟล์ .env.local ตาม .env.example แล้ว build ใหม่</p>
    <router-view />
    <p class="muted" style="margin-top:2rem">
      เครื่องมือนี้ช่วยจดจำเท่านั้น ไม่ใช่คำแนะนำทางการแพทย์ กินยาตามที่แพทย์หรือเภสัชกรสั่งเสมอ
    </p>
  </main>
  <ReminderModal />
</template>
