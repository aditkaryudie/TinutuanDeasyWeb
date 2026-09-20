export interface MenuRating {
  id?: string | number
  order_id?: string | number
  menu_id: string | number
  rating: number // 1 to 5
  review?: string | null
  customer_name?: string | null
  table_number?: string | number | null
  created_at?: string
}

export interface MenuRatingSummary {
  avg: number
  count: number
  reviews: Array<{
    id?: string | number
    name: string
    rating: number
    text?: string | null
    time: string
    table?: string | number | null
  }>
}

export const DEFAULT_BASELINE_RATINGS: Record<
  string,
  {
    avg: number
    count: number
    reviews: Array<{ name: string; rating: number; text: string; time: string }>
  }
> = {
  komplit: {
    avg: 4.9,
    count: 32,
    reviews: [
      {
        name: 'Oma Grace',
        rating: 5,
        text: 'Rasa bubur Manado paling autentik di sini! Sayur segar dan ikan cakalangnya wangi asap sedap.',
        time: 'Kemarin',
      },
      {
        name: 'Kevin M.',
        rating: 5,
        text: 'Porsinya kenyang dan labu kuningnya manis alami.',
        time: '3 hari lalu',
      },
      {
        name: 'Devi L.',
        rating: 5,
        text: 'Enak banget, sambal rica roa nya mantap pedas gurih.',
        time: '1 minggu lalu',
      },
    ],
  },
  biasa: {
    avg: 4.8,
    count: 24,
    reviews: [
      {
        name: 'Budi Santoso',
        rating: 5,
        text: 'Buburnya halus, sayuran bayam & kangkungnya fresh.',
        time: '2 hari lalu',
      },
      {
        name: 'Ibu Ratna',
        rating: 4,
        text: 'Cocok buat sarapan dan makan siang, hangat menyehatkan.',
        time: '5 hari lalu',
      },
    ],
  },
  perkedel: {
    avg: 4.9,
    count: 46,
    reviews: [
      {
        name: 'Santi P.',
        rating: 5,
        text: 'Garing di luar, manis jagungnya pecah di lidah! Wajib pesan.',
        time: 'Hari ini',
      },
      {
        name: 'Rudy W.',
        rating: 5,
        text: 'Paling favorit dimakan bareng tinutuan panas.',
        time: 'Kemarin',
      },
    ],
  },
  cakalang: {
    avg: 4.9,
    count: 21,
    reviews: [
      {
        name: 'Hendra T.',
        rating: 5,
        text: 'Asapnya meresap sampai ke serat daging ikan, bumbu rica pas pedasnya.',
        time: '2 hari lalu',
      },
    ],
  },
  brenebon: {
    avg: 4.8,
    count: 27,
    reviews: [
      {
        name: 'Evelyn K.',
        rating: 5,
        text: 'Segar sekali! Kacang merahnya empuk dan susunya pas manisnya.',
        time: 'Kemarin',
      },
      {
        name: 'Michael',
        rating: 5,
        text: 'Penutup yang sempurna sehabis makan pedas.',
        time: '4 hari lalu',
      },
    ],
  },
}

export function formatRelativeTime(isoString: string): string {
  try {
    const date = new Date(isoString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    if (diffMins < 2) return 'Baru saja'
    if (diffMins < 60) return `${diffMins} menit lalu`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours} jam lalu`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays === 1) return 'Kemarin'
    if (diffDays < 7) return `${diffDays} hari lalu`
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
  } catch {
    return 'Baru saja'
  }
}

export function computeMenuRating(
  item: { id: string | number; name: string },
  dbRatings: MenuRating[] = []
): MenuRatingSummary {
  const itemDbRatings = dbRatings.filter(
    (r) => String(r.menu_id) === String(item.id)
  )

  const lowerName = item.name.toLowerCase()
  let baselineKey: string | null = null
  for (const key of Object.keys(DEFAULT_BASELINE_RATINGS)) {
    if (lowerName.includes(key)) {
      baselineKey = key
      break
    }
  }

  const baseline = baselineKey
    ? DEFAULT_BASELINE_RATINGS[baselineKey]
    : {
        avg: 4.8,
        count: 15,
        reviews: [
          {
            name: 'Pelanggan Setia',
            rating: 5,
            text: 'Rasanya mantap dan bumbu khas Manadonya terasa nikmat!',
            time: 'Baru-baru ini',
          },
        ],
      }

  if (itemDbRatings.length === 0) {
    return {
      avg: baseline.avg,
      count: baseline.count,
      reviews: baseline.reviews.map((r, i) => ({
        id: `base-${item.id}-${i}`,
        name: r.name,
        rating: r.rating,
        text: r.text,
        time: r.time,
      })),
    }
  }

  const realSum = itemDbRatings.reduce(
    (acc, r) => acc + Number(r.rating || 5),
    0
  )
  const totalCount = baseline.count + itemDbRatings.length
  const totalSum = baseline.avg * baseline.count + realSum
  const combinedAvg = Math.round((totalSum / totalCount) * 10) / 10

  const realReviews = itemDbRatings.map((r) => ({
    id: r.id || `real-${Math.random()}`,
    name:
      r.customer_name ||
      (r.table_number ? `Tamu Meja ${r.table_number}` : 'Pelanggan'),
    rating: r.rating,
    text: r.review,
    time: r.created_at ? formatRelativeTime(r.created_at) : 'Baru saja',
    table: r.table_number,
  }))

  const baseReviews = baseline.reviews.map((r, i) => ({
    id: `base-${item.id}-${i}`,
    name: r.name,
    rating: r.rating,
    text: r.text,
    time: r.time,
  }))

  return {
    avg: Math.min(5, Math.max(1, combinedAvg)),
    count: totalCount,
    reviews: [...realReviews, ...baseReviews],
  }
}
