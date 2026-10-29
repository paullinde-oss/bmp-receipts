import { useEffect, useState } from "react";
import { deleteDoc, doc, updateDoc } from "firebase/firestore";
import { deleteObject, ref } from "firebase/storage";
import { ReceiptFields } from "./ReceiptFields";
import { DEFAULT_FOLDERS, folderEmoji } from "../lib/constants";
import { db, storage } from "../lib/firebase";

export function ReceiptList({
  receipts,
  showUser = false,
  currentUser,
  isAdmin = false,
  onRefresh,
  toast,
}) {
  const [zoomImageUrl, setZoomImageUrl] = useState(null);
  const [moveTarget, setMoveTarget] = useState(null);
  const canDelete = (receipt) => isAdmin || receipt.user === currentUser;
  // Returns true only if the receipt was actually deleted.
  const handleDelete = async (receipt, event) => {
    event.stopPropagation();
    if (
      window.confirm(
        `Delete receipt from ${receipt.vendor}? This cannot be undone.`,
      )
    ) {
      try {
        if (receipt.storagePath && storage) {
          try {
            await deleteObject(ref(storage, receipt.storagePath));
          } catch {}
        }
        await deleteDoc(doc(db, "receipts", receipt.id));
        toast.success("✓ Receipt deleted");
        if (onRefresh) {
          onRefresh();
        }
        return true;
      } catch (error) {
        toast.error(`Delete failed: ${error.message}`);
      }
    }
    return false;
  };
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editFields, setEditFields] = useState({});
  const [editReason, setEditReason] = useState("");
  const [editFolder, setEditFolder] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [customFolders, setCustomFolders] = useState([]);
  useEffect(() => {
    if (selectedReceipt) {
      const storedFolders = localStorage.getItem(
        `bmp_folders_${selectedReceipt.user}`,
      );
      setCustomFolders(storedFolders ? JSON.parse(storedFolders) : []);
    }
  }, [selectedReceipt]);
  // Custom folders are read raw here; the Move flow below maps `x.name || x`, so entries may be objects.
  const folderOptions = [...DEFAULT_FOLDERS, ...customFolders];
  const startEditing = (receipt) => {
    setEditFields({
      vendor: receipt.vendor || "",
      date: receipt.date || "",
      subtotal: receipt.subtotal || "",
      gst: receipt.gst || "",
      pst: receipt.pst || "",
      tip: receipt.tip || "",
      total: receipt.total || "",
      notes: receipt.notes || "",
    });
    setEditFolder(receipt.folder || "");
    setEditReason("");
    setIsEditing(true);
  };
  const handleSaveEdit = async () => {
    if (!editReason.trim()) {
      toast.error("Please enter a reason for editing");
      return;
    }
    if (!editFolder) {
      toast.error("Please select a folder");
      return;
    }
    setIsSaving(true);
    try {
      await updateDoc(doc(db, "receipts", selectedReceipt.id), {
        vendor: editFields.vendor,
        date: editFields.date,
        subtotal: parseFloat(editFields.subtotal) || null,
        gst: parseFloat(editFields.gst) || null,
        pst: parseFloat(editFields.pst) || null,
        tip: parseFloat(editFields.tip) || null,
        total: parseFloat(editFields.total) || 0,
        notes: editFields.notes || "",
        folder: editFolder,
        editedAt: new Date().toISOString(),
        editedBy: currentUser,
        editReason: editReason.trim(),
      });
      toast.success("✓ Receipt updated");
      setIsEditing(false);
      setSelectedReceipt(null);
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      toast.error(`Save failed: ${error.message}`);
    }
    setIsSaving(false);
  };
  // Same rule as canDelete: admins, or the receipt's owner.
  const canEdit = (receipt) => isAdmin || receipt.user === currentUser;
  return (
    <>
      <div className="receipt-list">
        {receipts.map((r) => (
          <div
            key={r.id}
            className="receipt-card"
            onClick={() => {
              setSelectedReceipt(r);
              setIsEditing(false);
            }}
          >
            {r.downloadURL ? (
              <img
                className="receipt-thumb"
                src={r.downloadURL}
                alt={r.vendor}
              />
            ) : (
              <div className="receipt-thumb-placeholder">🧾</div>
            )}
            <div className="receipt-info">
              <div className="receipt-vendor">{r.vendor || "Unknown"}</div>
              <div className="receipt-meta">
                <span>{r.date}</span>
                <span className="tag">
                  {folderEmoji(r.folder)} {r.folder}
                </span>
                {showUser && <span className="tag user">{r.user}</span>}
                {r.editedAt && <span className="tag edited">✏️ Edited</span>}
              </div>
              {r.notes && (
                <div
                  style={{
                    fontSize: "11px",
                    color: "var(--text-muted)",
                    marginTop: "3px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {r.notes}
                </div>
              )}
            </div>
            <div className="receipt-amount">
              {r.total > 0 ? `$${Number(r.total).toFixed(2)}` : "—"}
            </div>
            <div
              className="receipt-actions"
              onClick={(event) => event.stopPropagation()}
            >
              {canDelete(r) && (
                <button
                  className="icon-btn"
                  onClick={(event) => handleDelete(r, event)}
                  style={{
                    color: "var(--accent2)",
                    borderColor: "rgba(255,107,53,0.3)",
                  }}
                >
                  🗑
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      {selectedReceipt && (
        <div
          className="modal-overlay"
          onClick={() => {
            setSelectedReceipt(null);
            setIsEditing(false);
          }}
        >
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                {isEditing ? "Edit Receipt" : selectedReceipt.vendor}
              </div>
              <button
                className="modal-close"
                onClick={() => {
                  setSelectedReceipt(null);
                  setIsEditing(false);
                }}
              >
                ✕
              </button>
            </div>
            {isEditing ? (
              <>
                <ReceiptFields
                  fields={editFields}
                  onChange={(fieldName, fieldValue) =>
                    setEditFields((prev) => ({
                      ...prev,
                      [fieldName]: fieldValue,
                    }))
                  }
                  showTip={
                    editFolder === "Food/Entertainment" || !!editFields.tip
                  }
                />
                <p
                  className="section-title"
                  style={{
                    marginTop: "16px",
                  }}
                >
                  Folder
                </p>
                <div
                  className="folder-grid"
                  style={{
                    marginBottom: "16px",
                  }}
                >
                  {folderOptions.map((folder) => (
                    <button
                      key={folder}
                      className={`folder-btn${editFolder === folder ? " selected" : ""}`}
                      onClick={() => setEditFolder(folder)}
                    >
                      <span>{folderEmoji(folder)}</span>
                      {folder}
                    </button>
                  ))}
                </div>
                <div className="form-row">
                  <label className="form-label">
                    Reason for Edit{" "}
                    <span
                      style={{
                        color: "var(--accent2)",
                      }}
                    >
                      *required
                    </span>
                  </label>
                  <textarea
                    className="form-textarea"
                    value={editReason}
                    onChange={(event) => setEditReason(event.target.value)}
                    placeholder="Why are you editing this receipt?"
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
                    onClick={handleSaveEdit}
                    disabled={isSaving}
                  >
                    {isSaving ? "Saving..." : "Save Changes"}
                  </button>
                  <button
                    className="secondary-btn"
                    style={{
                      flex: 1,
                    }}
                    onClick={() => setIsEditing(false)}
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                {selectedReceipt.downloadURL && (
                  <img
                    src={selectedReceipt.downloadURL}
                    alt={selectedReceipt.vendor}
                    style={{
                      cursor: "zoom-in",
                    }}
                    onClick={() => setZoomImageUrl(selectedReceipt.downloadURL)}
                  />
                )}
                {[
                  ["Date", selectedReceipt.date],
                  [
                    "Folder",
                    `${folderEmoji(selectedReceipt.folder)} ${selectedReceipt.folder}`,
                  ],
                  ...(showUser ? [["Submitted by", selectedReceipt.user]] : []),
                ].map(([label, value]) => (
                  <div key={label} className="detail-row">
                    <span className="dk">{label}</span>
                    <span className="dv">{value}</span>
                  </div>
                ))}
                {(selectedReceipt.subtotal > 0 ||
                  selectedReceipt.gst > 0 ||
                  selectedReceipt.pst > 0 ||
                  selectedReceipt.tip > 0) && (
                  <div
                    style={{
                      background: "var(--surface2)",
                      border: "1px solid var(--border)",
                      borderRadius: "10px",
                      padding: "12px 14px",
                      margin: "8px 0",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "11px",
                        color: "var(--text-muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        marginBottom: "10px",
                      }}
                    >
                      Breakdown
                    </div>
                    {selectedReceipt.subtotal > 0 && (
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: "14px",
                          paddingBottom: "6px",
                          marginBottom: "6px",
                          borderBottom: "1px solid var(--border)",
                        }}
                      >
                        <span
                          style={{
                            color: "var(--text-muted)",
                          }}
                        >
                          Subtotal
                        </span>
                        <span
                          style={{
                            color: "var(--text)",
                          }}
                        >
                          ${Number(selectedReceipt.subtotal).toFixed(2)}
                        </span>
                      </div>
                    )}
                    {selectedReceipt.gst > 0 && (
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: "14px",
                          paddingBottom: "6px",
                          marginBottom: "6px",
                          borderBottom: "1px solid var(--border)",
                        }}
                      >
                        <span
                          style={{
                            color: "var(--text-muted)",
                          }}
                        >
                          GST (5%)
                        </span>
                        <span
                          style={{
                            color: "var(--text)",
                          }}
                        >
                          ${Number(selectedReceipt.gst).toFixed(2)}
                        </span>
                      </div>
                    )}
                    {selectedReceipt.pst > 0 && (
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: "14px",
                          paddingBottom: "6px",
                          marginBottom: "6px",
                          borderBottom: "1px solid var(--border)",
                        }}
                      >
                        <span
                          style={{
                            color: "var(--text-muted)",
                          }}
                        >
                          PST
                        </span>
                        <span
                          style={{
                            color: "var(--text)",
                          }}
                        >
                          ${Number(selectedReceipt.pst).toFixed(2)}
                        </span>
                      </div>
                    )}
                    {selectedReceipt.tip > 0 && (
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: "14px",
                          paddingBottom: "6px",
                          marginBottom: "6px",
                          borderBottom: "1px solid var(--border)",
                        }}
                      >
                        <span
                          style={{
                            color: "var(--text-muted)",
                          }}
                        >
                          Tip
                        </span>
                        <span
                          style={{
                            color: "var(--text)",
                          }}
                        >
                          ${Number(selectedReceipt.tip).toFixed(2)}
                        </span>
                      </div>
                    )}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "16px",
                        paddingTop: "4px",
                      }}
                    >
                      <span
                        style={{
                          fontWeight: "700",
                          color: "var(--text)",
                        }}
                      >
                        Total Paid
                      </span>
                      <span
                        style={{
                          fontWeight: "700",
                          color: "var(--accent)",
                          fontSize: "18px",
                        }}
                      >
                        ${Number(selectedReceipt.total).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
                {!(
                  selectedReceipt.subtotal > 0 ||
                  selectedReceipt.gst > 0 ||
                  selectedReceipt.pst > 0 ||
                  selectedReceipt.tip > 0
                ) && (
                  <div className="detail-row">
                    <span className="dk">Total Paid</span>
                    <span className="dv total">
                      ${Number(selectedReceipt.total).toFixed(2)}
                    </span>
                  </div>
                )}
                {[
                  selectedReceipt.notes
                    ? ["Notes", selectedReceipt.notes]
                    : null,
                  selectedReceipt.editedAt
                    ? [
                        "Edited by",
                        `${selectedReceipt.editedBy} on ${selectedReceipt.editedAt?.slice(0, 10)}`,
                      ]
                    : null,
                  selectedReceipt.editReason
                    ? ["Edit reason", selectedReceipt.editReason]
                    : null,
                ]
                  .filter(Boolean)
                  .map(([label, value]) => (
                    <div key={label} className="detail-row">
                      <span className="dk">{label}</span>
                      <span className="dv">{value}</span>
                    </div>
                  ))}
                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    marginTop: "16px",
                    flexWrap: "wrap",
                  }}
                >
                  {selectedReceipt.downloadURL ? (
                    <a
                      className="submit-btn"
                      style={{
                        flex: 1,
                        textAlign: "center",
                        textDecoration: "none",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                      href={selectedReceipt.downloadURL}
                      download={selectedReceipt.filename}
                      target="_blank"
                      rel="noreferrer"
                    >
                      ⬇ Download Photo
                    </a>
                  ) : (
                    <div
                      style={{
                        flex: 1,
                        padding: "12px",
                        background: "var(--surface2)",
                        border: "1px solid var(--border)",
                        borderRadius: "10px",
                        fontSize: "13px",
                        color: "var(--text-muted)",
                        textAlign: "center",
                      }}
                    >
                      📷 No photo attached to this receipt
                      {selectedReceipt.uploadStatus &&
                        selectedReceipt.uploadStatus !== "ok" && (
                          <div
                            style={{
                              fontSize: "10px",
                              marginTop: "6px",
                              color: "var(--accent)",
                              fontFamily: "monospace",
                            }}
                          >
                            diag: {selectedReceipt.uploadStatus}
                          </div>
                        )}
                    </div>
                  )}
                  {canEdit(selectedReceipt) && (
                    <button
                      className="secondary-btn"
                      style={{
                        flex: 1,
                      }}
                      onClick={() => startEditing(selectedReceipt)}
                    >
                      ✏️ Edit
                    </button>
                  )}
                  {canEdit(selectedReceipt) && (
                    <button
                      className="secondary-btn"
                      style={{
                        flex: 1,
                      }}
                      onClick={() => {
                        const moveFolderChoices = [
                          ...DEFAULT_FOLDERS,
                          ...(() => {
                            try {
                              return JSON.parse(
                                localStorage.getItem(
                                  `bmp_folders_${selectedReceipt.user}`,
                                ) || "[]",
                              )
                                .map(
                                  (folderEntry) =>
                                    folderEntry.name || folderEntry,
                                )
                                .filter(Boolean);
                            } catch {
                              return [];
                            }
                          })(),
                        ];
                        const opts = moveFolderChoices.filter(
                          (folderName) => folderName !== selectedReceipt.folder,
                        );
                        if (!opts.length) {
                          toast.warn("No other folders available");
                          return;
                        }
                        setMoveTarget({
                          receipt: selectedReceipt,
                          opts,
                        });
                      }}
                    >
                      📂 Move
                    </button>
                  )}
                  {canDelete(selectedReceipt) && (
                    <button
                      className="danger-btn"
                      style={{
                        flex: 1,
                      }}
                      onClick={async (event) => {
                        if (await handleDelete(selectedReceipt, event)) {
                          setSelectedReceipt(null);
                        }
                      }}
                    >
                      🗑 Delete
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {zoomImageUrl && (
        <div
          className="modal-overlay"
          onClick={() => setZoomImageUrl(null)}
          style={{
            alignItems: "center",
            padding: "20px",
          }}
        >
          <div
            style={{
              position: "relative",
              maxWidth: "100%",
              maxHeight: "90vh",
            }}
          >
            <img
              src={zoomImageUrl}
              alt="Receipt"
              style={{
                maxWidth: "100%",
                maxHeight: "85vh",
                objectFit: "contain",
                borderRadius: "12px",
                display: "block",
              }}
            />
            <button
              onClick={() => setZoomImageUrl(null)}
              style={{
                position: "absolute",
                top: "-12px",
                right: "-12px",
                background: "var(--surface2)",
                border: "1px solid var(--border)",
                borderRadius: "50%",
                width: "32px",
                height: "32px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                fontSize: "16px",
                color: "var(--text)",
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}
      {moveTarget && (
        <div className="modal-overlay" onClick={() => setMoveTarget(null)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Move to Folder</div>
              <button
                className="modal-close"
                onClick={() => setMoveTarget(null)}
              >
                ✕
              </button>
            </div>
            <p
              style={{
                fontSize: "13px",
                color: "var(--text-muted)",
                margin: "0 0 16px",
              }}
            >
              Select a folder for this receipt:
            </p>
            {moveTarget.opts.map((folder) => (
              <button
                key={folder}
                className="folder-btn"
                style={{
                  width: "100%",
                  marginBottom: "8px",
                }}
                onClick={async () => {
                  try {
                    await updateDoc(
                      doc(db, "receipts", moveTarget.receipt.id),
                      {
                        folder,
                        editedAt: new Date().toISOString(),
                        editedBy: currentUser,
                        editReason: `Moved from ${moveTarget.receipt.folder} to ${folder}`,
                      },
                    );
                    toast.success(`✓ Moved to ${folder}`);
                    setMoveTarget(null);
                    setSelectedReceipt(null);
                    if (onRefresh) {
                      onRefresh();
                    }
                  } catch (error) {
                    toast.error(`Move failed: ${error.message}`);
                  }
                }}
              >
                <span>{folderEmoji(folder)}</span>
                {folder}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
