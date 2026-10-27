import React, { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import NetInfo from "@react-native-community/netinfo";
import { SyncEngine } from "../src/services/syncEngine";
import { ActivityIndicator, View } from "react-native";
import { SessionProvider, useSession } from "../src/auth/SessionProvider";

export default function RootLayout() {
  return <SessionProvider><SessionNavigation /></SessionProvider>;
}

function SessionNavigation() {
  const { user, ready } = useSession();
  const [isConnected, setIsConnected] = useState<boolean | null>(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsConnected(state.isConnected);
      if (state.isConnected) {
        SyncEngine.processQueue();
      }
    });
    return () => unsubscribe();
  }, []);

  if (!ready) return <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}><ActivityIndicator accessibilityLabel="Đang khôi phục phiên đăng nhập" /></View>;

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!user}>
          <Stack.Screen name="(auth)/login" />
        </Stack.Protected>
        <Stack.Protected guard={!!user}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="note/[id]"
            options={{
              presentation: "card",
              headerShown: true,
              title: "Note Details",
            }}
          />
          <Stack.Screen
            name="modal"
            options={{ presentation: "modal", title: "Quick Actions" }}
          />
          <Stack.Screen name="+not-found" options={{ title: "Oops!" }} />
        </Stack.Protected>
      </Stack>
    </SafeAreaProvider>
  );
}
