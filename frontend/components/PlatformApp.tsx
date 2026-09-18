"use client";

import AuthGate from "@/components/AuthGate";
import AppHeader from "@/components/AppHeader";
import NdaApp from "@/components/NdaApp";

export default function PlatformApp() {
  return (
    <AuthGate>
      {(user, signOut) => (
        <div className="min-h-full flex-1 bg-white">
          <AppHeader user={user} onSignOut={signOut} />
          <NdaApp />
        </div>
      )}
    </AuthGate>
  );
}
