async function getEntries() {
  return new Promise(resolve => {
    chrome.storage.local.get({ entries: [] }, d => resolve(d.entries));
  });
}

async function saveEntries(entries) {
  return new Promise(resolve => {
    chrome.storage.local.set({ entries }, resolve);
  });
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// Tab routing 
const panels = { search: null, add: null, upload: null, manage: null };
const tabs = {};
let currentMode = "search";

function switchMode(mode) {
  currentMode = mode;
  Object.values(panels).forEach(p => p && p.classList.add("hidden"));
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  panels[mode].classList.remove("hidden");
  tabs[mode].classList.add("active");
  if (mode === "search") document.getElementById("search-input").focus();
  if (mode === "add") document.getElementById("add-key").focus();
  if (mode === "manage") {
    document.getElementById("manage-search").focus();
    getEntries().then(entries => renderManage(entries));
  }
}

// Search panel 
function renderResults(entries, query) {
  const list = document.getElementById("search-results");
  const empty = document.getElementById("search-empty");
  const q = query.toLowerCase().trim();
  const filtered = q
    ? entries.filter(e => e.key.toLowerCase().includes(q) || e.value.toLowerCase().includes(q))
    : entries.slice().sort((a, b) => a.key.localeCompare(b.key));

  list.innerHTML = "";
  if (filtered.length === 0) { empty.classList.remove("hidden"); return; }
  empty.classList.add("hidden");

  // Group by key
  const grouped = {};
  filtered.forEach(e => {
    if (!grouped[e.key]) grouped[e.key] = [];
    grouped[e.key].push(e);
  });

  Object.entries(grouped).forEach(([key, group]) => {
    group.forEach((entry, idx) => {
      const div = document.createElement("div");
      div.className = "result-item";
      div.innerHTML = `
        <div class="result-key">${escHtml(key)}${group.length > 1 ? `<span class="result-badge">${idx + 1}/${group.length}</span>` : ""}</div>
        <div class="result-val">${escHtml(entry.value)}</div>
      `;
      div.addEventListener("click", () => copyValue(entry.value));
      list.appendChild(div);
    });
  });
}

function copyValue(val) {
  navigator.clipboard.writeText(val).then(() => {
    const toast = document.getElementById("copy-toast");
    toast.classList.remove("hidden");
    setTimeout(() => toast.classList.add("hidden"), 2500);
  });
}

function initSearch(entries) {
  const input = document.getElementById("search-input");
  renderResults(entries, "");
  input.addEventListener("input", () => renderResults(entries, input.value));
  input.addEventListener("keydown", e => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const items = document.querySelectorAll(".result-item");
      if (items.length) { items[0].classList.add("focused"); items[0].focus(); }
    }
  });
  document.getElementById("search-results").addEventListener("keydown", e => {
    if (e.key === "Enter" && e.target.classList.contains("result-item")) e.target.click();
  });
}

// Add panel
let addEntries = [];

async function checkConflict() {
  const key = document.getElementById("add-key").value.trim();
  if (!key) { document.getElementById("conflict-box").classList.add("hidden"); return; }
  const matches = addEntries.filter(e => e.key === key);
  const box = document.getElementById("conflict-box");
  const entriesDiv = document.getElementById("conflict-entries");
  if (matches.length === 0) { box.classList.add("hidden"); return; }

  entriesDiv.innerHTML = "";
  matches.forEach((e, i) => {
    const label = document.createElement("label");
    label.className = "conflict-entry";
    label.innerHTML = `
      <input type="radio" name="conflict-entry" value="${e.id}" ${i === 0 ? "checked" : ""} />
      <span class="conflict-entry-val">${escHtml(e.value)}</span>
    `;
    entriesDiv.appendChild(label);
  });
  box.classList.remove("hidden");
}

