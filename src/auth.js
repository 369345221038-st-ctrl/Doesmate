import { ref, computed } from 'vue'
import { supabase } from './supabase'

export const user = ref(null)
export const role = ref('user')
export const isAdmin = computed(() => role.value === 'admin')

async function loadRole() {
  if (!user.value) { role.value = 'user'; return }
  const { data } = await supabase.from('profiles').select('role').eq('id', user.value.id).maybeSingle()
  role.value = data?.role || 'user'
}

export async function initAuth() {
  try {
    const { data } = await supabase.auth.getSession()
    user.value = data.session?.user ?? null
    await loadRole()
    supabase.auth.onAuthStateChange((_e, session) => {
      user.value = session?.user ?? null
      setTimeout(loadRole, 0) // ไม่ await supabase ภายใน callback
    })
  } catch { user.value = null }
}
