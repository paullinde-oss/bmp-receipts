export const APP_VERSION = "v2.2";

// Fallback password for any user without an entry in appConfig/settings.userPasswords.
export const DEFAULT_PASSWORD = "BMP2026";

// Monthly AI scan limit used when appConfig/settings.scanCap is not set.
export const DEFAULT_SCAN_CAP = 400;

// Used until appConfig/settings.users loads (and if it has no users list).
export const DEFAULT_USERS = [
  "Paul",
  "Grant",
  "Mark",
  "Jeff",
  "Jim",
  "Tammy",
  "Adam",
  "Anita",
];

export const DEFAULT_FOLDERS = ["Gas", "Auto", "Food/Entertainment", "Misc"];

const FOLDER_EMOJI = {
  Gas: "⛽",
  Auto: "🚗",
  "Food/Entertainment": "🍽️",
  Misc: "📦",
};

export const folderEmoji = (folder) => FOLDER_EMOJI[folder] || "📁";
