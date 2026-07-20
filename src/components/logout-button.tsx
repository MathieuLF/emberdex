"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui";

export function LogoutButton() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function logout() {
    setIsPending(true);

    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/");
      router.refresh();
    } catch {
      router.refresh();
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Button type="button" variant="ghost" className="min-h-9 px-3 py-2 text-xs" onClick={() => void logout()} disabled={isPending}>
      <LogOut className="h-3.5 w-3.5" />
      {isPending ? "Fermeture..." : "Se déconnecter"}
    </Button>
  );
}
