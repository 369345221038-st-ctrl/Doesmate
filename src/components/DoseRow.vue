<script setup>
defineProps({ dose: Object, status: String, url: String })
defineEmits(['toggle'])
const BADGE = { taken: 'กินแล้ว', missed: 'เลยเวลา', next: 'มื้อถัดไป', upcoming: '' }
</script>
<template>
  <div class="card dose" :class="status">
    <div class="time">{{ dose.time }}</div>
    <div>
      <strong>{{ dose.med.name }}</strong>
      <span v-if="BADGE[status]" class="badge" :class="status">{{ BADGE[status] }}</span>
      <div class="muted">{{ dose.med.pills_per_dose }} เม็ด · {{ dose.med.instruction }}</div>
      <div class="row" style="margin-top:.4rem">
        <img v-if="url" :src="url" alt="รูปซองยา" class="thumb" />
        <button :class="dose.taken ? 'alt' : ''" @click="$emit('toggle', dose)">{{ dose.taken ? 'ยกเลิกการติ๊ก' : 'กินแล้ว' }}</button>
      </div>
    </div>
  </div>
</template>
