<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '../supabase'
import { impactImages } from '../impactImages'

const rows = ref([]), loading = ref(true), err = ref(''), auto = ref(null)
// แสดงคำพูดเฉพาะแถวที่ผู้ใช้อนุญาต (consent มีคำว่า quote)
const quotes = computed(() => rows.value.filter((r) => r.quote && /quote/i.test(r.consent || '')))

onMounted(async () => {
  const { data, error } = await supabase.from('impact_log').select('*').order('created_at')
  if (error) err.value = 'โหลดข้อมูลไม่สำเร็จ'
  else rows.value = data
  const { data: st } = await supabase.rpc('public_stats')
  if (st) auto.value = st
  loading.value = false
})
</script>

<template>
  <h1>ผลการใช้งานจริง</h1>
  <p>ตัวเลขด้านบนนับอัตโนมัติจากการกด "กินแล้ว" ในระบบ (ไม่นับสมาชิกทีมและแอดมิน ไม่มีชื่อจริง) ส่วนคำพูดและภาพแสดงเฉพาะที่ผู้ใช้อนุญาต</p>
  <p v-if="err" class="err">{{ err }}</p>
  <p v-if="loading">กำลังโหลด…</p>
  <template v-else>
    <div class="card row">
      <div><div class="stat">{{ auto ? auto.active_users : 0 }}</div><div class="muted">คนที่ทดลองใช้</div></div>
      <div><div class="stat">{{ auto ? auto.doses : 0 }}</div><div class="muted">ครั้งที่บันทึกการใช้งาน</div></div>
    </div>

    <h2>คำพูดจากผู้ใช้</h2>
    <p v-if="!quotes.length" class="muted">ยังไม่มีคำพูดที่ได้รับอนุญาต</p>
    <div v-for="q in quotes" :key="q.id" class="card">
      <p style="margin:0">“{{ q.quote }}”</p>
      <p class="muted" style="margin:.3rem 0 0">ผู้ใช้ {{ q.user_code }}</p>
    </div>

    <h2>ภาพการใช้งาน</h2>
    <p v-if="!impactImages.length" class="muted">ยังไม่มีภาพที่ได้รับอนุญาต</p>
    <figure v-for="im in impactImages" :key="im.src" class="card" style="margin-left:0;margin-right:0">
      <img :src="im.src" :alt="im.caption" style="max-width:100%;border-radius:10px" />
      <figcaption class="muted">{{ im.caption }}</figcaption>
    </figure>
  </template>
</template>