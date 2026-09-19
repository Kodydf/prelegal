"use client";

import AuthGate from "@/components/AuthGate";
import AppHeader from "@/components/AppHeader";
import DraftingApp from "@/components/DraftingApp";

export default function PlatformApp() {
  return (
    <AuthGate>
      {(user, signOut) => (
        <div className="min-h-full flex-1 bg-white">
          <AppHeader user={user} onSignOut={signOut} />
          <DraftingApp />
        </div>
      )}
    </AuthGate>
  );
}
