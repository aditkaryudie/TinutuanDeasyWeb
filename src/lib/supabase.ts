import { createClient } from '@supabase/supabase-js'

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://desieqgcrkmseynoiqam.supabase.co'
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_qg3t-RK4q-5hBa_eE_u0gg_g4Kb4dJI'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
