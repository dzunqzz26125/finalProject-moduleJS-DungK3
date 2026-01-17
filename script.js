const api = "https://api-class-o1lo.onrender.com/api/dungvh";
let currentFilter = "all";
let currentCategory = "all";
let currentTimeFilter = "all";
let currentKeyword = "";
let currentTasks = [];

(function authGuard() {
  const accessToken = localStorage.getItem("accessToken");
  if (!accessToken || accessToken === "undefined" || accessToken === "null") {
    localStorage.removeItem("accessToken");
    window.location.replace("/auth/login.html");
    return;
  }
})();

// * Auth functions
function getToken() {
  return localStorage.getItem("accessToken");
}

function authHeaders() {
  return { headers: { Authorization: `Bearer ${getToken()}` } };
}

function decodeJwtPayload(token) {
  try {
    const payload = token.split(".")[1];
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function getCurrentUserId() {
  const payload = decodeJwtPayload(getToken());
  return payload?.id || payload?.userId || payload?._id || payload?.sub || null;
}

function filterTasksByUser(tasks) {
  const uid = getCurrentUserId();
  if (!uid) return tasks;
  return tasks.filter((t) => String(t.userId) === String(uid));
}

function showCurrentUser() {
  const label = document.getElementById("user-label");
  if (!label) return;
  const token = getToken();
  const payload = decodeJwtPayload(token);
  const display = payload?.email || "User";
  label.textContent = display;
}

showCurrentUser();

// * Logout
const logout = document.getElementById("btn-logout");
if (logout) {
  logout.addEventListener("click", () => {
    const ok = confirm("Bạn muốn đăng xuất?");
    if (!ok) return;
    localStorage.removeItem("accessToken");
    localStorage.removeItem("user");
    localStorage.removeItem("cached_tasks");
    window.location.replace("/auth/login.html");
  });
}

// * DOM elements
const openBtn = document.getElementById("btn-open-add");
const closeBtn = document.getElementById("btn-close-add");
const modal = document.getElementById("add-task-modal");
const cancelBtn = document.getElementById("btn-cancel");
const overlay = modal.querySelector(".modal-overlay");
const addForm = document.getElementById("add-task-form");
const searchInput = document.getElementById("search-input");
const statTotalEl = document.getElementById("stat-total");
const statActiveEl = document.getElementById("stat-active");
const statDoneEl = document.getElementById("stat-done");
const progressTextEl = document.getElementById("progress-text");
const progressBarEl = document.getElementById("progress-bar");
const remainingEl = document.getElementById("remaining");

// * Modal controls
openBtn.addEventListener("click", () => modal.classList.remove("hidden"));
closeBtn.addEventListener("click", () => modal.classList.add("hidden"));
cancelBtn.addEventListener("click", () => modal.classList.add("hidden"));
overlay.addEventListener("click", () => modal.classList.add("hidden"));

// * Form Validation
class FormValidator {
  validateTask(value) {
    if (!value || value.trim().length < 3)
      return "Task title must be at least 3 characters";
    if (value.length > 100)
      return "Task title must be less than 100 characters";
    return null;
  }

  validateDescription(value) {
    if (value && value.length > 500)
      return "Description must be less than 500 characters";
    return null;
  }

  validateDeadline(value) {
    if (value && new Date(value) < new Date())
      return "Deadline cannot be in the past";
    return null;
  }

  showError(fieldName, message) {
    const errorEl = document.getElementById(`${fieldName}-error`);
    const fieldEl = document
      .querySelector(`[name="${fieldName}"]`)
      .closest(".field");
    if (errorEl && fieldEl) {
      errorEl.textContent = message;
      errorEl.classList.add("show");
      fieldEl.classList.add("error");
    }
  }

  clearError(fieldName) {
    const errorEl = document.getElementById(`${fieldName}-error`);
    const fieldEl = document
      .querySelector(`[name="${fieldName}"]`)
      .closest(".field");
    if (errorEl && fieldEl) {
      errorEl.textContent = "";
      errorEl.classList.remove("show");
      fieldEl.classList.remove("error");
    }
  }

  validateForm(formData) {
    ["task", "description", "deadline"].forEach((field) =>
      this.clearError(field)
    );
    let isValid = true;

    const taskError = this.validateTask(formData.task);
    if (taskError) {
      this.showError("task", taskError);
      isValid = false;
    }

    const descError = this.validateDescription(formData.description);
    if (descError) {
      this.showError("description", descError);
      isValid = false;
    }

    const deadlineError = this.validateDeadline(formData.deadlineAt);
    if (deadlineError) {
      this.showError("deadline", deadlineError);
      isValid = false;
    }

    return isValid;
  }
}

const validator = new FormValidator();

// * Custom Select
class CustomSelect {
  constructor(element) {
    this.element = element;
    this.trigger = element.querySelector(".select-trigger");
    this.options = element.querySelector(".select-options");
    this.hiddenInput = element.querySelector('input[type="hidden"]');
    this.textElement = element.querySelector(".select-text");
    this.init();
  }

  init() {
    this.trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      this.toggle();
    });

    this.options.addEventListener("click", (e) => {
      if (e.target.classList.contains("select-option")) {
        this.selectOption(e.target);
      }
    });

    document.addEventListener("click", () => this.close());
  }

  toggle() {
    this.element.classList.contains("open") ? this.close() : this.open();
  }

  open() {
    document.querySelectorAll(".custom-select.open").forEach((select) => {
      if (select !== this.element) select.classList.remove("open");
    });
    this.element.classList.add("open");
  }

  close() {
    this.element.classList.remove("open");
  }

  selectOption(option) {
    const value = option.dataset.value;
    const text = option.textContent;

    this.options
      .querySelectorAll(".select-option")
      .forEach((opt) => opt.classList.remove("selected"));
    option.classList.add("selected");

    this.textElement.textContent = text;
    if (this.hiddenInput) this.hiddenInput.value = value;

    this.element.dispatchEvent(
      new CustomEvent("change", { detail: { value, text } })
    );
    this.close();
  }
}

