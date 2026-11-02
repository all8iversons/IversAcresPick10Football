import Link from "next/link";

export default function HomePage() {
  return (
    <main className="page-shell">
      <header className="site-header">
        <Link className="brand" href="/">
          Ivers Acres Pick 10
        </Link>
      </header>
      <section className="content hero hero-centered">
        <p className="eyebrow">Your league. Your picks. Every week.</p>
        <h1>Pick ten. Back your teams.</h1>
        <p className="lead">
          Join a private NFL league, choose ten teams to win before kickoff, and
          follow the season with your friends.
        </p>
        <div className="hero-actions">
          <Link className="button" href="/sign-in">
            Sign in
          </Link>
          <Link className="button button-secondary" href="/sign-up">
            Create your account
          </Link>
        </div>
      </section>
    </main>
  );
}
