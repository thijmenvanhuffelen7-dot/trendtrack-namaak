/** Lopende tekst op de publieke site (juridische pagina's, blog). Eén kolom van ~68 tekens. */
export function Prose({ children }: { children: React.ReactNode }) {
  return <div className="s-prose max-w-[68ch]">{children}</div>;
}

/** Inhoud onder een PageTitle. */
export function Column({ children }: { children: React.ReactNode }) {
  return <div className="mt-12 min-w-0">{children}</div>;
}

/** Kop van een subpagina: kruimel of datum klein erboven, dan de titel met verloop en de intro. */
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
    <div className="max-w-4xl">
      {aside && <div className="s-rise mb-6 text-[14px] text-[var(--s-muted)]">{aside}</div>}
      <h1
        className="s-rise-2"
        style={{
          fontSize: size === "lg" ? "var(--step-display)" : "clamp(2.1rem, 1.4rem + 2.4vw, 3.4rem)",
        }}
      >
        {title}
      </h1>
      {lead && (
        <p className="s-rise-3 mt-6 max-w-[42rem] text-[var(--step-lead)] leading-relaxed text-[#c4c4cc]">
          {lead}
        </p>
      )}
    </div>
  );
}

/** Wrapper voor een subpagina: gloed bovenaan, ruimte onder de kopbalk. */
export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="s-glow relative">
      <div className="s-wrap pt-16 pb-[clamp(80px,9vw,140px)] md:pt-24">{children}</div>
    </div>
  );
}