// * Utility functions
function filterToStatus(status) {
  if (status === "todo") return "ACTIVE";
  if (status === "doing") return "DOING";
  if (status === "done") return "COMPLETED";
  return "";
}

function statusToFilter(status) {
  if (status === "ACTIVE") return "todo";
  if (status === "DOING") return "doing";
  if (status === "COMPLETED") return "done";
  return status?.toLowerCase() || "todo";
}

const priorityOrder = { high: 0, medium: 1, low: 2 };
function sortByPriority(tasks) {
  return [...tasks].sort((a, b) => {
    const pa = priorityOrder[(a.priority || "").toLowerCase()] ?? 99;
    const pb = priorityOrder[(b.priority || "").toLowerCase()] ?? 99;
    return pa - pb;
  });
}

function applySearch(tasks) {
  if (!currentKeyword) return tasks;
  return tasks.filter((t) =>
    (t.task || "").toLowerCase().includes(currentKeyword)
  );
}

function formatDeadline(deadline) {
  if (!deadline) return "";
  const d = new Date(deadline);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("vi-VN");
}

function isOverdue(task) {
  if (!task?.deadline || task.status === "COMPLETED") return false;
  const d = new Date(task.deadline);
  return !Number.isNaN(d.getTime()) && d.getTime() < Date.now();
}

function applyTimeFilter(tasks) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const next7Days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const next30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

  switch (currentTimeFilter) {
    case "overdue":
      return tasks.filter(
        (t) =>
          t.deadline && new Date(t.deadline) < now && t.status !== "COMPLETED"
      );
    case "today":
      return tasks.filter(
        (t) =>
          t.deadline &&
          new Date(t.deadline) >= today &&
          new Date(t.deadline) < tomorrow
      );
    case "next7d":
      return tasks.filter(
        (t) =>
          t.deadline &&
          new Date(t.deadline) >= now &&
          new Date(t.deadline) <= next7Days
      );
    case "next30d":
      return tasks.filter(
        (t) =>
          t.deadline &&
          new Date(t.deadline) >= now &&
          new Date(t.deadline) <= next30Days
      );
    case "nodeadline":
      return tasks.filter((t) => !t.deadline);
    default:
      return tasks;
  }
}

// * Search
if (searchInput) {
  searchInput.addEventListener("input", () => {
    currentKeyword = searchInput.value.trim().toLowerCase();
    renderTasks(sortByPriority(applySearch(currentTasks)));
  });
}

