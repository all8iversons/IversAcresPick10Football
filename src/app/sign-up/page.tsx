import Link from "next/link";
import { SignUpForm } from "@/components/auth/SignUpForm";

export default function SignUpPage() {
  return (
    <main className="content stack">
      <Link href="/" className="brand">
        Ivers Acres Pick 10
      </Link>
      <section className="card stack">
        <h1>Create an account</h1>
        <SignUpForm />
        <p className="muted">
          Already have an account? <Link href="/sign-in">Sign in</Link>
        </p>
      </section>
    </main>
  );
}
