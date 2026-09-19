"use client";

import { useState } from "react";
import { Alert, focusRing, primaryButtonClass } from "@/components/ui";
import { errorMessage } from "@/lib/api";
import { MIN_PASSWORD_LENGTH, signIn, signUp, type User } from "@/lib/auth";
import { SITE_DISCLAIMER } from "@/lib/disclaimer";

type Mode = "signin" | "signup";

const inputClass =
  "mt-1.5 block w-full rounded-lg border border-silver bg-white px-3.5 py-2.5 text-sm text-black shadow-sm placeholder:text-black/60 focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/20";

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
      setError(errorMessage(err));
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col lg:flex-row">
      {/* On phones this is just a compact brand bar so the form is visible straight away. */}
      <section className="flex flex-col justify-between bg-navy px-6 py-5 text-white lg:w-[45%] lg:px-16 lg:py-16">
        <div>
          <p className="text-2xl font-bold tracking-wide">Prelegal</p>
          <div className="mt-2 h-1 w-12 rounded bg-gold" />
        </div>
        <div className="my-10 hidden lg:block">
          <p className="text-4xl font-semibold leading-tight">Draft legal agreements, in plain conversation.</p>
          <ul className="mt-8 space-y-4 text-white/90">
            {FEATURES.map((feature) => (
              <li key={feature} className="flex items-start gap-3 text-base">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gold" aria-hidden />
                {feature}
              </li>
            ))}
          </ul>
        </div>
        <p className="hidden text-xs text-white/80 lg:block">{SITE_DISCLAIMER}</p>
      </section>

      <section className="flex flex-1 items-center justify-center bg-white px-6 py-10 lg:py-12">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-semibold text-navy">{isSignUp ? "Create your account" : "Welcome back"}</h1>
          <p className="mt-1 text-sm text-black/60">
            {isSignUp ? "Sign up to start drafting agreements." : "Sign in to continue to your documents."}
          </p>

          {notice ? (
            <Alert role="status" className="mt-6">
              {notice}
            </Alert>
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

            {error ? <Alert>{error}</Alert> : null}

            <button
              type="submit"
              disabled={isSubmitting || email.trim().length === 0 || password.length === 0}
              className={`${primaryButtonClass} w-full py-2.5`}
            >
              {isSubmitting ? "Please wait…" : isSignUp ? "Create account" : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-black/70">
            {isSignUp ? "Already have an account?" : "New to Prelegal?"}{" "}
            <button
              type="button"
              onClick={switchMode}
              className={`rounded font-semibold text-navy underline-offset-2 hover:underline ${focusRing}`}
            >
              {isSignUp ? "Sign in" : "Create an account"}
            </button>
          </p>
          <p className="mt-8 text-center text-xs text-black/60">
            This is a demo environment: accounts and documents are cleared whenever the server restarts.
          </p>
          <p className="mt-3 text-center text-xs text-black/60 lg:hidden">{SITE_DISCLAIMER}</p>
        </div>
      </section>
    </main>
  );
}
