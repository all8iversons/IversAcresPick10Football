import Link from "next/link";

export default function HomePage() {
  return (
    <main className="page-shell">
      <header className="site-header">
        <Link className="brand" href="/">
          Ivers Acres Pick 10
        </Link>
        <Link href="/sign-in">Sign in</Link>
      </header>
      <section className="content hero">
        <p className="eyebrow">Your league. Your picks. Every week.</p>
        <h1>Pick ten. Back your teams.</h1>
        <p className="lead">
          Join a private NFL league, choose ten teams to win before kickoff, and
          follow the season with your friends.
        </p>
        <Link className="button" href="/sign-up">
          Create your account
        </Link>
      </section>
    </main>
  );
}
