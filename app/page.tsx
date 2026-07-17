import Link from "next/link";

const features = [
  {
    title: "Any size, 3 to 128",
    text: "No power-of-two rules. Byes are placed automatically so every bracket plays out fairly.",
    icon: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M4 5h5M4 10h5M9 7.5h4v9h4M4 14h5M4 19h5M9 16.5h4M17 12h3" />
      </svg>
    ),
  },
  {
    title: "Custom seeds",
    text: "Seed with anything — numbers, codes like E4 or R3-2, region tags. Your bracket, your labels.",
    icon: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" />
        <circle cx="7.5" cy="7.5" r="1.3" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    title: "Live scores",
    text: "Tap any match to record scores and advance winners. Change a result and the bracket updates itself.",
    icon: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20V10M18 20V4M6 20v-4" />
      </svg>
    ),
  },
  {
    title: "Save & share",
    text: "Create free with no signup. Make an account to keep brackets in the cloud and share a link to anyone.",
    icon: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 17.6A5 5 0 0 0 18 8h-1.3A8 8 0 1 0 4 16.3" />
        <path d="M12 12v9M8.5 15.5 12 12l3.5 3.5" />
      </svg>
    ),
  },
];

export default function Home() {
  return (
    <main className="container">
      <section className="hero">
        <h1>
          Tournament brackets,
          <br />
          <span className="accent">exactly your way.</span>
        </h1>
        <p>
          Build sleek single-elimination brackets for 3 to 128 players. Custom
          seeds, custom names, live scores — beautiful on your laptop and your
          phone.
        </p>
        <div className="hero-actions">
          <Link href="/new" className="btn primary">
            Create a bracket
          </Link>
          <Link href="/signup" className="btn">
            Make an account
          </Link>
        </div>
      </section>

      <section className="features">
        {features.map((f) => (
          <div key={f.title} className="card feature">
            <div className="icon">{f.icon}</div>
            <h3>{f.title}</h3>
            <p>{f.text}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
