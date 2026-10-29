export function Header({ user, isAdmin, onLogout }) {
  return (
    <>
      <div className="header">
        <div className="header-left">
          <div className="header-logo">
            Receipt<span>Tracker</span>
          </div>
          <div className="header-meta">
            <div className="header-user">{user}</div>
            {isAdmin && (
              <span
                style={{
                  fontSize: "14px",
                }}
                title="Admin active"
              >
                🔐
              </span>
            )}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            gap: "8px",
            alignItems: "center",
          }}
        >
          <button className="logout-btn" onClick={onLogout}>
            Log Out
          </button>
        </div>
      </div>
    </>
  );
}
