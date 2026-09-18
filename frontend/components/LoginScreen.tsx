"use client";

import { useState } from "react";

interface LoginScreenProps {
  onSignIn: (email: string) => void;
}

export default function LoginScreen({ onSignIn }: LoginScreenProps) {
  const [email, setEmail] = useState("");

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-4">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSignIn(email.trim() || "guest@prelegal.local");
        }}
        className="w-full max-w-sm rounded-lg border border-silver p-8 shadow-sm"
      >
        <h1 className="text-2xl font-bold text-navy">Prelegal</h1>
        <p className="mt-1 text-sm text-black">Draft legal agreements with confidence.</p>
        <label className="mt-6 block text-sm font-medium text-black">
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            className="mt-1 block w-full rounded-md border border-silver px-3 py-2 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
          />
        </label>
        <button
          type="submit"
          className="mt-6 w-full rounded-md bg-navy px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-navy/90 focus:outline-none focus:ring-2 focus:ring-gold"
        >
          Sign in
        </button>
        <p className="mt-4 text-xs text-black/60">
          Demo mode: no password required. Any email, or none, will get you in.
        </p>
      </form>
    </main>
  );
}
