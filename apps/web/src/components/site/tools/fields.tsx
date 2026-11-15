"use client";

/** Getal uit een invoerveld; accepteert een komma als decimaalteken. */
export const num = (v: string) => {
  const n = Number(v.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

export const eur = (n: number) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(n);

export function NumField({
  id,
  label,
  value,
  onChange,
  suffix,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  suffix?: string;
}) {
  return (
    <label htmlFor={id} className="block">
      <span className="mb-1 block text-[15px] text-[var(--s-muted)]">{label}</span>
      <span className="flex items-center rounded-xl border border-[var(--s-line-2)] bg-[#0a0a0b] transition-colors focus-within:border-[var(--s-accent-hi)] hover:border-white/20">
        <input
          id={id}
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="s-input !border-0 !bg-transparent !shadow-none"
        />
        {suffix && <span className="pr-4 text-[var(--s-muted)]">{suffix}</span>}
      </span>
    </label>
  );
}

export function DomainForm({
  onSubmit,
  pending,
  button,
  placeholder = "bijvoorbeeld zilverzand.nl",
}: {
  onSubmit: (domain: string) => void;
  pending: boolean;
  button: string;
  placeholder?: string;
}) {
  return (
    <form
      className="flex max-w-xl flex-col gap-2 sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault();
        const d = String(new FormData(e.currentTarget).get("domain") ?? "").trim();
        if (d) onSubmit(d);
      }}
    >
      <label htmlFor="tool-domain" className="sr-only">
        Domein van de webshop
      </label>
      <input
        id="tool-domain"
        name="domain"
        required
        className="s-input"
        placeholder={placeholder}
        autoComplete="off"
        inputMode="url"
      />
      <button type="submit" className="s-btn shrink-0" disabled={pending}>
        {pending ? "Bezig…" : button}
      </button>
    </form>
  );
}

export async function getJson<T>(
  url: string,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const res = await fetch(url);
    const body = await res.json();
    return res.ok
      ? { ok: true, data: body as T }
      : { ok: false, error: body.error ?? "Dat lukte niet." };
  } catch {
    return { ok: false, error: "Geen verbinding. Probeer het opnieuw." };
  }
}
