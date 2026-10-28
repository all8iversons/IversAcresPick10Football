import Link from "next/link";
import { SignInForm } from "@/components/auth/SignInForm";

export default function SignInPage() {
  return (
    <main className="content stack">
      <Link href="/" className="brand">
        Ivers Acres Pick 10
      </Link>
      <section className="card stack">
        <h1>Sign in</h1>
        <SignInForm />
        <p className="muted">
          New here? <Link href="/sign-up">Create an account</Link>
        </p>
      </section>
    </main>
  );
}
