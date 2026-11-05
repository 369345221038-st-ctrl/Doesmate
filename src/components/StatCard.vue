<script setup>
defineProps({ label: String, value: [String, Number], hint: String, tone: { type: String, default: '' } })
</script>
<template>
  <div class="card stat-card" :class="tone">
    <div class="stat">{{ value }}</div>
    <div>{{ label }}</div>
    <div v-if="hint" class="muted">{{ hint }}</div>
  </div>
</template>
