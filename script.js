/* ---------- CONFIG ----------
   Paste your deployed Apps Script Web App URL here.
   (Deploy > New deployment > Web app, in Code.gs) */
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwsynTWk5NTxzb6BFLU44aQ6Hltn35qUxdpwnh1HF0Ra3pyF948bSjA04n37Wpq8BSW/exec";

/* ---------- STATE ---------- */
let DATA = {};
let ANNOUNCEMENTS = [];
let SETTINGS = {};
let state = { version: null, series: null, device: null };

/* ---------- LOAD ---------- */
async function loadData() {
  const res = await fetch(SCRIPT_URL);
  const json = await res.json();
  DATA = json.versions || {};
  ANNOUNCEMENTS = json.announcements || [];
  SETTINGS = json.settings || {};
}

function isOn(settingName) {
  return !!(SETTINGS[settingName] && SETTINGS[settingName].value);
}

function messageFor(settingName, fallback) {
  const s = SETTINGS[settingName];
  return (s && s.message) ? s.message : fallback;
}

/* ---------- ANNOUNCEMENTS ---------- */
function renderAnnouncements() {
  const bar = document.getElementById("announceBar");
  if (!ANNOUNCEMENTS.length) { bar.hidden = true; return; }
  ANNOUNCEMENTS.forEach(a => {
    const el = document.createElement("a");
    el.className = "announce-card";
    el.href = a.link;
    el.textContent = a.text;
    el.target = "_blank";
    el.rel = "noopener";
    bar.appendChild(el);
  });
}

/* ---------- STEP 1: VERSION ---------- */
function renderVersionChips() {
  const row = document.getElementById("versionChips");
  Object.keys(DATA).forEach(v => {
    const chip = document.createElement("button");
    chip.className = "chip";
    chip.type = "button";
    chip.textContent = v;
    chip.addEventListener("click", () => selectVersion(v, chip));
    row.appendChild(chip);
  });
}

function selectVersion(version, chipEl) {
  state.version = version;
  state.series = null;
  state.device = null;
  [...chipEl.parentElement.children].forEach(c => c.classList.remove("selected"));
  chipEl.classList.add("selected");

  document.getElementById("step1").dataset.state = "done";
  document.getElementById("step2").dataset.state = "active";
  document.getElementById("step2").innerHTML = "";
  buildStep2();
  resetStep3();
  resetResult();
}

/* ---------- STEP 2: SERIES ---------- */
function buildStep2() {
  const step2 = document.getElementById("step2");
  const label = document.createElement("p");
  label.className = "step-label";
  label.innerHTML = `<span class="step-no">02</span> Choose your series`;
  const row = document.createElement("div");
  row.className = "chip-row";
  row.id = "seriesChips";
  step2.appendChild(label);
  step2.appendChild(row);

  const seriesList = [...new Set(DATA[state.version].map(r => r.series))];
  seriesList.forEach(s => {
    const chip = document.createElement("button");
    chip.className = "chip";
    chip.type = "button";
    chip.textContent = s;
    chip.addEventListener("click", () => selectSeries(s, chip));
    row.appendChild(chip);
  });
}

function selectSeries(series, chipEl) {
  state.series = series;
  state.device = null;
  [...chipEl.parentElement.children].forEach(c => c.classList.remove("selected"));
  chipEl.classList.add("selected");

  document.getElementById("step2").dataset.state = "done";
  document.getElementById("step3").dataset.state = "active";
  const input = document.getElementById("deviceSearch");
  input.disabled = false;
  input.value = "";
  input.focus();
  resetResult();
}

/* ---------- STEP 3: SEARCH (fuzzy) ---------- */
function normalize(str) {
  return str.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function fuzzyScore(query, target) {
  const q = normalize(query), t = normalize(target);
  if (!q) return 0;
  if (t === q) return 100;
  if (t.startsWith(q)) return 90;
  if (t.includes(q)) return 75;
  let matches = 0, ti = 0;
  for (const ch of q) {
    const idx = t.indexOf(ch, ti);
    if (idx !== -1) { matches++; ti = idx + 1; }
  }
  return Math.round((matches / q.length) * 50);
}

function getRowsForCurrentScope() {
  return DATA[state.version].filter(r => r.series === state.series);
}

function searchDevices(query) {
  const rows = getRowsForCurrentScope();
  const results = [];
  rows.forEach(row => {
    row.devices.forEach(deviceName => {
      const score = fuzzyScore(query, deviceName);
      if (score > 0) results.push({ deviceName, row, score });
    });
  });
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, 6);
}

