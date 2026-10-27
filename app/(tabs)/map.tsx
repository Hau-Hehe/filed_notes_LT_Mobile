import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, Platform } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE, type LatLng } from "react-native-maps";
import { useFocusEffect } from "expo-router";
import { Note } from "../../src/types";
import { StorageService } from "../../src/services/storage";
import { getDeviceLocation, hasValidCoordinates } from "../../src/services/location";

export default function MapScreen() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [notesLoaded, setNotesLoaded] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<LatLng | null>(null);
  const [locationMessage, setLocationMessage] = useState("Checking location...");
  const [locating, setLocating] = useState(false);
  const [locationChecked, setLocationChecked] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapSlow, setMapSlow] = useState(false);
  const mapRef = useRef<MapView>(null);
  const locatingRef = useRef(false);
  const mountedRef = useRef(true);
  const positionedRef = useRef(false);
  const userMovedRef = useRef(false);

  const locate = useCallback(async (requestPermission: boolean) => {
    if (locatingRef.current) return;
    locatingRef.current = true;
    setLocating(true);
    try {
      const { position, cached } = await getDeviceLocation(requestPermission);
      if (!mountedRef.current) return;
      setCurrentLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      setLocationMessage(cached ? "Recent location: at most 2 minutes old, accuracy within 100 m." : "Current GPS location available.");
    } catch (error) {
      if (mountedRef.current) {
        setCurrentLocation(null);
        setLocationMessage(error instanceof Error ? error.message : "GPS unavailable. Saved note markers are still shown.");
      }
    } finally {
      locatingRef.current = false;
      if (mountedRef.current) {
        setLocating(false);
        setLocationChecked(true);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    // Start after the initial render; cancel if the screen unmounts first.
    const timer = setTimeout(() => { void locate(false); }, 0);
    return () => { clearTimeout(timer); mountedRef.current = false; };
  }, [locate]);

  useEffect(() => {
    if (mapLoaded) return;
    const timer = setTimeout(() => setMapSlow(true), 15000);
    return () => clearTimeout(timer);
  }, [mapLoaded]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      StorageService.getNotes().then((data) => {
        if (active) { setNotes(data); setNotesLoaded(true); }
      }).catch(() => {
        if (active) { setNotesLoaded(true); setLocationMessage("Unable to read saved notes. Reopen this tab to retry."); }
      });
      return () => { active = false; };
    }, []),
  );

  const notesWithLocation = useMemo(
    () => notes.filter((n) => hasValidCoordinates(n.latitude, n.longitude)),
    [notes],
  );
  const coordinates = useMemo(() => {
    const points: LatLng[] = notesWithLocation.map((n) => ({ latitude: n.latitude!, longitude: n.longitude! }));
    if (currentLocation) points.push(currentLocation);
    return points;
  }, [notesWithLocation, currentLocation]);

  const fitLocations = useCallback((points: LatLng[]) => {
    if (!mapReady || !mapRef.current || points.length === 0) return;
    if (points.length === 1) {
      mapRef.current.animateToRegion({ ...points[0], latitudeDelta: 0.02, longitudeDelta: 0.02 }, 400);
    } else {
      mapRef.current.fitToCoordinates(points, { edgePadding: { top: 180, right: 50, bottom: 70, left: 50 }, animated: true });
    }
  }, [mapReady]);

  useEffect(() => {
    if (!mapReady || !notesLoaded || positionedRef.current || userMovedRef.current) return;
    // Fit saved notes without waiting for GPS. If there are no notes, wait for
    // the first location attempt; later camera changes require an explicit tap.
    if (notesWithLocation.length === 0 && !locationChecked) return;
    if (coordinates.length > 0) {
      fitLocations(coordinates);
      positionedRef.current = true;
    }
  }, [mapReady, notesLoaded, notesWithLocation.length, locationChecked, coordinates, fitLocations]);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
        mapType="standard"
        userInterfaceStyle="light"
        onMapReady={() => setMapReady(true)}
        onMapLoaded={() => { setMapLoaded(true); setMapSlow(false); }}
        onPanDrag={() => { userMovedRef.current = true; }}
        onRegionChangeComplete={(_, details) => { if (details?.isGesture) userMovedRef.current = true; }}
      >
        {notesWithLocation.map((note) => (
          <Marker
            key={note.id}
            coordinate={{
              latitude: note.latitude!,
              longitude: note.longitude!,
            }}
            title={note.title}
            description={note.content}
          />
        ))}
        {currentLocation && (
          <Marker coordinate={currentLocation} pinColor="#007aff" title="Device location" description={locationMessage} />
        )}
      </MapView>
      <View style={styles.overlay}>
        <Text style={styles.overlayText}>
          {notesWithLocation.length} Geotagged Notes
        </Text>
        <Text style={styles.statusText}>{locationMessage}</Text>
        {mapSlow && <Text style={styles.statusText}>Map background is taking longer to load. Check the emulator internet connection and Google Maps services.</Text>}
        <View style={styles.buttons}>
          <TouchableOpacity style={styles.button} disabled={locating} onPress={() => { void locate(true); }} accessibilityRole="button" accessibilityState={{ disabled: locating, busy: locating }}>
            {locating ? <ActivityIndicator color="#fff" /> : <Text style={styles.overlayText}>Retry GPS</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, (!mapReady || coordinates.length === 0) && styles.disabled]} disabled={!mapReady || coordinates.length === 0} onPress={() => { positionedRef.current = true; fitLocations(coordinates); }} accessibilityRole="button">
            <Text style={styles.overlayText}>Show all locations</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width: "100%", height: "100%" },
  overlay: {
    position: "absolute",
    top: 16,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.75)",
    maxWidth: "92%",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  overlayText: { color: "#fff", fontWeight: "bold", fontSize: 14 },
  statusText: { color: "#fff", fontSize: 12, marginTop: 6 },
  buttons: { flexDirection: "row", gap: 8, marginTop: 10 },
  button: { backgroundColor: "#007aff", borderRadius: 8, padding: 8 },
  disabled: { opacity: 0.5 },
});