// * Add Task
async function addTask(
  task,
  priority,
  description,
  deadlineAt,
  category,
  status
) {
  try {
    const uid = getCurrentUserId();
    await axios.post(
      `${api}/task`,
      {
        task: task.trim(),
        priority: priority || "medium",
        status: filterToStatus(status || "todo"),
        userId: uid,
        description: description?.trim() || "",
        deadline: deadlineAt ? new Date(deadlineAt).toISOString() : null,
        category: category || "work",
      },
      authHeaders()
    );

    modal.classList.add("hidden");
    alert("Task added successfully!");
    addForm.reset();
    resetFormSelects();
    await loadTasks();
  } catch (error) {
    alert(error?.response?.data?.message || error.message);
  }
}

function resetFormSelects() {
  const selects = [
    { id: "#category-select", text: "Work", value: "work" },
    { id: "#priority-select", text: "Medium", value: "medium" },
    { id: "#status-select", text: "Todo", value: "todo" },
  ];

  selects.forEach(({ id, text, value }) => {
    const select = document.querySelector(id);
    if (select) {
      select.querySelector(".select-text").textContent = text;
      select.querySelector('input[type="hidden"]').value = value;
      select
        .querySelectorAll(".select-option")
        .forEach((opt) => opt.classList.remove("selected"));
      select.querySelector(`[data-value="${value}"]`).classList.add("selected");
    }
  });
}

// * Load Tasks
async function loadTasks() {
  try {
    const res = await axios.get(`${api}/task`, authHeaders());
    let tasks = res?.data?.data || [];
    tasks = filterTasksByUser(tasks);

    localStorage.setItem("cached_tasks", JSON.stringify(tasks));

    let filteredTasks = tasks;
    if (currentFilter !== "all") {
      filteredTasks = filteredTasks.filter(
        (t) => statusToFilter(t.status) === currentFilter
      );
    }
    if (currentCategory !== "all") {
      filteredTasks = filteredTasks.filter(
        (t) => t.category === currentCategory
      );
    }
    if (currentTimeFilter !== "all") {
      filteredTasks = applyTimeFilter(filteredTasks);
    }

    currentTasks = filteredTasks;
    renderTasks(sortByPriority(applySearch(filteredTasks)));
    updateOverview(tasks);
  } catch (err) {
    const cached = localStorage.getItem("cached_tasks");
    if (cached) {
      const tasks = JSON.parse(cached);
      currentTasks = tasks;
      renderTasks(sortByPriority(applySearch(tasks)));
      updateOverview(tasks);
    } else {
      alert(err?.response?.data?.message || err.message);
    }
  }
}

// * Render Tasks
function renderTasks(tasks) {
  const list = document.getElementById("task-list");
  const empty = document.getElementById("empty-state");

  if (!tasks.length) {
    list.innerHTML = "";
    empty?.classList.remove("hidden");
    return;
  }
  empty?.classList.add("hidden");

  const priorityColors = { high: "#6366f1", medium: "#fbbf24", low: "#34d399" };
  const categoryColors = {
    work: "#3b82f6",
    personal: "#10b981",
    shopping: "#f59e0b",
    health: "#ef4444",
    education: "#8b5cf6",
    other: "#6b7280",
  };

  list.innerHTML = tasks
    .map((t) => {
      const status = statusToFilter(t.status);
      const isCompleted = status === "done";
      const isDoing = status === "doing";
      const checked = isCompleted ? "checked" : "";
      const doneClass = isCompleted ? "task-done" : isDoing ? "task-doing" : "";

      return `
      <li class="task-item ${doneClass}" data-id="${t._id}">
        <div class="task-left">
          <input type="checkbox" class="task-check" ${checked} />
          ${status === 'todo' ? `<button type="button" class="doing-btn" onclick="setDoing('${t._id}')">Doing</button>` : ''}
          <span class="priority-dot" style="background:${
            priorityColors[t.priority] || priorityColors.medium
          }"></span>
          <div class="task-content">
            <span class="task-text" ondblclick="editTask('${t._id}', '${
        t.task
      }')">${t.task}</span>
            ${
              t.description
                ? `<div class="task-desc muted small">${t.description}</div>`
                : ""
            }
            <div class="task-meta">
              <span class="task-category" style="background-color: ${
                categoryColors[t.category] || categoryColors.other
              }20; color: ${
        categoryColors[t.category] || categoryColors.other
      }; border: 1px solid ${
        categoryColors[t.category] || categoryColors.other
      }40;">
                ${t.category || "other"}
              </span>
              <span class="task-status status-${status}">${status}</span>
            </div>
            ${
              t.deadline
                ? `<div class="task-deadline muted small">
              <span>⏰ ${formatDeadline(t.deadline)}</span>
              ${
                isOverdue(t)
                  ? `<span class="overdue-badge">Overdue!</span>`
                  : ""
              }
            </div>`
                : ""
            }
          </div>
        </div>
        <div class="task-right">  
          <span class="task-priority">${t.priority}</span>
          <button type="button" class="delete-btn" onclick="deleteTask('${
            t._id
          }')">Delete</button>
        </div>
      </li>
    `;
    })
    .join("");
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

// * Event Listeners
if (addForm) {
  addForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(addForm);
    const data = Object.fromEntries(fd.entries());

    if (!validator.validateForm(data)) return;

    addTask(
      data.task,
      data.priority,
      data.description,
      data.deadlineAt,
      data.category,
      data.status
    );
  });
}

