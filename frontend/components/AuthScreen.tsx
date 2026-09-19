"use client";

import { useState } from "react";
import { ApiError, GENERIC_ERROR } from "@/lib/api";
import { MIN_PASSWORD_LENGTH, signIn, signUp, type User } from "@/lib/auth";

type Mode = "signin" | "signup";

const inputClass =
  "mt-1.5 block w-full rounded-lg border border-silver bg-white px-3.5 py-2.5 text-sm text-black shadow-sm placeholder:text-black/40 focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/20";

const FEATURES = [
  "Chat with an assistant instead of filling in long forms",
  "Eleven standard agreements, from NDAs to cloud contracts",
  "Every draft saved, so you can pick up where you left off",
];

interface AuthScreenProps {
  onAuthenticated: (user: User) => void;
  /** Shown above the form, e.g. when a session has expired. */
  notice?: string | null;
}

export default function AuthScreen({ onAuthenticated, notice }: AuthScreenProps) {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isSignUp = mode === "signup";

  const switchMode = () => {
    setMode(isSignUp ? "signin" : "signup");
    setError(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;
    if (isSignUp && password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const user = await (isSignUp ? signUp : signIn)(email, password);
      onAuthenticated(user);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : GENERIC_ERROR);
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col lg:flex-row">
      <section className="flex flex-col justify-between bg-navy px-8 py-10 text-white lg:w-[45%] lg:px-16 lg:py-16">
        <div>
          <p className="text-2xl font-bold tracking-wide">Prelegal</p>
          <div className="mt-2 h-1 w-12 rounded bg-gold" />
        </div>
        <div className="my-10 lg:my-0">
          <h1 className="text-3xl font-semibold leading-tight lg:text-4xl">Draft legal agreements, in plain conversation.</h1>
          <ul className="mt-8 space-y-4 text-white/90">
            {FEATURES.map((feature) => (
              <li key={feature} className="flex items-start gap-3 text-sm lg:text-base">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gold" aria-hidden />
                {feature}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-white/70">
          Documents are drafts and are subject to legal review. Prelegal provides drafting assistance, not legal advice.
        </p>
      </section>

      <section className="flex flex-1 items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-semibold text-navy">{isSignUp ? "Create your account" : "Welcome back"}</h2>
          <p className="mt-1 text-sm text-black/60">
            {isSignUp ? "Sign up to start drafting agreements." : "Sign in to continue to your documents."}
          </p>

          {notice ? (
            <p role="status" className="mt-6 rounded-lg border border-silver border-l-4 border-l-gold px-4 py-3 text-sm text-black">
              {notice}
            </p>
          ) : null}

          <form onSubmit={handleSubmit} className="mt-6 space-y-5" noValidate>
            <label className="block text-sm font-medium text-black">
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                placeholder="you@company.com"
                required
                className={inputClass}
              />
            </label>
            <label className="block text-sm font-medium text-black">
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={isSignUp ? "new-password" : "current-password"}
                required
                className={inputClass}
              />
              {isSignUp ? (
                <span className="mt-1 block text-xs font-normal text-black/60">
                  At least {MIN_PASSWORD_LENGTH} characters.
                </span>
              ) : null}
            </label>

            {error ? (
              <p role="alert" className="rounded-lg border border-navy border-l-4 border-l-gold bg-white px-4 py-3 text-sm text-black">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting || email.trim().length === 0 || password.length === 0}
              className="w-full rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-navy/90 focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-silver"
            >
              {isSubmitting ? "Please wait…" : isSignUp ? "Create account" : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-black/70">
            {isSignUp ? "Already have an account?" : "New to Prelegal?"}{" "}
            <button
              type="button"
              onClick={switchMode}
              className="font-semibold text-navy underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-gold"
            >
              {isSignUp ? "Sign in" : "Create an account"}
            </button>
          </p>
          <p className="mt-8 text-center text-xs text-black/50">
            This is a demo environment: accounts and documents are cleared whenever the server restarts.
          </p>
        </div>
      </section>
    </main>
  );
}
