<script setup>
import { reminder, state, snoozeRinging, takeRinging } from '../store'
</script>
<template>
  <div v-if="reminder.ringing" class="overlay" role="alertdialog" aria-modal="true" aria-labelledby="rm-t">
    <div class="card">
      <h2 id="rm-t">ถึงเวลากินยา</h2>
      <p class="stat">{{ reminder.ringing.time }}</p>
      <p>
        <strong>{{ reminder.ringing.med.name }}</strong><br />
        {{ reminder.ringing.med.pills_per_dose }} เม็ด · {{ reminder.ringing.med.instruction }}
      </p>
      <img v-if="state.urls[reminder.ringing.med.image_path]" :src="state.urls[reminder.ringing.med.image_path]" alt="รูปซองยา" />
      <div class="row" style="justify-content:center;margin-top:1rem">
        <button @click="takeRinging">กินแล้ว</button>
        <button class="alt" @click="snoozeRinging(5)">เตือนอีก 5 นาที</button>
        <button class="warn" @click="reminder.ringing = null">ข้ามมื้อนี้</button>
      </div>
    </div>
  </div>
</template>
