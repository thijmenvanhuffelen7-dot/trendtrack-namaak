"use client";

/** Laatste vangnet als zelfs een root-layout faalt. Bewust zonder externe styles. */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="nl">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#0b3a31",
          color: "#fff",
          fontFamily: "system-ui, sans-serif",
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 420 }}>
          <h1 style={{ fontSize: 32, margin: 0 }}>Er ging iets mis.</h1>
          <p style={{ opacity: 0.8, lineHeight: 1.5 }}>
            Probeer het opnieuw. Blijft het misgaan, mail ons dan.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 8,
              padding: "12px 18px",
              borderRadius: 999,
              border: 0,
              background: "#fff",
              color: "#0f1412",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Opnieuw proberen
          </button>
        </div>
      </body>
    </html>
  );
}
