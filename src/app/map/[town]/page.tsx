interface TownPageProps {
  params: {
    town: string;
  };
}

export default function TownPage({ params }: TownPageProps) {
  return (
    <main style={{ padding: "2rem" }}>
      <h1>Town: {params.town}</h1>
      <p>Map and NPCs for this location will appear here.</p>
    </main>
  );
}
