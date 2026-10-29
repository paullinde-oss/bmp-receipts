import { useRef, useState } from "react";

export function ZoomableImage({ src, onRemove }) {
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const lastPinchDistanceRef = useRef(null);
  const onWheel = (event) => {
    event.preventDefault();
    const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
    setZoom((prevZoom) => Math.min(4, Math.max(1, prevZoom * zoomFactor)));
  };
  // Two-finger pinch: scale zoom by the change in distance between touches (clamped 1x-4x).
  const handleTouchMove = (event) => {
    if (event.touches.length !== 2) {
      return;
    }
    const deltaX = event.touches[0].clientX - event.touches[1].clientX;
    const deltaY = event.touches[0].clientY - event.touches[1].clientY;
    const pinchDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    if (lastPinchDistanceRef.current) {
      const pinchRatio = pinchDistance / lastPinchDistanceRef.current;
      setZoom((prevZoom) => Math.min(4, Math.max(1, prevZoom * pinchRatio)));
    }
    lastPinchDistanceRef.current = pinchDistance;
  };
  const handleTouchEnd = () => {
    lastPinchDistanceRef.current = null;
  };
  return (
    <>
      <div
        className="preview-wrap"
        style={{
          marginBottom: "16px",
          cursor: zoom > 1 ? "grab" : "zoom-in",
          overflow: "hidden",
        }}
        onWheel={onWheel}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <img
          src={src}
          alt="Receipt preview"
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: "top center",
            transition: zoom === 1 ? "transform 0.2s" : "none",
            width: "100%",
            display: "block",
          }}
          onClick={() => setIsFullscreen(true)}
        />
        <button className="preview-remove" onClick={onRemove}>
          ✕ Remove
        </button>
        {zoom === 1 && (
          <div
            style={{
              position: "absolute",
              bottom: "10px",
              left: "50%",
              transform: "translateX(-50%)",
              background: "rgba(0,0,0,0.6)",
              color: "#fff",
              fontSize: "11px",
              padding: "4px 10px",
              borderRadius: "20px",
              pointerEvents: "none",
              whiteSpace: "nowrap",
            }}
          >
            🔍 Pinch or scroll to zoom · Tap to expand
          </div>
        )}
        {zoom > 1 && (
          <button
            onClick={() => setZoom(1)}
            style={{
              position: "absolute",
              bottom: "10px",
              right: "10px",
              background: "rgba(0,0,0,0.7)",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: "8px",
              color: "#fff",
              fontSize: "12px",
              padding: "5px 10px",
              cursor: "pointer",
            }}
          >
            Reset zoom
          </button>
        )}
      </div>
      {isFullscreen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.95)",
            zIndex: 300,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
          onClick={() => setIsFullscreen(false)}
        >
          <img
            src={src}
            alt="Receipt"
            style={{
              maxWidth: "100%",
              maxHeight: "90vh",
              objectFit: "contain",
              borderRadius: "8px",
            }}
          />
          <button
            onClick={() => setIsFullscreen(false)}
            style={{
              position: "absolute",
              top: "16px",
              right: "16px",
              background: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: "50%",
              width: "36px",
              height: "36px",
              color: "#fff",
              fontSize: "18px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ✕
          </button>
          <div
            style={{
              position: "absolute",
              bottom: "20px",
              left: "50%",
              transform: "translateX(-50%)",
              color: "rgba(255,255,255,0.5)",
              fontSize: "12px",
            }}
          >
            Tap anywhere to close
          </div>
        </div>
      )}
    </>
  );
}
