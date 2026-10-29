import { useEffect, useRef, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { ReceiptFields } from "./ReceiptFields";
import { ZoomableImage } from "./ZoomableImage";
import { loadConfig, tryConsumeScan } from "../lib/config";
import {
  DEFAULT_FOLDERS,
  DEFAULT_SCAN_CAP,
  folderEmoji,
} from "../lib/constants";
import { today } from "../lib/dates";
import { db, storage } from "../lib/firebase";
import {
  compressImage,
  pdfToImage,
  receiptBaseName,
  toSupportedImage,
} from "../lib/images";
import { scanReceipt } from "../lib/scanReceipt";

export function Capture({
  user,
  toast,
  fabAction,
  fabFile,
  onFabActionDone,
  onSaved,
}) {
  const cameraInputRef = useRef();
  const galleryInputRef = useRef();
  const uploadInputRef = useRef();
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [fields, setFields] = useState({
    vendor: "",
    date: today(),
    subtotal: "",
    gst: "",
    pst: "",
    tip: "",
    total: "",
    notes: "",
  });
  const [selectedFolder, setSelectedFolder] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [newFolderName, setNewFolderName] = useState("");
  const [customFolders, setCustomFolders] = useState([]);
  const [scanCap, setScanCap] = useState(DEFAULT_SCAN_CAP);
  const [duplicate, setDuplicate] = useState(null);
  const [isManualEntry, setIsManualEntry] = useState(false);
  const [unreadable, setUnreadable] = useState(new Set());
  useEffect(() => {
    const savedFolders = localStorage.getItem(`bmp_folders_${user}`);
    if (savedFolders) {
      setCustomFolders(JSON.parse(savedFolders));
    }
    loadConfig().then((config) => {
      if (config.scanCap) {
        setScanCap(config.scanCap);
      }
    });
  }, [user]);
  useEffect(() => {
    if (fabFile) {
      handleFile(fabFile);
      if (onFabActionDone != null) {
        onFabActionDone();
      }
    }
  }, [fabFile]);
  useEffect(() => {
    if (fabAction === "manual") {
      setIsManualEntry(true);
      if (onFabActionDone != null) {
        onFabActionDone();
      }
    }
  }, [fabAction]);
  const allFolders = [...DEFAULT_FOLDERS, ...customFolders];
  const onChange = (field, value) =>
    setFields((prev) => ({
      ...prev,
      [field]: value,
    }));
  const handleFile = async (file) => {
    var fileName;
    if (!file) {
      return;
    }
    if (
      file.type === "application/pdf" ||
      ((fileName = file.name) != null &&
        fileName.toLowerCase().endsWith(".pdf"))
    ) {
      toast.info("📄 Converting PDF to image...");
      const convertedImage = await pdfToImage(file);
      if (!convertedImage) {
        toast.error("Could not read PDF — try a JPG or PNG instead");
        return;
      }
      file = convertedImage;
    } else if (
      !file.type.startsWith("image/") &&
      !file.type.includes("heic") &&
      !file.type.includes("heif")
    ) {
      toast.error("Please use an image file (JPG, PNG, HEIC) or PDF.");
      return;
    }
    const image = await toSupportedImage(file);
    setImageFile(image);
    setPreviewUrl(URL.createObjectURL(image));
    const reader = new FileReader();
    reader.onload = async (loadEvent) => {
      const base64Data = loadEvent.target.result.split(",")[1];
      setIsScanning(true);
      toast.info("🤖 Analyzing receipt...");
      if (!(await tryConsumeScan(scanCap))) {
        setIsScanning(false);
        toast.warn(
          "⚠️ Monthly scan limit reached — please fill in fields manually",
        );
        return;
      }
      const scan = await scanReceipt(base64Data, image.type || "image/jpeg");
      const unreadableFields = new Set(
        (scan.unreadable_fields || "")
          .split(",")
          .map((fieldName) => fieldName.trim().toLowerCase())
          .filter(Boolean),
      );
      const extractedFields = new Set();
      if (scan.vendor) {
        onChange("vendor", scan.vendor);
        extractedFields.add("vendor");
      } else if (!unreadableFields.has("vendor")) {
        unreadableFields.add("vendor");
      }
      if (scan.date) {
        onChange("date", scan.date);
        extractedFields.add("date");
      }
      if (scan.date) {
        onChange("date", scan.date);
      }
      if (scan.category && allFolders.includes(scan.category)) {
        setSelectedFolder(scan.category);
      }
      const subtotal =
        parseFloat(String(scan.subtotal || "").replace(/[^0-9.]/g, "")) || 0;
      const province = (scan.province || "").toUpperCase();
      const isUS = province === "US";
      const pstRates = {
        BC: 0.07,
        MB: 0.07,
        SK: 0.06,
        QC: 0.09975,
      };
      // Canadian receipts: back-fill 5% GST and provincial PST from the subtotal when the scan omitted them.
      const isGstZero =
        scan.gst === 0 || scan.gst === "0" || scan.gst === "0.00";
      if (subtotal > 0 && !isUS) {
        let gstAmount = 0;
        if (scan.gst && !isGstZero) {
          gstAmount = parseFloat(String(scan.gst).replace(/[^0-9.]/g, ""));
        } else if (!isGstZero && !scan.gst) {
          gstAmount = parseFloat((subtotal * 0.05).toFixed(2));
        }
        if (gstAmount > 0) {
          onChange("gst", parseFloat(gstAmount).toFixed(2));
        }
        let pstAmount = 0;
        if (scan.pst) {
          pstAmount = parseFloat(String(scan.pst).replace(/[^0-9.]/g, ""));
        } else if (province && pstRates[province] && !isGstZero) {
          pstAmount = parseFloat((subtotal * pstRates[province]).toFixed(2));
        }
        if (pstAmount > 0) {
          onChange("pst", parseFloat(pstAmount).toFixed(2));
        }
        onChange("subtotal", parseFloat(subtotal).toFixed(2));
      } else {
        if (scan.subtotal) {
          onChange(
            "subtotal",
            parseFloat(String(scan.subtotal).replace(/[^0-9.]/g, "")).toFixed(
              2,
            ),
          );
        }
        if (!isUS && scan.gst && !isGstZero) {
          onChange(
            "gst",
            parseFloat(String(scan.gst).replace(/[^0-9.]/g, "")).toFixed(2),
          );
        }
        if (!isUS && scan.pst) {
          onChange(
            "pst",
            parseFloat(String(scan.pst).replace(/[^0-9.]/g, "")).toFixed(2),
          );
        }
      }
      if (scan.tip) {
        onChange(
          "tip",
          parseFloat(String(scan.tip).replace(/[^0-9.]/g, "")).toFixed(2),
        );
        extractedFields.add("tip");
      }
      if (scan.total) {
        onChange(
          "total",
          parseFloat(String(scan.total).replace(/[^0-9.]/g, "")).toFixed(2),
        );
        extractedFields.add("total");
      } else if (!extractedFields.has("total")) {
        unreadableFields.add("total");
      }
      setUnreadable(unreadableFields);
      setIsScanning(false);
      if (scan.vendor) {
        toast.success("✓ Receipt data extracted");
      }
    };
    reader.readAsDataURL(file);
  };
  // Looks for one of this user's receipts with the same date and total. If found,
  // shows the "Possible Duplicate" box (Save Anyway / Cancel) and returns true.
  // Fails open: if the lookup errors, saving goes ahead.
  const checkDuplicate = async () => {
    const total = parseFloat(fields.total);
    if (!db || !fields.date || !total) {
      return false;
    }
    try {
      const snapshot = await getDocs(
        query(
          collection(db, "receipts"),
          where("user", "==", user),
          where("date", "==", fields.date),
        ),
      );
      const match = snapshot.docs
        .map((d) => d.data())
        .find((receipt) => Math.abs((receipt.total || 0) - total) < 0.005);
      if (match) {
        setDuplicate(match);
        return true;
      }
    } catch (error) {
      console.warn("Duplicate check failed:", error);
    }
    return false;
  };
  const saveReceipt = async () => {
    if (!imageFile && !isManualEntry) {
      toast.error("Please take or upload a photo");
      return;
    }
    if (!fields.vendor) {
      toast.error("Vendor name is required");
      return;
    }
    if (!selectedFolder) {
      toast.error("Please select a folder");
      return;
    }
    if (!db) {
      toast.error("Firebase not configured yet");
      return;
    }
    setProgress(30);
    setDuplicate(null);
    try {
      const baseName = receiptBaseName(fields.date, fields.vendor);
      const filename = imageFile ? `${baseName}.jpg` : `${baseName}.txt`;
      const docRef = await addDoc(collection(db, "receipts"), {
        user,
        vendor: fields.vendor,
        date: fields.date,
        subtotal: parseFloat(fields.subtotal) || null,
        gst: parseFloat(fields.gst) || null,
        pst: parseFloat(fields.pst) || null,
        tip: parseFloat(fields.tip) || null,
        total: parseFloat(fields.total) || 0,
        notes: fields.notes || "",
        folder: selectedFolder,
        filename,
        storagePath: null,
        downloadURL: null,
        manualEntry: !imageFile,
        createdAt: new Date().toISOString(),
        editedAt: null,
        editedBy: null,
        editReason: null,
      });
      const uploadFile = imageFile;
      const uploadFolder = selectedFolder;
      setProgress(100);
      navigator.vibrate?.(50);
      toast.success("✓ Receipt saved!");
      setImageFile(null);
      setPreviewUrl(null);
      setFields({
        vendor: "",
        date: today(),
        subtotal: "",
        gst: "",
        pst: "",
        tip: "",
        total: "",
        notes: "",
      });
      setSelectedFolder("");
      setProgress(0);
      setIsSaving(false);
      setIsManualEntry(false);
      setUnreadable(new Set());
      onSaved?.();
      if (uploadFile && storage) {
        try {
          const compressed = await compressImage(uploadFile);
          const storagePath = `receipts/${user}/${uploadFolder}/${filename}`;
          await uploadBytes(ref(storage, storagePath), compressed);
          const downloadURL = await getDownloadURL(ref(storage, storagePath));
          await updateDoc(doc(db, "receipts", docRef.id), {
            storagePath,
            downloadURL,
            uploadStatus: "ok",
          });
        } catch (error) {
          console.error(
            "PHOTO UPLOAD FAILED:",
            error.code,
            error.message,
            error,
          );
          try {
            await updateDoc(doc(db, "receipts", docRef.id), {
              uploadStatus: `FAILED: ${error.code || error.message}`,
            });
          } catch {}
          toast.error(`Photo upload failed: ${error.code || error.message}`);
        }
      } else {
        const skipReason = uploadFile ? "no-storage" : "no-file";
        try {
          await updateDoc(doc(db, "receipts", docRef.id), {
            uploadStatus: `skipped-${skipReason}`,
          });
        } catch {}
        console.warn(
          "Upload skipped:",
          skipReason,
          "uploadFile=",
          !!uploadFile,
          "storage=",
          !!storage,
        );
      }
    } catch (error) {
      toast.error(`Save failed: ${error.message}`);
      setIsSaving(false);
      setProgress(0);
    }
  };
  const handleSave = async () => {
    setIsSaving(true);
    if (await checkDuplicate()) {
      setIsSaving(false);
      return;
    }
    await saveReceipt();
  };
  const handleAddFolder = () => {
    const folderName = newFolderName.trim();
    if (!folderName || allFolders.includes(folderName)) {
      return;
    }
    const updatedFolders = [...customFolders, folderName];
    setCustomFolders(updatedFolders);
    localStorage.setItem(`bmp_folders_${user}`, JSON.stringify(updatedFolders));
    setSelectedFolder(folderName);
    setNewFolderName("");
  };
  const showForm = previewUrl && !isScanning;
  return (
    <div>
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{
          display: "none",
        }}
        onChange={(e) => handleFile(e.target.files[0])}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        style={{
          display: "none",
        }}
        onChange={(e) => handleFile(e.target.files[0])}
      />
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*,application/pdf,.pdf"
        style={{
          display: "none",
        }}
        onChange={(e) => handleFile(e.target.files[0])}
      />
      {previewUrl && (
        <ZoomableImage
          src={previewUrl}
          onRemove={() => {
            setImageFile(null);
            setPreviewUrl(null);
            setIsManualEntry(false);
            setUnreadable(new Set());
            setFields({
              vendor: "",
              date: today(),
              subtotal: "",
              gst: "",
              pst: "",
              tip: "",
              total: "",
              notes: "",
            });
            setSelectedFolder("");
          }}
        />
      )}
      {isScanning && (
        <div className="scanning-overlay">
          <div className="scanning-spinner" />
          <div className="scanning-label">🤖 Scanning Receipt...</div>
          <div className="scanning-sub">AI is reading your receipt details</div>
        </div>
      )}
      {!previewUrl && !isManualEntry && (
        <div className="capture-hero">
          <button
            className="capture-hero-btn"
            onClick={() => cameraInputRef.current?.click()}
          >
            <div className="hero-icon">📷</div>
            <div className="hero-label">Take Photo</div>
            <div className="hero-sub">Point camera at your receipt</div>
          </button>
          <div className="capture-secondary">
            <button
              className="capture-secondary-btn"
              onClick={() => galleryInputRef.current?.click()}
            >
              <span className="sec-icon">🖼️</span>
              <span>Camera Roll</span>
            </button>
            <button
              className="capture-secondary-btn"
              onClick={() => uploadInputRef.current?.click()}
            >
              <span className="sec-icon">📁</span>
              <span>Upload File</span>
            </button>
          </div>
          <button
            className="manual-link"
            onClick={() => setIsManualEntry(true)}
          >
            Enter receipt manually instead
          </button>
        </div>
      )}
      {progress > 0 && progress < 100 && (
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{
              width: `${progress}%`,
            }}
          />
        </div>
      )}
      {duplicate && (
        <div className="warn-box">
          <div
            style={{
              fontWeight: "600",
              marginBottom: "8px",
            }}
          >
            ⚠️ Possible Duplicate
          </div>
          <div
            style={{
              fontSize: "12px",
              marginBottom: "12px",
            }}
          >
            A receipt from <strong>{duplicate.vendor}</strong> on{" "}
            <strong>{duplicate.date}</strong> for{" "}
            <strong>${Number(duplicate.total).toFixed(2)}</strong> already
            exists.
          </div>
          <div
            style={{
              display: "flex",
              gap: "8px",
            }}
          >
            <button
              className="submit-btn"
              style={{
                flex: 1,
                padding: "10px",
              }}
              onClick={() => {
                setIsSaving(true);
                saveReceipt();
              }}
            >
              Save Anyway
            </button>
            <button
              className="secondary-btn"
              style={{
                flex: 1,
              }}
              onClick={() => setDuplicate(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {!duplicate && (showForm || isManualEntry) && (
        <>
          {isManualEntry && !previewUrl && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                marginBottom: "16px",
                padding: "12px 14px",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "10px",
              }}
            >
              <span
                style={{
                  fontSize: "20px",
                }}
              >
                ✏️
              </span>
              <div
                style={{
                  flex: 1,
                }}
              >
                <div
                  style={{
                    fontSize: "13px",
                    fontWeight: "600",
                    color: "var(--text)",
                  }}
                >
                  Manual Entry
                </div>
                <div
                  style={{
                    fontSize: "11px",
                    color: "var(--text-muted)",
                  }}
                >
                  No photo — fill in details below
                </div>
              </div>
              <button
                className="manual-link"
                onClick={() => setIsManualEntry(false)}
              >
                Cancel
              </button>
            </div>
          )}
          <ReceiptFields
            fields={fields}
            onChange={onChange}
            showTip={selectedFolder === "Food/Entertainment" || !!fields.tip}
            unreadable={unreadable}
            onFieldFocus={(fieldName) =>
              setUnreadable((prev) => {
                const next = new Set(prev);
                next.delete(fieldName);
                return next;
              })
            }
          />
          <p
            className="section-title"
            style={{
              marginTop: "20px",
            }}
          >
            Save to Folder
          </p>
          <div className="folder-grid">
            {allFolders.map((folder) => (
              <button
                key={folder}
                className={`folder-btn${selectedFolder === folder ? " selected" : ""}`}
                onClick={() => setSelectedFolder(folder)}
              >
                <span>{folderEmoji(folder)}</span>
                {folder}
              </button>
            ))}
          </div>
          <div className="new-folder-row">
            <input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="+ New custom folder..."
              onKeyDown={(e) => e.key === "Enter" && handleAddFolder()}
            />
            <button onClick={handleAddFolder}>Add</button>
          </div>
          <button
            className="submit-btn"
            onClick={handleSave}
            disabled={
              isSaving ||
              (!imageFile && !isManualEntry) ||
              !selectedFolder ||
              !fields.vendor
            }
          >
            {isSaving ? "Saving..." : "💾 Save Receipt"}
          </button>
        </>
      )}
    </div>
  );
}
