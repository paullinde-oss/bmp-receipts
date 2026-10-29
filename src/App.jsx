import { useEffect, useRef, useState } from "react";
import { AdminView } from "./components/AdminView";
import { Capture } from "./components/Capture";
import { Header } from "./components/Header";
import { Home } from "./components/Home";
import { Login } from "./components/Login";
import { Settings } from "./components/Settings";
import { Splash } from "./components/Splash";
import { useToast } from "./hooks/useToast";
import { loadConfig } from "./lib/config";
import { APP_VERSION, DEFAULT_USERS } from "./lib/constants";

export default function App() {
  const [user, setUser] = useState(
    () => localStorage.getItem("bmp_rt_user") || null,
  );
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem("bmp_rt_theme");
    return (
      savedTheme ||
      (window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark")
    );
  });
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("bmp_rt_theme", theme);
  }, [theme]);
  const onToggleTheme = () =>
    setTheme((prev) => {
      if (prev === "dark") {
        return "light";
      }
      return "dark";
    });
  const [isAdmin, setIsAdmin] = useState(
    () => localStorage.getItem("bmp_rt_admin") === "true",
  );
  const [unusedFlag, setUnusedFlag] = useState(true);
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  const [tab, setTab] = useState("myreceipts");
  const [fabOpen, setFabOpen] = useState(false);
  const [fabAction, setFabAction] = useState(null);
  const [fabFile, setFabFile] = useState(null);
  const cameraInputRef = useRef(null);
  const rollInputRef = useRef(null);
  const uploadInputRef = useRef(null);
  const [users, setUsers] = useState(DEFAULT_USERS);
  const toast = useToast();
  useEffect(() => {
    loadConfig().then((config) => {
      if (config.users) {
        setUsers(config.users);
      }
    });
  }, []);
  const onLogin = (name) => {
    localStorage.setItem("bmp_rt_user", name);
    setUser(name);
    setTab("myreceipts");
  };
  const onLogout = () => {
    localStorage.removeItem("bmp_rt_user");
    localStorage.removeItem("bmp_rt_admin");
    setUser(null);
    setIsAdmin(false);
  };
  const tabs = isAdmin
    ? [
        {
          id: "myreceipts",
          icon: "🗂",
          label: "Receipts",
        },
        {
          id: "admin",
          icon: "🔐",
          label: "All",
        },
        {
          id: "settings",
          icon: "⚙️",
          label: "Settings",
        },
      ]
    : [
        {
          id: "myreceipts",
          icon: "🗂",
          label: "Receipts",
        },
        {
          id: "settings",
          icon: "⚙️",
          label: "Settings",
        },
      ];
  return (
    <div className="app-wrap">
      <Splash />
      {user ? (
        <>
          <Header user={user} isAdmin={isAdmin} onLogout={onLogout} />
          <div className="tabs">
            {tabs.map((t) => (
              <button
                key={t.id}
                className={`tab${t.admin ? " admin-tab" : ""}${tab === t.id ? " active" : ""}`}
                onClick={() => setTab(t.id)}
              >
                <span className="tab-icon">{t.icon}</span>
                <span className="tab-label">{t.label}</span>
              </button>
            ))}
          </div>
          <div className="main">
            {tab === "capture" && (
              <Capture
                user={user}
                toast={toast}
                fabAction={fabAction}
                fabFile={fabFile}
                onFabActionDone={() => {
                  setFabAction(null);
                  setFabFile(null);
                }}
                onSaved={() => setTab("myreceipts")}
              />
            )}
            {tab === "myreceipts" && <Home user={user} toast={toast} />}
            {tab === "admin" && <AdminView toast={toast} />}
            {tab === "settings" && (
              <Settings
                user={user}
                isAdmin={isAdmin}
                toast={toast}
                onUsersChange={setUsers}
                onExitAdmin={() => {
                  localStorage.removeItem("bmp_rt_admin");
                  setIsAdmin(false);
                  setTab("myreceipts");
                }}
                theme={theme}
                onToggleTheme={onToggleTheme}
              />
            )}
          </div>
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{
              display: "none",
            }}
            onChange={(e) => {
              if (e.target.files[0]) {
                setTab("capture");
                setFabAction("camera_file");
                setFabFile(e.target.files[0]);
              }
              e.target.value = "";
            }}
          />
          <input
            ref={rollInputRef}
            type="file"
            accept="image/*"
            style={{
              display: "none",
            }}
            onChange={(e) => {
              if (e.target.files[0]) {
                setTab("capture");
                setFabAction("roll_file");
                setFabFile(e.target.files[0]);
              }
              e.target.value = "";
            }}
          />
          <input
            ref={uploadInputRef}
            type="file"
            accept="image/*,application/pdf,.pdf"
            style={{
              display: "none",
            }}
            onChange={(e) => {
              if (e.target.files[0]) {
                setTab("capture");
                setFabAction("upload_file");
                setFabFile(e.target.files[0]);
              }
              e.target.value = "";
            }}
          />
          {tab !== "settings" && tab !== "admin" && tab !== "capture" && (
            <>
              {fabOpen && (
                <>
                  <div
                    style={{
                      position: "fixed",
                      inset: 0,
                      zIndex: 89,
                    }}
                    onClick={() => setFabOpen(false)}
                  />
                  <div className="fab-sheet">
                    <button
                      className="fab-option"
                      onClick={() => {
                        setFabOpen(false);
                        cameraInputRef.current?.click();
                      }}
                    >
                      📷 Take Photo
                    </button>
                    <button
                      className="fab-option"
                      onClick={() => {
                        setFabOpen(false);
                        rollInputRef.current?.click();
                      }}
                    >
                      🖼 {isMobile ? "Camera Roll" : "Choose Image"}
                    </button>
                    {!isMobile && (
                      <button
                        className="fab-option"
                        onClick={() => {
                          setFabOpen(false);
                          uploadInputRef.current?.click();
                        }}
                      >
                        ⬆ Upload File (PDF/Image)
                      </button>
                    )}
                    <button
                      className="fab-option"
                      onClick={() => {
                        setFabOpen(false);
                        setTab("capture");
                        setFabAction("manual");
                        setFabFile(null);
                      }}
                    >
                      ✏️ Enter Manually
                    </button>
                  </div>
                </>
              )}
              <button
                className="fab"
                onClick={() => setFabOpen((open) => !open)}
              >
                {fabOpen ? "✕" : "+"}
              </button>
            </>
          )}
        </>
      ) : (
        <Login onLogin={onLogin} users={users} />
      )}
      <div className="toast-wrap">
        {toast.toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            {t.msg}
          </div>
        ))}
      </div>
      <div
        style={{
          position: "fixed",
          bottom: "calc(62px + env(safe-area-inset-bottom, 0px))",
          right: "10px",
          fontSize: "9px",
          color: "var(--text-muted)",
          opacity: 0.4,
          pointerEvents: "none",
          zIndex: 50,
        }}
      >
        {APP_VERSION}
      </div>
    </div>
  );
}
