"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const AUTH_SESSION_KEY = "stonecross.session.v1";

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    try {
      localStorage.removeItem(AUTH_SESSION_KEY);
    } catch {}
    router.replace("/login");
  }, [router]);

  return (
    <main className="sc-page" style={{ padding: "2rem" }}>
      Logging out…
    </main>
  );
}
