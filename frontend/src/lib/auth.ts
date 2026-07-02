import { useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { tokenStore, userStore, type StoredUser } from "./api";

export function useCurrentUser(): StoredUser | null {
  // Starts null on both server and client render so hydration text matches;
  // real value (from localStorage) is applied only after mount.
  const [user, setUser] = useState<StoredUser | null>(null);
  useEffect(() => {
    setUser(userStore.get());
    const onStorage = () => setUser(userStore.get());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return user;
}

export function useRequireAuth() {
  const router = useRouter();
  useEffect(() => {
    if (typeof window !== "undefined" && !tokenStore.get()) {
      router.navigate({ to: "/login" });
    }
  }, [router]);
}

export function logout() {
  tokenStore.clear();
  window.location.assign("/login");
}
