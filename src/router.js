import { createRouter, createWebHistory } from 'vue-router'
import { user, isAdmin } from './auth'
import Login from './views/Login.vue'
import Today from './views/Today.vue'
import Meds from './views/Meds.vue'
import MedForm from './views/MedForm.vue'
import History from './views/History.vue'
import Catalog from './views/Catalog.vue'
import Impact from './views/Impact.vue'
import Admin from './views/Admin.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/today' },
    { path: '/login', component: Login },
    { path: '/today', component: Today, meta: { auth: true } },
    { path: '/meds', component: Meds, meta: { auth: true } },
    { path: '/meds/new', component: MedForm, meta: { auth: true } },
    { path: '/meds/:id/edit', component: MedForm, meta: { auth: true } },
    { path: '/history', component: History, meta: { auth: true } },
    { path: '/catalog', component: Catalog },
    { path: '/impact', component: Impact },
    { path: '/admin', component: Admin, meta: { auth: true, admin: true } },
    { path: '/:pathMatch(.*)*', redirect: '/today' }
  ]
})

router.beforeEach((to) => {
  if (to.meta.auth && !user.value) return '/login'
  if (to.meta.admin && !isAdmin.value) return '/today'
  if (to.path === '/login' && user.value) return '/today'
})
export default router
