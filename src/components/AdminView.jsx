import { useEffect, useState } from "react";
import { collection, getDocs, query } from "firebase/firestore";
import { ReceiptList } from "./ReceiptList";
import { getScanCount, loadConfig } from "../lib/config";
import { DEFAULT_SCAN_CAP, DEFAULT_USERS } from "../lib/constants";
import { today } from "../lib/dates";
import { db } from "../lib/firebase";

export function AdminView({ toast }) {
  const [allReceipts, setAllReceipts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [dateTo, setDateTo] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, "0")}`;
  });
  const [vendorSearch, setVendorSearch] = useState("");
  const [userFilter, setUserFilter] = useState("All");
  const [hasLoaded, setHasLoaded] = useState(false);
  const [scanCount, setScanCount] = useState(null);
  const [scanCap, setScanCap] = useState(DEFAULT_SCAN_CAP);
  const [users, setUsers] = useState(DEFAULT_USERS);
  const [exportUser, setExportUser] = useState("All");
  const [exportFrom, setExportFrom] = useState("");
  const [exportTo, setExportTo] = useState("");
  useEffect(() => {
    loadReceipts();
    loadConfig().then((config) => {
      if (config.scanCap) {
        setScanCap(config.scanCap);
      }
      if (config.users) {
        setUsers(config.users);
      }
    });
  }, []);
  const loadReceipts = async () => {
    if (!db) {
      toast.error("Firebase not configured");
      return;
    }
    setIsLoading(true);
    try {
      const receiptsQuery = query(collection(db, "receipts"));
      const snapshot = await getDocs(receiptsQuery);
      setAllReceipts(
        snapshot.docs
          .map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          }))
          .sort((receiptA, receiptB) =>
            (receiptB.date || "").localeCompare(receiptA.date || ""),
          ),
      );
      setHasLoaded(true);
      setScanCount(await getScanCount());
    } catch (error) {
      toast.error(`Failed to load: ${error.message}`);
    }
    setIsLoading(false);
  };
  const filteredReceipts = allReceipts.filter((receipt) => {
    var vendor;
    return !(
      (userFilter !== "All" && receipt.user !== userFilter) ||
      (vendorSearch &&
        !(
          (vendor = receipt.vendor) != null &&
          vendor.toLowerCase().includes(vendorSearch.toLowerCase())
        )) ||
      (dateFrom && receipt.date < dateFrom) ||
      (dateTo && receipt.date > dateTo)
    );
  });
  const receiptsByUser = users.reduce((groups, userName) => {
    const userReceipts = filteredReceipts.filter(
      (receipt) => receipt.user === userName,
    );
    if (userReceipts.length > 0) {
      groups[userName] = userReceipts;
    }
    return groups;
  }, {});
  const filteredTotal = filteredReceipts.reduce(
    (acc, item) => acc + (parseFloat(item.total) || 0),
    0,
  );
  // Note: values are wrapped in quotes but embedded quotes are not escaped.
  const toCsv = (rows) =>
    rows.map((row) => row.map((cell) => `"${cell || ""}"`).join(",")).join(`
