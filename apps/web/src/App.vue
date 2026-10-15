<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { RouterLink, RouterView } from 'vue-router';
import { useCatalog } from '@/api/queries';
import Icon from '@/components/ui/Icon.vue';

const NAV = [
  { to: '/experiments', label: 'Experiments', icon: 'flask' },
  { to: '/suites', label: 'Task suites', icon: 'list' },
  { to: '/configs', label: 'Agent configs', icon: 'sliders' },
] as const;

const catalog = useCatalog();

type Theme = 'light' | 'dark';
const THEME_KEY = 'agent-evals:theme';
const theme = ref<Theme>('light');

function applyTheme(value: Theme) {
  theme.value = value;
  document.documentElement.dataset.theme = value;
  try {
    localStorage.setItem(THEME_KEY, value);
  } catch {
    // Storage unavailable (private mode): the choice lasts for this page view.
  }
}

onMounted(() => {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(THEME_KEY);
  } catch {
    stored = null;
  }
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(stored === 'dark' || stored === 'light' ? stored : prefersDark ? 'dark' : 'light');
});
</script>

<template>
  <div class="min-h-screen">
    <header class="sticky top-0 z-10 border-b border-line bg-surface/90 backdrop-blur">
      <div class="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4 sm:px-6">
        <RouterLink to="/" class="flex items-center gap-2 font-semibold text-ink">
          <img src="/favicon.svg" alt="" class="size-6" />
          <span>Agent Evals</span>
        </RouterLink>
        <nav class="flex items-center gap-1 overflow-x-auto text-sm">
          <RouterLink
            v-for="item in NAV"
            :key="item.to"
            :to="item.to"
            class="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 whitespace-nowrap text-ink-2 hover:bg-surface-2 hover:text-ink"
            active-class="bg-surface-2 !text-ink font-medium"
          >
            <Icon :name="item.icon" :size="15" />
            <span class="hidden sm:inline">{{ item.label }}</span>
          </RouterLink>
        </nav>
        <div class="ml-auto flex items-center gap-3">
          <span
            class="hidden items-center gap-1.5 text-xs md:inline-flex"
            :class="catalog.data.value?.hermesVersion ? 'text-ink-2' : 'text-serious'"
            :title="catalog.data.value?.hermesVersion ?? 'Hermes CLI not found — runs will fail'"
          >
            <span
              class="size-1.5 rounded-full"
              :class="catalog.data.value?.hermesVersion ? 'bg-good' : 'bg-serious'"
            />
            {{ catalog.data.value?.hermesVersion?.split('·')[0]?.trim() ?? 'Hermes not detected' }}
          </span>
          <button
            type="button"
            class="rounded-md p-1.5 text-ink-2 hover:bg-surface-2 hover:text-ink"
            :aria-label="`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`"
            @click="applyTheme(theme === 'dark' ? 'light' : 'dark')"
          >
            <Icon :name="theme === 'dark' ? 'sun' : 'moon'" />
          </button>
        </div>
      </div>
    </header>
    <main class="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <RouterView />
    </main>
  </div>
</template>
