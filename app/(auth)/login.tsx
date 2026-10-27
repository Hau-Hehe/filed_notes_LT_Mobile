import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import { useSession } from "../../src/auth/SessionProvider";

export default function LoginScreen() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const { busy, error, retrySignOut, signIn, signOut } = useSession();

  const handleLogin = async () => {
    if (busy) return;
    await signIn(username, password);
    setPassword("");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Field Notes</Text>
      <Text style={styles.subtitle}>DNTU Mobile App Project</Text>
      <TextInput
        style={styles.input}
        placeholder="Username / Student ID"
        placeholderTextColor="#888"
        value={username}
        onChangeText={setUsername}
        accessibilityLabel="Username input"
        editable={!busy}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#888"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        accessibilityLabel="Password input"
        editable={!busy}
      />
      <TouchableOpacity
        style={styles.button}
        onPress={handleLogin}
        accessibilityRole="button"
        accessibilityLabel="Đăng nhập Field Notes"
        accessibilityState={{ disabled: busy, busy }}
        disabled={busy}
      >
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign In</Text>}
      </TouchableOpacity>
      {error && (
        <View>
          <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
          {retrySignOut && <TouchableOpacity style={styles.retry} accessibilityRole="button" accessibilityLabel="Thử xóa phiên đăng nhập lại" disabled={busy} onPress={() => { void signOut(); }}>
            <Text>Thử xóa phiên lại</Text>
          </TouchableOpacity>}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  error: { color: "#b00020", marginTop: 16 },
  retry: { minHeight: 44, minWidth: 44, justifyContent: "center", alignItems: "center" },
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#f5f5f7",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    textAlign: "center",
    color: "#1c1c1e",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    color: "#636366",
    marginBottom: 32,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: "#c7c7cc",
    borderRadius: 10,
    paddingHorizontal: 16,
    backgroundColor: "#fff",
    marginBottom: 16,
    fontSize: 16,
  },
  button: {
    height: 50,
    backgroundColor: "#007aff",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 10,
  },
  buttonText: { color: "#fff", fontSize: 18, fontWeight: "600" },
});
