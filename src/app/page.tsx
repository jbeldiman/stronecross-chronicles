export default function HomePage() {
  return (
    <main className="sc-page">
      <div
        className="sc-bg"
        style={{ backgroundImage: "url('/backgrounds/home.jpg')" }}
      />
      <div className="sc-overlay" />

      <div className="sc-content" style={{ padding: "2rem" }}>
        <h1>Stonecross Chronicles</h1>
        <p>Welcome. Choose where to go:</p>
        <ul>
          <li><a href="/login">Login</a></li>
          <li><a href="/character">Character</a></li>
          <li><a href="/map">Map</a></li>
          <li><a href="/combat">Combat</a></li>
          <li><a href="/dm">DM</a></li>
        </ul>
      </div>
    </main>
  );
}
