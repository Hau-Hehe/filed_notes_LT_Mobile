import React, { createContext, useContext, useEffect, useSyncExternalStore } from "react";
import * as SecureStore from "expo-secure-store";
import { createSessionController } from "../services/session";

const session = createSessionController(SecureStore);
const SessionContext = createContext<typeof session | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => { void session.restore(); }, []);
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const controller = useContext(SessionContext);
  if (!controller) throw new Error("SessionProvider is required.");
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  return { ...state, signIn: controller.signIn, signOut: controller.signOut };
}
