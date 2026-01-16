const api = "https://api-class-o1lo.onrender.com/api/dungvh";
(function authGuard() {
  const accessToken = localStorage.getItem("accessToken");

  if (!accessToken || accessToken === "undefined" || accessToken === "null") {
    localStorage.removeItem("accessToken");
    window.location.replace("/auth/login.html");
    return;
  }
  console.log("Access granted!");
})();

function getToken() {
  return localStorage.getItem("accessToken");
}

function authHeaders() {
  return { headers: { Authorization: `Bearer ${getToken()}` } };
}

let currentFilter = "all";

let currentKeyword = "";
let currentTasks = [];

const searchInput = document.getElementById("search-input");

if (searchInput) {
  searchInput.addEventListener("input", () => {
    currentKeyword = searchInput.value.trim().toLowerCase();
    renderTasks(sortByPriority(applySearch(currentTasks)));
  });
}

function applySearch(tasks) {
  if (!currentKeyword) return tasks;
  return tasks.filter((t) =>
    (t.task || "").toLowerCase().includes(currentKeyword)
  );
}

function filterToStatus(status) {
  if (status === "active") return "ACTIVE";
  if (status === "completed") return "COMPLETED";
  return "";
}

const addForm = document.getElementById("task-form");
const taskListEl = document.getElementById("task-list");
const emptyStateEl = document.getElementById("empty-state");

const statTotalEl = document.getElementById("stat-total");
const statActiveEl = document.getElementById("stat-active");
const statDoneEl = document.getElementById("stat-done");
const progressTextEl = document.getElementById("progress-text");
const progressBarEl = document.getElementById("progress-bar");
const remainingEl = document.getElementById("remaining");

const priorityOrder = { high: 0, medium: 1, low: 2 };

function sortByPriority(tasks) {
  return [...tasks].sort((a, b) => {
    const pa = priorityOrder[(a.priority || "").toLowerCase()] ?? 99;
    const pb = priorityOrder[(b.priority || "").toLowerCase()] ?? 99;
    return pa - pb;
  });
}

// * AddTask
async function addTask(task, priority) {
  try {
    await axios.post(
      `${api}/task`,
      { task, priority, status: "ACTIVE" },
      authHeaders()
    );

    alert("Add task success!");
    addForm.reset();

    await loadTasks();
  } catch (error) {
    alert(error?.response?.data?.message || error.message);
  }
}

if (addForm) {
  addForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(addForm);
    const data = Object.fromEntries(fd.entries());
    addTask(data.task, data.priority);
  });
}

// * Update Overview
function updateOverview(taskAll) {
  const total = taskAll.length;
  const done = taskAll.filter((t) => t.status === "COMPLETED").length;
  const active = total - done;

  const percent = total === 0 ? 0 : Math.round((done / total) * 100);

  if (statTotalEl) statTotalEl.textContent = total;
  if (statActiveEl) statActiveEl.textContent = active;
  if (statDoneEl) statDoneEl.textContent = done;

  if (progressTextEl) progressTextEl.textContent = `${percent}%`;
  if (progressBarEl) progressBarEl.style.width = `${percent}%`;

  if (remainingEl) remainingEl.textContent = `${active} items left`;
}

async function loadOverview() {
  try {
    const res = await axios.get(`${api}/task`, authHeaders());
    const tasksAll = res?.data?.data || [];
    updateOverview(tasksAll);
  } catch (err) {
    console.warn("Load overview failed:", err?.response?.data || err.message);
  }
}

// * LoadTask
async function loadTasks() {
  try {
    const status = filterToStatus(currentFilter);
    const url = status ? `${api}/task?status=${status}` : `${api}/task`;
    const res = await axios.get(url, authHeaders());

    const tasks = res?.data?.data || [];
    currentTasks = tasks;

    renderTasks(sortByPriority(applySearch(tasks)));

    loadOverview();
  } catch (err) {
    alert(err?.response?.data?.message || err.message);
  }
}

// * RenderTask
function renderTasks(tasks) {
  const list = document.getElementById("task-list");
  const empty = document.getElementById("empty-state");

  if (!tasks.length) {
    list.innerHTML = "";
    empty?.classList.remove("hidden");
    return;
  }
  empty?.classList.add("hidden");

  list.innerHTML = tasks
    .map((t) => {
      const isCompleted = t.status === "COMPLETED";
      const checked = isCompleted ? "checked" : "";
      const doneClass = isCompleted ? "task-done" : "";

      const color =
        t.priority === "high"
          ? "#6366f1"
          : t.priority === "low"
          ? "#34d399"
          : "#fbbf24";

      return `
        <li class="task-item ${doneClass}" data-id="${t._id}">
          <div class="task-left">
            <input
              type="checkbox"
              class="task-check"
              ${checked}
            />
            <span class="priority-dot" style="background:${color}"></span>
            <span class="task-text"  ondblclick="editTask('${t._id}', '${t.task}')">${t.task}</span>
          </div>

          <div class="task-right">  
            <span class="task-priority">${t.priority}</span>
            <button type="button" class="delete-btn" onclick="deleteTask('${t._id}')">Delete</button>
          </div>
        </li>
      `;
    })
    .join("");
}

document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    currentFilter = btn.dataset.filter;

    document
      .querySelectorAll(".tab")
      .forEach((b) => b.classList.remove("tab-active"));
    btn.classList.add("tab-active");
    loadTasks();
  });
});

document.addEventListener("change", async (e) => {
  if (!e.target.classList.contains("task-check")) return;

  const li = e.target.closest(".task-item");
  const taskId = li.dataset.id;
  const status = e.target.checked ? "COMPLETED" : "ACTIVE";

  try {
    await axios.patch(`${api}/task/${taskId}`, { status }, authHeaders());

    loadTasks();
  } catch (err) {
    alert(err?.response?.data?.message || err.message);
  }
});

async function deleteTask(taskId) {
  const ok = window.confirm("Do you want to delete this task?");
  if (!ok) return;

  try {
    await axios.delete(`${api}/task/${taskId}`, authHeaders());

    await loadTasks();
  } catch (error) {
    alert(error?.response?.data?.message || error.message);
  }
}

async function editTask(taskId, oldValue) {
  const newValue = prompt("Edit task name:", oldValue);
  if (!newValue || newValue.trim() === oldValue) return;

  try {
    await axios.patch(
      `${api}/task/${taskId}`,
      { task: newValue.trim() },
      authHeaders()
    );

    await loadTasks();
  } catch (error) {
    alert(error?.response?.data?.message || error.message);
  }
}

loadTasks();

window.deleteTask = deleteTask;
window.editTask = editTask;
