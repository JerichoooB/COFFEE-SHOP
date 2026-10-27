import { useEffect, useState } from "react";
import { Mail, Check, RefreshCw } from "lucide-react";
import { api, message } from "../services/api";
export default function EmailReceipt({ order, poll = false }) {
  const [status, setStatus] = useState(order.receipt_status),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (!poll || !["pending", "sending"].includes(status)) return;
    let cancelled = false,
      timer,
      attempts = 0;
    async function check() {
      if (cancelled) return;
      attempts++;
      try {
        const response = await api.get(`/orders/${order.id}`);
        const next = response.data.receipt_status;
        if (
          !cancelled &&
          ["pending", "sending", "sent", "failed"].includes(next)
        )
          setStatus(next);
      } catch {
        /* An email-status check must not interrupt the confirmed order. */
      }
      if (!cancelled && attempts < 8) timer = setTimeout(check, 3000);
    }
    timer = setTimeout(check, 3000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [poll, order.id, status]);
  if (!status || status === "unavailable") return null;
  async function retry() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await api.post(`/orders/${order.id}/receipt`);
      setStatus(r.data.status);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={`email-receipt receipt-${status}`}>
      <div className="receipt-icon">
        {status === "sent" ? <Check size={18} /> : <Mail size={18} />}
      </div>
      <div>
        <strong>
          {status === "sent"
            ? "Your email receipt is on its way"
            : status === "sending"
              ? "Your receipt is being sent"
              : "Your email receipt is pending"}
        </strong>
        <p>
          {status === "sent"
            ? `Sent to ${order.receipt_email || "your account email"}. Please check your spam folder too.`
            : status === "sending"
              ? "Give it a moment, then refresh to check its status."
              : status === "failed"
                ? "Your order is confirmed. We couldn’t send its email receipt. Please try again later."
                : "Your order is confirmed. Your receipt is waiting to be sent. You can check back or try sending it below."}
        </p>
        {error && (
          <p className="receipt-error" role="alert">
            {error}
          </p>
        )}
        {(["pending", "failed"].includes(status) ||
          (status === "sending" &&
            order.receipt_status === "sending" &&
            Date.parse(order.receipt_updated_at) <
              Date.now() - 10 * 60 * 1000)) && (
          <button disabled={busy} onClick={retry}>
            <RefreshCw size={12} />
            {busy ? "Sending…" : "Try sending receipt"}
          </button>
        )}
      </div>
    </div>
  );
}
