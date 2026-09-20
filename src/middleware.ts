import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://desieqgcrkmseynoiqam.supabase.co'
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    'sb_publishable_qg3t-RK4q-5hBa_eE_u0gg_g4Kb4dJI'

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        )
        response = NextResponse.next({
          request,
        })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        )
      },
    },
  })

  const { pathname } = request.nextUrl

  const isDummySupabase =
    !supabaseUrl || supabaseUrl.includes('dummy.supabase.co')

  let user: any = null
  let role: string | null = null

  // 1. Check custom staff role cookie first (Quick Staff Access & Kiosk Mode)
  const staffRoleCookie = request.cookies.get('tinutuan_staff_role')?.value
  if (staffRoleCookie && ['super_admin', 'admin', 'kitchen'].includes(staffRoleCookie)) {
    role = staffRoleCookie
    user = {
      id: 'staff-' + staffRoleCookie,
      email: request.cookies.get('tinutuan_staff_email')?.value || `${staffRoleCookie}@tinutuandeasy.com`,
    }
  }

  // 2. Check Supabase Auth session if role not established by cookie
  if (!role && !isDummySupabase) {
    try {
      const { data } = await supabase.auth.getUser()
      if (data?.user) {
        user = data.user
        // Check user metadata
        const metaRole = data.user.user_metadata?.role || data.user.app_metadata?.role
        if (metaRole && ['super_admin', 'admin', 'kitchen'].includes(metaRole)) {
          role = metaRole
        } else {
          // Check 'users' table
          const { data: userData } = await supabase
            .from('users')
            .select('role')
            .eq('id', data.user.id)
            .single()
          role = userData?.role || null
        }

        // Fallback inference if authenticated but role not in database
        if (!role && data.user.email) {
          if (data.user.email.includes('superadmin') || data.user.email.includes('owner')) {
            role = 'super_admin'
          } else if (data.user.email.includes('kitchen') || data.user.email.includes('dapur')) {
            role = 'kitchen'
          } else {
            role = 'admin'
          }
        }
      }
    } catch {
      // Ignore user auth fetch error
    }
  }

  // 1. Global Maintenance Mode Check
  const maintenanceCookie = request.cookies.get('tinutuan_maintenance')?.value
  let isMaintenance = maintenanceCookie === 'true'

  if (!isDummySupabase) {
    try {
      const { data: setting } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'maintenance_mode')
        .single()

      if (setting) {
        isMaintenance = setting.value === 'true' || setting.value === true
      }
    } catch {
      // If table doesn't exist yet, preserve cookie-based state
    }
  }

  // Super Admin can always access the entire website during maintenance
  const isSuperAdmin = role === 'super_admin'

  if (isMaintenance && !isSuperAdmin) {
    const allowedInMaintenance = [
      '/superadmin',
      '/login',
      '/maintenance',
      '/api',
    ]
    const isAllowed = allowedInMaintenance.some((path) =>
      pathname.startsWith(path)
    )

    if (!isAllowed) {
      const redirectRes = NextResponse.redirect(new URL('/maintenance', request.url))
      redirectRes.cookies.set({
        name: 'tinutuan_maintenance',
        value: 'true',
        path: '/',
        maxAge: 30 * 24 * 60 * 60,
        sameSite: 'lax',
      })
      return redirectRes
    }
  } else if (!isMaintenance && pathname === '/maintenance') {
    // If maintenance is turned off and visitor is on /maintenance, redirect back to menu
    const redirectRes = NextResponse.redirect(new URL('/menu', request.url))
    redirectRes.cookies.set({
      name: 'tinutuan_maintenance',
      value: 'false',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
      sameSite: 'lax',
    })
    return redirectRes
  }

  // 2. Route Protection for Protected Paths
  const protectedRoutes = ['/admin', '/kitchen', '/superadmin']
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  )

  if (isProtectedRoute && !isDummySupabase) {
    // Unauthenticated redirect to /login
    if (!user) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirectedFrom', pathname)
      return NextResponse.redirect(loginUrl)
    }

    // /superadmin restriction
    if (pathname.startsWith('/superadmin') && role !== 'super_admin') {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // /admin restriction
    if (
      pathname.startsWith('/admin') &&
      role !== 'admin' &&
      role !== 'super_admin'
    ) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // /kitchen restriction (kitchen, admin, super_admin)
    if (
      pathname.startsWith('/kitchen') &&
      role !== 'kitchen' &&
      role !== 'admin' &&
      role !== 'super_admin'
    ) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  // Do not overwrite cookies for API routes
  if (pathname.startsWith('/api')) {
    return response
  }

  // Keep cookie in sync with current state
  response.cookies.set({
    name: 'tinutuan_maintenance',
    value: isMaintenance ? 'true' : 'false',
    path: '/',
    maxAge: 30 * 24 * 60 * 60,
    sameSite: 'lax',
  })

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, assets)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
