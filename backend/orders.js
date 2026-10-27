import { priceForSize } from "./pricing.js";
import { HttpError } from "./errors.js";
export { HttpError } from "./errors.js";
export function totalCents(items) {
  return items.reduce(
    (sum, item) => sum + Math.round(Number(item.price) * 100) * item.quantity,
    0,
  );
}
export async function createOrder(db, userId, data) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    // Every cart mutation also locks this parent row, serializing checkout and cart updates.
    const cart = (
      await client.query("SELECT id FROM carts WHERE user_id=$1 FOR UPDATE", [
        userId,
      ])
    ).rows[0];
    if (!cart) throw new HttpError(400, "Your cart is empty.");
    const items = (
      await client.query(
        "SELECT ci.quantity,ci.size,p.id,p.name,p.price,p.size_options,p.is_available FROM cart_items ci JOIN products p ON p.id=ci.product_id WHERE ci.cart_id=$1 ORDER BY p.id FOR SHARE OF p",
        [cart.id],
      )
    ).rows;
    if (!items.length) throw new HttpError(400, "Your cart is empty.");
    if (items.some((p) => !p.is_available))
      throw new HttpError(
        409,
        "A product in your cart is no longer available. Please update your cart.",
      );
    for (const item of items) {
      item.size = item.size || "Regular";
      item.price = priceForSize(item, item.size);
    }
    const total = (totalCents(items) / 100).toFixed(2);
    const order = (
      await client.query(
        "INSERT INTO orders(user_id,total_amount,customer_name,contact_number,order_type,notes) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",
        [
          userId,
          total,
          data.customer_name,
          data.contact_number,
          data.order_type,
          data.notes,
        ],
      )
    ).rows[0];
    for (const item of items)
      await client.query(
        "INSERT INTO order_items(order_id,product_id,product_name,quantity,unit_price,size) VALUES($1,$2,$3,$4,$5,$6)",
        [order.id, item.id, item.name, item.quantity, item.price, item.size],
      );
    await client.query("DELETE FROM cart_items WHERE cart_id=$1", [cart.id]);
    await client.query("UPDATE carts SET updated_at=now() WHERE id=$1", [
      cart.id,
    ]);
    await client.query(
      "INSERT INTO order_receipts(order_id,recipient_email) SELECT $1,email FROM users WHERE id=$2",
      [order.id, userId],
    );
    await client.query("COMMIT");
    return order;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
