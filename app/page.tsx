import { listCards } from "@/lib/store";

export default function Home() {
  const cards = listCards();
  return (
    <main>
      <h1>Aangan</h1>
      <p className="sub">Memory Lane — our family timeline.</p>
      {cards.length === 0 && <p>No cards yet. Upload the first memory.</p>}
      {cards.map((card) => (
        <article className="card" key={card.id}>
          <time>{card.takenAt.slice(0, 10)}</time>
          <h2>{card.caption}</h2>
          <p>{card.summary}</p>
          <div>
            <span className="badge">{card.type}</span>
            <span className="badge">{card.lang}</span>
            {card.ritualSlug && <span className="badge">{card.ritualSlug}</span>}
          </div>
        </article>
      ))}
    </main>
  );
}
