// ── PWA Bootstrap ────────────────────────────────────────────────────────────

// 1. Point manifest link to the real manifest.json served from GitHub Pages
(function () {
  var el = document.getElementById("pwa-manifest");
  if (el) el.href = "/bmp-receipts/manifest.json";
})();

// 2. Register real sw.js (must be same-origin, blob URLs are blocked)
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("/bmp-receipts/sw.js", { scope: "/bmp-receipts/" })
    .catch(function () {
      /* SW optional */
    });
}

// 3. PWA install support — exposes window.bmpInstallApp() for the Settings tab
(function () {
  var isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) && !window.MSStream;

  function showModal(msg) {
    if (document.getElementById("bmp-install-modal")) return;
    var overlay = document.createElement("div");
    overlay.id = "bmp-install-modal";
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;padding:24px;";
    overlay.innerHTML =
      '<div style="background:#1a1a1a;border:1px solid #333;border-radius:16px;padding:24px;max-width:340px;width:100%;color:#e0e0e0;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">' +
      '<div style="font-size:32px;margin-bottom:12px;text-align:center">\u{1F4F2}</div>' +
      '<div style="font-size:16px;font-weight:600;margin-bottom:12px;text-align:center">Install BMP Receipt Tracker</div>' +
      '<div style="font-size:14px;color:#aaa;line-height:1.5;margin-bottom:20px;text-align:center">' +
      msg +
      "</div>" +
      '<button onclick="document.getElementById(\'bmp-install-modal\').remove()" style="width:100%;background:#f97316;color:#fff;border:none;border-radius:10px;padding:12px;font-size:15px;font-weight:600;cursor:pointer;">Got it</button>' +
      "</div>";
    document.body.appendChild(overlay);
  }

  window.bmpInstallApp = function () {
    var isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;
    if (isStandalone) {
      showModal("This app is already installed on your device!");
      return;
    }
    if (window._pwaPrompt) {
      window._pwaPrompt.prompt();
      window._pwaPrompt.userChoice.then(function () {
        window._pwaPrompt = null;
      });
    } else if (isIOS) {
      showModal(
        'To install: tap the <strong>Share button</strong> at the bottom of Safari, then tap <strong>"Add to Home Screen"</strong>.',
      );
    } else {
      showModal(
        'To install: tap the <strong>three-dot menu</strong> in Chrome, then tap <strong>"Add to Home screen"</strong> or <strong>"Install app"</strong>.',
      );
    }
  };

  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    window._pwaPrompt = e;
    // Update button text if already rendered
    var btn = document.getElementById("bmp-settings-install-btn");
    if (btn) btn.textContent = "📲 Install App";
  });

  // Inject the install button into Settings after React renders
  function injectInstallButton() {
    if (document.getElementById("bmp-settings-install-btn")) return;
    // Find the Appearance settings section by looking for "Dark Mode" text
    var labels = document.querySelectorAll("span");
    var darkModeRow = null;
    for (var i = 0; i < labels.length; i++) {
      if (labels[i].textContent === "Dark Mode") {
        darkModeRow = labels[i].closest("div[style]");
        break;
      }
    }
    if (!darkModeRow) return;
    var section = darkModeRow.parentElement;
    if (!section) return;

    var row = document.createElement("div");
    row.style.cssText =
      "display:flex;justify-content:space-between;align-items:center;padding:4px 0;margin-top:8px;";
    row.innerHTML =
      '<span style="font-size:14px;color:var(--text)">Install as App</span>';

    var btn = document.createElement("button");
    btn.id = "bmp-settings-install-btn";
    btn.textContent = window._pwaPrompt
      ? "📲 Install App"
      : "📲 How to Install";
    btn.style.cssText =
      "background:var(--accent);border:1px solid var(--border);border-radius:20px;padding:6px 16px;cursor:pointer;color:#fff;font-size:13px;font-weight:600;";
    btn.onclick = function () {
      window.bmpInstallApp && window.bmpInstallApp();
    };

    row.appendChild(btn);
    section.appendChild(row);
  }

  // Try injecting after React has had time to render
  setTimeout(injectInstallButton, 1500);
  setTimeout(injectInstallButton, 3000); // retry in case of slow load
})();
