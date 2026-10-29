const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-5-20250929";
const ALL_UNREADABLE = "vendor,date,subtotal,total";

// The key lives in appConfig/settings.anthropicKey (via the cached config);
// bmp_rt_api_key is an older per-device fallback.
const getAnthropicKey = () => {
  const cached = localStorage.getItem("bmp_config_cache");
  if (cached) {
    try {
      return JSON.parse(cached).anthropicKey || "";
    } catch {}
  }
  return localStorage.getItem("bmp_rt_api_key") || "";
};

const PROMPT = `You are extracting data from a receipt photo. There may be multiple overlapping slips, UI overlays, or partial obstructions — read ALL visible text carefully.

Respond ONLY with valid JSON, no markdown, no explanation:
{"vendor":"store or business name","date":"YYYY-MM-DD","subtotal":"amount before tax","gst":"GST/HST amount or null","pst":"PST amount or null","tip":"tip/gratuity amount or null","total":"final amount charged to card","category":"one of: Gas, Auto, Food/Entertainment, Misc","province":"2-letter province code or null","unreadable_fields":"comma-separated list of fields you could not determine, or empty string"}

EXTRACTION RULES:
- All amounts as plain numbers like 12.34, no $ signs or commas
- vendor: business name only — never VISA, Mastercard, or payment network names
- date: transaction/invoice/issue date. Accept any format, output as YYYY-MM-DD. CRITICAL date rules: 4-digit years are always correct as written (05-05-2026 = 2026-05-05). For 2-digit years, 26=2026, 25=2025 etc. Never output a future year unless clearly shown. MM/DD/YY and DD-MM-YY are both possible — use context (month cannot exceed 12).
- subtotal: amount taxes are calculated on. May be labeled SUBTOTAL, SUB TOTAL, AMOUNT, SALE (after discounts), or Food Total. If a discount/trade-in is applied, use the POST-discount amount. If ONLY a total is visible with no subtotal line, back-calculate subtotal only: subtotal = round(total / 1.05, 2) for AB/SK/MB/ON/NS/NB/PE/NL, subtotal = round(total / 1.12, 2) for BC. Do NOT change the total value when back-calculating.
- gst: federal tax line. Accept labels: GST, GST 5%, GST [registration number] 5%, HST, HST [number]. If HST=$0.00 that is tax-exempt, set gst=null. If only a total is visible with no tax lines printed, calculate gst = round(subtotal * 0.05, 2).
- pst: provincial tax only. Labels: PST, PST 7%, PST........7%. Never confuse HST with PST. Alberta has NO PST. If only total visible and province=BC, calculate pst = round(subtotal * 0.07, 2).
- tip: any tip, gratuity, or Total Tips line. Very common on restaurant receipts.
- total: the FINAL amount actually charged to the card. Look for: CREDIT CARD SALE, Visa [amount], AMOUNT (on credit slip), the amount next to card number, or the largest final total including tip. CRITICAL: Always read this DIRECTLY from the receipt — never calculate or derive it. On this receipt Total=$20.99 and CREDIT CARD SALE=$20.99 both confirm the total.
- province: read vendor street address for province. BC/British Columbia=BC, AB/Alberta=AB, ON/Ontario=ON, QC/Quebec=QC etc. If vendor address is in the USA (US state abbreviations like WA, MT, ID, CA, NY, TX etc, or says United States), set province=US. If province=US, set gst=null and pst=null — US sales tax is not tracked. Very important.
- category: Auto=vehicle repair/oil change/collision/tires/parts. Gas=fuel only. Food/Entertainment=restaurants/bars/bakeries/cafes. Misc=everything else.
- unreadable_fields: list any of vendor/date/subtotal/gst/pst/tip/total/province that you genuinely could not determine. Empty string if all found.

COMMON RECEIPT PATTERNS:
- Two overlapping slips: credit card slip on top + invoice/restaurant bill behind. Read BOTH.
- GST registration numbers in label: "GST 820413370 5%" — the number is just a tax ID, extract the dollar amount only.
- Alberta (AB) has NO PST. BC has PST 7%. Quebec has QST ~9.975%.
- Restaurant receipts: AMOUNT on credit slip = pre-tip total. TIP is separate. TOTAL on credit slip = final charged.
- Jiffy Lube / auto service: SALE = post-discount subtotal (before tax).
- If only one total visible and no tax breakdown, that total is the final charged amount.
- CRITICAL TOTAL RULE: total must ALWAYS be >= subtotal. If total equals subtotal but GST was calculated, total = subtotal + gst + pst. Never let total equal subtotal when taxes exist.`;

// Sends a base64 receipt image to Claude and returns the parsed fields.
// On any failure returns { unreadable_fields } so the user can enter values by hand.
export async function scanReceipt(base64Data, mediaType) {
  const apiKey = getAnthropicKey();
  if (!apiKey) {
    return { unreadable_fields: ALL_UNREADABLE, _nokey: true };
  }
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 300,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType,
                  data: base64Data,
                },
              },
              { type: "text", text: PROMPT },
            ],
          },
        ],
      }),
    });
    const result = await response.json();
    const text = result.content?.[0]?.text || "{}";
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch (error) {
    console.error("Receipt scan error:", error);
    return { unreadable_fields: ALL_UNREADABLE };
  }
}
