-- ======================================================
-- TINUTUAN DEASY DATABASE SETUP SCHEMA FOR SUPABASE
-- Jalankan query ini di Supabase SQL Editor
-- ======================================================

-- 1. TABEL USERS & ROLES
CREATE TABLE IF NOT EXISTS public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  role TEXT CHECK (role IN ('super_admin', 'admin', 'kitchen')) DEFAULT 'kitchen',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pastikan kolom email dan full_name ada jika tabel sudah pernah dibuat sebelumnya
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'kitchen';

-- RLS untuk tabel users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read users" ON public.users;
DROP POLICY IF EXISTS "Allow insert/update for auth users" ON public.users;
DROP POLICY IF EXISTS "Allow all access on users" ON public.users;

CREATE POLICY "Allow all access on users" ON public.users
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Trigger untuk sinkronisasi otomatis dari auth.users ke public.users saat register
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', 'Staf'),
    COALESCE(new.raw_user_meta_data->>'role', 'admin')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- 1.5 TABEL MENU_CATEGORIES
CREATE TABLE IF NOT EXISTS public.menu_categories (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow full access on menu_categories" ON public.menu_categories FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 2. TABEL MENU
CREATE TABLE IF NOT EXISTS public.menu (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL DEFAULT 0,
  is_available BOOLEAN DEFAULT true,
  description TEXT,
  image_url TEXT,
  variants JSONB DEFAULT '[]'::jsonb,
  category_id BIGINT REFERENCES public.menu_categories(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.menu ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all read menu" ON public.menu;
DROP POLICY IF EXISTS "Allow all edit menu" ON public.menu;
DROP POLICY IF EXISTS "Allow full access on menu" ON public.menu;

CREATE POLICY "Allow full access on menu" ON public.menu
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Seed Kategori Menu
INSERT INTO public.menu_categories (name) VALUES
('Best Seller Minggu Ini'),
('Promo Paket Hemat'),
('Makanan'),
('Minuman')
ON CONFLICT (name) DO NOTHING;

-- Seed Contoh Menu Tinutuan Deasy (Termasuk Kategori Promosi & Best Seller)
INSERT INTO public.menu (name, price, is_available, description, image_url, category_id, variants) VALUES
('Paket Juara Tinutuan Komplit', 32000, true, 'Menu paling laris minggu ini! 1 Tinutuan Komplit labu kuning & cakalang fufu + 2 Perkedel Jagung renyah + 1 Es Teh Manis Segar.', '/img/biasa.jpg', (SELECT id FROM public.menu_categories WHERE name = 'Best Seller Minggu Ini' LIMIT 1), '["Pedas Sedang (Rica Roa)", "Ekstra Pedas Mantap", "Tidak Pedas / Kuah Original"]'::jsonb),
('Tinutuan Spesial Cakalang Asap', 24000, true, 'Bubur Manado otentik beraroma kemangi segar dengan labu kuning manis, jagung pipil, bayam, kangkung, dan topping cakalang fufu asap rica gurih berlimpah.', '/img/campur.jpg', (SELECT id FROM public.menu_categories WHERE name = 'Best Seller Minggu Ini' LIMIT 1), '["Original Segar", "Ekstra Sambal Roa"]'::jsonb),
('Mie Cakalang Kuah Rempah Spesial', 20000, true, 'Mie kuning kenyal khas Minahasa dengan siraman kuah kaldu ikan cakalang hangat bertabur daun bawang, sayur sawi hijau, dan bawang goreng renyah.', '/img/geprek.jpg', (SELECT id FROM public.menu_categories WHERE name = 'Best Seller Minggu Ini' LIMIT 1), '["Kuah Gurih Original", "Kuah Pedas Rica"]'::jsonb),
('Perkedel Jagung Crispy Manado (Isi 5)', 15000, true, 'Bakwan jagung manis pipil renyah keemasan khas Manado, disajikan hangat dengan cocolan sambal dabu-dabu rica iris pedas segar.', '/img/daging.jpg', (SELECT id FROM public.menu_categories WHERE name = 'Best Seller Minggu Ini' LIMIT 1), '[]'::jsonb),
('Paket Duo Tinutuan Hemat', 38000, true, 'Pilihan pas untuk berdua! 2 Tinutuan Biasa + 2 Es Teh Manis Segar. Hemat dan bikin kenyang bersama.', '/img/biasa.jpg', (SELECT id FROM public.menu_categories WHERE name = 'Promo Paket Hemat' LIMIT 1), '["Keduanya Pedas", "Keduanya Tidak Pedas", "1 Pedas + 1 Tidak Pedas"]'::jsonb),
('Paket Nyantai: Perkedel + Es Brenebon', 22000, true, 'Kombinasi camilan dan dessert khas Manado! 1 Porsi Perkedel Jagung hangat renyah + 1 Es Kacang Merah Brenebon cokelat manis segar.', '/img/es_nutrisari.jpg', (SELECT id FROM public.menu_categories WHERE name = 'Promo Paket Hemat' LIMIT 1), '[]'::jsonb),
('Tinutuan Biasa', 18000, true, 'Bubur Manado segar khas rempah tradisional.', '/img/biasa.jpg', (SELECT id FROM public.menu_categories WHERE name = 'Makanan' LIMIT 1), '[]'::jsonb),
('Es Teh Manis Segar', 5000, true, 'Es teh manis segar pelepas dahaga.', '/img/Es-teh-tawar-manis.jpg', (SELECT id FROM public.menu_categories WHERE name = 'Minuman' LIMIT 1), '[]'::jsonb)
ON CONFLICT DO NOTHING;



-- 3. TABEL ORDERS
CREATE TABLE IF NOT EXISTS public.orders (
  id BIGSERIAL PRIMARY KEY,
  table_number TEXT NOT NULL,
  customer_name TEXT,
  total_price NUMERIC DEFAULT 0,
  payment_status TEXT DEFAULT 'pending',
  order_status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'cooking', 'ready', 'completed', 'cancelled'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on orders" ON public.orders;
DROP POLICY IF EXISTS "Allow full access on orders" ON public.orders;

CREATE POLICY "Allow full access on orders" ON public.orders
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);


-- 4. TABEL ORDER_ITEMS
CREATE TABLE IF NOT EXISTS public.order_items (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT REFERENCES public.orders(id) ON DELETE CASCADE,
  menu_id BIGINT REFERENCES public.menu(id) ON DELETE SET NULL,
  quantity INT DEFAULT 1,
  notes TEXT,
  is_cancelled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on order_items" ON public.order_items;
DROP POLICY IF EXISTS "Allow full access on order_items" ON public.order_items;

CREATE POLICY "Allow full access on order_items" ON public.order_items
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);


-- 5. TABEL SYSTEM_SETTINGS
CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on system_settings" ON public.system_settings;
DROP POLICY IF EXISTS "Allow full access on system_settings" ON public.system_settings;

CREATE POLICY "Allow full access on system_settings" ON public.system_settings
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

INSERT INTO public.system_settings (key, value) VALUES
('maintenance_mode', 'false')
ON CONFLICT (key) DO NOTHING;

-- 6. TABEL MENU_RATINGS (Rating & Ulasan Pelanggan)
CREATE TABLE IF NOT EXISTS public.menu_ratings (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT REFERENCES public.orders(id) ON DELETE SET NULL,
  menu_id BIGINT REFERENCES public.menu(id) ON DELETE CASCADE,
  rating INT CHECK (rating >= 1 AND rating <= 5) NOT NULL,
  review TEXT,
  customer_name TEXT DEFAULT 'Pelanggan',
  table_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.menu_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on menu_ratings" ON public.menu_ratings;
DROP POLICY IF EXISTS "Allow full access on menu_ratings" ON public.menu_ratings;

CREATE POLICY "Allow full access on menu_ratings" ON public.menu_ratings
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Aktifkan Realtime Replication untuk tabel terkait
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.menu;
ALTER PUBLICATION supabase_realtime ADD TABLE public.system_settings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_ratings;