async function handleSave() {
  const key = document.getElementById("add-key").value.trim();
  const value = document.getElementById("add-value").value.trim();
  if (!key || !value) { shakeEl(document.getElementById("add-save-btn")); return; }

  const matches = addEntries.filter(e => e.key === key);
  const conflictMode = document.querySelector('input[name="conflict"]:checked')?.value;
  const selectedId = document.querySelector('input[name="conflict-entry"]:checked')?.value;

  if (matches.length > 0 && conflictMode === "overwrite" && selectedId) {
    const idx = addEntries.findIndex(e => e.id === selectedId);
    addEntries[idx].value = value;
  } else {
    addEntries.push({ key, value, id: genId() });
  }

  await saveEntries(addEntries);
  document.getElementById("add-key").value = "";
  document.getElementById("add-value").value = "";
  document.getElementById("conflict-box").classList.add("hidden");

  const toast = document.getElementById("add-toast");
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 2000);
}

function initAdd(entries) {
  addEntries = entries;
  document.getElementById("add-key").addEventListener("input", checkConflict);
  document.getElementById("add-save-btn").addEventListener("click", handleSave);
}

// Upload panel 
function initUpload(entries) {
  let uploadEntries = entries;

  const dropZone = document.getElementById("drop-zone");
  const fileInput = document.getElementById("file-input");

  dropZone.addEventListener("dragover", e => { e.preventDefault(); dropZone.classList.add("drag-over"); });
  dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
  dropZone.addEventListener("drop", e => {
    e.preventDefault();
    dropZone.classList.remove("drag-over");
    const file = e.dataTransfer.files[0];
    if (file) processFile(file, uploadEntries);
  });
  dropZone.addEventListener("click", e => {
    if (e.target.tagName !== "LABEL" && e.target.tagName !== "INPUT") fileInput.click();
  });
  fileInput.addEventListener("change", () => {
    if (fileInput.files[0]) processFile(fileInput.files[0], uploadEntries);
    fileInput.value = "";
  });
}

async function processFile(file, currentEntries) {
  const name = file.name.toLowerCase();
  let pairs = [];

  try {
    if (name.endsWith(".csv")) {
      const text = await file.text();
      pairs = parseCSV(text);
    } else if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      pairs = await parseExcel(file);
    } else {
      showUploadError("Unsupported file type. Please use .csv, .xlsx, or .xls");
      return;
    }
  } catch (err) {
    showUploadError("Could not read file: " + err.message);
    return;
  }

  if (pairs.length === 0) {
    showUploadError("No valid key/value pairs found. Ensure columns are named 'key' and 'value'.");
    return;
  }

  const overridden = [];
  const entries = [...currentEntries];

  pairs.forEach(({ key, value }) => {
    const existing = entries.filter(e => e.key === key);
    if (existing.length > 0) {
      overridden.push(key);
      existing.forEach(e => { e.value = value; });
    } else {
      entries.push({ key, value, id: genId() });
    }
  });

  await saveEntries(entries);
  showUploadSuccess(pairs.length, overridden);
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/^"|"$/g, ""));
  const ki = headers.indexOf("key");
  const vi = headers.indexOf("value");
  if (ki === -1 || vi === -1) return [];
  const pairs = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i]);
    const key = (cols[ki] || "").trim();
    const value = (cols[vi] || "").trim();
    if (key && value) pairs.push({ key, value });
  }
  return pairs;
}

function splitCSVLine(line) {
  const result = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQ = !inQ; }
    else if (c === "," && !inQ) { result.push(cur); cur = ""; }
    else { cur += c; }
  }
  result.push(cur);
  return result.map(s => s.replace(/^"|"$/g, ""));
}

async function parseExcel(file) {
  if (typeof XLSX === "undefined") throw new Error("Excel parser not loaded");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
  const pairs = [];
  rows.forEach(row => {
    const key = String(row["key"] || row["Key"] || "").trim();
    const value = String(row["value"] || row["Value"] || "").trim();
    if (key && value) pairs.push({ key, value });
  });
  return pairs;
}

