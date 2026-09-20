import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://desieqgcrkmseynoiqam.supabase.co'
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    'sb_publishable_qg3t-RK4q-5hBa_eE_u0gg_g4Kb4dJI'

  return createClient(supabaseUrl, supabaseAnonKey)
}

export async function GET(request: NextRequest) {
  const supabase = getSupabase()
  const cookieVal = request.cookies.get('tinutuan_maintenance')?.value
  let isMaintenance = cookieVal === 'true'
  let tableExists = true

  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'maintenance_mode')
      .single()

    if (error) {
      if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
        tableExists = false
      }
    } else if (data) {
      isMaintenance = data.value === 'true' || data.value === true
    }
  } catch {
    tableExists = false
  }

  const response = NextResponse.json({
    maintenance: isMaintenance,
    tableExists,
  })

  // Sync cookie with the authoritative setting
  response.cookies.set({
    name: 'tinutuan_maintenance',
    value: isMaintenance ? 'true' : 'false',
    path: '/',
    maxAge: 30 * 24 * 60 * 60, // 30 days
    sameSite: 'lax',
  })

  return response
}

export async function POST(request: NextRequest) {
  const supabase = getSupabase()
  let body: { maintenance?: boolean } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  const isMaintenance = Boolean(body.maintenance)
  let tableExists = true
  let dbError: string | null = null

  try {
    const { error } = await supabase
      .from('system_settings')
      .upsert(
        {
          key: 'maintenance_mode',
          value: String(isMaintenance),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'key' }
      )

    if (error) {
      dbError = error.message
      if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
        tableExists = false
      }
    }
  } catch (err: unknown) {
    dbError = err instanceof Error ? err.message : 'Database error'
    tableExists = false
  }

  const response = NextResponse.json({
    success: true,
    maintenance: isMaintenance,
    tableExists,
    warning: tableExists
      ? null
      : 'Tabel database public.system_settings belum dibuat di Supabase. Status diaktifkan secara lokal, tetapi mohon buat tabel di Supabase SQL Editor agar aktif secara global di seluruh perangkat.',
    error: dbError,
  })

  // Set or update cookie for instant middleware effect
  response.cookies.set({
    name: 'tinutuan_maintenance',
    value: isMaintenance ? 'true' : 'false',
    path: '/',
    maxAge: 30 * 24 * 60 * 60,
    sameSite: 'lax',
  })

  return response
}
