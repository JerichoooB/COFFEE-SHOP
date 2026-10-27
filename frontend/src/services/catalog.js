export const coffeeImage =
  "https://images.unsplash.com/photo-1534778101976-62847782c213?auto=format&fit=crop&w=1000&q=85";
export const categories = [
  "Hot Coffee",
  "Iced Coffee",
  "Non-Coffee",
  "Matcha",
  "Pastries",
  "Desserts",
];
export const sampleProducts = [
  [
    "a1111111-1111-4111-8111-111111111111",
    "Signature Latte",
    "Silky espresso, steamed milk, a little moment of bliss.",
    165,
    "Hot Coffee",
    "photo-1570968915860-54d5c301fa9f",
    true,
  ],
  [
    "a2222222-2222-4222-8222-222222222222",
    "Caramel Cold Brew",
    "Slow-steeped coffee with a golden caramel finish.",
    185,
    "Iced Coffee",
    "photo-1517701604599-bb29b565090c",
    true,
  ],
  [
    "a3333333-3333-4333-8333-333333333333",
    "Ceremonial Matcha",
    "Earthy Japanese matcha meets creamy, velvety milk.",
    190,
    "Matcha",
    "photo-1515823064-d6e0c04616a7",
    true,
  ],
  [
    "a4444444-4444-4444-8444-444444444444",
    "Butter Croissant",
    "Golden, flaky layers. Baked for your coffee break.",
    110,
    "Pastries",
    "photo-1555507036-ab1f4038808a",
    true,
  ],
  [
    "a5555555-5555-4555-8555-555555555555",
    "Classic Americano",
    "A beautifully simple cup with a bold, clean finish.",
    120,
    "Hot Coffee",
    "photo-1510707577719-ae7c14805e3a",
    false,
  ],
  [
    "a6666666-6666-4666-8666-666666666666",
    "Dark Chocolate",
    "Rich cocoa and warm milk, made for slow sipping.",
    170,
    "Non-Coffee",
    "photo-1542990253-0b8be5db0ed1",
    false,
  ],
  [
    "a7777777-7777-4777-8777-777777777777",
    "Basque Cheesecake",
    "A caramelized top and a wonderfully creamy heart.",
    210,
    "Desserts",
    "photo-1533134242443-d4fd215305ad",
    false,
  ],
  [
    "a8888888-8888-4888-8888-888888888888",
    "Iced Spanish Latte",
    "Espresso, milk, and just the right touch of sweetness.",
    180,
    "Iced Coffee",
    "photo-1461023058943-07fcbe16d735",
    false,
  ],
].map(([id, name, description, price, category_name, photo, is_featured]) => ({
  id,
  name,
  description,
  price,
  category_name,
  image_url: `https://images.unsplash.com/${photo}?auto=format&fit=crop&w=700&q=80`,
  is_featured,
  is_available: true,
}));
export const money = (value) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(Number(value));

export function sizeOptions(product) {
  return product.size_options || [];
}
for (const product of sampleProducts) {
  product.size_options = [
    "Hot Coffee",
    "Iced Coffee",
    "Non-Coffee",
    "Matcha",
  ].includes(product.category_name)
    ? ["Small", "Medium", "Large"].map((name, index) => ({
        name,
        price: product.price + index * 20,
      }))
    : [];
}
