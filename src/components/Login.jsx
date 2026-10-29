import { useState } from "react";
import { loadConfig } from "../lib/config";
import { DEFAULT_PASSWORD } from "../lib/constants";

export function Login({ onLogin, users }) {
  const [selectedUser, setSelectedUser] = useState(null);
  const [password, setPassword] = useState("");
  const [showError, setShowError] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const handleSignIn = async () => {
    if (password) {
      setIsSigningIn(true);
      // Default password is accepted unless the cached config shows this user has set their own.
      if (password === DEFAULT_PASSWORD) {
        try {
          const cachedConfig = localStorage.getItem("bmp_config_cache");
          if (cachedConfig) {
            const userPasswords = JSON.parse(cachedConfig).userPasswords || {};
            if (
              userPasswords[selectedUser] &&
              userPasswords[selectedUser] !== DEFAULT_PASSWORD
            ) {
              setIsSigningIn(false);
              setShowError(true);
              setPassword("");
              setTimeout(() => setShowError(false), 2500);
              return;
            }
          }
          onLogin(selectedUser);
          return;
        } catch {
          onLogin(selectedUser);
          return;
        }
      }
      try {
        const storedPassword = ((await loadConfig()).userPasswords || {})[
          selectedUser
        ];
        if (storedPassword && password === storedPassword) {
          onLogin(selectedUser);
        } else {
          setIsSigningIn(false);
          setShowError(true);
          setPassword("");
          setTimeout(() => setShowError(false), 2500);
        }
      } catch {
        setIsSigningIn(false);
        setShowError(true);
        setPassword("");
        setTimeout(() => setShowError(false), 2500);
      }
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
