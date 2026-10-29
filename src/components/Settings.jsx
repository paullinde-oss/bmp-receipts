import { useEffect, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import { deleteObject, ref } from "firebase/storage";
import { loadConfig, saveConfig } from "../lib/config";
import {
  DEFAULT_FOLDERS,
  DEFAULT_PASSWORD,
  DEFAULT_SCAN_CAP,
  DEFAULT_USERS,
  folderEmoji,
} from "../lib/constants";
import { currentMonth } from "../lib/dates";
import { db, storage } from "../lib/firebase";

export function Settings({
  user,
  isAdmin,
  toast,
  onUsersChange,
  onExitAdmin,
  theme,
  onToggleTheme,
}) {
  const [adminPasswordInput, setAdminPasswordInput] = useState("");
  const [adminPasswordError, setAdminPasswordError] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const handleAdminUnlock = async () => {
    if (adminPasswordInput) {
      setIsUnlocking(true);
      try {
        // Prefer the locally cached config; fall back to Firestore, then a hardcoded default.
        const cachedConfigJson = localStorage.getItem("bmp_config_cache");
        const expectedAdminPassword =
          (cachedConfigJson ? JSON.parse(cachedConfigJson) : await loadConfig())
            .adminPassword || "bmp2024admin";
        if (adminPasswordInput === expectedAdminPassword) {
          localStorage.setItem("bmp_rt_admin", "true");
          window.location.reload();
        } else {
          setAdminPasswordError(true);
          setAdminPasswordInput("");
          setTimeout(() => setAdminPasswordError(false), 2000);
        }
      } catch {
        setAdminPasswordError(true);
        setAdminPasswordInput("");
        setTimeout(() => setAdminPasswordError(false), 2000);
      }
      setIsUnlocking(false);
    }
  };
  // Only used to display a masked preview of the current key; the real key lives in shared config.
  const [savedApiKey, setSavedApiKey] = useState(
    () => localStorage.getItem("bmp_rt_api_key") || "",
  );
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [apiKeySaved, setApiKeySaved] = useState(false);
  const handleSaveApiKey = async () => {
    const anthropicKey = apiKeyInput.trim();
    if (!anthropicKey.startsWith("sk-ant-")) {
      toast.error("Key should start with sk-ant-...");
      return;
    }
    await saveConfig({
      anthropicKey,
    });
    setSavedApiKey(anthropicKey);
    setApiKeyInput("");
    setApiKeySaved(true);
    setTimeout(() => setApiKeySaved(false), 2000);
    toast.success("✓ API key saved — all devices will use this key");
  };
  const [customFolders, setCustomFolders] = useState([]);
  const [newFolderName, setNewFolderName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [scanCap, setScanCap] = useState(DEFAULT_SCAN_CAP);
  const [users, setUsers] = useState(DEFAULT_USERS);
  const [newUserName, setNewUserName] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [confirmAdminPassword, setConfirmAdminPassword] = useState("");
  const [resetPasswordUser, setResetPasswordUser] = useState("");
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [purgeYears, setPurgeYears] = useState(2);
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [isSavingScanCap, setIsSavingScanCap] = useState(false);
  useEffect(() => {
    const storedFolders = localStorage.getItem(`bmp_folders_${user}`);
    if (storedFolders) {
      setCustomFolders(JSON.parse(storedFolders));
    }
    if (isAdmin) {
      loadConfig().then((config) => {
        if (config.scanCap) {
          setScanCap(config.scanCap);
        }
        if (config.users) {
          setUsers(config.users);
          setResetPasswordUser(config.users[0] || "");
        }
      });
    }
  }, [user, isAdmin]);
  const saveCustomFolders = (folders) => {
    setCustomFolders(folders);
    localStorage.setItem(`bmp_folders_${user}`, JSON.stringify(folders));
  };
  const handleAddFolder = () => {
    const folderName = newFolderName.trim();
    if (!folderName) {
      toast.error("Enter a folder name");
      return;
    }
    if (
      [...DEFAULT_FOLDERS, ...customFolders]
        .map((folder) => folder.toLowerCase())
        .includes(folderName.toLowerCase())
    ) {
      toast.error("Folder already exists");
      return;
    }
    saveCustomFolders([...customFolders, folderName]);
    setNewFolderName("");
    toast.success(`✓ "${folderName}" added`);
  };
  const handleRemoveFolder = (folderName) => {
    saveCustomFolders(customFolders.filter((folder) => folder !== folderName));
    toast.success(`✓ "${folderName}" removed`);
  };
  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("All fields required");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords don't match");
      return;
    }
    if (newPassword.length < 4) {
      toast.error("Password must be at least 4 characters");
      return;
    }
    setIsChangingPassword(true);
    try {
      const config = await loadConfig();
      const userPasswords = config.userPasswords || {};
      const expectedPassword =
        userPasswords[user] || config.defaultUserPassword || DEFAULT_PASSWORD;
      if (currentPassword !== expectedPassword) {
        toast.error("Current password is incorrect");
        setIsChangingPassword(false);
        return;
      }
      userPasswords[user] = newPassword;
      await saveConfig({
        userPasswords: userPasswords,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("✓ Password updated");
    } catch {
      toast.error("Failed to update password");
    }
    setIsChangingPassword(false);
  };
  const handleSaveScanCap = async () => {
    setIsSavingScanCap(true);
    await saveConfig({
      scanCap: parseInt(scanCap),
    });
    toast.success("✓ Scan cap updated");
    setIsSavingScanCap(false);
  };
  const handleResetScanCounter = async () => {
    if (db) {
      await setDoc(doc(db, "scanUsage", currentMonth()), {
        count: 0,
        month: currentMonth(),
      });
      toast.success("✓ Scan counter reset");
    }
  };
  const handleAddUser = async () => {
    const userName = newUserName.trim();
    if (!userName || users.includes(userName)) {
      toast.error("Invalid or duplicate name");
      return;
    }
    const updatedUsers = [...users, userName];
    setUsers(updatedUsers);
    await saveConfig({
      users: updatedUsers,
    });
    onUsersChange(updatedUsers);
    setNewUserName("");
    toast.success(`✓ ${userName} added`);
  };
  const handleRemoveUser = async (userName) => {
    const updatedUsers = users.filter(
      (existingUser) => existingUser !== userName,
    );
    setUsers(updatedUsers);
    await saveConfig({
      users: updatedUsers,
    });
    onUsersChange(updatedUsers);
    toast.success(`✓ ${userName} removed`);
  };
  const handleSaveAdminPassword = async () => {
    if (!newAdminPassword || newAdminPassword !== confirmAdminPassword) {
      toast.error("Passwords don't match");
      return;
    }
    if (newAdminPassword.length < 6) {
      toast.error("Must be at least 6 characters");
      return;
    }
    await saveConfig({
      adminPassword: newAdminPassword,
    });
    setNewAdminPassword("");
    setConfirmAdminPassword("");
    toast.success("✓ Admin password updated");
  };
  const handleResetUserPassword = async () => {
    if (!resetPasswordUser || !resetPasswordValue) {
      toast.error("Select a user and enter a new password");
      return;
    }
    if (resetPasswordValue.length < 4) {
      toast.error("Password must be at least 4 characters");
      return;
    }
    const userPasswords = (await loadConfig()).userPasswords || {};
    userPasswords[resetPasswordUser] = resetPasswordValue;
    await saveConfig({
      userPasswords: userPasswords,
    });
    setResetPasswordValue("");
    toast.success(`✓ Password reset for ${resetPasswordUser}`);
  };
  const handlePurgeOldReceipts = async () => {
    if (!db || !storage) {
      toast.error("Firebase not configured");
      return;
    }
    setIsPurging(true);
    try {
      const cutoffDate = new Date();
      cutoffDate.setFullYear(cutoffDate.getFullYear() - purgeYears);
      const cutoffDateStr = cutoffDate.toISOString().split("T")[0];
      const oldReceiptsQuery = query(
        collection(db, "receipts"),
        where("date", "<", cutoffDateStr),
      );
      const snapshot = await getDocs(oldReceiptsQuery);
      if (snapshot.empty) {
        toast.info(`No receipts older than ${purgeYears} years`);
        setIsPurging(false);
        setShowPurgeConfirm(false);
        return;
      }
      let deletedCount = 0;
      for (const receiptDoc of snapshot.docs) {
        const receipt = receiptDoc.data();
        if (receipt.storagePath) {
          try {
            await deleteObject(ref(storage, receipt.storagePath));
          } catch {}
        }
        await deleteDoc(doc(db, "receipts", receiptDoc.id));
        deletedCount++;
      }
      toast.success(
        `✓ Deleted ${deletedCount} receipts older than ${purgeYears} years`,
      );
      setShowPurgeConfirm(false);
    } catch (error) {
      toast.error(`Purge failed: ${error.message}`);
    }
    setIsPurging(false);
  };
  return (
    <div>
      <p className="section-title">My Settings</p>
      <div
        className="settings-section"
        style={{
          marginBottom: "16px",
        }}
      >
        <div className="settings-section-title">🎨 Appearance</div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "4px 0",
          }}
        >
          <span
            style={{
              fontSize: "14px",
              color: "var(--text)",
            }}
          >
            Dark Mode
          </span>
          <button
            onClick={onToggleTheme}
            style={{
              background:
                theme === "dark" ? "var(--accent)" : "var(--surface2)",
              border: "1px solid var(--border)",
              borderRadius: "20px",
              padding: "6px 16px",
              cursor: "pointer",
              color: theme === "dark" ? "#fff" : "var(--text)",
              fontSize: "13px",
              fontWeight: "600",
            }}
          >
            {theme === "dark" ? "🌙 On" : "☀️ Off"}
          </button>
        </div>
      </div>
      {isAdmin ? (
        <div
          className="settings-section"
          style={{
            marginBottom: "16px",
            borderColor: "rgba(167,139,250,0.3)",
          }}
        >
          <div
            className="settings-section-title"
            style={{
              color: "var(--admin)",
            }}
          >
            🔐 Admin Active
          </div>
          <div
            style={{
              fontSize: "13px",
              color: "var(--text-muted)",
              marginBottom: "12px",
            }}
          >
            You currently have admin access enabled.
          </div>
          <button
            className="secondary-btn"
            style={{
              width: "100%",
              padding: "12px",
            }}
            onClick={onExitAdmin}
          >
            Exit Admin Mode
          </button>
        </div>
      ) : (
        <div
          className="settings-section"
          style={{
            marginBottom: "16px",
          }}
        >
          <div className="settings-section-title">🔐 Admin Access</div>
          <div className="form-row">
            <input
              className="form-input"
              type="password"
              value={adminPasswordInput}
              onChange={(e) => {
                setAdminPasswordInput(e.target.value);
                setAdminPasswordError(false);
              }}
              onKeyDown={(e) => e.key === "Enter" && handleAdminUnlock()}
              placeholder="Admin password..."
              style={
                adminPasswordError
                  ? {
                      borderColor: "var(--accent2)",
                    }
                  : {}
              }
            />
          </div>
          {adminPasswordError && (
            <div
              style={{
                fontSize: "12px",
                color: "var(--accent2)",
                marginBottom: "10px",
              }}
            >
              Incorrect password
            </div>
          )}
          <button
            className="admin-btn"
            style={{
              width: "100%",
              padding: "12px",
            }}
            onClick={handleAdminUnlock}
            disabled={isUnlocking}
          >
            {isUnlocking ? (
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                }}
              >
                <span
                  style={{
                    width: "12px",
                    height: "12px",
                    border: "2px solid rgba(167,139,250,0.3)",
                    borderTopColor: "var(--admin)",
                    borderRadius: "50%",
                    display: "inline-block",
                    animation: "spin 0.7s linear infinite",
                  }}
                />
                Unlocking...
              </span>
            ) : (
              "Unlock Admin"
            )}
          </button>
        </div>
      )}
      <div className="settings-section">
        <div className="settings-section-title">📂 Default Folders</div>
        {DEFAULT_FOLDERS.map((folder) => (
          <div key={folder} className="settings-row">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <span
                style={{
                  fontSize: "18px",
                }}
              >
                {folderEmoji(folder)}
              </span>
              <div className="settings-label">{folder}</div>
            </div>
            <span
              style={{
                fontSize: "11px",
                color: "var(--text-muted)",
              }}
            >
              Default
            </span>
          </div>
        ))}
        {customFolders.length > 0 && (
          <>
            <div className="divider" />
            <div
              className="settings-section-title"
              style={{
                marginBottom: "12px",
              }}
            >
              ✨ My Custom Folders
            </div>
            {customFolders.map((folder) => (
              <div key={folder} className="settings-row">
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "18px",
                    }}
                  >
                    📁
                  </span>
                  <div className="settings-label">{folder}</div>
                </div>
                <button
                  className="danger-btn"
                  style={{
                    padding: "6px 14px",
                    fontSize: "12px",
                  }}
                  onClick={() => handleRemoveFolder(folder)}
                >
                  Remove
                </button>
              </div>
            ))}
          </>
        )}
        <div className="divider" />
        <div
          style={{
            display: "flex",
            gap: "8px",
          }}
        >
          <input
            className="form-input"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="New folder name..."
            onKeyDown={(e) => e.key === "Enter" && handleAddFolder()}
            style={{
              flex: 1,
            }}
          />
          <button
            className="secondary-btn"
            onClick={handleAddFolder}
            style={{
              flexShrink: 0,
            }}
          >
            Add
          </button>
        </div>
        <div
          style={{
            fontSize: "11px",
            color: "var(--text-muted)",
            marginTop: "10px",
            textAlign: "center",
          }}
        >
          Custom folders are only visible to you
        </div>
      </div>
      <div className="settings-section">
        <div className="settings-section-title">🔑 Change My Password</div>
        <div className="form-row">
          <label className="form-label">Current Password</label>
          <input
            className="form-input"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Current password..."
          />
        </div>
        <div className="form-row">
          <label className="form-label">New Password</label>
          <input
            className="form-input"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password..."
          />
        </div>
        <div className="form-row">
          <label className="form-label">Confirm New Password</label>
          <input
            className="form-input"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm password..."
            onKeyDown={(e) => e.key === "Enter" && handleChangePassword()}
          />
        </div>
        <button
          className="submit-btn"
          style={{
            padding: "13px",
          }}
          onClick={handleChangePassword}
          disabled={isChangingPassword}
        >
          {isChangingPassword ? "Saving..." : "Update Password"}
        </button>
      </div>
      {isAdmin && (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              margin: "24px 0 16px",
            }}
          >
            <div
              style={{
                flex: 1,
                height: "1px",
                background: "var(--border)",
              }}
            />
            <div className="admin-badge">🔐 Admin Settings</div>
            <div
              style={{
                flex: 1,
                height: "1px",
                background: "var(--border)",
              }}
            />
          </div>
          <div className="settings-section">
            <div className="settings-section-title">🔑 AI Scan API Key</div>
            <div
              style={{
                fontSize: "12px",
                color: "var(--text-muted)",
                marginBottom: "12px",
              }}
            >
              {savedApiKey
                ? `Current key: ${savedApiKey.slice(0, 12)}...${savedApiKey.slice(-4)}`
                : "No key set — scanning won't work until this is added"}
            </div>
            <div className="form-row">
              <label className="form-label">New API Key</label>
              <input
                className="form-input"
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="sk-ant-..."
              />
            </div>
            <button
              className="submit-btn"
              style={{
                padding: "13px",
              }}
              onClick={handleSaveApiKey}
            >
              {apiKeySaved ? "✓ Saved!" : "Update API Key"}
            </button>
          </div>
          <div className="settings-section">
            <div className="settings-section-title">👥 Manage Users</div>
            {users.map((userName) => (
              <div key={userName} className="settings-row">
                <div className="settings-label">{userName}</div>
                {userName !== user ? (
                  <button
                    className="danger-btn"
                    style={{
                      padding: "6px 12px",
                      fontSize: "12px",
                    }}
                    onClick={() => handleRemoveUser(userName)}
                  >
                    Remove
                  </button>
                ) : (
                  <span
                    style={{
                      fontSize: "11px",
                      color: "var(--text-muted)",
                    }}
                  >
                    You
                  </span>
                )}
              </div>
            ))}
            <div className="divider" />
            <div
              style={{
                display: "flex",
                gap: "8px",
              }}
            >
              <input
                className="form-input"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                placeholder="New user name..."
                onKeyDown={(e) => e.key === "Enter" && handleAddUser()}
                style={{
                  flex: 1,
                }}
              />
              <button className="secondary-btn" onClick={handleAddUser}>
                Add
              </button>
            </div>
          </div>
          <div className="settings-section">
            <div className="settings-section-title">🔄 Reset User Password</div>
            <div className="form-row">
              <label className="form-label">User</label>
              <select
                className="form-select"
                value={resetPasswordUser}
                onChange={(e) => setResetPasswordUser(e.target.value)}
              >
                {users.map((userName) => (
                  <option key={userName}>{userName}</option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label className="form-label">New Password</label>
              <input
                className="form-input"
                type="password"
                value={resetPasswordValue}
                onChange={(e) => setResetPasswordValue(e.target.value)}
                placeholder="New password for this user..."
                onKeyDown={(e) =>
                  e.key === "Enter" && handleResetUserPassword()
                }
              />
            </div>
            <button
              className="submit-btn"
              style={{
                padding: "13px",
              }}
              onClick={handleResetUserPassword}
            >
              Reset Password
            </button>
          </div>
          <div className="settings-section">
            <div className="settings-section-title">💰 Monthly AI Scan Cap</div>
            <div className="settings-row">
              <div>
                <div className="settings-label">Scans per month</div>
                <div className="settings-sub">400 ≈ $10 max</div>
              </div>
              <input
                className="form-input"
                type="number"
                value={scanCap}
                onChange={(e) => setScanCap(e.target.value)}
                style={{
                  width: "100px",
                  textAlign: "center",
                }}
              />
            </div>
            <div
              style={{
                display: "flex",
                gap: "8px",
                marginTop: "8px",
              }}
            >
              <button
                className="submit-btn"
                style={{
                  flex: 1,
                  padding: "11px",
                }}
                onClick={handleSaveScanCap}
                disabled={isSavingScanCap}
              >
                {isSavingScanCap ? "Saving..." : "Save Cap"}
              </button>
              <button
                className="secondary-btn"
                style={{
                  flex: 1,
                }}
                onClick={handleResetScanCounter}
              >
                Reset Counter
              </button>
            </div>
          </div>
          <div className="settings-section">
            <div className="settings-section-title">
              🔑 Change Admin Password
            </div>
            <div className="form-row">
              <label className="form-label">New Password</label>
              <input
                className="form-input"
                type="password"
                value={newAdminPassword}
                onChange={(e) => setNewAdminPassword(e.target.value)}
                placeholder="New admin password..."
              />
            </div>
            <div className="form-row">
              <label className="form-label">Confirm Password</label>
              <input
                className="form-input"
                type="password"
                value={confirmAdminPassword}
                onChange={(e) => setConfirmAdminPassword(e.target.value)}
                placeholder="Confirm..."
                onKeyDown={(e) =>
                  e.key === "Enter" && handleSaveAdminPassword()
                }
              />
            </div>
            <button
              className="submit-btn"
              style={{
                padding: "13px",
              }}
              onClick={handleSaveAdminPassword}
            >
              Update Admin Password
            </button>
          </div>
          <div className="settings-section">
            <div className="settings-section-title">🗑️ Purge Old Data</div>
            <div
              className="settings-row"
              style={{
                marginBottom: "16px",
              }}
            >
              <div>
                <div className="settings-label">Delete receipts older than</div>
                <div className="settings-sub">
                  Permanently removes photos + records
                </div>
              </div>
              <select
                className="form-select"
                value={purgeYears}
                onChange={(e) => setPurgeYears(parseInt(e.target.value))}
                style={{
                  width: "110px",
                }}
              >
                <option value={1}>1 year</option>
                <option value={2}>2 years</option>
                <option value={3}>3 years</option>
              </select>
            </div>
            {showPurgeConfirm ? (
              <div className="warn-box">
                <div
                  style={{
                    fontWeight: "600",
                    marginBottom: "8px",
                  }}
                >
                  ⚠️ Are you sure?
                </div>
                <div
                  style={{
                    fontSize: "12px",
                    marginBottom: "14px",
                  }}
                >
                  Permanently deletes all receipts and photos older than{" "}
                  {purgeYears} year{purgeYears !== 1 ? "s" : ""}. Cannot be
                  undone.
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                  }}
                >
                  <button
                    className="danger-btn"
                    style={{
                      flex: 1,
                      padding: "10px",
                    }}
                    onClick={handlePurgeOldReceipts}
                    disabled={isPurging}
                  >
                    {isPurging ? "Deleting..." : "Yes, Delete"}
                  </button>
                  <button
                    className="secondary-btn"
                    style={{
                      flex: 1,
                    }}
                    onClick={() => setShowPurgeConfirm(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                className="danger-btn"
                style={{
                  width: "100%",
                  padding: "12px",
                }}
                onClick={() => setShowPurgeConfirm(true)}
              >
                🗑️ Purge Data Older Than {purgeYears} Year
                {purgeYears !== 1 ? "s" : ""}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
