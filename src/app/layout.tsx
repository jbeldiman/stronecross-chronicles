import "./globals.css";

export const metadata = {
  title: "Stonecross Chronicles",
  description: "A tabletop RPG campaign companion",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <header style={{ padding: "1rem 2rem", borderBottom: "1px solid #222" }}>
          <nav style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
            <a href="/" style={{ fontWeight: 700 }}>
              Stonecross
            </a>
            <a href="/login">Login</a>
            <a href="/character">Character</a>
            <a href="/map">Map</a>
            <a href="/shops">Shops</a>
            <a href="/old-gods">The Old Gods</a>
            <a href="/combat">Combat</a>
            <a href="/dm">DM</a>
          </nav>
        </header>

        <div style={{ padding: "2rem" }}>{children}</div>
      </body>
    </html>
  );
}
