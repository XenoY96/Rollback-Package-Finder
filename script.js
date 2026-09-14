/* ---------- SAMPLE DATA ----------
   Replace this with a live fetch from your published Google Sheet
   (same pattern as Update Tracker) once the backend is wired up.
   Structure: one array per UI-version tab, each row = one thread. */

const DATA = {
  "UI 7": [
    { series: "P", devices: ["realme P4 5G", "realme P4 Pro 5G"], link: "https://community.realme.com/example-p4-rollback" },
    { series: "Number", devices: ["realme 15 5G", "realme 15T", "realme 15T Pro"], link: "https://community.realme.com/example-15-rollback" },
    { series: "C", devices: ["realme C75"], link: "https://community.realme.com/example-c75-rollback" }
  ],
  "UI 6": [
    { series: "P", devices: ["realme P3 5G", "realme P3 Pro", "realme P3x 5G"], link: "https://community.realme.com/example-p3-rollback" },
    { series: "Number", devices: ["realme 14 5G", "realme 14 Pro 5G", "realme 14T"], link: "https://community.realme.com/example-14-rollback" }
  ],
  "UI 5": [
    { series: "P", devices: ["realme P2 5G", "realme P2 Pro 5G"], link: "https://community.realme.com/example-p2-rollback" }
  ]
};

const ANNOUNCEMENTS = [
  { text: "How rollback actually works — full guide", link: "#" },
  { text: "UI 8 rollback packages not available yet", link: "#" }
];

/* ---------- STATE ---------- */
let state = { version: null, series: null, device: null };

/* ---------- ANNOUNCEMENTS ---------- */
function renderAnnouncements() {
  const bar = document.getElementById("announceBar");
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

// lightweight fuzzy score: exact match first, then substring, then edit-distance-ish
function fuzzyScore(query, target) {
  const q = normalize(query), t = normalize(target);
  if (!q) return 0;
  if (t === q) return 100;
  if (t.startsWith(q)) return 90;
  if (t.includes(q)) return 75;
  // simple char-overlap fallback for typo tolerance
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
function initRequestForm() {
  const form = document.getElementById("requestForm");
  const note = document.getElementById("formNote");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    // TODO: wire this to an Apps Script endpoint that appends to the Requests tab
    // (Device Name, UI Version Needed, Status, Timestamp) — same pattern as
    // Update Tracker's submission flow, minus the verification pipeline.
    form.reset();
    note.hidden = false;
    note.textContent = "Got it — we'll take a look and add it if possible.";
    setTimeout(() => { note.hidden = true; }, 4000);
  });
}

/* ---------- INIT ---------- */
renderAnnouncements();
renderVersionChips();
initSearch();
initRequestForm();
