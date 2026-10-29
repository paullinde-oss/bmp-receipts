const PDFJS_BASE = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174";
const SUPPORTED_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
];

const sanitizeName = (name) => (name || "").replace(/[^a-zA-Z0-9_\-]/g, "_");

// Base filename for a receipt, e.g. "2026-05-01_Canadian_Tire".
export const receiptBaseName = (date, vendor) =>
  `${date}_${sanitizeName(vendor || "Unknown")}`;

// pdf.js is only needed for PDF uploads, so it is loaded from the CDN on first use.
const loadPdfJs = () =>
  new Promise((resolve) => {
    if (window.pdfjsLib) {
      resolve(window.pdfjsLib);
      return;
    }
    const script = document.createElement("script");
    script.src = `${PDFJS_BASE}/pdf.min.js`;
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = `${PDFJS_BASE}/pdf.worker.min.js`;
      resolve(window.pdfjsLib);
    };
    document.head.appendChild(script);
  });

// Renders page 1 of a PDF to a JPEG File. Returns null on failure.
export async function pdfToImage(file) {
  try {
    const pdfjs = await loadPdfJs();
    const data = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data }).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext("2d"), viewport })
      .promise;
    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          resolve(
            new File([blob], file.name.replace(".pdf", ".jpg"), {
              type: "image/jpeg",
            }),
          );
        },
        "image/jpeg",
        0.92,
      );
    });
  } catch (error) {
    console.error("PDF conversion failed:", error);
    return null;
  }
}

// Converts formats the scanner can't take (e.g. HEIC) to JPEG. Supported
// images, and anything the browser can't decode, are returned unchanged.
export async function toSupportedImage(file) {
  if (SUPPORTED_TYPES.includes(file.type.toLowerCase())) {
    return file;
  }
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext("2d").drawImage(img, 0, 0);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          resolve(
            blob
              ? new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
                  type: "image/jpeg",
                })
              : file,
          );
        },
        "image/jpeg",
        0.92,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}

// Downscales to at most 1200px on the long edge and re-encodes as JPEG (q=0.72)
// for storage. Falls back to the original file if anything fails.
export async function compressImage(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      let { naturalWidth: width, naturalHeight: height } = img;
      if (width > 1200 || height > 1200) {
        if (width >= height) {
          height = Math.round(height * (1200 / width));
          width = 1200;
        } else {
          width = Math.round(width * (1200 / height));
          height = 1200;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          resolve(blob || file);
        },
        "image/jpeg",
        0.72,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}