function initSearch() {
  const input = document.getElementById("deviceSearch");
  const list = document.getElementById("suggestions");

  input.addEventListener("input", () => {
    const q = input.value.trim();
    if (!q) { list.hidden = true; list.innerHTML = ""; return; }
    const matches = searchDevices(q);
    if (!matches.length) { list.hidden = true; list.innerHTML = ""; return; }
    list.innerHTML = "";
    matches.forEach(m => {
      const li = document.createElement("li");
      li.innerHTML = `<span>${m.deviceName}</span><span class="tag">${m.row.series}</span>`;
      li.addEventListener("click", () => pickDevice(m.deviceName, m.row));
      list.appendChild(li);
    });
    list.hidden = false;
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-box")) list.hidden = true;
  });
}

function resetStep3() {
  document.getElementById("step3").dataset.state = "locked";
  const input = document.getElementById("deviceSearch");
  input.disabled = true;
  input.value = "";
  document.getElementById("suggestions").hidden = true;
}

/* ---------- STEP 4: RESULT ---------- */
function pickDevice(deviceName, row) {
  state.device = deviceName;
  document.getElementById("suggestions").hidden = true;
  document.getElementById("deviceSearch").value = deviceName;
  document.getElementById("step3").dataset.state = "done";
  document.getElementById("step4").dataset.state = "active";

  const card = document.getElementById("resultCard");
  card.innerHTML = `
    <p class="result-device">${state.version} → rollback confirmed</p>
    <p class="result-title">${deviceName}</p>
    <a class="result-link" href="${row.link}" target="_blank" rel="noopener">Open rollback thread</a>
    <p class="result-alt">Wrong device? <a href="#requestForm">Request it instead</a></p>
  `;
}

function resetResult() {
  document.getElementById("step4").dataset.state = "locked";
  document.getElementById("resultCard").innerHTML =
    `<p class="empty-hint">Pick a device above to see its rollback thread here.</p>`;
}

/* ---------- REQUEST FORM ---------- */
/* Mirrors the backend's validateField() so users get instant feedback
   instead of waiting on a round-trip for something obviously invalid. */
function validateField(text, maxLen) {
  const t = text.trim();
  if (!t) return { ok: false, reason: "This field is required." };
  if (t.length > maxLen) return { ok: false, reason: `Keep it under ${maxLen} characters.` };
  if (/https?:\/\/|www\.|\.(com|net|org|in|io|co|link|xyz)\b/i.test(t)) {
    return { ok: false, reason: "Links aren't allowed here — just the device/version." };
  }
  if (/<[^>]*>|javascript:|on\w+\s*=/i.test(t)) {
    return { ok: false, reason: "That contains characters that aren't allowed." };
  }
  if (/^[=+\-@]/.test(t)) {
    return { ok: false, reason: "That contains characters that aren't allowed." };
  }
  return { ok: true };
}

function initRequestForm() {
  const form = document.getElementById("requestForm");
  const note = document.getElementById("formNote");

  if (isOn("Block Requests")) {
    form.querySelectorAll("input, button").forEach(el => el.disabled = true);
    note.hidden = false;
    note.textContent = messageFor("Block Requests", "Requests are paused right now — check back later.");
    return;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const deviceEl = document.getElementById("reqDevice");
    const versionEl = document.getElementById("reqVersion");

    const deviceCheck = validateField(deviceEl.value, 60);
    if (!deviceCheck.ok) {
      note.hidden = false; note.textContent = deviceCheck.reason;
      return;
    }
    const versionCheck = validateField(versionEl.value, 50);
    if (!versionCheck.ok) {
      note.hidden = false; note.textContent = versionCheck.reason;
      return;
    }

    const payload = { device: deviceEl.value.trim(), version: versionEl.value.trim() };
    try {
      const res = await fetch(SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      note.hidden = false;
      if (result.ok) {
        form.reset();
        note.textContent = "Got it — we'll take a look and add it if possible.";
      } else {
        note.textContent = "That couldn't be submitted — check for links or special characters.";
      }
    } catch (err) {
      note.hidden = false;
      note.textContent = "Something went wrong sending that — try again in a bit.";
    }
    setTimeout(() => { note.hidden = true; }, 5000);
  });
}

/* ---------- MAINTENANCE ---------- */
function showMaintenance(message) {
  document.querySelector(".wrap").innerHTML = `
    <div class="state-msg">
      <h2>Down for a moment</h2>
      <p>${message}</p>
    </div>`;
}

/* ---------- INIT ---------- */
(async function init() {
  const loading = document.getElementById("loadingState");
  try {
    await loadData();
  } catch (err) {
    loading.textContent = "Couldn't load data — check your connection and reload.";
    return;
  }

  if (isOn("Maintenance Mode")) {
    showMaintenance(messageFor("Maintenance Mode", "Back shortly — doing some maintenance."));
    return;
  }

  loading.hidden = true;
  document.querySelectorAll(".hero, #step1").forEach(el => el.hidden = false);

  renderAnnouncements();
  renderVersionChips();
  initSearch();
  initRequestForm();
})();
