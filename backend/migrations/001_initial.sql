CREATE TABLE users (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), full_name VARCHAR(100) NOT NULL CHECK(length(trim(full_name))>0),
 email VARCHAR(254) NOT NULL UNIQUE CHECK(email=lower(email)), password_hash TEXT NOT NULL,
 role TEXT NOT NULL DEFAULT 'customer' CHECK(role IN ('customer','admin')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE categories (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name VARCHAR(80) NOT NULL UNIQUE, slug VARCHAR(100) NOT NULL UNIQUE CHECK(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'), description TEXT NOT NULL DEFAULT '');
CREATE TABLE products (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
 name VARCHAR(120) NOT NULL, description TEXT NOT NULL DEFAULT '', price NUMERIC(12,2) NOT NULL CHECK(price>0 AND price<=100000), image_url TEXT NOT NULL,
 is_available BOOLEAN NOT NULL DEFAULT true, is_featured BOOLEAN NOT NULL DEFAULT false,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX products_category_idx ON products(category_id);
CREATE TABLE carts (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE cart_items (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), cart_id UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE, product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE, quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 20), UNIQUE(cart_id,product_id));
CREATE TABLE orders (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 total_amount NUMERIC(12,2) NOT NULL CHECK(total_amount>0), status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','preparing','ready','completed','cancelled')),
 customer_name VARCHAR(100) NOT NULL, contact_number VARCHAR(30) NOT NULL, order_type TEXT NOT NULL CHECK(order_type IN ('pickup','dine-in')), notes TEXT NOT NULL DEFAULT '' CHECK(length(notes)<=1000), created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX orders_user_idx ON orders(user_id,created_at DESC);
CREATE INDEX orders_status_idx ON orders(status,created_at DESC);
CREATE TABLE order_items (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE, product_id UUID REFERENCES products(id) ON DELETE SET NULL, product_name VARCHAR(120) NOT NULL, quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 20), unit_price NUMERIC(12,2) NOT NULL CHECK(unit_price>0));
CREATE INDEX order_items_order_idx ON order_items(order_id);
CREATE TABLE reviews (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5), comment TEXT NOT NULL CHECK(length(comment) BETWEEN 1 AND 2000), created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX reviews_user_idx ON reviews(user_id);
CREATE FUNCTION update_timestamp() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END; $$;
CREATE TRIGGER users_updated BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER products_updated BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER carts_updated BEFORE UPDATE ON carts FOR EACH ROW EXECUTE FUNCTION update_timestamp();
