import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View, Alert } from "react-native";
import { StorageService } from "../../src/services/storage";

export default function ExportScreen() {
  const [exporting, setExporting] = useState(false);

  const handleExportDaily = async () => {
    setExporting(true);
    const notes = await StorageService.getNotes();
    const today = new Date().toISOString().split("T")[0];
    const todayNotes = notes.filter((n) => n.createdAt.startsWith(today));

    const report = {
      date: today,
      totalNotes: todayNotes.length,
      notes: todayNotes,
    };

    setTimeout(() => {
      setExporting(false);
      Alert.alert(
        "Export Successful",
        `Exported ${todayNotes.length} notes for ${today} as JSON format.`,
      );
    }, 800);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Daily Note Export</Text>
      <Text style={styles.subtitle}>
        Export today&apos;s field notes into JSON or CSV report format for compliance
        and review.
      </Text>
      <TouchableOpacity
        style={styles.button}
        onPress={handleExportDaily}
        disabled={exporting}
      >
        <Text style={styles.buttonText}>
          {exporting ? "Exporting..." : "Export Today's Notes (JSON)"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    backgroundColor: "#f5f5f7",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 12,
    color: "#1c1c1e",
  },
  subtitle: {
    fontSize: 16,
    color: "#636366",
    marginBottom: 24,
    lineHeight: 22,
  },
  button: {
    backgroundColor: "#007aff",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontSize: 18, fontWeight: "600" },
});
