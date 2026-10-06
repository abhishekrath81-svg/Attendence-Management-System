const state = {
  students: [],
  classes: [],
  attendance: {},
  date: "",
  query: "",
  calendarMonth: "",
};

const statusLabels = {
  present: "Present",
  absent: "Absent",
  late: "Late",
  excused: "Excused",
};

const attendedStatuses = new Set(["present", "late"]);

const dateInput = document.querySelector("#attendanceDate");
const studentForm = document.querySelector("#studentForm");
const studentList = document.querySelector("#studentList");
const performanceList = document.querySelector("#performanceList");
const calendarGrid = document.querySelector("#calendarGrid");
const calendarTitle = document.querySelector("#calendarTitle");
const toast = document.querySelector("#toast");

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }
  return data;
}

async function loadData() {
  const data = await api("/api/data");
  applyData(data);
}

function applyData(data) {
  state.students = data.students || [];
  state.classes = data.classes || [];
  state.attendance = data.attendance || {};
  render();
}

function setToday() {
  const today = new Date();
  state.date = toDateKey(today);
  state.calendarMonth = state.date.slice(0, 7);
  dateInput.value = state.date;
}

function selectedRecords() {
  return state.attendance[state.date] || {};
}

function getVisibleStudents() {
  const query = state.query.toLowerCase();
  return state.students.filter((student) => {
    return `${student.roll} ${student.name} ${student.className}`.toLowerCase().includes(query);
  });
}

function getStudentStats(studentId) {
  const totalClasses = state.classes.length;
  const attendedDays = state.classes.filter((classDay) => {
    const status = state.attendance[classDay.date]?.[studentId]?.status;
    return attendedStatuses.has(status);
  }).length;
  const percentage = totalClasses ? Math.round((attendedDays / totalClasses) * 100) : 0;
  return { attendedDays, totalClasses, percentage };
}

function getDailyStats() {
  const records = selectedRecords();
  const stats = { present: 0, absent: 0, late: 0, excused: 0, unmarked: 0 };
  state.students.forEach((student) => {
    const status = records[student.id]?.status || "unmarked";
    stats[status] += 1;
  });
  const attended = stats.present + stats.late;
  const percentage = state.students.length ? Math.round((attended / state.students.length) * 100) : 0;
  return { ...stats, attended, percentage };
}

function getAveragePercentage() {
  if (!state.students.length) return 0;
  const total = state.students.reduce((sum, student) => sum + getStudentStats(student.id).percentage, 0);
  return Math.round(total / state.students.length);
}

function render() {
  renderSummary();
  renderStudentRows();
  renderPerformance();
  renderCalendar();
}

function renderSummary() {
  const daily = getDailyStats();
  document.querySelector("#totalStudents").textContent = state.students.length;
  document.querySelector("#totalClasses").textContent = state.classes.length;
  document.querySelector("#selectedRate").textContent = `${daily.percentage}%`;
  document.querySelector("#averageRate").textContent = `${getAveragePercentage()}%`;
  document.querySelector("#registerSubtext").textContent = `${formatDate(state.date)} - ${daily.attended} attended, ${daily.absent} absent`;
}

function renderStudentRows() {
  const records = selectedRecords();
  const students = getVisibleStudents();
  studentList.innerHTML = "";
  document.querySelector("#emptyState").hidden = students.length > 0;

  students.forEach((student) => {
    const stats = getStudentStats(student.id);
    const selectedStatus = records[student.id]?.status || "unmarked";
    const statusButtons = Object.entries(statusLabels)
      .map(([status, label]) => {
        const active = selectedStatus === status ? " active" : "";
        return `<button class="status-button${active}" type="button" data-id="${student.id}" data-status="${status}">${label}</button>`;
      })
      .join("");

    const row = document.createElement("article");
    row.className = "student-row";
    row.innerHTML = `
      <div class="student-main">
        <p class="student-name">${escapeHtml(student.roll)}. ${escapeHtml(student.name)}</p>
        <div class="student-meta">${escapeHtml(student.className)}${student.guardian ? ` - ${escapeHtml(student.guardian)}` : ""}</div>
      </div>
      <div class="status-group" role="group" aria-label="Attendance for ${escapeHtml(student.name)}">
        ${statusButtons}
      </div>
      <div class="student-result">
        <strong>${stats.attendedDays}/${stats.totalClasses} days</strong>
        ${stats.percentage}% attendance
      </div>
      <button class="danger-button" type="button" data-delete="${student.id}">Delete</button>
    `;
    studentList.appendChild(row);
  });
}

