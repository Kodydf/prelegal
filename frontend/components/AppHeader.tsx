import type { User } from "@/lib/auth";

export type View = "draft" | "documents";

interface AppHeaderProps {
  user: User;
  view: View;
  onNavigate: (view: View) => void;
  onSignOut: () => void;
}

const NAV: { view: View; label: string }[] = [
  { view: "draft", label: "New document" },
  { view: "documents", label: "My documents" },
];

export default function AppHeader({ user, view, onNavigate, onSignOut }: AppHeaderProps) {
  return (
    <header className="border-b-4 border-gold bg-navy text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 sm:px-8">
        <div className="flex items-center gap-8">
          <span className="text-lg font-bold tracking-wide">Prelegal</span>
          <nav aria-label="Main" className="flex items-center gap-1">
            {NAV.map((item) => (
              <button
                key={item.view}
                type="button"
                onClick={() => onNavigate(item.view)}
                aria-current={view === item.view ? "page" : undefined}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-gold ${
                  view === item.view ? "bg-white/15 text-white" : "text-white/75 hover:bg-white/10 hover:text-white"
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="hidden text-silver sm:inline">{user.email}</span>
          <button
            type="button"
            onClick={onSignOut}
            className="rounded-md border border-silver px-3 py-1 font-medium transition-colors hover:bg-white hover:text-navy focus:outline-none focus:ring-2 focus:ring-gold"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
