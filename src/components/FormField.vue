<script setup>
defineProps({ label: String, error: String, forId: String, hint: String })
</script>
<template>
  <div class="field">
    <label :for="forId">{{ label }}</label>
    <slot />
    <p v-if="hint && !error" class="muted" style="margin:.2rem 0 0">{{ hint }}</p>
    <p v-if="error" class="err" role="alert" style="margin:.2rem 0 0">{{ error }}</p>
  </div>
</template>
