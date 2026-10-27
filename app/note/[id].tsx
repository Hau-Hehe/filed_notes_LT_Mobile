import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { Ionicons } from "@expo/vector-icons";
import { Note } from "../../src/types";
import { StorageService } from "../../src/services/storage";
import { SyncEngine } from "../../src/services/syncEngine";
import { getDeviceLocation, hasValidCoordinates } from "../../src/services/location";

export default function NoteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === "new";

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("General");
  const [imageUri, setImageUri] = useState<string | undefined>();
  const [location, setLocation] = useState<
    { latitude: number; longitude: number } | undefined
  >();
  const [noteObj, setNoteObj] = useState<Note | null>(null);
  const [locating, setLocating] = useState(false);
  const locatingRef = useRef(false);
  const mountedRef = useRef(true);
  const routeIdRef = useRef(id);
  useLayoutEffect(() => { routeIdRef.current = id; }, [id]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!isNew) {
      StorageService.getNotes().then((notes) => {
        const found = notes.find((n) => n.id === id);
        if (found) {
          setNoteObj(found);
          setTitle(found.title);
          setContent(found.content);
          setCategory(found.category);
          setImageUri(found.imageUri);
          if (hasValidCoordinates(found.latitude, found.longitude)) {
            setLocation({
              latitude: found.latitude!,
              longitude: found.longitude!,
            });
          }
        }
      });
    }
  }, [id, isNew]);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0].uri) {
      // Compress image
      const manipulated = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 800 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
      );
      setImageUri(manipulated.uri);
    }
  };

  const captureLocation = async () => {
    if (locatingRef.current) return;
    locatingRef.current = true;
    setLocating(true);
    const requestedId = id;
    try {
      const { position, cached } = await getDeviceLocation();
      if (!mountedRef.current || routeIdRef.current !== requestedId) return;
      setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      Alert.alert("GPS attached", cached
        ? "Using a recent location (at most 2 minutes old, accuracy within 100 m). Save the note to keep it."
        : "Current coordinates attached. Save the note to keep them.");
    } catch (error) {
      if (mountedRef.current && routeIdRef.current === requestedId) {
        Alert.alert("Unable to get GPS", error instanceof Error ? error.message : "Please try GPS again.");
      }
    } finally {
      locatingRef.current = false;
      if (mountedRef.current) setLocating(false);
    }
  };

  const handleSave = async () => {
    if (locatingRef.current) return;
    if (!title.trim() || !content.trim()) {
      Alert.alert("Validation Error", "Title and content cannot be empty.");
      return;
    }

    const notes = await StorageService.getNotes();
    const now = new Date().toISOString();

    if (isNew) {
      const newNote: Note = {
        id: Date.now().toString(),
        title,
        content,
        category,
        imageUri,
        latitude: location?.latitude,
        longitude: location?.longitude,
        createdAt: now,
        updatedAt: now,
        syncStatus: "pending",
        retryCount: 0,
      };
      notes.unshift(newNote);
      await StorageService.saveNotes(notes);
      await SyncEngine.enqueueOperation("CREATE", newNote);
    } else if (noteObj) {
      const updatedNote: Note = {
        ...noteObj,
        title,
        content,
        category,
        imageUri,
        latitude: location?.latitude ?? noteObj.latitude,
        longitude: location?.longitude ?? noteObj.longitude,
        updatedAt: now,
        syncStatus: "pending",
      };
      const index = notes.findIndex((n) => n.id === id);
      if (index !== -1) notes[index] = updatedNote;
      await StorageService.saveNotes(notes);
      await SyncEngine.enqueueOperation("UPDATE", updatedNote);
    }

    router.back();
  };

  return (
    <ScrollView style={styles.container}>
      <TextInput
        style={styles.inputTitle}
        placeholder="Note Title"
        placeholderTextColor="#888"
        value={title}
        onChangeText={setTitle}
      />
      <TextInput
        style={styles.inputContent}
        placeholder="Note content & observations..."
        placeholderTextColor="#888"
        multiline
        value={content}
        onChangeText={setContent}
      />

      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.actionBtn} onPress={pickImage}>
          <Ionicons name="camera" size={20} color="#007aff" />
          <Text style={styles.actionText}>Attach Photo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, locating && styles.disabled]} onPress={captureLocation} disabled={locating} accessibilityRole="button" accessibilityState={{ disabled: locating, busy: locating }}>
          {locating ? <ActivityIndicator color="#007aff" /> : <Ionicons name="location" size={20} color="#007aff" />}
          <Text style={styles.actionText}>{locating ? "Getting GPS..." : "Tag GPS"}</Text>
        </TouchableOpacity>
      </View>

      {imageUri && (
        <Image source={{ uri: imageUri }} style={styles.previewImage} />
      )}
      {location && (
        <Text style={styles.locationText}>
          GPS: {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
        </Text>
      )}

      <TouchableOpacity style={[styles.saveButton, locating && styles.disabled]} onPress={handleSave} disabled={locating}>
        <Text style={styles.saveButtonText}>Save Field Note</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  disabled: { opacity: 0.5 },
  container: { flex: 1, backgroundColor: "#fff", padding: 16 },
  inputTitle: {
    fontSize: 22,
    fontWeight: "bold",
    borderBottomWidth: 1,
    borderColor: "#e5e5ea",
    paddingBottom: 8,
    marginBottom: 16,
  },
  inputContent: {
    fontSize: 16,
    height: 160,
    textAlignVertical: "top",
    borderWidth: 1,
    borderColor: "#e5e5ea",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  actionsRow: { flexDirection: "row", gap: 12, marginBottom: 16 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    backgroundColor: "#f2f2f7",
    borderRadius: 8,
    gap: 8,
  },
  actionText: { color: "#007aff", fontWeight: "600" },
  previewImage: {
    width: "100%",
    height: 200,
    borderRadius: 8,
    marginBottom: 16,
  },
  locationText: {
    fontSize: 14,
    color: "#34c759",
    marginBottom: 16,
    fontWeight: "500",
  },
  saveButton: {
    backgroundColor: "#007aff",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 12,
    marginBottom: 40,
  },
  saveButtonText: { color: "#fff", fontSize: 18, fontWeight: "bold" },
});