function showUploadSuccess(total, overridden) {
  const box = document.getElementById("upload-result");
  box.classList.remove("hidden");
  let html = `<div class="upload-success">
    <div class="upload-success-title">✓ ${total} pair${total !== 1 ? "s" : ""} imported successfully</div>
    <div class="upload-success-sub">${total - overridden.length} new &nbsp;·&nbsp; ${overridden.length} updated</div>
  </div>`;
  if (overridden.length > 0) {
    const tags = [...new Set(overridden)].map(k => `<span class="override-tag">${escHtml(k)}</span>`).join("");
    html += `<div class="override-box">
      <div class="override-title">${overridden.length} key${overridden.length !== 1 ? "s" : ""} overridden</div>
      <div class="override-tags">${tags}</div>
    </div>`;
  }
  box.innerHTML = html;
}

function showUploadError(msg) {
  const box = document.getElementById("upload-result");
  box.classList.remove("hidden");
  box.innerHTML = `<div class="upload-success" style="background:#fff5f5;border-color:#f09595">
    <div class="upload-success-title" style="color:#a32d2d">⚠ ${escHtml(msg)}</div>
  </div>`;
}

// Manage Panel 
function initManage(entries) {
  const input = document.getElementById("manage-search");

  renderManage(entries);

  input.addEventListener("input", async () => {
    const entries = await getEntries();
    renderManage(entries, input.value);
  });
}

function renderManage(entries, query = "") {
  const list = document.getElementById("manage-list");
  const empty = document.getElementById("manage-empty");

  const q = query.toLowerCase().trim();
  const filtered = q
    ? entries.filter(e => e.key.toLowerCase().includes(q) || e.value.toLowerCase().includes(q))
    : entries;

  list.innerHTML = "";

  if (filtered.length === 0) {
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  filtered.forEach(entry => {
    const div = document.createElement("div");
    div.className = "manage-item";

    div.innerHTML = `
      <div class="manage-row">
        <div class="manage-key">${escHtml(entry.key)}</div>
        <div class="manage-actions">
          <button class="manage-btn save">Save</button>
          <button class="manage-btn delete">Delete</button>
        </div>
      </div>
      <input class="manage-input" value="${escHtml(entry.value)}" />
    `;

    const input = div.querySelector(".manage-input");
    const saveBtn = div.querySelector(".save");
    const deleteBtn = div.querySelector(".delete");

    // Save update
    saveBtn.addEventListener("click", async () => {
      entry.value = input.value.trim();
      await saveEntries(entries);
      input.blur();
    });

    // Delete entry
    deleteBtn.addEventListener("click", async () => {
      const idx = entries.findIndex(e => e.id === entry.id);
      if (idx !== -1) {
        entries.splice(idx, 1);
        await saveEntries(entries);
        renderManage(entries, query);
      }
    });

    list.appendChild(div);
  });
}

//  Utilities 
function escHtml(s) {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function shakeEl(el) {
  el.style.animation = "none";
  el.offsetHeight;
  el.style.animation = "shake 0.3s ease";
}

// Boot
document.addEventListener("DOMContentLoaded", async () => {
  panels.search = document.getElementById("panel-search");
  panels.add    = document.getElementById("panel-add");
  panels.upload = document.getElementById("panel-upload");
  panels.manage = document.getElementById("panel-manage");

  document.querySelectorAll(".tab").forEach(btn => {
    tabs[btn.dataset.mode] = btn;
    btn.addEventListener("click", () => switchMode(btn.dataset.mode));
  });

  const entries = await getEntries();
  initSearch(entries);
  initAdd(entries);
  initUpload(entries);
  initManage(entries);

  // Check if triggered by shortcut
  chrome.storage.session.get({ pendingMode: null }, ({ pendingMode }) => {
    if (pendingMode) {
      chrome.storage.session.remove("pendingMode");
      switchMode(pendingMode);
    } else {
      switchMode("search");
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.altKey) {
      if (e.key === "1") switchMode("search");
      if (e.key === "2") switchMode("add");
      if (e.key === "3") switchMode("upload");
      if (e.key === "4") switchMode("manage"); 
    }
  });
});
