import React from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from "react-native";
import { useSession } from "./SessionProvider";

export function SignOutButton() {
  const { busy, signOut } = useSession();
  return (
    <TouchableOpacity
      style={styles.button}
      accessibilityRole="button"
      accessibilityLabel="Đăng xuất khỏi Field Notes"
      accessibilityState={{ disabled: busy, busy }}
      disabled={busy}
      onPress={() => { void signOut(); }}
    >
      {busy ? <ActivityIndicator /> : <Text style={styles.text}>Đăng xuất</Text>}
    </TouchableOpacity>
  );
}
const styles = StyleSheet.create({
  button: { minWidth: 44, minHeight: 44, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  text: { color: "#007aff", fontWeight: "600" },
});
