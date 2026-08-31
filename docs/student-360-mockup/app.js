const students = [
  { initials: "MR", name: "Maya Rodriguez", aid: "10093872", studentId: "20387465", program: "BS Computer Science", term: "Fall 2026", email: "maya.rodriguez@example.edu", phone: "(415) 555-0187", risk: "High melt risk", riskShort: "High risk" },
  { initials: "AK", name: "Avery Kim", aid: "10094113", studentId: "20388104", program: "BS Mechanical Engineering", term: "Fall 2026", email: "avery.kim@example.edu", phone: "(212) 555-0144", risk: "Medium melt risk", riskShort: "Medium risk" },
  { initials: "JL", name: "Jordan Lee", aid: "10093408", studentId: "20386237", program: "BBA Finance", term: "Fall 2026", email: "jordan.lee@example.edu", phone: "(617) 555-0129", risk: "Low melt risk", riskShort: "Low risk" },
  { initials: "SN", name: "Sofia Nguyen", aid: "10094991", studentId: "20389552", program: "BS Nursing", term: "Spring 2027", email: "sofia.nguyen@example.edu", phone: "(503) 555-0168", risk: "Medium melt risk", riskShort: "Medium risk" }
];

let selectedStudentIndex = 0;
let toastTimer;

const toast = document.getElementById("toast");
const searchInput = document.getElementById("student-search");
const searchResults = document.getElementById("search-results");
const filterButton = document.getElementById("filter-button");
const filterPanel = document.getElementById("filter-panel");

function showToast(message) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("show");
  toastTimer = window.setTimeout(() => toast.classList.remove("show"), 2600);
}

function switchTab(tabName) {
  const tab = document.querySelector('[data-tab="' + tabName + '"]');
  const panel = document.querySelector('[data-panel="' + tabName + '"]');
  if (!tab || !panel) return;

  document.querySelectorAll(".record-tab").forEach((item) => {
    const active = item === tab;
    item.classList.toggle("active", active);
    item.setAttribute("aria-selected", String(active));
    item.tabIndex = active ? 0 : -1;
  });

  document.querySelectorAll(".tab-panel").forEach((item) => {
    const active = item === panel;
    item.hidden = !active;
    item.classList.toggle("active", active);
  });

  window.history.replaceState(null, "", "#" + tabName);
  document.querySelector(".student-record").scrollIntoView({ behavior: "smooth", block: "start" });
}

const tabs = Array.from(document.querySelectorAll(".record-tab"));
tabs.forEach((tab, index) => {
  tab.addEventListener("click", () => switchTab(tab.dataset.tab));
  tab.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    const offset = event.key === "ArrowRight" ? 1 : -1;
    const next = tabs[(index + offset + tabs.length) % tabs.length];
    switchTab(next.dataset.tab);
    next.focus();
  });
});

document.addEventListener("click", (event) => {
  const tabTarget = event.target.closest("[data-go-tab]");
  if (tabTarget) switchTab(tabTarget.dataset.goTab);

  const toastTarget = event.target.closest("[data-toast]");
  if (toastTarget) showToast(toastTarget.dataset.toast);

  if (!event.target.closest(".search-wrap")) searchResults.classList.remove("open");
  if (!event.target.closest("#filter-panel") && !event.target.closest("#filter-button") && !filterPanel.hidden) closeFilters();
});

function renderSearchResults(query) {
  const normalized = (query || "").trim().toLowerCase();
  const matches = students.filter((student) =>
    Object.values(student).some((value) => String(value).toLowerCase().includes(normalized))
  );

  if (!matches.length) {
    searchResults.innerHTML = '<div class="search-empty">No students match that search.</div>';
  } else {
    searchResults.innerHTML = matches.map((student) =>
      '<button class="search-result" type="button" data-student-id="' + student.studentId + '">' +
        '<span>' + student.initials + '</span>' +
        '<span><strong>' + student.name + '</strong><small>' + student.program + ' - ' + student.term + '</small></span>' +
        '<b>' + student.riskShort + '</b>' +
      '</button>'
    ).join("");
  }
  searchResults.classList.add("open");
}

function selectStudent(studentId) {
  const index = students.findIndex((student) => student.studentId === studentId);
  if (index < 0) return;
  selectedStudentIndex = index;
  const student = students[index];

  document.querySelectorAll("[data-bind]").forEach((node) => {
    node.textContent = student[node.dataset.bind];
  });

  searchInput.value = "";
  searchResults.classList.remove("open");
  showToast(student.name + " selected. Prototype detail content remains representative.");
}

searchInput.addEventListener("focus", () => renderSearchResults(searchInput.value));
searchInput.addEventListener("input", () => renderSearchResults(searchInput.value));
searchResults.addEventListener("click", (event) => {
  const result = event.target.closest("[data-student-id]");
  if (result) selectStudent(result.dataset.studentId);
});

document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    searchInput.focus();
  }
  if (event.key === "Escape") {
    searchResults.classList.remove("open");
    closeFilters();
  }
});

document.querySelectorAll("[data-cycle]").forEach((button) => {
  button.addEventListener("click", () => {
    const step = button.dataset.cycle === "next" ? 1 : -1;
    selectedStudentIndex = (selectedStudentIndex + step + students.length) % students.length;
    selectStudent(students[selectedStudentIndex].studentId);
  });
});

function openFilters() {
  filterPanel.hidden = false;
  filterButton.setAttribute("aria-expanded", "true");
}

function closeFilters() {
  filterPanel.hidden = true;
  filterButton.setAttribute("aria-expanded", "false");
}

