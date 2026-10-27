import {
  sampleProducts,
  categories,
} from "../../frontend/src/services/catalog.js";
export async function seed(pool) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(8472192)");
    for (const name of categories)
      await client.query(
        "INSERT INTO categories(name,slug,description) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
        [
          name,
          name.toLowerCase().replaceAll(" ", "-"),
          `${name}, crafted with care.`,
        ],
      );
    for (const p of sampleProducts)
      await client.query(
        "INSERT INTO products(id,category_id,name,description,price,image_url,is_featured,is_available) SELECT $1,c.id,$2,$3,$4,$5,$6,true FROM categories c WHERE c.slug=$7 ON CONFLICT(id) DO NOTHING",
        [
          p.id,
          p.name,
          p.description,
          p.price,
          p.image_url,
          p.is_featured,
          p.category_name.toLowerCase().replaceAll(" ", "-"),
        ],
      );
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
