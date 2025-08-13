import { supa } from "./api/supabase";

export type SessionInfo = {
  userId: string | null;
  email: string | null;
  role: "admin" | "user" | null;
  displayName: string | null;
};

export async function getSessionInfo(): Promise<SessionInfo> {
  const { data: { session } } = await supa.auth.getSession();
  if (!session?.user) return { userId: null, email: null, role: null, displayName: null };

  const userId = session.user.id;
  const email = session.user.email ?? null;
  // Carga perfil (rol y nombre)
  const { data: prof } = await supa.from("profiles").select("display_name, role").eq("id", userId).maybeSingle();
  return {
    userId,
    email,
    role: (prof?.role ?? "user") as "admin" | "user",
    displayName: prof?.display_name ?? (email ? email.split("@")[0] : "Yo")
  };
}

export async function signInWithMagic(email: string) {
  const base = import.meta.env.VITE_SITE_URL as string;
  const redirectTo = base.endsWith("/") ? base + "#/fiestas" : base + "/#/fiestas";
  const { error } = await supa.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo }
  });
  if (error) throw error;
}

export async function signOut() {
  await supa.auth.signOut();
}

export function onAuthChange(cb: () => void) {
  const { data: sub } = supa.auth.onAuthStateChange((_event, _session) => cb());
  return () => sub.subscription.unsubscribe();
}