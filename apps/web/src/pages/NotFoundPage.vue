<script setup lang="ts">
import { RouterLink } from 'vue-router';
</script>

<template>
  <div class="py-24 text-center">
    <p class="text-sm text-muted">404</p>
    <h1 class="mt-1 text-2xl font-semibold text-ink">Page not found</h1>
    <RouterLink to="/" class="btn-secondary mt-6">Back to experiments</RouterLink>
  </div>
</template>