function renderPerformance() {
  performanceList.innerHTML = "";
  state.students.forEach((student) => {
    const stats = getStudentStats(student.id);
    const row = document.createElement("article");
    row.className = "performance-row";
    row.innerHTML = `
      <div>
        <strong>${escapeHtml(student.name)}</strong>
        <span>${stats.attendedDays} of ${stats.totalClasses} class days attended</span>
      </div>
      <div class="percentage-pill">${stats.percentage}%</div>
    `;
    performanceList.appendChild(row);
  });
}

function renderCalendar() {
  const [year, month] = state.calendarMonth.split("-").map(Number);
  const firstDay = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const classMap = new Map(state.classes.map((classDay) => [classDay.date, classDay]));

  calendarTitle.textContent = new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric" }).format(firstDay);
  calendarGrid.innerHTML = "";

  for (let index = 0; index < firstDay.getDay(); index += 1) {
    const empty = document.createElement("div");
    empty.className = "calendar-day empty";
    calendarGrid.appendChild(empty);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateKey = `${state.calendarMonth}-${String(day).padStart(2, "0")}`;
    const classDay = classMap.get(dateKey);
    const records = state.attendance[dateKey] || {};
    const attended = state.students.filter((student) => attendedStatuses.has(records[student.id]?.status)).length;
    const button = document.createElement("button");
    button.className = `calendar-day${classDay ? " has-class" : ""}${dateKey === state.date ? " selected" : ""}`;
    button.type = "button";
    button.dataset.date = dateKey;
    button.innerHTML = `
      <strong>${day}</strong>
      <span>${classDay ? `${attended}/${state.students.length} attended` : "No class"}</span>
    `;
    calendarGrid.appendChild(button);
  }
}

function setStatus(studentId, status) {
  const records = { ...selectedRecords(), [studentId]: { status } };
  state.attendance[state.date] = records;
  render();
}

async function saveAttendance() {
  const data = await api("/api/attendance", {
    method: "POST",
    body: JSON.stringify({ date: state.date, records: selectedRecords() }),
  });
  applyData(data);
  showToast("Attendance saved in data/attendance.json.");
}

async function addClassDay() {
  const data = await api("/api/classes", {
    method: "POST",
    body: JSON.stringify({ date: state.date, title: "Regular Class" }),
  });
  applyData(data);
  showToast("Class day added in data/classes.json.");
}

async function addStudent(event) {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(studentForm).entries());
  const data = await api("/api/students", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  applyData(data);
  studentForm.reset();
  showToast("Student added in data/students.json.");
}

async function deleteStudent(studentId) {
  const data = await api(`/api/students/${studentId}`, { method: "DELETE" });
  applyData(data);
  showToast("Student deleted.");
}

function toDateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function shiftMonth(direction) {
  const [year, month] = state.calendarMonth.split("-").map(Number);
  const next = new Date(year, month - 1 + direction, 1);
  state.calendarMonth = toDateKey(next).slice(0, 7);
  renderCalendar();
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

let toastTimer;
function showToast(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("show");
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2500);
}

studentList.addEventListener("click", (event) => {
  const statusButton = event.target.closest("[data-status]");
  const deleteButton = event.target.closest("[data-delete]");
  if (statusButton) {
    setStatus(statusButton.dataset.id, statusButton.dataset.status);
  }
  if (deleteButton) {
    deleteStudent(deleteButton.dataset.delete).catch((error) => showToast(error.message));
  }
});

calendarGrid.addEventListener("click", (event) => {
  const day = event.target.closest("[data-date]");
  if (!day) return;
  state.date = day.dataset.date;
  state.calendarMonth = state.date.slice(0, 7);
  dateInput.value = state.date;
  render();
});

dateInput.addEventListener("change", () => {
  state.date = dateInput.value;
  state.calendarMonth = state.date.slice(0, 7);
  render();
});

document.querySelector("#searchInput").addEventListener("input", (event) => {
  state.query = event.target.value;
  renderStudentRows();
});

document.querySelector("#markAllPresent").addEventListener("click", () => {
  const records = { ...selectedRecords() };
  getVisibleStudents().forEach((student) => {
    records[student.id] = { status: "present" };
  });
  state.attendance[state.date] = records;
  render();
  showToast("Visible students marked present.");
});

document.querySelector("#saveAttendance").addEventListener("click", () => {
  saveAttendance().catch((error) => showToast(error.message));
});

document.querySelector("#addClassDay").addEventListener("click", () => {
  addClassDay().catch((error) => showToast(error.message));
});

document.querySelector("#prevMonth").addEventListener("click", () => shiftMonth(-1));
document.querySelector("#nextMonth").addEventListener("click", () => shiftMonth(1));
studentForm.addEventListener("submit", (event) => {
  addStudent(event).catch((error) => showToast(error.message));
});

setToday();
loadData().catch((error) => showToast(error.message));
