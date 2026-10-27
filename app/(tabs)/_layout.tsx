import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SignOutButton } from "../../src/auth/SignOutButton";

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: "#007aff", headerRight: () => <SignOutButton /> }}>
      <Tabs.Screen
        name="index"
        options={{
          title: "Notes",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="document-text" size={size} color={typeof color === "number" ? undefined : color ?? undefined} />
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: "Map View",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="map" size={size} color={typeof color === "number" ? undefined : color ?? undefined} />
          ),
        }}
      />
      <Tabs.Screen
        name="export"
        options={{
          title: "Export",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="download" size={size} color={typeof color === "number" ? undefined : color ?? undefined} />
          ),
        }}
      />
    </Tabs>
  );
}
