import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Abre as ligações enviadas por e-mail (confirmação de conta e recuperação de
 * palavra-passe). O token chega no `#hash` do URL; aqui validamo-lo e
 * encaminhamos a pessoa para o ecrã certo.
 */
export function AuthLinkCatcher() {
  const nav = useNavigate();
  const { session, loading } = useAuth();
  const done = useRef(false);

  useEffect(() => {
    if (done.current || loading || session) return;
    const h = window.location.hash;
    if (!h.includes("token_hash") && !h.includes("confirmation_token") && !h.includes("type=recovery")) return;
    done.current = true;

    const p = new URLSearchParams(h.replace(/^#/, ""));
    const token = p.get("token_hash") ?? p.get("confirmation_token") ?? "";
    const type = (p.get("type") ?? "signup") as "signup" | "recovery" | "email" | "invite";

    (async () => {
      if (!token) return;
      const { error } = await supabase.auth.verifyOtp({ token_hash: token, type });
      if (error) {
        toast.error("Essa ligação deixou de ser válida. Peça uma nova.");
        nav({ to: "/login" });
        return;
      }
      history.replaceState(null, "", window.location.pathname + window.location.search);
      nav({ to: type === "recovery" ? "/reset-password" : "/onboarding" });
    })();
  }, [session, loading, nav]);

  return null;
}
