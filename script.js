// * Constants
const CONSTANTS = {
  API_URL: "https://api-class-o1lo.onrender.com/api/dungvh",
  STORAGE_KEYS: {
    ACCESS_TOKEN: "accessToken",
    USER: "user",
    CACHED_TASKS: "cached_tasks",
  },
  PRIORITY_COLORS: {
    high: "#6366f1",
    medium: "#fbbf24",
    low: "#34d399",
  },
  CATEGORY_COLORS: {
    work: "#3b82f6",
    personal: "#10b981",
    shopping: "#f59e0b",
    health: "#ef4444",
    education: "#8b5cf6",
    other: "#6b7280",
  },
  MESSAGES: {
    TASK_ADDED: "Task added successfully!",
    TASK_UPDATED: "Task updated successfully!",
    TASK_DELETED: "Task deleted successfully!",
    CONFIRM_DELETE: "Do you want to delete this task?",
    CONFIRM_CLEAR: "Do you want to delete completed tasks?",
    CONFIRM_LOGOUT: "Do you want to log out?",
    NO_COMPLETED: "No completed tasks to clear",
    ERROR_GENERIC: "An error occurred. Please try again.",
  },
};

const api = CONSTANTS.API_URL;
let currentFilter = "all";
let currentCategory = "all";
let currentTimeFilter = "all";
let currentKeyword = "";
let currentTasks = [];

// * Pagination variables
let currentPage = 1;
let tasksPerPage = 5;
let totalTasks = 0;

// * Utility functions
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function handleError(
  error,
  fallbackMessage = CONSTANTS.MESSAGES.ERROR_GENERIC,
) {
  const message =
    error?.response?.data?.message || error.message || fallbackMessage;
  console.error("Error:", error);
  alert(message);
}

(function authGuard() {
  const accessToken = localStorage.getItem(CONSTANTS.STORAGE_KEYS.ACCESS_TOKEN);
  if (!accessToken || accessToken === "undefined" || accessToken === "null") {
    localStorage.removeItem(CONSTANTS.STORAGE_KEYS.ACCESS_TOKEN);
    window.location.replace("/auth/login.html");
    return;
  }
})();

// * Auth functions
function getToken() {
  return localStorage.getItem(CONSTANTS.STORAGE_KEYS.ACCESS_TOKEN);
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
        .join(""),
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
    const ok = confirm(CONSTANTS.MESSAGES.CONFIRM_LOGOUT);
    if (!ok) return;
    Object.values(CONSTANTS.STORAGE_KEYS).forEach((key) => {
      localStorage.removeItem(key);
    });
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

// * Pagination elements
const paginationEl = document.getElementById("pagination");
const pageNumbersEl = document.getElementById("page-numbers");
const prevBtn = document.getElementById("prev-btn");
const nextBtn = document.getElementById("next-btn");

// * Modal controls with keyboard support
openBtn.addEventListener("click", () => {
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");

  const firstInput = modal.querySelector('input[name="task"]');
  if (firstInput) firstInput.focus();
});

function closeModal() {
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
  resetForm();
}

closeBtn.addEventListener("click", closeModal);
cancelBtn.addEventListener("click", closeModal);
overlay.addEventListener("click", closeModal);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !modal.classList.contains("hidden")) {
    closeModal();
  }
});

// * Form Validation
class FormValidator {
  validateTask(value) {
    if (!value || value.trim().length < 3)
      return "Task title must be at least 3 characters";
    if (value.length > 50) return "Task title must be less than 100 characters";
    return null;
  }

  validateDescription(value) {
    if (!value) return "Description can't be empty";
    if (value && value.length > 500)
      return "Description must be less than 500 characters";
    return null;
  }

  validateDeadline(value) {
    if (!value) return "Deadline can't be empty";
    if (value && new Date(value) < new Date())
      return "Deadline cannot be in the past";
    return null;
  }

  showError(fieldName, message) {
    const errorEl = document.getElementById(`${fieldName}-error`);
    const fieldEl = document.querySelector(`[name="${fieldName}"]`);

    if (errorEl) {
      errorEl.textContent = message;
      errorEl.classList.add("show");
    }
    if (fieldEl) {
      fieldEl.closest(".field")?.classList.add("error");
    }
  }

  clearError(fieldName) {
    const errorEl = document.getElementById(`${fieldName}-error`);
    const fieldEl = document.querySelector(`[name="${fieldName}"]`);

    if (errorEl) {
      errorEl.textContent = "";
      errorEl.classList.remove("show");
    }
    if (fieldEl) {
      fieldEl.closest(".field")?.classList.remove("error");
    }
  }

