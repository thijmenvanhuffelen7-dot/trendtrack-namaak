/** Lopende tekst op de publieke site (juridische pagina's, blog). Eén kolom van ~66 tekens. */
export function Prose({ children }: { children: React.ReactNode }) {
  return <div className="s-prose max-w-[66ch]">{children}</div>;
}

/** Tekst onder een PageTitle, in dezelfde kolom als de titel. */
export function Column({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-12 grid gap-6 md:grid-cols-[var(--s-axis)_1fr]">
      <div className="md:col-start-2">{children}</div>
    </div>
  );
}

export function PageTitle({
  title,
  lead,
  aside,
  size = "lg",
}: {
  title: string;
  lead?: string;
  aside?: React.ReactNode;
  size?: "lg" | "md";
}) {
  return (
    <div className="grid gap-6 md:grid-cols-[var(--s-axis)_1fr]">
      <div className="order-2 text-[15px] text-[var(--s-muted)] md:order-none md:pt-3">{aside}</div>
      <div>
        <h1
          style={{
            fontSize: size === "lg" ? "clamp(2.6rem, 6.4vw, 6rem)" : "clamp(2.2rem, 4.2vw, 4rem)",
            lineHeight: 0.95,
          }}
        >
          {title}
        </h1>
        {lead && <p className="mt-6 max-w-[48ch] text-[var(--step-lead)] leading-[1.35]">{lead}</p>}
      </div>
    </div>
  );
}
