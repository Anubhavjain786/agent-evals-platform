<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ value: unknown; maxHeight?: string }>();
const text = computed(() =>
  typeof props.value === 'string' ? props.value : JSON.stringify(props.value, null, 2),
);
</script>

<template>
  <pre class="code overflow-auto" :style="{ maxHeight: maxHeight ?? '24rem' }">{{ text }}</pre>
</template>