  validateForm(formData) {
    ["task", "description", "deadlineAt"].forEach((field) =>
      this.clearError(field === "deadlineAt" ? "deadline" : field),
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
    this.hiddenInput = element.parentElement.querySelector(
      'input[type="hidden"]',
    );
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
    if (this.hiddenInput) {
      this.hiddenInput.value = value;
      console.log(`CustomSelect updated hidden input to: ${value}`);
    }

    this.element.dispatchEvent(
      new CustomEvent("change", { detail: { value, text } }),
    );
    this.close();
  }
}

// * Utility functions
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

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
    (t.task || "").toLowerCase().includes(currentKeyword),
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
          t.deadline && new Date(t.deadline) < now && t.status !== "COMPLETED",
      );
    case "today":
      return tasks.filter(
        (t) =>
          t.deadline &&
          new Date(t.deadline) >= today &&
          new Date(t.deadline) < tomorrow,
      );
    case "next7d":
      return tasks.filter(
        (t) =>
          t.deadline &&
          new Date(t.deadline) >= now &&
          new Date(t.deadline) <= next7Days,
      );
    case "next30d":
      return tasks.filter(
        (t) =>
          t.deadline &&
          new Date(t.deadline) >= now &&
          new Date(t.deadline) <= next30Days,
      );
    case "nodeadline":
      return tasks.filter((t) => !t.deadline);
    default:
      return tasks;
  }
}

// * Search with debounce
if (searchInput) {
  const debouncedSearch = debounce(() => {
    currentKeyword = searchInput.value.trim().toLowerCase();
    currentPage = 1; // Reset to first page
    loadTasks();
  }, 300);

  searchInput.addEventListener("input", debouncedSearch);
}

// * Add Task
async function addTask(
  task,
  priority,
  description,
  deadlineAt,
  category,
  status,
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
      authHeaders(),
    );

    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
    alert(CONSTANTS.MESSAGES.TASK_ADDED);
    resetForm();
    await loadTasks();
  } catch (error) {
    handleError(error, "Failed to add task");
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
      const textEl = select.querySelector(".select-text");
      const hiddenInput = select.querySelector('input[type="hidden"]');
      const optionEl = select.querySelector(`[data-value="${value}"]`);

      if (textEl) textEl.textContent = text;
      if (hiddenInput) hiddenInput.value = value;
      if (optionEl) {
        select
          .querySelectorAll(".select-option")
          .forEach((opt) => opt.classList.remove("selected"));
        optionEl.classList.add("selected");
      }
    }
  });
}

// * Pagination functions
function paginateTasks(tasks) {
  const startIndex = (currentPage - 1) * tasksPerPage;
  const endIndex = startIndex + tasksPerPage;
  return tasks.slice(startIndex, endIndex);
}

function renderPagination() {
  const totalPages = Math.ceil(totalTasks / tasksPerPage);

  if (totalPages <= 1) {
    paginationEl.classList.add("hidden");
    return;
  }

  paginationEl.classList.remove("hidden");

  prevBtn.disabled = currentPage === 1;
  nextBtn.disabled = currentPage === totalPages;

  let pageNumbersHTML = "";
  for (let i = 1; i <= totalPages; i++) {
    const isActive = i === currentPage ? "active" : "";
    pageNumbersHTML += `<button class="page-btn ${isActive}" onclick="goToPage(${i})">${i}</button>`;
  }

  pageNumbersEl.innerHTML = pageNumbersHTML;
}

function goToPage(page) {
  currentPage = page;
  const paginatedTasks = paginateTasks(currentTasks);
  renderTasks(paginatedTasks);
  renderPagination();
}

function goToPrevPage() {
  if (currentPage > 1) {
    goToPage(currentPage - 1);
  }
}

function goToNextPage() {
  const totalPages = Math.ceil(totalTasks / tasksPerPage);
  if (currentPage < totalPages) {
    goToPage(currentPage + 1);
  }
}

