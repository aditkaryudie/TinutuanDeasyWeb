import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co'
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy-anon-key'

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
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('dummy.supabase.co')

  let user = null

  if (!isDummySupabase) {
    // 1. Get authenticated user
    const { data } = await supabase.auth.getUser()
    user = data.user

    // 2. Global Maintenance Mode Check
    try {
      const { data: setting } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'maintenance_mode')
        .single()

      const isMaintenance = setting?.value === 'true' || setting?.value === true

      if (isMaintenance) {
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
          return NextResponse.redirect(new URL('/maintenance', request.url))
        }
      }
    } catch {
      // If table doesn't exist or query fails, continue without blocking
    }
  }

  // 3. Route Protection for Protected Paths
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

    // Role-based Access Control
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = userData?.role

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

    // /kitchen restriction
    if (
      pathname.startsWith('/kitchen') &&
      role !== 'kitchen' &&
      role !== 'super_admin'
    ) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

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
