import * as Location from "expo-location";

const MAX_CACHE_AGE_MS = 2 * 60 * 1000;
const MAX_CACHE_ACCURACY_METERS = 100;
let currentRequest: Promise<Location.LocationObject> | null = null;

export function hasValidCoordinates(
  latitude: unknown,
  longitude: unknown,
): boolean {
  return (
    typeof latitude === "number" && Number.isFinite(latitude) &&
    latitude >= -90 && latitude <= 90 &&
    typeof longitude === "number" && Number.isFinite(longitude) &&
    longitude >= -180 && longitude <= 180
  );
}

async function withDeadline<T>(request: Promise<T>, milliseconds: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      request,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Location request timed out.")), milliseconds);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function getDeviceLocation(requestPermission = true) {
  let permission = await Location.getForegroundPermissionsAsync();
  if (permission.status !== "granted" && requestPermission && permission.canAskAgain) {
    permission = await Location.requestForegroundPermissionsAsync();
  }
  if (permission.status !== "granted") {
    throw new Error("Allow location access while using the app in Android Settings, then try GPS again.");
  }
  if (!(await Location.hasServicesEnabledAsync())) {
    throw new Error("Location services are off. Turn on Location in device Settings, then try again.");
  }

  try {
    // A UI deadline cannot cancel the native request. Reuse it until it settles
    // instead of starting more native requests after repeated timeouts.
    if (!currentRequest) {
      const request = Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      currentRequest = request;
      const release = () => { if (currentRequest === request) currentRequest = null; };
      void request.then(release, release);
    }
    const position = await withDeadline(currentRequest, 20000);
    if (!hasValidCoordinates(position.coords.latitude, position.coords.longitude)) {
      throw new Error("Invalid location coordinates.");
    }
    return { position, cached: false };
  } catch {
    try {
      const position = await withDeadline(Location.getLastKnownPositionAsync({
        maxAge: MAX_CACHE_AGE_MS,
        requiredAccuracy: MAX_CACHE_ACCURACY_METERS,
      }), 3000);
      if (position && hasValidCoordinates(position.coords.latitude, position.coords.longitude) &&
        Number.isFinite(position.timestamp) && Date.now() - position.timestamp >= 0 &&
        Date.now() - position.timestamp <= MAX_CACHE_AGE_MS &&
        position.coords.accuracy !== null && Number.isFinite(position.coords.accuracy) &&
        position.coords.accuracy >= 0 && position.coords.accuracy <= MAX_CACHE_ACCURACY_METERS) {
        return { position, cached: true };
      }
    } catch {
      // Report one actionable error if both current and recent cached fixes fail.
    }
    throw new Error("No current location or recent accurate location is available. On Android Emulator, send a location in Extended Controls > Location, then retry. Existing note coordinates have not been changed.");
  }
}
