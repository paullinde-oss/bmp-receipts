import { doc, getDoc, increment, setDoc } from "firebase/firestore";
import { currentMonth } from "./dates";
import { db } from "./firebase";

// appConfig/settings is cached in memory and in localStorage ("bmp_config_cache")
// for CONFIG_TTL_MS. A fresh localStorage copy is returned immediately and
// refreshed from Firestore in the background.
const CACHE_KEY = "bmp_config_cache";
const CONFIG_TTL_MS = 5 * 60 * 1000;
let configCache = null;
let configCachedAt = 0;

const settingsDoc = () => doc(db, "appConfig", "settings");
const scanUsageDoc = () => doc(db, "scanUsage", currentMonth());

function storeConfig(config) {
  configCache = config;
  configCachedAt = Date.now();
  localStorage.setItem(CACHE_KEY, JSON.stringify(config));
}

export async function loadConfig(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && configCache && now - configCachedAt < CONFIG_TTL_MS) {
    return configCache;
  }
  const stored = localStorage.getItem(CACHE_KEY);
  if (!forceRefresh && stored) {
    const config = JSON.parse(stored);
    if (now - config._cachedAt < CONFIG_TTL_MS) {
      configCache = config;
      configCachedAt = config._cachedAt;
      if (db) {
        getDoc(settingsDoc())
          .then((snap) => {
            if (snap.exists()) {
              storeConfig({ ...snap.data(), _cachedAt: Date.now() });
            }
          })
          .catch(() => {});
      }
      return config;
    }
  }
  if (!db) {
    return {};
  }
  try {
    const snap = await getDoc(settingsDoc());
    const config = snap.exists()
      ? { ...snap.data(), _cachedAt: Date.now() }
      : { _cachedAt: Date.now() };
    storeConfig(config);
    return config;
  } catch {
    return stored ? JSON.parse(stored) : {};
  }
}

// Merges `updates` into appConfig/settings and invalidates the cache.
export async function saveConfig(updates) {
  if (db) {
    await setDoc(settingsDoc(), updates, { merge: true });
    configCache = null;
    configCachedAt = 0;
    localStorage.removeItem(CACHE_KEY);
  }
}

// Counts one AI scan against this month's usage. Returns false if the cap is
// already reached. Fails open (returns true) if Firestore is unavailable.
export async function tryConsumeScan(cap) {
  if (!db) {
    return true;
  }
  try {
    const usageRef = scanUsageDoc();
    const snap = await getDoc(usageRef);
    const count = (snap.exists() && snap.data().count) || 0;
    if (count >= cap) {
      return false;
    }
    await setDoc(
      usageRef,
      { count: increment(1), month: currentMonth() },
      { merge: true },
    );
    return true;
  } catch {
    return true;
  }
}

export async function getScanCount() {
  if (!db) {
    return 0;
  }
  try {
    const snap = await getDoc(scanUsageDoc());
    return (snap.exists() && snap.data().count) || 0;
  } catch {
    return 0;
  }
}
