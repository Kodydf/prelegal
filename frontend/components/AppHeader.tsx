import type { FakeUser } from "@/lib/auth";

export default function AppHeader({ user, onSignOut }: { user: FakeUser; onSignOut: () => void }) {
  return (
    <header className="border-b-4 border-gold bg-navy text-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-8">
        <span className="text-lg font-bold tracking-wide">Prelegal</span>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-silver">{user.email}</span>
          <button
            type="button"
            onClick={onSignOut}
            className="rounded-md border border-silver px-3 py-1 font-medium transition-colors hover:bg-white hover:text-navy"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