// * Load Tasks
async function loadTasks() {
  try {
    const res = await axios.get(`${api}/task`, authHeaders());
    let tasks = res?.data?.data || [];
    tasks = filterTasksByUser(tasks);

    localStorage.setItem(
      CONSTANTS.STORAGE_KEYS.CACHED_TASKS,
      JSON.stringify(tasks),
    );

    let filteredTasks = tasks;
    if (currentFilter !== "all") {
      filteredTasks = filteredTasks.filter(
        (t) => statusToFilter(t.status) === currentFilter,
      );
    }
    if (currentCategory !== "all") {
      filteredTasks = filteredTasks.filter(
        (t) => t.category === currentCategory,
      );
    }
    if (currentTimeFilter !== "all") {
      filteredTasks = applyTimeFilter(filteredTasks);
    }

    filteredTasks = applySearch(filteredTasks);
    filteredTasks = sortByPriority(filteredTasks);

    totalTasks = filteredTasks.length;
    currentTasks = filteredTasks;

    const paginatedTasks = paginateTasks(filteredTasks);
    renderTasks(paginatedTasks);
    renderPagination();
    updateOverview(tasks);
  } catch (err) {
    const cached = localStorage.getItem(CONSTANTS.STORAGE_KEYS.CACHED_TASKS);
    if (cached) {
      const tasks = JSON.parse(cached);
      totalTasks = tasks.length;
      currentTasks = tasks;
      const paginatedTasks = paginateTasks(tasks);
      renderTasks(paginatedTasks);
      renderPagination();
      updateOverview(tasks);
    } else {
      handleError(err, "Failed to load tasks");
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

  const priorityColors = CONSTANTS.PRIORITY_COLORS;
  const categoryColors = CONSTANTS.CATEGORY_COLORS;

  // Use DocumentFragment for better performance
  const fragment = document.createDocumentFragment();

  tasks.forEach((t) => {
    const status = statusToFilter(t.status);
    const isCompleted = status === "done";
    const isDoing = status === "doing";
    const checked = isCompleted ? "checked" : "";
    const doneClass = isCompleted ? "task-done" : isDoing ? "task-doing" : "";

    const li = document.createElement("li");
    li.className = `task-item ${doneClass}`;
    li.dataset.id = t._id;
    li.innerHTML = `
      <div class="task-left">
        <input type="checkbox" class="task-check" ${checked} aria-label="Mark task as ${isCompleted ? "incomplete" : "complete"}" />
        ${status === "todo" ? `<button type="button" class="doing-btn" onclick="setDoing('${t._id}')" aria-label="Set task to doing">Doing</button>` : ""}
        <span class="priority-dot" style="background:${
          priorityColors[t.priority] || priorityColors.medium
        }" aria-label="Priority: ${t.priority}"></span>
        <div onClick="openEditModal('${t._id}')" class="task-content" role="button" tabindex="0" aria-label="Edit task">
          <span class="task-text">${escapeHtml(t.task)}</span>
          ${
            t.description
              ? `<div class="task-desc muted small">${escapeHtml(t.description)}</div>`
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
            ${isOverdue(t) ? `<span class="overdue-badge">Overdue!</span>` : ""}
          </div>`
              : ""
          }
        </div>
      </div>
      <div class="task-right">  
        <span class="task-priority">${t.priority}</span>
        <button type="button" class="delete-btn" onclick="deleteTask('${
          t._id
        }')" aria-label="Delete task">Delete</button>
      </div>
    `;
    fragment.appendChild(li);
  });

  list.innerHTML = "";
  list.appendChild(fragment);
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
  addForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(addForm);
    const data = Object.fromEntries(fd.entries());

    console.log("Form data being submitted:", data);

    if (!validator.validateForm(data)) return;

    const editId = addForm.dataset.editId;
    if (editId) {
      // Update existing task
      try {
        const updateData = {
          task: data.task.trim(),
          priority: data.priority,
          description: data.description?.trim() || "",
          deadline: data.deadlineAt
            ? new Date(data.deadlineAt).toISOString()
            : null,
          category: data.category,
          status: filterToStatus(data.status),
        };

        console.log("Update data being sent to server:", updateData);

        await axios.patch(`${api}/task/${editId}`, updateData, authHeaders());

        modal.classList.add("hidden");
        modal.setAttribute("aria-hidden", "true");
        alert(CONSTANTS.MESSAGES.TASK_UPDATED);
        resetForm();
        await loadTasks();
      } catch (error) {
        handleError(error, "Failed to update task");
      }
    } else {
      // Add new task
      addTask(
        data.task,
        data.priority,
        data.description,
        data.deadlineAt,
        data.category,
        data.status,
      );
    }
  });
}

function resetForm() {
  addForm.reset();
  resetFormSelects();
  delete addForm.dataset.editId;
  document.querySelector(".modal-head h3").textContent = "Add new task";
  document.querySelector('button[type="submit"]').textContent = "Add";
}

// * Tabs
document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    currentFilter = btn.dataset.filter;
    currentPage = 1; // Reset to first page
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
    await axios.patch(
      `${api}/task/${taskId}`,
      { status: newStatus },
      authHeaders(),
    );
    loadTasks();
  } catch (err) {
    handleError(err, "Failed to update task status");
    e.target.checked = !isChecked;
  }
});

// * Set Doing function
async function setDoing(taskId) {
  try {
    await axios.patch(
      `${api}/task/${taskId}`,
      { status: "DOING" },
      authHeaders(),
    );
    loadTasks();
  } catch (err) {
    handleError(err, "Failed to set task status");
  }
}

// * CRUD Operations
async function deleteTask(taskId) {
  if (!confirm(CONSTANTS.MESSAGES.CONFIRM_DELETE)) return;
  try {
    await axios.delete(`${api}/task/${taskId}`, authHeaders());
    await loadTasks();
  } catch (error) {
    handleError(error, "Failed to delete task");
  }
}

// * Edit Task Modal
async function openEditModal(taskId) {
  try {
    // Get fresh data from server
    const res = await axios.get(`${api}/task/${taskId}`, authHeaders());
    const task = res?.data?.data;
    if (!task) return;
    // console.log('Task data from server:', task);
    // console.log('Task category:', task.category);

    // * Fill form with task data
    document.querySelector('[name="task"]').value = task.task;
    document.querySelector('[name="description"]').value =
      task.description || "";

    // * Set deadline
    if (task.deadline) {
      const deadline = new Date(task.deadline);
      const localDateTime = new Date(
        deadline.getTime() - deadline.getTimezoneOffset() * 60000,
      )
        .toISOString()
        .slice(0, 16);
      document.querySelector('[name="deadlineAt"]').value = localDateTime;
    } else {
      document.querySelector('[name="deadlineAt"]').value = "";
    }

    // Set custom selects
    setSelectValue("#category-select", task.category || "work");
    setSelectValue("#priority-select", task.priority || "medium");
    setSelectValue("#status-select", statusToFilter(task.status) || "todo");

    // Change modal title and button
    document.querySelector(".modal-head h3").textContent = "Edit Task";
    document.querySelector('button[type="submit"]').textContent = "Update";

    // Store task ID for update
    addForm.dataset.editId = taskId;

    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
  } catch (error) {
    handleError(error, "Failed to load task details");
  }
}

function setSelectValue(selector, value) {
  const select = document.querySelector(selector);
  if (!select) {
    console.warn(`Select element not found: ${selector}`);
    return;
  }

  const textEl = select.querySelector(".select-text");
  const hiddenInput = select.parentElement.querySelector(
    'input[type="hidden"]',
  );
  const optionEl = select.querySelector(`[data-value="${value}"]`);

  // console.log(`Setting ${selector} to value: ${value}`);
  // console.log("Found option:", optionEl);
  // console.log("Hidden input:", hiddenInput);

  if (hiddenInput) {
    hiddenInput.value = value;
    console.log("Hidden input value set to:", hiddenInput.value);
  }

  if (optionEl) {
    select
      .querySelectorAll(".select-option")
      .forEach((opt) => opt.classList.remove("selected"));
    optionEl.classList.add("selected");

    if (textEl) {
      textEl.textContent = optionEl.textContent;
      console.log("Text updated to:", optionEl.textContent);
    }

    const changeEvent = new CustomEvent("change", {
      detail: { value: value, text: optionEl.textContent },
    });
    select.dispatchEvent(changeEvent);
  } else {
    console.warn(`Option with value "${value}" not found in ${selector}`);
    if (textEl) textEl.textContent = value;
  }
}

async function clearCompletedTask() {
  if (!confirm(CONSTANTS.MESSAGES.CONFIRM_CLEAR)) return;
  try {
    const res = await axios.get(`${api}/task?status=COMPLETED`, authHeaders());
    const tasks = res?.data?.data || [];
    const myCompleted = filterTasksByUser(tasks);

    if (!myCompleted.length) {
      alert(CONSTANTS.MESSAGES.NO_COMPLETED);
      return;
    }

    await Promise.all(
      myCompleted.map((t) =>
        axios.delete(`${api}/task/${t._id}`, authHeaders()),
      ),
    );
    await loadTasks();
    alert(CONSTANTS.MESSAGES.TASK_DELETED);
  } catch (error) {
    handleError(error, "Failed to clear completed tasks");
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
      currentPage = 1; // Reset to first page
      loadTasks();
    });
  }

  const timeFilter = document.getElementById("time-filter");
  if (timeFilter) {
    timeFilter.addEventListener("change", (e) => {
      currentTimeFilter = e.detail.value;
      currentPage = 1; // Reset to first page
      loadTasks();
    });
  }

  // * Pagination event listeners
  if (prevBtn) {
    prevBtn.addEventListener("click", goToPrevPage);
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", goToNextPage);
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
              error,
            )
          : validator.clearError(name === "deadlineAt" ? "deadline" : name);
      });
    }
  });

  // * Keyboard support for task content
  document.addEventListener("keydown", (e) => {
    if (
      e.target.classList.contains("task-content") &&
      (e.key === "Enter" || e.key === " ")
    ) {
      e.preventDefault();
      e.target.click();
    }
  });
});

loadTasks();
window.deleteTask = deleteTask;
window.openEditModal = openEditModal;
window.setDoing = setDoing;
window.clearCompletedTask = clearCompletedTask;
window.goToPage = goToPage;