filterButton.addEventListener("click", () => filterPanel.hidden ? openFilters() : closeFilters());
document.getElementById("close-filter").addEventListener("click", closeFilters);
document.getElementById("apply-filter").addEventListener("click", () => {
  closeFilters();
  showToast("Directory filters applied to the prototype.");
});
document.querySelector(".clear-filters").addEventListener("click", () => showToast("Prototype filters cleared."));
document.querySelectorAll(".filter-chip").forEach((chip) => chip.addEventListener("click", () => {
  chip.remove();
  showToast("Filter removed.");
}));
document.getElementById("directory-sort").addEventListener("change", (event) => {
  showToast("Directory sorted by " + event.target.options[event.target.selectedIndex].text.toLowerCase() + ".");
});

const websiteToggle = document.getElementById("website-toggle");
const timelineSearch = document.getElementById("timeline-search");
const timelineCategory = document.getElementById("timeline-category");

function filterTimeline() {
  const includeWebsite = websiteToggle.checked;
  const query = timelineSearch.value.trim().toLowerCase();
  const category = timelineCategory.value;
  let visible = 0;
  let visibleWebsite = 0;

  document.querySelectorAll(".timeline-event").forEach((event) => {
    const isWebsite = event.dataset.type === "website";
    const matchesWebsite = includeWebsite || !isWebsite;
    const matchesCategory = category === "all" || event.dataset.type === category;
    const matchesQuery = !query || event.dataset.search.includes(query);
    const show = matchesWebsite && matchesCategory && matchesQuery;
    event.classList.toggle("filtered-out", !show);
    if (show) {
      visible += 1;
      if (isWebsite) visibleWebsite += 1;
    }
  });

  document.getElementById("visible-event-count").textContent = visible;
  document.getElementById("web-event-count").textContent = visibleWebsite;
  document.getElementById("empty-events").hidden = visible !== 0;
  document.getElementById("website-toggle-copy").textContent = includeWebsite ? "Showing approved portal visits" : "Portal visits are hidden";
}

websiteToggle.addEventListener("change", () => {
  filterTimeline();
  showToast(websiteToggle.checked ? "Website activity is visible." : "Website activity is now hidden.");
});
timelineSearch.addEventListener("input", filterTimeline);
timelineCategory.addEventListener("change", filterTimeline);

const documentSearch = document.getElementById("document-search");
const documentStage = document.getElementById("document-stage");
const documentStatus = document.getElementById("document-status");

function filterDocuments() {
  const query = documentSearch.value.trim().toLowerCase();
  let visible = 0;

  document.querySelectorAll("#document-table-body tr").forEach((row) => {
    const stageMatch = documentStage.value === "all" || row.dataset.stage === documentStage.value;
    const statusMatch = documentStatus.value === "all" || row.dataset.status === documentStatus.value;
    const queryMatch = !query || row.textContent.toLowerCase().includes(query);
    const show = stageMatch && statusMatch && queryMatch;
    row.classList.toggle("filtered-out", !show);
    if (show) visible += 1;
  });

  document.getElementById("document-count").textContent = visible + " document" + (visible === 1 ? "" : "s");
  document.getElementById("empty-documents").hidden = visible !== 0;
}

documentSearch.addEventListener("input", filterDocuments);
documentStage.addEventListener("change", filterDocuments);
documentStatus.addEventListener("change", filterDocuments);

document.querySelectorAll("[data-task-action]").forEach((button) => {
  button.addEventListener("click", () => {
    const card = button.closest(".requirement-card");
    const approved = button.dataset.taskAction === "approved";
    card.style.borderLeftColor = approved ? "var(--cobalt-600)" : "var(--coral)";
    showToast(approved ? "Evidence approved in this prototype only." : "Replacement request prepared in this prototype only.");
  });
});

const noteForm = document.getElementById("note-form");
const notesFeed = document.getElementById("notes-feed");
const notesSort = document.getElementById("notes-sort");

function sortNotes() {
  const cards = Array.from(notesFeed.querySelectorAll(".note-card"));
  const direction = notesSort.value === "newest" ? -1 : 1;
  cards.sort((a, b) => direction * (new Date(a.dataset.time) - new Date(b.dataset.time)));
  cards.forEach((card) => notesFeed.appendChild(card));
}

notesSort.addEventListener("change", () => {
  sortNotes();
  showToast("Notes sorted " + (notesSort.value === "newest" ? "newest" : "oldest") + " first.");
});

noteForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const noteText = document.getElementById("note-text");
  const text = noteText.value.trim();
  if (!text) {
    showToast("Add note text before submitting.");
    return;
  }

  const category = document.getElementById("note-category").value;
  const visibility = document.getElementById("note-visibility").value;
  const card = document.createElement("article");
  card.className = "note-card card";
  card.dataset.time = new Date().toISOString();
  card.innerHTML =
    '<div class="note-author"><span class="mini-avatar">JW</span><div><strong>Jamie Wilson</strong><small>Just now - ' + category + '</small></div><span class="new-label">New</span></div>' +
    '<p></p>' +
    '<div class="note-footer"><span class="status-badge neutral">' + visibility + '</span><span>Prototype note - not saved</span><button type="button" aria-label="Note actions"><svg><use href="#i-more"></use></svg></button></div>';
  card.querySelector("p").textContent = text;
  notesFeed.prepend(card);
  noteText.value = "";
  document.getElementById("note-total").textContent = String(Number(document.getElementById("note-total").textContent) + 1);
  notesSort.value = "newest";
  showToast("Note added to this browser session only.");
});

document.querySelectorAll(".segmented-control").forEach((control) => {
  control.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    control.querySelectorAll("button").forEach((item) => item.classList.toggle("active", item === button));
    showToast(button.textContent.trim() + " requirements selected.");
  });
});

const initialTab = window.location.hash.replace("#", "");
if (["overview", "timeline", "application", "documents", "progress", "notes", "financials"].includes(initialTab)) {
  switchTab(initialTab);
}
