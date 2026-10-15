import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { createApp } from 'vue';
import { ApiError } from './api/client';
import App from './App.vue';
import { router } from './router';
import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5_000,
      refetchOnWindowFocus: false,
      // 4xx responses are definitive; only retry transient failures.
      retry: (failures, error) =>
        !(error instanceof ApiError && error.status < 500) && failures < 2,
    },
  },
});

createApp(App).use(router).use(VueQueryPlugin, { queryClient }).mount('#app');
