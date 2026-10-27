-- Existing orders retain their historical prices. Existing drink carts use Small.
ALTER TABLE products ADD COLUMN size_options JSONB NOT NULL DEFAULT '[]'::jsonb
 CHECK (jsonb_typeof(size_options) = 'array' AND jsonb_array_length(size_options) IN (0,3));
UPDATE products p SET size_options=jsonb_build_array(
 jsonb_build_object('name','Small','price',p.price),
 jsonb_build_object('name','Medium','price',p.price+20),
 jsonb_build_object('name','Large','price',p.price+40)
) FROM categories c WHERE c.id=p.category_id AND c.slug IN ('hot-coffee','iced-coffee','non-coffee','matcha');
ALTER TABLE cart_items ADD COLUMN size TEXT NOT NULL DEFAULT 'Regular' CHECK(size IN ('Regular','Small','Medium','Large'));
ALTER TABLE cart_items DROP CONSTRAINT cart_items_cart_id_product_id_key;
UPDATE cart_items ci SET size='Small' FROM products p WHERE p.id=ci.product_id AND jsonb_array_length(p.size_options)>0;
ALTER TABLE cart_items ADD CONSTRAINT cart_items_cart_product_size_key UNIQUE(cart_id,product_id,size);
ALTER TABLE order_items ADD COLUMN size TEXT NOT NULL DEFAULT 'Regular' CHECK(size IN ('Regular','Small','Medium','Large'));
