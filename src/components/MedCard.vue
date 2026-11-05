<script setup>
import { computed } from 'vue'
import { daysLeft } from '../utils'
const props = defineProps({ med: Object, url: String })
defineEmits(['edit', 'remove', 'toggle-active'])
const left = computed(() => daysLeft(props.med))
</script>
<template>
  <div class="card" :class="{ paused: !med.active }">
    <div class="row">
      <img v-if="url" :src="url" alt="รูปซองยา" class="thumb" />
      <div style="flex:1;min-width:10rem">
        <strong>{{ med.name }}</strong>
        <span v-if="!med.active" class="badge missed">หยุดชั่วคราว</span>
        <div class="muted">{{ med.pills_per_dose }} เม็ด · {{ med.instruction }}</div>
        <div>เวลา: {{ med.times.length ? med.times.join(', ') : 'เมื่อมีอาการ' }}</div>
        <div class="muted">เริ่ม {{ med.start_date }}{{ med.end_date ? ' ถึง ' + med.end_date : ' (ไม่กำหนดวันสิ้นสุด)' }}</div>
        <div v-if="med.stock != null" :class="left !== null && left <= 3 ? 'err' : 'muted'">
          เหลือ {{ med.stock }} เม็ด<span v-if="left !== null"> (พอกิน ~{{ left }} วัน)</span>
        </div>
        <div v-if="med.notes" class="muted">หมายเหตุ: {{ med.notes }}</div>
      </div>
    </div>
    <div class="row" style="margin-top:.6rem">
      <button class="alt" @click="$emit('edit', med)">แก้ไข</button>
      <button class="alt" @click="$emit('toggle-active', med)">{{ med.active ? 'หยุดชั่วคราว' : 'กลับมากินต่อ' }}</button>
      <button class="warn" @click="$emit('remove', med)">ลบ</button>
    </div>
  </div>
</template>
