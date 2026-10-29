export function ReceiptFields({
  fields,
  onChange,
  showTip,
  unreadable = new Set(),
  onFieldFocus,
}) {
  const fieldStyle = (fieldName, baseStyle = {}) => {
    const isUnreadable = unreadable.has(fieldName);
    return {
      ...baseStyle,
      ...(isUnreadable
        ? {
            borderColor: "#e53e3e",
            borderWidth: "2px",
          }
        : {}),
    };
  };
  const FieldLabel = ({ name, children }) => (
    <label className="form-label">
      {children}
      {unreadable.has(name) && (
        <span
          style={{
            color: "#e53e3e",
            fontWeight: "600",
            textTransform: "none",
            letterSpacing: 0,
            marginLeft: "6px",
            fontSize: "10px",
          }}
        >
          ⚠ Could not read — please verify
        </span>
      )}
    </label>
  );
  const handleFocus = (fieldName) => onFieldFocus && onFieldFocus(fieldName);
  return (
    <>
      <div className="form-row">
        <FieldLabel name="vendor">Vendor / Store</FieldLabel>
        <input
          className="form-input"
          value={fields.vendor}
          onChange={(e) => onChange("vendor", e.target.value)}
          onFocus={() => handleFocus("vendor")}
          placeholder="e.g. Shell, McDonald's"
          style={fieldStyle("vendor")}
        />
      </div>
      <div className="form-row-2">
        <div>
          <FieldLabel name="date">Date</FieldLabel>
          <input
            className="form-input"
            type="date"
            value={fields.date}
            onChange={(e) => onChange("date", e.target.value)}
            onFocus={() => handleFocus("date")}
            style={fieldStyle("date")}
          />
        </div>
        <div>
          <FieldLabel name="subtotal">Subtotal ($)</FieldLabel>
          <input
            className="form-input"
            type="number"
            step="0.01"
            value={fields.subtotal}
            onChange={(e) => onChange("subtotal", e.target.value)}
            onFocus={() => handleFocus("subtotal")}
            placeholder="0.00"
            style={fieldStyle("subtotal")}
          />
        </div>
      </div>
      <div className="form-row-3">
        <div>
          <FieldLabel name="gst">GST ($)</FieldLabel>
          <input
            className="form-input"
            type="number"
            step="0.01"
            value={fields.gst}
            onChange={(e) => onChange("gst", e.target.value)}
            onFocus={() => handleFocus("gst")}
            placeholder="0.00"
            style={fieldStyle("gst")}
          />
        </div>
        <div>
          <FieldLabel name="pst">PST ($)</FieldLabel>
          <input
            className="form-input"
            type="number"
            step="0.01"
            value={fields.pst}
            onChange={(e) => onChange("pst", e.target.value)}
            onFocus={() => handleFocus("pst")}
            placeholder="0.00"
            style={fieldStyle("pst")}
          />
        </div>
        <div>
          <FieldLabel name="tip">Tip ($)</FieldLabel>
          <input
            className="form-input"
            type="number"
            step="0.01"
            value={fields.tip}
            onChange={(e) => onChange("tip", e.target.value)}
            onFocus={() => handleFocus("tip")}
            placeholder="0.00"
            style={fieldStyle(
              "tip",
              showTip
                ? {}
                : {
                    opacity: 0.35,
                  },
            )}
          />
        </div>
      </div>
      <div className="form-row">
        <FieldLabel name="total">
          Total Paid ($){" "}
          <span
            style={{
              color: "var(--accent)",
              fontWeight: "normal",
              textTransform: "none",
              letterSpacing: 0,
            }}
          >
            incl. tax & tip
          </span>
        </FieldLabel>
        <input
          className="form-input"
          type="number"
          step="0.01"
          value={fields.total}
          onChange={(e) => onChange("total", e.target.value)}
          onFocus={() => handleFocus("total")}
          placeholder="0.00"
          style={fieldStyle(
            "total",
            fields.total && !unreadable.has("total")
              ? {
                  borderColor: "var(--accent)",
                }
              : {},
          )}
        />
      </div>
      <div className="form-row">
        <label className="form-label">
          Notes{" "}
          <span
            style={{
              color: "var(--text-muted)",
              fontWeight: "normal",
              textTransform: "none",
              letterSpacing: 0,
            }}
          >
            (optional)
          </span>
        </label>
        <textarea
          className="form-textarea"
          value={fields.notes}
          onChange={(e) => onChange("notes", e.target.value)}
          placeholder="e.g. Client lunch with Lafarge, job site fuel..."
        />
      </div>
    </>
  );
}
