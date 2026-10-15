import { createRouter, createWebHistory } from 'vue-router';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/experiments' },
    {
      path: '/experiments',
      name: 'experiments',
      component: () => import('./pages/ExperimentsPage.vue'),
    },
    {
      path: '/experiments/new',
      name: 'new-experiment',
      component: () => import('./pages/NewExperimentPage.vue'),
    },
    {
      path: '/experiments/:id',
      name: 'experiment',
      component: () => import('./pages/ExperimentPage.vue'),
      props: true,
    },
    { path: '/runs/:id', name: 'run', component: () => import('./pages/RunPage.vue'), props: true },
    { path: '/suites', name: 'suites', component: () => import('./pages/SuitesPage.vue') },
    { path: '/suites/new', name: 'new-suite', component: () => import('./pages/NewSuitePage.vue') },
    {
      path: '/suites/:id',
      name: 'suite',
      component: () => import('./pages/SuitePage.vue'),
      props: true,
    },
    { path: '/configs', name: 'configs', component: () => import('./pages/ConfigsPage.vue') },
    {
      path: '/configs/new',
      name: 'new-config',
      component: () => import('./pages/ConfigEditorPage.vue'),
      props: (route) => ({ from: typeof route.query.from === 'string' ? route.query.from : null }),
    },
    {
      path: '/configs/:id/edit',
      name: 'edit-config',
      component: () => import('./pages/ConfigEditorPage.vue'),
      props: (route) => ({ editId: route.params.id as string, from: route.params.id as string }),
    },
    {
      path: '/configs/:id',
      name: 'config',
      component: () => import('./pages/ConfigPage.vue'),
      props: true,
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('./pages/NotFoundPage.vue'),
    },
  ],
  scrollBehavior: () => ({ top: 0 }),
});
