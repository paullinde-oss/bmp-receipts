import { useEffect, useRef, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { ReceiptList } from "./ReceiptList";
import { folderEmoji } from "../lib/constants";
import { db } from "../lib/firebase";

export function Home({ user, toast, onCapture }) {
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  const [allReceipts, setAllReceipts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [term, setTerm] = useState("");
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [addingFolder, setAddingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [deletingFolder, setDeletingFolder] = useState(false);
  // User-created folders, persisted per user in localStorage (entries may be legacy {name} objects).
  const [customFolders, setCustomFolders] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(`bmp_folders_${user}`) || "[]")
        .map((entry) => entry.name || entry)
        .filter(Boolean);
    } catch {
      return [];
    }
  });
  const defaultFolders = ["Gas", "Auto", "Food/Entertainment", "Misc"];
  const allFolders = [...new Set([...defaultFolders, ...customFolders])];
  useEffect(() => {
    onRefresh();
  }, [user]);
  const onRefresh = async () => {
    if (!db) {
      toast.error("Firebase not configured");
      return;
    }
    setLoading(true);
    try {
      const receiptsQuery = query(
        collection(db, "receipts"),
        where("user", "==", user),
      );
      const snapshot = await getDocs(receiptsQuery);
      const receipts = snapshot.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }))
        .sort((receiptA, receiptB) =>
          (receiptB.date || "").localeCompare(receiptA.date || ""),
        );
      setAllReceipts(receipts);
      // Merge any non-default folders found on receipts back into the localStorage folder list.
      const firestoreFolders = [
        ...new Set(
          receipts
            .map((r) => r.folder)
            .filter(
              (f) =>
                f && !["Gas", "Auto", "Food/Entertainment", "Misc"].includes(f),
            ),
        ),
      ];
      const stored = JSON.parse(
        localStorage.getItem(`bmp_folders_${user}`) || "[]",
      )
        .map((entry) => entry.name || entry)
        .filter(Boolean);
      const merged = [...new Set([...stored, ...firestoreFolders])];
      if (
        merged.length !== stored.length ||
        firestoreFolders.some((f) => !stored.includes(f))
      ) {
        localStorage.setItem(`bmp_folders_${user}`, JSON.stringify(merged));
        setCustomFolders(merged);
      }
    } catch {
      toast.error("Failed to load receipts");
    }
    setLoading(false);
  };
  // Pull-to-refresh: a >60px downward drag from the top of the page triggers onRefresh on release.
  const touchStartYRef = useRef(null);
  const [isPulling, setIsPulling] = useState(false);
  const onTouchStart = (touchEvent) => {
    touchStartYRef.current = touchEvent.touches[0].clientY;
  };
  const onTouchMove = (touchEvent) => {
    if (!touchStartYRef.current) {
      return;
    }
    if (
      touchEvent.touches[0].clientY - touchStartYRef.current > 60 &&
      window.scrollY === 0
    ) {
      setIsPulling(true);
    }
  };
  const onTouchEnd = () => {
    if (isPulling) {
      onRefresh();
    }
    setIsPulling(false);
    touchStartYRef.current = null;
  };
  // Search matches on vendor/notes; null when the search box is empty.
  const hits =
    term.trim().length > 0
      ? allReceipts.filter(
          (receipt) =>
            (receipt.vendor || "").toLowerCase().includes(term.toLowerCase()) ||
            (receipt.notes || "").toLowerCase().includes(term.toLowerCase()),
        )
      : null;
  const folderReceipts = selectedFolder
    ? allReceipts.filter((receipt) => receipt.folder === selectedFolder)
    : [];
  const folderTotal = folderReceipts.reduce(
    (acc, item) => acc + (parseFloat(item.total) || 0),
    0,
  );
  const receiptsByMonth = folderReceipts.reduce((acc, receipt) => {
    const monthKey = (receipt.date || "").slice(0, 7);
    if (!acc[monthKey]) {
      acc[monthKey] = [];
    }
    acc[monthKey].push(receipt);
    return acc;
  }, {});
  const sortedMonths = Object.keys(receiptsByMonth).sort((monthA, monthB) =>
    monthB.localeCompare(monthA),
  );
  const currentMonth = new Date().toISOString().slice(0, 7);
  const folderStats = allFolders.reduce((acc, folder) => {
    const inFolder = allReceipts.filter((receipt) => receipt.folder === folder);
    const thisMonth = inFolder.filter(
      (receipt) => (receipt.date || "").slice(0, 7) === currentMonth,
    );
    acc[folder] = {
      count: inFolder.length,
      monthCount: thisMonth.length,
      monthTotal: thisMonth.reduce(
        (sum, receipt) => sum + (parseFloat(receipt.total) || 0),
        0,
      ),
    };
    return acc;
  }, {});
  const exportCsv = () => {
    const rows = [
      [
        "Date",
        "Vendor",
        "Subtotal",
        "GST",
        "PST",
        "Tip",
        "Total Paid",
        "Folder",
        "Notes",
      ],
    ];
    folderReceipts.forEach((receipt) =>
      rows.push([
        receipt.date,
        receipt.vendor,
        receipt.subtotal > 0 ? Number(receipt.subtotal).toFixed(2) : "",
        receipt.gst > 0 ? Number(receipt.gst).toFixed(2) : "",
        receipt.pst > 0 ? Number(receipt.pst).toFixed(2) : "",
        receipt.tip > 0 ? Number(receipt.tip).toFixed(2) : "",
        Number(receipt.total).toFixed(2),
        receipt.folder,
        receipt.notes || "",
      ]),
    );
    const csv = rows.map((row) =>
      row.map((cell) => `"${cell || ""}"`).join(","),
    ).join(`
`);
    const link = document.createElement("a");
    link.href = URL.createObjectURL(
      new Blob([csv], {
        type: "text/csv",
      }),
    );
    link.download = `BMP_${user}_${selectedFolder}.csv`;
    link.click();
  };
  return (
    <>
      {selectedFolder ? (
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "16px",
            }}
          >
            <button
              onClick={() => setSelectedFolder(null)}
              style={{
                background: "none",
                border: "none",
                fontSize: "22px",
                cursor: "pointer",
                color: "var(--text-muted)",
                padding: "4px",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              ←
            </button>
            <div
              style={{
                flex: 1,
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-head)",
                  fontSize: "18px",
                  fontWeight: "700",
                  color: "var(--text)",
                }}
              >
                {folderEmoji(selectedFolder)} {selectedFolder}
              </div>
              <div
                style={{
                  fontSize: "12px",
                  color: "var(--text-muted)",
                }}
              >
                {folderReceipts.length} receipts ·{" "}
                <span
                  style={{
                    color: "var(--accent)",
                    fontWeight: "600",
                  }}
                >
                  ${folderTotal.toFixed(2)}
                </span>
              </div>
            </div>
            {folderReceipts.length > 0 && !isMobile && (
              <button
                className="icon-btn"
                onClick={exportCsv}
                style={{
                  fontSize: "14px",
                }}
              >
                ⬇ CSV
              </button>
            )}
            {!["Gas", "Auto", "Food/Entertainment", "Misc"].includes(
              selectedFolder,
            ) && (
              <button
                className="icon-btn"
                onClick={() => setDeletingFolder(true)}
                style={{
                  fontSize: "14px",
                  color: "var(--accent2)",
                  borderColor: "rgba(255,107,53,0.3)",
                }}
              >
                🗑
              </button>
            )}
          </div>
          {loading ? (
            <div className="loading">Loading...</div>
          ) : folderReceipts.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">{folderEmoji(selectedFolder)}</div>
              <p>No receipts in {selectedFolder} yet</p>
            </div>
          ) : (
            sortedMonths.map((month) => (
              <div
                key={month}
                style={{
                  marginBottom: "20px",
                }}
              >
                <div
                  style={{
                    fontSize: "11px",
                    fontWeight: "700",
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    marginBottom: "8px",
                    paddingBottom: "6px",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  {new Date(`${month}-01`).toLocaleDateString("en-CA", {
                    month: "long",
                    year: "numeric",
                  })}
                  <span
                    style={{
                      float: "right",
                      color: "var(--accent)",
                    }}
                  >
                    $
                    {receiptsByMonth[month]
                      .reduce(
                        (acc, receipt) =>
                          acc + (parseFloat(receipt.total) || 0),
                        0,
                      )
                      .toFixed(2)}
                  </span>
                </div>
                <ReceiptList
                  receipts={receiptsByMonth[month]}
                  showUser={false}
                  currentUser={user}
                  isAdmin={false}
                  onRefresh={onRefresh}
                  toast={toast}
                />
              </div>
            ))
          )}
        </div>
      ) : (
        <div
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {isPulling && (
            <div className="ptr-indicator">↓ Release to refresh...</div>
          )}
          <div
            style={{
              position: "relative",
              marginBottom: "16px",
            }}
          >
            <span
              style={{
                position: "absolute",
                left: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                fontSize: "16px",
                color: "var(--text-muted)",
              }}
            >
              🔍
            </span>
            <input
              className="form-input"
              value={term}
              onChange={(ev) => setTerm(ev.target.value)}
              placeholder="Search receipts..."
              style={{
                paddingLeft: "38px",
              }}
            />
            {term && (
              <button
                onClick={() => setTerm("")}
                style={{
                  position: "absolute",
                  right: "10px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  fontSize: "18px",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            )}
          </div>
          {hits !== null ? (
            <div>
              <div
                style={{
                  fontSize: "12px",
                  color: "var(--text-muted)",
                  marginBottom: "10px",
                }}
              >
                {hits.length} result{hits.length !== 1 ? "s" : ""} for "{term}"
              </div>
              {hits.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">🔍</div>
                  <p>No receipts found</p>
                </div>
              ) : (
                <ReceiptList
                  receipts={hits}
                  showUser={false}
                  currentUser={user}
                  isAdmin={false}
                  onRefresh={onRefresh}
                  toast={toast}
                />
              )}
            </div>
          ) : (
            <>
              {loading ? (
                <div className="loading">Loading...</div>
              ) : (
                <div className="folder-grid">
                  {allFolders.map((folder) => {
                    const isDefault = [
                      "Gas",
                      "Auto",
                      "Food/Entertainment",
                      "Misc",
                    ].includes(folder);
                    return (
                      <button
                        key={folder}
                        className="folder-tile"
                        style={{
                          position: "relative",
                        }}
                        onClick={() => setSelectedFolder(folder)}
                      >
                        <div
                          style={{
                            fontSize: "32px",
                            marginBottom: "6px",
                          }}
                        >
                          {folderEmoji(folder)}
                        </div>
                        <div
                          style={{
                            fontWeight: "700",
                            fontSize: "14px",
                            color: "var(--text)",
                            marginBottom: "3px",
                          }}
                        >
                          {folder}
                        </div>
                        {folderStats[folder]?.count > 0 ? (
                          <>
                            <div
                              style={{
                                fontSize: "12px",
                                color: "var(--accent)",
                                fontWeight: "600",
                              }}
                            >
                              ${folderStats[folder].monthTotal.toFixed(2)}
                            </div>
                            <div
                              style={{
                                fontSize: "10px",
                                color: "var(--text-muted)",
                              }}
                            >
                              this month
                            </div>
                            <div
                              style={{
                                fontSize: "10px",
                                color: "var(--text-muted)",
                                marginTop: "2px",
                              }}
                            >
                              {folderStats[folder].count} total receipt
                              {folderStats[folder].count !== 1 ? "s" : ""}
                            </div>
                          </>
                        ) : (
                          <div
                            style={{
                              fontSize: "11px",
                              color: "var(--text-muted)",
                            }}
                          >
                            No receipts
                          </div>
                        )}
                      </button>
                    );
                  })}
                  <button
                    className="folder-tile folder-tile-add"
                    onClick={() => {
                      setAddingFolder(true);
                      setNewFolderName("");
                    }}
                  >
                    <div
                      style={{
                        fontSize: "32px",
                        marginBottom: "6px",
                      }}
                    >
                      ➕
                    </div>
                    <div
                      style={{
                        fontWeight: "700",
                        fontSize: "13px",
                        color: "var(--text-muted)",
                      }}
                    >
                      Add Folder
                    </div>
                  </button>
                </div>
              )}
              {allReceipts.length > 0 && (
                <div
                  style={{
                    marginTop: "20px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "11px",
                      fontWeight: "700",
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      marginBottom: "10px",
                    }}
                  >
                    Recent
                  </div>
                  <ReceiptList
                    receipts={allReceipts.slice(0, 5)}
                    showUser={false}
                    currentUser={user}
                    isAdmin={false}
                    onRefresh={onRefresh}
                    toast={toast}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}
      {addingFolder && (
        <div className="modal-overlay" onClick={() => setAddingFolder(false)}>
          <div className="modal" onClick={(ev) => ev.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">New Folder</div>
              <button
                className="modal-close"
                onClick={() => setAddingFolder(false)}
              >
                ✕
              </button>
            </div>
            <div className="form-row">
              <label className="form-label">Folder Name</label>
              <input
                className="form-input"
                style={{
                  fontSize: "16px",
                }}
                placeholder="e.g. 🏗 Site Costs"
                value={newFolderName}
                onChange={(ev) => setNewFolderName(ev.target.value)}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter") {
                    const trimmedName = newFolderName.trim();
                    if (!trimmedName) {
                      return;
                    }
                    const saved = JSON.parse(
                      localStorage.getItem(`bmp_folders_${user}`) || "[]",
                    )
                      .map((entry) => entry.name || entry)
                      .filter(Boolean);
                    if (
                      saved.includes(trimmedName) ||
                      ["Gas", "Auto", "Food/Entertainment", "Misc"].includes(
                        trimmedName,
                      )
                    ) {
                      toast.error("Folder already exists");
                      return;
                    }
                    const updated = [...saved, trimmedName];
                    localStorage.setItem(
                      `bmp_folders_${user}`,
                      JSON.stringify(updated),
                    );
                    setCustomFolders(updated);
                    setAddingFolder(false);
                    setNewFolderName("");
                  }
                }}
                autoFocus
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
                }}
                onClick={() => {
                  const trimmedName = newFolderName.trim();
                  if (!trimmedName) {
                    toast.error("Enter a folder name");
                    return;
                  }
                  const saved = JSON.parse(
                    localStorage.getItem(`bmp_folders_${user}`) || "[]",
                  )
                    .map((entry) => entry.name || entry)
                    .filter(Boolean);
                  if (
                    saved.includes(trimmedName) ||
                    ["Gas", "Auto", "Food/Entertainment", "Misc"].includes(
                      trimmedName,
                    )
                  ) {
                    toast.error("Folder already exists");
                    return;
                  }
                  const updated = [...saved, trimmedName];
                  localStorage.setItem(
                    `bmp_folders_${user}`,
                    JSON.stringify(updated),
                  );
                  setCustomFolders(updated);
                  setAddingFolder(false);
                  setNewFolderName("");
                  toast.success(`✓ Folder "${trimmedName}" added`);
                }}
              >
                Add Folder
              </button>
              <button
                className="secondary-btn"
                style={{
                  flex: 1,
                }}
                onClick={() => setAddingFolder(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {deletingFolder && (
        <div className="modal-overlay" onClick={() => setDeletingFolder(false)}>
          <div className="modal" onClick={(ev) => ev.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Delete Folder</div>
              <button
                className="modal-close"
                onClick={() => setDeletingFolder(false)}
              >
                ✕
              </button>
            </div>
            <div className="warn-box">
              <div
                style={{
                  fontWeight: "600",
                  marginBottom: "8px",
                }}
              >{`⚠️ Delete "${selectedFolder}"?`}</div>
              {allReceipts.filter((r) => r.folder === selectedFolder).length >
              0 ? (
                <div
                  style={{
                    fontSize: "13px",
                  }}
                >
                  This folder has{" "}
                  {
                    allReceipts.filter((r) => r.folder === selectedFolder)
                      .length
                  }{" "}
                  receipt
                  {allReceipts.filter((r) => r.folder === selectedFolder)
                    .length !== 1
                    ? "s"
                    : ""}
                  . They won't be deleted — use the 📂 Move button on each
                  receipt to move them first.
                </div>
              ) : (
                <div
                  style={{
                    fontSize: "13px",
                  }}
                >
                  This folder is empty and will be removed.
                </div>
              )}
            </div>
            <div
              style={{
                display: "flex",
                gap: "8px",
                marginTop: "12px",
              }}
            >
              <button
                className="danger-btn"
                style={{
                  flex: 1,
                }}
                onClick={() => {
                  const saved = JSON.parse(
                    localStorage.getItem(`bmp_folders_${user}`) || "[]",
                  )
                    .map((entry) => entry.name || entry)
                    .filter(Boolean);
                  const updated = saved.filter((f) => f !== selectedFolder);
                  localStorage.setItem(
                    `bmp_folders_${user}`,
                    JSON.stringify(updated),
                  );
                  setCustomFolders(updated);
                  setSelectedFolder(null);
                  setDeletingFolder(false);
                  toast.success("✓ Folder deleted");
                }}
              >
                Delete Folder
              </button>
              <button
                className="secondary-btn"
                style={{
                  flex: 1,
                }}
                onClick={() => setDeletingFolder(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
