import { useState } from "react";
import { loadConfig } from "../lib/config";
import { DEFAULT_PASSWORD } from "../lib/constants";

export function Login({ onLogin, users }) {
  const [selectedUser, setSelectedUser] = useState(null);
  const [password, setPassword] = useState("");
  const [showError, setShowError] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const rejectPassword = () => {
    setIsSigningIn(false);
    setShowError(true);
    setPassword("");
    setTimeout(() => setShowError(false), 2500);
  };
  // A user with an entry in userPasswords must use it; anyone else uses the
  // default password. Always checked against loadConfig() (Firestore, or its
  // fresh cache) so a missing local cache can't let the default password
  // through for a user who has set their own.
  const handleSignIn = async () => {
    if (!password) {
      return;
    }
    setIsSigningIn(true);
    let storedPassword;
    try {
      storedPassword = ((await loadConfig()).userPasswords || {})[selectedUser];
    } catch {}
    if (password === (storedPassword || DEFAULT_PASSWORD)) {
      onLogin(selectedUser);
    } else {
      rejectPassword();
    }
  };
  if (selectedUser) {
    return (
      <div className="login-screen">
        <div className="login-logo">
          <div className="brand">BMP Supplies</div>
          <h1>
            Receipt<span>Tracker</span>
          </h1>
        </div>
        <div
          style={{
            width: "100%",
            maxWidth: "360px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <div
            style={{
              textAlign: "center",
              marginBottom: "4px",
            }}
          >
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                background: "var(--surface2)",
                border: "2px solid var(--accent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "22px",
                fontFamily: "var(--font-head)",
                fontWeight: "700",
                color: "var(--accent)",
                margin: "0 auto 10px",
              }}
            >
              {selectedUser[0]}
            </div>
            <div
              style={{
                fontFamily: "var(--font-head)",
                fontSize: "20px",
                fontWeight: "700",
              }}
            >
              {selectedUser}
            </div>
            <div
              style={{
                fontSize: "12px",
                color: "var(--text-muted)",
                marginTop: "4px",
              }}
            >
              Enter your password to continue
            </div>
          </div>
          <input
            className="admin-input"
            type="password"
            placeholder="Password..."
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setShowError(false);
            }}
            onKeyDown={(event) => event.key === "Enter" && handleSignIn()}
            style={
              showError
                ? {
                    borderColor: "var(--accent2)",
                    fontSize: "16px",
                  }
                : {
                    fontSize: "16px",
                  }
            }
            disabled={isSigningIn}
            autoFocus
          />
          {showError && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                fontSize: "13px",
                color: "var(--accent2)",
                fontWeight: "600",
              }}
            >
              ✕ Incorrect password
            </div>
          )}
          <button
            className="submit-btn"
            onClick={handleSignIn}
            disabled={isSigningIn}
            style={
              isSigningIn
                ? {
                    opacity: 0.85,
                  }
                : {}
            }
          >
            {isSigningIn ? (
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
                    width: "14px",
                    height: "14px",
                    border: "2px solid rgba(26,8,0,0.3)",
                    borderTopColor: "#1a0800",
                    borderRadius: "50%",
                    display: "inline-block",
                    animation: "spin 0.7s linear infinite",
                  }}
                />
                Signing In...
              </span>
            ) : (
              "Sign In"
            )}
          </button>
          <button
            className="secondary-btn"
            style={{
              textAlign: "center",
            }}
            onClick={() => {
              setSelectedUser(null);
              setPassword("");
              setShowError(false);
              setIsSigningIn(false);
            }}
          >
            ← Back
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="login-screen">
      <div className="login-logo">
        <div className="brand">BMP Supplies</div>
        <h1>
          Receipt<span>Tracker</span>
        </h1>
        <div className="tagline">Tap your name to sign in</div>
      </div>
      <div className="user-grid">
        {users.map((userName) => (
          <button
            key={userName}
            className="user-btn"
            onClick={() => setSelectedUser(userName)}
          >
            <div className="avatar">{userName[0]}</div>
            {userName}
          </button>
        ))}
      </div>
    </div>
  );
}
