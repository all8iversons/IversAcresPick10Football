import Link from "next/link";
import { SignInForm } from "@/components/auth/SignInForm";

export default function SignInPage() {
  return (
    <main className="content auth-center">
      <Link href="/" className="brand">
        Ivers Acres Pick 10
      </Link>
      <section className="card stack">
        <h1>Sign in</h1>
        <SignInForm />
      </section>
      <Link className="button button-secondary" href="/sign-up">
        Create your account
      </Link>
    </main>
  );
}
