/* ---------- ROLLBACK PACKAGE FINDER — BACKEND ----------
   Deploy this as a Web App (Deploy > New deployment > Web app,
   Execute as: Me, Who has access: Anyone), then paste the
   deployment URL into SCRIPT_URL at the top of script.js.

   Sheet structure expected:
   - Any tab named after a UI version ("UI 7", "UI 6", ...):
       columns Series | Devices | Thread Link
   - "Announcements" tab: Text | Link | Active | Order
   - "Settings" tab: Setting | Value | Message
       rows: "Maintenance Mode" and "Block Requests", Value = ON/OFF
   - "Requests" tab: Device Name | UI Version Needed | Status | Timestamp
       (this script only appends rows here — you manage Status by hand)
*/

const RESERVED_SHEETS = ["Announcements", "Settings", "Requests"];

function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const payload = {
    versions: readVersionTabs(ss),
    announcements: readAnnouncements(ss),
    settings: readSettings(ss)
  };
  return jsonOutput(payload);
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const device = validateField(data.device, 60);
    const version = validateField(data.version, 50);

    if (!device.ok) return jsonOutput({ ok: false, error: "device_" + device.reason });
    if (!version.ok) return jsonOutput({ ok: false, error: "version_" + version.reason });

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Requests");
    sheet.appendRow([device.value, version.value, "Pending", new Date()]);
    return jsonOutput({ ok: true });
  } catch (err) {
    return jsonOutput({ ok: false, error: "bad_request" });
  }
}

/* Blocks links, HTML/script injection, and spreadsheet-formula injection
   before anything reaches the Requests sheet. Returns {ok, value, reason}. */
function validateField(raw, maxLen) {
  const text = String(raw || "").trim();

  if (!text) return { ok: false, reason: "empty" };
  if (text.length > maxLen) return { ok: false, reason: "too_long" };

  // links / URLs of any kind
  if (/https?:\/\/|www\.|\.(com|net|org|in|io|co|link|xyz)\b/i.test(text)) {
    return { ok: false, reason: "link_not_allowed" };
  }
  // HTML tags or script-like content
  if (/<[^>]*>|javascript:|on\w+\s*=/i.test(text)) {
    return { ok: false, reason: "invalid_characters" };
  }
  // spreadsheet formula injection (=, +, -, @ as the leading character)
  if (/^[=+\-@]/.test(text)) {
    return { ok: false, reason: "invalid_characters" };
  }

  return { ok: true, value: text };
}

function readVersionTabs(ss) {
  const versions = {};
  ss.getSheets().forEach(function (sheet) {
    const name = sheet.getName();
    if (RESERVED_SHEETS.indexOf(name) !== -1) return;

    const rows = sheet.getDataRange().getValues();
    rows.shift(); // drop header row
    versions[name] = rows
      .filter(function (r) { return r[0] && r[1]; })
      .map(function (r) {
        return {
          series: String(r[0]).trim(),
          devices: String(r[1]).split(",").map(function (d) { return d.trim(); }).filter(Boolean),
          link: String(r[2] || "").trim()
        };
      });
  });
  return versions;
}

function readAnnouncements(ss) {
  const sheet = ss.getSheetByName("Announcements");
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  rows.shift();
  return rows
    .filter(function (r) { return r[0] && String(r[2]).toUpperCase() === "TRUE"; })
    .sort(function (a, b) { return (Number(a[3]) || 0) - (Number(b[3]) || 0); })
    .map(function (r) { return { text: String(r[0]), link: String(r[1] || "#") }; });
}

function readSettings(ss) {
  const sheet = ss.getSheetByName("Settings");
  if (!sheet) return {};
  const rows = sheet.getDataRange().getValues();
  rows.shift();
  const settings = {};
  rows.forEach(function (r) {
    if (!r[0]) return;
    settings[String(r[0]).trim()] = {
      value: String(r[1]).toUpperCase() === "ON",
      message: String(r[2] || "")
    };
  });
  return settings;
}

function jsonOutput(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
