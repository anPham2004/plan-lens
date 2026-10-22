const demo = {
  label: "01-Oct → 08-Oct", source: "Dữ liệu minh hoạ", missing: [{ model: "SSRH24NVS-35080", total: 900 }], appeared: [{ model: "SS17HB-R05140", total: 5400 }, { model: "SS28H-R25080-CH", total: 400 }],
  changes: [
    ["SS11H-10062-CH", "Đổi số lượng", 77100, 95000, 17900, null], ["SS21V-R250023", "Đổi số lượng", 15000, 7200, -7800, null], ["SSR10H-22034", "Đổi số lượng", 12000, 9600, -2400, null],
    ["SS11V-03550", "Pull in", 82000, 82000, null, 3], ["SSR21NV-M08475", "Pull in", 24800, 24800, null, 2], ["SSHB10HS-04265-PA", "Pull in", 40000, 40000, null, 1],
    ["SSR10VS-05495", "Push out", 2300, 2300, null, -4], ["SS11V-R10093", "Push out", 6000, 6000, null, -3], ["SSR21NV-M12345", "Push out", 5000, 5000, null, -2], ["SS21V-R100146", "Push out", 5000, 5000, null, -1],
  ].map(([model, type, oldTotal, newTotal, delta, shift]) => ({ model, type, oldTotal, newTotal, delta, shift })),
  stats: { "Đổi số lượng": 48, "Pull in": 35, "Push out": 37 }
};

let report = demo;
let allVisible = false;
let workbook;

const $ = (selector) => document.querySelector(selector);
const format = (value) => value === null || value === undefined ? "—" : new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(value);
const normalise = (value) => String(value ?? "").trim().replace(/\s+/g, " ").toUpperCase();
const number = (value) => {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return value;
  const text = String(value).trim().replaceAll(",", "");
  if (["", "-", "–", "—"].includes(text)) return 0;
  return Number(text.replace(/^\((.*)\)$/, "-$1")) || 0;
};

function activeDays(record) { return Object.keys(record.days).map(Number).filter((day) => Math.abs(record.days[day]) > 1e-6).sort((a, b) => a - b); }
function aggregateByModel(rows) {
  const records = new Map();
  rows.forEach(({ model, total, days }) => {
    const key = normalise(model);
    if (!key) return;
    if (!records.has(key)) records.set(key, { model: String(model).trim(), total: 0, days: {} });
    const record = records.get(key); record.total += total;
    Object.entries(days).forEach(([day, qty]) => { record.days[day] = (record.days[day] || 0) + qty; });
  });
  return records;
}

function detectPlan(rows, name) {
  const headerIndex = rows.findIndex((row) => {
    const headers = row.map((cell) => normalise(cell));
    const days = row.filter((cell) => Number.isInteger(Number(cell)) && Number(cell) >= 1 && Number(cell) <= 31).length;
    return headers.some((x) => x === "LINE" || x.startsWith("LINE")) && headers.some((x) => x === "MODEL" || x.startsWith("MODEL")) && days >= 5;
  });
  if (headerIndex < 0) throw new Error(`Không nhận diện được các cột Line, Model và ngày ở sheet “${name}”.`);
  const header = rows[headerIndex];
  const lineCol = header.findIndex((cell) => { const x = normalise(cell); return x === "LINE" || x.startsWith("LINE"); });
  const modelCol = header.findIndex((cell) => { const x = normalise(cell); return x === "MODEL" || x.startsWith("MODEL"); });
  const totalCol = header.findIndex((cell) => ["TOTAL Q'TY", "TOTAL QTY", "TOTAL QUANTITY"].includes(String(cell ?? "").trim().toUpperCase().replace(/\s+/g, " ")));
  const dayColumns = header.map((cell, index) => ({ day: Number(cell), index })).filter(({ day }) => Number.isInteger(day) && day >= 1 && day <= 31);
  if (modelCol < 0 || totalCol < 0 || !dayColumns.length) throw new Error(`Sheet “${name}” thiếu cột Model, Total Q'ty hoặc các cột ngày.`);
  const records = [];
  rows.slice(headerIndex + 1).forEach((row) => {
    const model = row[modelCol]; const line = row[lineCol];
    if (!String(model ?? "").trim() || !String(line ?? "").trim()) return;
    const days = {}; dayColumns.forEach(({ day, index }) => { days[day] = number(row[index]); });
    records.push({ model, total: number(row[totalCol]), days });
  });
  return aggregateByModel(records);
}

