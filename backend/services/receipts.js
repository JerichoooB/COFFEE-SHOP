import { z } from "zod";
import nodemailer from "nodemailer";
const pesos = (value) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(
    Number(value),
  );
const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function receiptContent(order) {
  const reference = order.id.slice(0, 8).toUpperCase();
  const lines = order.items.map((i) => ({
    label: `${i.quantity} × ${i.product_name}${i.size && i.size !== "Regular" ? ` · ${i.size}` : ""}`,
    amount: pesos(Number(i.unit_price) * i.quantity),
  }));
  const type = order.order_type === "dine-in" ? "Dine-in" : "Pickup";
  const text = [
    `BREW HAVEN · Order receipt #${reference}`,
    `Thank you, ${order.customer_name}. Your order has been received.`,
    "",
    ...lines.map((i) => `${i.label} — ${i.amount}`),
    "",
    `Total: ${pesos(order.total_amount)}`,
    `Order type: ${type}`,
    "Payment: Pay at Counter. Payment has not been collected online.",
    ...(order.notes ? [`Notes: ${order.notes}`] : []),
    "",
    "Keep this receipt for your visit. We look forward to brewing your next favorite.",
  ].join("\n");
  const html = `<!doctype html><html><body style="margin:0;background:#f8f3ec;color:#4b2e2b;font-family:Arial,sans-serif"><main style="max-width:560px;margin:30px auto;background:#fffdf9;padding:35px;border:1px solid #e8d9c7;border-radius:12px"><p style="font-size:10px;letter-spacing:3px;color:#9b7850">BREW HAVEN</p><h1 style="font-family:Georgia,serif;font-weight:400;font-size:32px">A good moment is on its way.</h1><p>Thank you, ${escape(order.customer_name)}. Your order has been received.</p><p style="color:#9b7850;font-size:12px">ORDER #${reference} · ${type.toUpperCase()}</p><table style="border-collapse:collapse;width:100%;font-size:13px">${lines.map((i) => `<tr><td style="padding:14px 0;border-bottom:1px solid #e8d9c7">${escape(i.label)}</td><td style="padding:14px 0;text-align:right;border-bottom:1px solid #e8d9c7;white-space:nowrap">${escape(i.amount)}</td></tr>`).join("")}<tr><td style="padding:20px 0;font-weight:bold">Total</td><td style="text-align:right;font-weight:bold">${escape(pesos(order.total_amount))}</td></tr></table><p style="background:#f4ecdf;padding:15px;font-size:12px"><strong>Pay at Counter</strong><br/>Payment has not been collected online.</p>${order.notes ? `<p style="font-size:12px">Notes: ${escape(order.notes)}</p>` : ""}<p style="font-size:12px;color:#9b856c">Keep this receipt for your visit. A good cup is waiting for you.</p></main></body></html>`;
  return { subject: `Your Brew Haven order #${reference}`, html, text };
}
export function emailConfigured(env = process.env) {
  return Boolean(
    env.GMAIL_APP_PASSWORD?.replace(/\s/g, "") &&
    z.email().safeParse(env.GMAIL_USER).success,
  );
}
export function gmailTransportOptions(env = process.env) {
  return {
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: env.GMAIL_USER,
      pass: env.GMAIL_APP_PASSWORD.replace(/\s/g, ""),
    },
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 8000,
    dnsTimeout: 5000,
    tls: { minVersion: "TLSv1.2", servername: "smtp.gmail.com" },
  };
}
async function sendGmail(message, env) {
  const transport = nodemailer.createTransport(gmailTransportOptions(env));
  try {
    return await transport.sendMail(message);
  } finally {
    transport.close();
  }
}
export async function deliverReceipt(
  db,
  orderId,
  { env = process.env, mailer = sendGmail } = {},
) {
  const existing = (
    await db.query("SELECT * FROM order_receipts WHERE order_id=$1", [orderId])
  ).rows[0];
  if (!existing) return { status: "unavailable" };
  if (existing.status === "sent") return { status: "sent" };
  if (!emailConfigured(env))
    return { status: existing.status === "failed" ? "failed" : "pending" };
  const claimed = (
    await db.query(
      "UPDATE order_receipts SET status='sending',attempt_count=attempt_count+1,updated_at=now() WHERE order_id=$1 AND (status IN ('pending','failed') OR (status='sending' AND updated_at<now()-interval '10 minutes')) RETURNING *",
      [orderId],
    )
  ).rows[0];
  if (!claimed) return { status: "sending" };
  let providerId;
  try {
    const result = await db.query(
      "SELECT o.*,COALESCE((SELECT json_agg(i ORDER BY i.id) FROM order_items i WHERE i.order_id=o.id),'[]'::json) AS items FROM orders o WHERE o.id=$1",
      [orderId],
    );
    const order = result.rows[0];
    if (!order) throw new Error("order_missing");
    const content = receiptContent(order);
    const messageId = `<brew-haven-receipt-${orderId}@${env.GMAIL_USER.split("@")[1]}>`;
    const resultMessage = await mailer(
      {
        from: `Brew Haven <${env.GMAIL_USER}>`,
        to: [claimed.recipient_email],
        messageId,
        ...content,
      },
      env,
    );
    if (
      !resultMessage.accepted?.some(
        (address) =>
          typeof address === "string" &&
          address.toLowerCase() === claimed.recipient_email.toLowerCase(),
      )
    )
      throw new Error("recipient_rejected");
    providerId = resultMessage.messageId || messageId;
  } catch (error) {
    const code =
      error.message === "order_missing"
        ? "order_missing"
        : error.message === "recipient_rejected"
          ? "recipient_rejected"
          : error.code === "EAUTH"
            ? "sender_authentication"
            : error.code === "ETIMEDOUT" || error.name === "TimeoutError"
              ? "delivery_timeout"
              : "delivery_unavailable";
    await db.query(
      "UPDATE order_receipts SET status='failed',last_error_code=$2,updated_at=now() WHERE order_id=$1",
      [orderId, code],
    );
    return { status: "failed" };
  }
  // Store SMTP acceptance, never claim inbox delivery. Database leases prevent concurrent attempts.
  await db.query(
    "UPDATE order_receipts SET status='sent',provider_message_id=$2,last_error_code=NULL,sent_at=now(),updated_at=now() WHERE order_id=$1",
    [orderId, providerId],
  );
  return { status: "sent" };
}
export async function safelyDeliverReceipt(db, orderId, options) {
  try {
    return await deliverReceipt(db, orderId, options);
  } catch {
    console.error("Receipt delivery could not be recorded.");
    return { status: "pending" };
  }
}
