"use client";

// Legacy compatibility:
// Some older routes still reference `pages/Common/ProfilePage`.
// The real profile UI (including profile picture upload + display) is implemented in the app router.
import ProfilePage from "@/app/requester/profile/page";

export default function CommonProfilePage() {
  return <ProfilePage />;
}