// * Tabs
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

// * Status change - Checkbox để completed hoặc về todo
document.addEventListener("change", async (e) => {
  if (!e.target.classList.contains("task-check")) return;

  const li = e.target.closest(".task-item");
  const taskId = li.dataset.id;
  const isChecked = e.target.checked;
    
  try {
    const newStatus = isChecked ? "COMPLETED" : "ACTIVE";
    await axios.patch(`${api}/task/${taskId}`, { status: newStatus }, authHeaders());
    loadTasks();
  } catch (err) {
    alert(err?.response?.data?.message || err.message);
    e.target.checked = !isChecked;
  }
});

// * Set Doing function
async function setDoing(taskId) {
  try {
    await axios.patch(`${api}/task/${taskId}`, { status: "DOING" }, authHeaders());
    loadTasks();
  } catch (err) {
    alert(err?.response?.data?.message || err.message);
  }
}

// * CRUD Operations
async function deleteTask(taskId) {
  if (!confirm("Do you want to delete this task?")) return;
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

async function clearCompletedTask() {
  if (!confirm("Do you want to delete completed tasks?")) return;
  try {
    const res = await axios.get(`${api}/task?status=COMPLETED`, authHeaders());
    const tasks = res?.data?.data || [];
    const myCompleted = filterTasksByUser(tasks);

    if (!myCompleted.length) {
      alert("No completed tasks to clear");
      return;
    }

    await Promise.all(
      myCompleted.map((t) =>
        axios.delete(`${api}/task/${t._id}`, authHeaders())
      )
    );
    await loadTasks();
  } catch (error) {
    alert(error?.response?.data?.message || error.message);
  }
}

// * Initialize
document.addEventListener("DOMContentLoaded", () => {
  document
    .querySelectorAll(".custom-select")
    .forEach((select) => new CustomSelect(select));

  const categoryFilter = document.getElementById("category-filter");
  if (categoryFilter) {
    categoryFilter.addEventListener("change", (e) => {
      currentCategory = e.detail.value;
      loadTasks();
    });
  }

  const timeFilter = document.getElementById("time-filter");
  if (timeFilter) {
    timeFilter.addEventListener("change", (e) => {
      currentTimeFilter = e.detail.value;
      loadTasks();
    });
  }

  // * Real-time validation
  const inputs = [
    { name: "task", event: "blur" },
    { name: "description", event: "blur" },
    { name: "deadlineAt", event: "change" },
  ];

  inputs.forEach(({ name, event }) => {
    const input = document.querySelector(`[name="${name}"]`);
    if (input) {
      input.addEventListener(event, () => {
        const error = validator[
          `validate${
            name === "deadlineAt"
              ? "Deadline"
              : name.charAt(0).toUpperCase() + name.slice(1)
          }`
        ](input.value);
        error
          ? validator.showError(
              name === "deadlineAt" ? "deadline" : name,
              error
            )
          : validator.clearError(name === "deadlineAt" ? "deadline" : name);
      });
    }
  });
});

loadTasks();
window.deleteTask = deleteTask;
window.editTask = editTask;
window.setDoing = setDoing;
