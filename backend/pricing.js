import { HttpError } from "./errors.js";

export function priceForSize(product, size = "Regular") {
  const options = product.size_options || [];
  const price = options.length
    ? options.find((option) => option.name === size)?.price
    : size === "Regular"
      ? product.price
      : undefined;
  if (
    price === undefined ||
    price === null ||
    !Number.isFinite(Number(price)) ||
    Number(price) <= 0
  ) {
    throw new HttpError(
      409,
      "This size is no longer available. Remove the item and choose an available size.",
    );
  }
  return Number(price).toFixed(2);
}
