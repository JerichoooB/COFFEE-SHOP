import { useId, useState } from "react";
import { ArrowUpRight, Check, Send } from "lucide-react";
const endpoint =
  import.meta.env.VITE_FORMSPREE_ENDPOINT || "https://formspree.io/f/xvkkkley";
export default function EmailForm({ newsletter = false }) {
  const id = useId(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [sent, setSent] = useState(false);
  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    const form = e.currentTarget,
      values = Object.fromEntries(new FormData(form));
    setBusy(true);
    setError("");
    setSent(false);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          ...values,
          form_type: newsletter ? "Newsletter request" : "Contact enquiry",
          _subject: newsletter
            ? "Brew Haven · Newsletter request"
            : "Brew Haven · New contact enquiry",
        }),
        signal: AbortSignal.timeout(15000),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.ok !== true)
        throw new Error(
          response.status === 429
            ? "Too many messages. Please try again in a few minutes."
            : Array.isArray(data?.errors)
              ? data.errors
                  .map((e) => e.message)
                  .filter((v) => typeof v === "string")
                  .join(" ")
              : "Your message could not be sent. Please try again shortly.",
        );
      form.reset();
      setSent(true);
    } catch (e) {
      setError(
        e.name === "TimeoutError"
          ? "Sending took too long. Please try again."
          : e.name === "TypeError"
            ? "Unable to send right now. Please check your connection and try again."
            : e.message ||
              "Your message could not be sent. Please try again shortly.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={newsletter ? "newsletter-wrapper" : "contact-form-card"}>
      {!newsletter && (
        <>
          <p className="eyebrow">GOOD CONVERSATIONS START HERE</p>
          <h2>
            Drop us <em>a little note.</em>
          </h2>
          <p>A question, a kind word, or a coffee idea? We’re all ears.</p>
        </>
      )}
      <form
        onSubmit={submit}
        className={newsletter ? "newsletter" : "contact-email-form"}
        aria-label={newsletter ? "Newsletter request" : "Contact Brew Haven"}
      >
        {!newsletter && (
          <div className="settings-form-grid">
            <label htmlFor={`${id}-name`}>
              Your name
              <input
                id={`${id}-name`}
                name="name"
                required
                maxLength={100}
                autoComplete="name"
                placeholder="How should we call you?"
              />
            </label>
            <label htmlFor={`${id}-email`}>
              Your email
              <input
                id={`${id}-email`}
                name="email"
                type="email"
                required
                maxLength={254}
                autoComplete="email"
                placeholder="you@example.com"
              />
            </label>
          </div>
        )}
        {newsletter && (
          <>
            <label className="sr-only" htmlFor={`${id}-newsletter`}>
              Newsletter email address
            </label>
            <input
              id={`${id}-newsletter`}
              name="email"
              type="email"
              required
              maxLength={254}
              autoComplete="email"
              placeholder="Your email address"
            />
          </>
        )}
        {!newsletter && (
          <label htmlFor={`${id}-message`}>
            Your message
            <textarea
              id={`${id}-message`}
              name="message"
              required
              minLength={5}
              maxLength={3000}
              rows={4}
              placeholder="Tell us what’s on your mind…"
            />
          </label>
        )}
        <div className="form-honeypot" aria-hidden="true">
          <label htmlFor={`${id}-website`}>
            Leave this field empty
            <input
              id={`${id}-website`}
              name="_gotcha"
              tabIndex={-1}
              autoComplete="off"
            />
          </label>
        </div>
        <button
          className={newsletter ? "" : "button"}
          disabled={busy}
          aria-label={newsletter ? "Send newsletter request" : undefined}
        >
          {newsletter ? (
            <ArrowUpRight size={20} />
          ) : (
            <>
              {busy ? "Sending…" : "Send message"}
              <Send size={15} />
            </>
          )}
        </button>
        {!newsletter && (
          <small className="contact-privacy">
            Your message is sent securely through Formspree. Please don’t
            include passwords or payment details.
          </small>
        )}
      </form>
      {error && (
        <p className="email-form-error" role="alert">
          {error}
        </p>
      )}
      {sent && (
        <p className="email-form-success" role="status">
          <Check size={15} />
          {newsletter
            ? "Thanks! Your newsletter request has been sent."
            : "Your message has been sent. Thanks for reaching out!"}
        </p>
      )}
    </div>
  );
}
