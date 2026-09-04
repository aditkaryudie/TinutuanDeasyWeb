import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { order_id, total_price } = body

    if (!order_id || !total_price) {
      return NextResponse.json(
        { error: 'Missing required fields: order_id or total_price' },
        { status: 400 }
      )
    }

    // Initialize Supabase Server Client
    const cookieStore = await cookies()
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://desieqgcrkmseynoiqam.supabase.co'
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_qg3t-RK4q-5hBa_eE_u0gg_g4Kb4dJI'

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    })

    // 1. Verify that the order exists in the Supabase 'orders' table
    const { data: order, error } = await supabase
      .from('orders')
      .select('id, total_price, payment_status')
      .eq('id', order_id)
      .single()

    if (error || !order) {
      return NextResponse.json(
        { error: 'Order not found or invalid order_id' },
        { status: 404 }
      )
    }

    // Optional: Verify if total_price matches to prevent tampering
    // In a real scenario, we should rely on the DB price, not the client request price.
    const finalAmount = order.total_price

    // Simulate successful payment instantly for demo purposes
    // We update payment_status to 'paid' and order_status to 'pending' (sent to kitchen)
    const { error: updateError } = await supabase
      .from('orders')
      .update({ 
        payment_status: 'paid',
        order_status: 'pending' // Now it goes to the kitchen
      })
      .eq('id', order_id)

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to update order status' },
        { status: 500 }
      )
    }

    // Instead of redirecting to midtrans, we just return success
    return NextResponse.json({
      success: true,
      order_id: order.id,
      gross_amount: finalAmount,
      message: 'Payment successful (Mock)',
    })

  } catch (error: unknown) {
    console.error('Payment API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error while processing payment.' },
      { status: 500 }
    )
  }
}