`);
  const handleExportFiltered = () => {
    const csvRows = [
      [
        "User",
        "Date",
        "Vendor",
        "Subtotal",
        "GST",
        "PST",
        "Tip",
        "Total Paid",
        "Folder",
        "Notes",
        "Edited",
        "Edit Reason",
        "File",
        "URL",
      ],
    ];
    filteredReceipts.forEach((receipt) =>
      csvRows.push([
        receipt.user,
        receipt.date,
        receipt.vendor,
        receipt.subtotal > 0 ? Number(receipt.subtotal).toFixed(2) : "",
        receipt.gst > 0 ? Number(receipt.gst).toFixed(2) : "",
        receipt.pst > 0 ? Number(receipt.pst).toFixed(2) : "",
        receipt.tip > 0 ? Number(receipt.tip).toFixed(2) : "",
        Number(receipt.total).toFixed(2),
        receipt.folder,
        receipt.notes || "",
        receipt.editedAt
          ? `${receipt.editedBy} on ${receipt.editedAt?.slice(0, 10)}`
          : "",
        receipt.editReason || "",
        receipt.filename,
        receipt.downloadURL,
      ]),
    );
    const dateRangeLabel =
      dateFrom && dateTo ? `${dateFrom}_to_${dateTo}` : today();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(
      new Blob([toCsv(csvRows)], {
        type: "text/csv",
      }),
    );
    link.download = `BMP_AllReceipts_${dateRangeLabel}.csv`;
    link.click();
  };
  // Per-person export: uses its own user/date selection, independent of the list filters above.
  const handleBulkExport = () => {
    const exportReceipts = (
      exportUser === "All"
        ? allReceipts
        : allReceipts.filter((receipt) => receipt.user === exportUser)
    ).filter(
      (receipt) =>
        !(
          (exportFrom && receipt.date < exportFrom) ||
          (exportTo && receipt.date > exportTo)
        ),
    );
    if (exportReceipts.length === 0) {
      toast.error("No receipts found for that selection");
      return;
    }
    const csvRows = [
      [
        "User",
        "Date",
        "Vendor",
        "Subtotal",
        "GST",
        "PST",
        "Tip",
        "Total Paid",
        "Folder",
        "Notes",
        "Edited",
        "Edit Reason",
        "File",
        "URL",
      ],
    ];
    exportReceipts.forEach((receipt) =>
      csvRows.push([
        receipt.user,
        receipt.date,
        receipt.vendor,
        receipt.subtotal > 0 ? Number(receipt.subtotal).toFixed(2) : "",
        receipt.gst > 0 ? Number(receipt.gst).toFixed(2) : "",
        receipt.pst > 0 ? Number(receipt.pst).toFixed(2) : "",
        receipt.tip > 0 ? Number(receipt.tip).toFixed(2) : "",
        Number(receipt.total).toFixed(2),
        receipt.folder,
        receipt.notes || "",
        receipt.editedAt
          ? `${receipt.editedBy} on ${receipt.editedAt?.slice(0, 10)}`
          : "",
        receipt.editReason || "",
        receipt.filename,
        receipt.downloadURL,
      ]),
    );
    const userLabel = exportUser === "All" ? "AllStaff" : exportUser;
    const dateRangeLabel =
      exportFrom && exportTo ? `${exportFrom}_to_${exportTo}` : today();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(
      new Blob([toCsv(csvRows)], {
        type: "text/csv",
      }),
    );
    link.download = `BMP_${userLabel}_${dateRangeLabel}.csv`;
    link.click();
  };
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          marginBottom: "20px",
        }}
      >
        <p
          className="section-title"
          style={{
            margin: 0,
          }}
        >
          All Team Receipts
        </p>
        <div className="admin-badge">🔐 Admin</div>
      </div>
      <div className="filter-bar">
        <div className="filter-row">
          <input
            value={vendorSearch}
            onChange={(event) => setVendorSearch(event.target.value)}
            placeholder="Search vendor..."
          />
          <select
            value={userFilter}
            onChange={(event) => setUserFilter(event.target.value)}
          >
            <option>All</option>
            {users.map((userName) => (
              <option key={userName}>{userName}</option>
            ))}
          </select>
        </div>
        <div className="filter-row">
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            className="form-input"
            style={{
              flex: 1,
              fontSize: "14px",
              padding: "8px 10px",
            }}
          />
          <input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            className="form-input"
            style={{
              flex: 1,
              fontSize: "14px",
              padding: "8px 10px",
            }}
          />
          <button className="search-btn" onClick={loadReceipts}>
            ↻
          </button>
        </div>
      </div>
      <div
        className="summary-cards"
        style={{
          marginBottom: "16px",
        }}
      >
        <div className="summary-card">
          <div className="s-label">Total (filtered)</div>
          <div className="s-val accent">${filteredTotal.toFixed(2)}</div>
        </div>
        <div className="summary-card">
          <div className="s-label">Receipts</div>
          <div className="s-val">{filteredReceipts.length}</div>
        </div>
        <div
          className="summary-card"
          style={{
            gridColumn: "1/-1",
          }}
        >
          <div className="s-label">🤖 AI Scans This Month</div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginTop: "4px",
            }}
          >
            <div
              className="s-val"
              style={{
                color:
                  scanCount >= scanCap
                    ? "var(--accent2)"
                    : scanCount >= scanCap * 0.8
                      ? "var(--accent)"
                      : "var(--text)",
              }}
            >
              {scanCount === null ? "—" : `${scanCount} / ${scanCap}`}
            </div>
            {scanCount !== null && (
              <div
                style={{
                  flex: 1,
                  height: "6px",
                  background: "var(--border)",
                  borderRadius: "3px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    borderRadius: "3px",
                    transition: "width 0.3s",
                    width: `${Math.min(100, (scanCount / scanCap) * 100)}%`,
                    background:
                      scanCount >= scanCap
                        ? "var(--accent2)"
                        : scanCount >= scanCap * 0.8
                          ? "var(--accent)"
                          : "var(--admin)",
                  }}
                />
              </div>
            )}
          </div>
          {scanCount >= scanCap && (
            <div
              style={{
                marginTop: "6px",
                fontSize: "11px",
                color: "var(--accent2)",
              }}
            >
              Cap reached — staff filling in manually until next month
            </div>
          )}
          {scanCount !== null &&
            scanCount >= scanCap * 0.8 &&
            scanCount < scanCap && (
              <div
                style={{
                  marginTop: "6px",
                  fontSize: "11px",
                  color: "var(--accent)",
                }}
              >
                Approaching monthly limit
              </div>
            )}
          <div
            style={{
              marginTop: "4px",
              fontSize: "11px",
              color: "var(--text-muted)",
            }}
          >
            Cap: {scanCap} scans/month ≈ $10 max · Resets 1st of each month
          </div>
        </div>
      </div>
      <div
        className="settings-section"
        style={{
          marginBottom: "16px",
        }}
      >
        <div className="settings-section-title">📤 Bulk Export by Person</div>
        <div
          className="filter-bar"
          style={{
            marginBottom: "10px",
          }}
        >
          <div className="filter-row">
            <select
              value={exportUser}
              onChange={(event) => setExportUser(event.target.value)}
            >
              <option>All</option>
              {users.map((userName) => (
                <option key={userName}>{userName}</option>
              ))}
            </select>
          </div>
          <div className="filter-row">
            <input
              type="date"
              value={exportFrom}
              onChange={(event) => setExportFrom(event.target.value)}
            />
            <input
              type="date"
              value={exportTo}
              onChange={(event) => setExportTo(event.target.value)}
            />
          </div>
        </div>
        <button
          className="export-btn admin"
          style={{
            margin: 0,
          }}
          onClick={handleBulkExport}
        >
          ⬇ Export {exportUser === "All" ? "All Staff" : exportUser}
        </button>
      </div>
      <button className="export-btn admin" onClick={handleExportFiltered}>
        ⬇ Export All {filteredReceipts.length} Filtered Receipts to CSV
      </button>
      {isLoading ? (
        <div className="loading">Loading all receipts...</div>
      ) : hasLoaded ? (
        filteredReceipts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🗂</div>
            <p>No receipts found</p>
          </div>
        ) : userFilter !== "All" ? (
          <ReceiptList
            receipts={filteredReceipts}
            showUser={false}
            currentUser="Admin"
            isAdmin
            onRefresh={loadReceipts}
            toast={toast}
          />
        ) : (
          Object.entries(receiptsByUser).map(([userName, userReceipts]) => {
            const userTotal = userReceipts.reduce(
              (acc, item) => acc + (parseFloat(item.total) || 0),
              0,
            );
            return (
              <div key={userName} className="user-section">
                <div className="user-section-header">
                  <div className="user-section-name">
                    <span
                      style={{
                        fontSize: "18px",
                        background: "var(--surface)",
                        borderRadius: "50%",
                        width: "28px",
                        height: "28px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: "1px solid rgba(167,139,250,0.2)",
                      }}
                    >
                      {userName[0]}
                    </span>
                    {userName}
                  </div>
                  <div className="user-section-stats">
                    {userReceipts.length} receipt
                    {userReceipts.length !== 1 ? "s" : ""} · $
                    {userTotal.toFixed(2)}
                  </div>
                </div>
                <ReceiptList
                  receipts={userReceipts}
                  showUser={false}
                  currentUser="Admin"
                  isAdmin
                  onRefresh={loadReceipts}
                  toast={toast}
                />
              </div>
            );
          })
        )
      ) : (
        <div className="empty-state">
          <div className="empty-icon">🔐</div>
          <p>Loading...</p>
        </div>
      )}
    </div>
  );
}