function compare(previous, current, label) {
  const missing = [...previous.entries()].filter(([key]) => !current.has(key)).map(([, value]) => value);
  const appeared = [...current.entries()].filter(([key]) => !previous.has(key)).map(([, value]) => value);
  const changes = [];
  [...previous.entries()].forEach(([key, oldRecord]) => {
    const newRecord = current.get(key); if (!newRecord) return;
    const delta = newRecord.total - oldRecord.total;
    if (Math.abs(delta) > 1e-6) { changes.push({ model: newRecord.model, type: "Đổi số lượng", oldTotal: oldRecord.total, newTotal: newRecord.total, delta, shift: null }); return; }
    const oldDays = activeDays(oldRecord), newDays = activeDays(newRecord);
    if (!oldDays.length || !newDays.length || oldDays.join() === newDays.join()) return;
    const shift = oldDays[0] - newDays[0];
    if (!shift) return;
    changes.push({ model: newRecord.model, type: shift > 0 ? "Pull in" : "Push out", oldTotal: oldRecord.total, newTotal: newRecord.total, delta: null, shift });
  });
  const stats = { "Đổi số lượng": 0, "Pull in": 0, "Push out": 0 };
  changes.forEach((change) => { stats[change.type] += 1; });
  return { label, source: "Dữ liệu từ file vừa nhập", missing, appeared, changes, stats };
}

function render() {
  const { stats } = report;
  $("#comparison-label").textContent = report.label;
  $("#period-label").textContent = report.source;
  $("#missing-count").textContent = format(report.missing.length);
  $("#new-count").textContent = format(report.appeared.length);
  $("#quantity-count").textContent = format(stats["Đổi số lượng"]);
  $("#pull-count").textContent = format(stats["Pull in"]);
  $("#push-count").textContent = format(stats["Push out"]);
  renderDistribution(); renderInsight(); renderTable();
}

function renderDistribution() {
  const values = [["Đổi số lượng", report.stats["Đổi số lượng"], "#f6d267"], ["Pull in", report.stats["Pull in"], "#b8e4c3"], ["Push out", report.stats["Push out"], "#f2c7c1"]];
  const total = values.reduce((sum, [, value]) => sum + value, 0) || 1;
  $("#distribution").innerHTML = values.map(([name, value, color]) => `<span title="${name}: ${value}" style="width:${value / total * 100}%;background:${color}"></span>`).join("");
  $("#legend").innerHTML = values.map(([name, value, color]) => `<span class="legend-item"><i style="background:${color}"></i>${name} <strong>${format(value)}</strong></span>`).join("");
}

function renderInsight() {
  const quantity = report.changes.filter((item) => item.type === "Đổi số lượng");
  const largest = quantity.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0];
  if (largest) {
    $("#insight-title").textContent = `${format(report.stats["Đổi số lượng"])} model đổi số lượng cần ưu tiên`;
    $("#insight-copy").textContent = `Mức biến động lớn nhất đang thuộc về ${largest.model}. Dùng bộ lọc để rà soát toàn bộ các thay đổi về sản lượng.`;
    $("#largest-change").textContent = `${largest.delta > 0 ? "+" : ""}${format(largest.delta)}`;
  } else { $("#insight-title").textContent = "Chưa có thay đổi số lượng"; $("#insight-copy").textContent = "Các thay đổi hiện tại chỉ liên quan tới pull in hoặc push out."; $("#largest-change").textContent = "—"; }
}

function filteredChanges() {
  const term = $("#search-input").value.trim().toUpperCase(); const type = $("#type-filter").value;
  return report.changes.filter((row) => (!term || row.model.toUpperCase().includes(term)) && (type === "all" || row.type === type));
}

function renderTable() {
  const rows = filteredChanges(); const shown = allVisible ? rows : rows.slice(0, 12);
  $("#changes-body").innerHTML = shown.length ? shown.map((row) => `<tr><td>${escapeHtml(row.model)}</td><td><span class="change-pill ${row.type === "Đổi số lượng" ? "pill-qty" : row.type === "Pull in" ? "pill-pull" : "pill-push"}">${row.type}</span></td><td class="number">${format(row.oldTotal)}</td><td class="number">${format(row.newTotal)}</td><td class="number ${row.delta > 0 ? "positive" : row.delta < 0 ? "negative" : "muted"}">${row.delta === null ? "—" : `${row.delta > 0 ? "+" : ""}${format(row.delta)}`}</td><td class="number ${row.shift > 0 ? "positive" : row.shift < 0 ? "negative" : "muted"}">${row.shift === null ? "—" : `${row.shift > 0 ? "+" : ""}${format(row.shift)}`}</td></tr>`).join("") : `<tr><td colspan="6" class="muted">Không có model phù hợp với bộ lọc.</td></tr>`;
  $("#row-count").textContent = `Hiển thị ${Math.min(shown.length, rows.length)} / ${rows.length} thay đổi`;
  const showAll = $("#show-all-button"); showAll.hidden = rows.length <= 12; showAll.textContent = allVisible ? "Thu gọn" : `Xem tất cả (${rows.length})`;
}

function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, (char) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" })[char]); }
function toast(message) { const el = $("#toast"); el.textContent = message; el.classList.add("show"); clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove("show"), 3000); }

async function openFile(file) {
  if (!window.XLSX) { toast("Thư viện đọc Excel chưa sẵn sàng. Vui lòng thử lại sau vài giây."); return; }
  try {
    const content = await file.arrayBuffer(); workbook = XLSX.read(content, { type: "array", cellFormula: false });
    const options = workbook.SheetNames.map((sheet) => `<option value="${escapeHtml(sheet)}">${escapeHtml(sheet)}</option>`).join("");
    $("#previous-sheet").innerHTML = options; $("#current-sheet").innerHTML = options;
    if (workbook.SheetNames.length > 1) $("#current-sheet").selectedIndex = 1;
    $("#sheet-controls").hidden = false; $("#file-status").textContent = `Đã chọn: ${file.name}. Chọn sheet cũ và sheet mới trước khi phân tích.`;
    toast("Đã đọc file. Hãy chọn hai sheet để tiếp tục.");
  } catch (error) { $("#file-status").textContent = `Không thể đọc file: ${error.message}`; toast("Không thể đọc file Excel này."); }
}

function analyzeWorkbook() {
  const previousName = $("#previous-sheet").value, currentName = $("#current-sheet").value;
  if (!previousName || !currentName || previousName === currentName) { toast("Hãy chọn hai sheet khác nhau."); return; }
  try {
    const previousRows = XLSX.utils.sheet_to_json(workbook.Sheets[previousName], { header: 1, defval: null, raw: true });
    const currentRows = XLSX.utils.sheet_to_json(workbook.Sheets[currentName], { header: 1, defval: null, raw: true });
    report = compare(detectPlan(previousRows, previousName), detectPlan(currentRows, currentName), `${previousName} → ${currentName}`);
    allVisible = false; render(); $("#file-status").textContent = `Đã phân tích ${previousName} và ${currentName}. File gốc vẫn chỉ nằm trên thiết bị của bạn.`; toast("Đã cập nhật dashboard.");
  } catch (error) { toast(error.message); $("#file-status").textContent = error.message; }
}

function exportCsv() {
  const rows = [["Model", "Loại thay đổi", "Tổng SL cũ", "Tổng SL mới", "Tăng/Giảm SL", "Số ngày Pull/Push"], ...report.changes.map((row) => [row.model, row.type, row.oldTotal, row.newTotal, row.delta ?? "", row.shift ?? ""])];
  const csv = "\ufeff" + rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); const link = document.createElement("a"); link.href = url; link.download = "bao-cao-thay-doi-ke-hoach.csv"; link.click(); URL.revokeObjectURL(url); toast("Đã tải báo cáo CSV.");
}

$("#file-input").addEventListener("change", (event) => event.target.files[0] && openFile(event.target.files[0]));
const dropzone = $("#dropzone"); ["dragenter", "dragover"].forEach((event) => dropzone.addEventListener(event, (e) => { e.preventDefault(); dropzone.classList.add("dragging"); })); ["dragleave", "drop"].forEach((event) => dropzone.addEventListener(event, (e) => { e.preventDefault(); dropzone.classList.remove("dragging"); })); dropzone.addEventListener("drop", (event) => event.dataTransfer.files[0] && openFile(event.dataTransfer.files[0]));
$("#analyze-button").addEventListener("click", analyzeWorkbook); $("#search-input").addEventListener("input", () => { allVisible = false; renderTable(); }); $("#type-filter").addEventListener("change", () => { allVisible = false; renderTable(); }); $("#show-all-button").addEventListener("click", () => { allVisible = !allVisible; renderTable(); }); $("#export-button").addEventListener("click", exportCsv);
render();
