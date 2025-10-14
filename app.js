/* -------------------------
   Utilities & State
   --------------------------*/
const LS_KEY = "meditrak_reminders_v1";

let reminders = []; // loaded from localStorage
let dueReminder = null; // currently showing due modal
let audioCtx = null; // for beep

/* -------------------------
   DOM refs
   --------------------------*/
const addBtn = document.getElementById("addBtn");
const modal = document.getElementById("modal");
const modalClose = document.getElementById("modalClose");
const modalCancel = document.getElementById("modalCancel");
const reminderForm = document.getElementById("reminderForm");
const remindersWrap = document.getElementById("remindersWrap");
const globalSoundToggle = document.getElementById("globalSoundToggle");
const clearAllBtn = document.getElementById("clearAll");

const dueModal = document.getElementById("dueModal");
const dueText = document.getElementById("dueText");
const markTakenBtn = document.getElementById("markTaken");
const markMissedBtn = document.getElementById("markMissed");
const snoozeBtn = document.getElementById("snoozeBtn");

/* Form fields */
const medNameInput = document.getElementById("medName");
const medDoseInput = document.getElementById("medDose");
const medTimeInput = document.getElementById("medTime");
const medSoundInput = document.getElementById("medSound");

/* -------------------------
   Persistence
   --------------------------*/
function loadReminders() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    reminders = raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Failed to load reminders", e);
    reminders = [];
  }
}

function saveReminders() {
  localStorage.setItem(LS_KEY, JSON.stringify(reminders));
}

/* -------------------------
   Helpers
   --------------------------*/
function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/**
 * Normalize time string HH:MM
 */
function nowHHMM() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

/**
 * Play a short beep using WebAudio
 */
function playBeep(durationMs = 350, freq = 980) {
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn("AudioContext not available", e);
      return;
    }
  }
  const now = audioCtx.currentTime;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = "sine";
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.2, now + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);
  o.connect(g);
  g.connect(audioCtx.destination);
  o.start(now);
  o.stop(now + durationMs / 1000 + 0.02);
}

/* -------------------------
   UI Rendering
   --------------------------*/
function createCard(rem) {
  const card = document.createElement("article");
  card.className = "card";
  card.dataset.id = rem.id;

  const row1 = document.createElement("div");
  row1.className = "row";
  const med = document.createElement("div");
  med.className = "medicine";
  med.textContent = rem.name;
  const time = document.createElement("div");
  time.className = "time";
  time.textContent = rem.time;
  row1.appendChild(med);
  row1.appendChild(time);

  const dose = document.createElement("div");
  dose.className = "meta";
  dose.textContent = rem.dosage || "—";

  const row2 = document.createElement("div");
  row2.className = "row";
  const status = document.createElement("div");
  status.className = `status ${rem.status}`;
  status.textContent =
    rem.status === "pending"
      ? "Pending"
      : rem.status === "taken"
      ? "Taken"
      : "Missed";
  row2.appendChild(dose);
  row2.appendChild(status);

  const actions = document.createElement("div");
  actions.className = "card-actions";
  const left = document.createElement("div");
  left.className = "small-actions";

  const takenBtn = document.createElement("button");
  takenBtn.className = "btn success";
  takenBtn.textContent = "Mark Taken";
  takenBtn.onclick = () => markReminder(rem.id, "taken");

  const missedBtn = document.createElement("button");
  missedBtn.className = "btn danger";
  missedBtn.textContent = "Mark Missed";
  missedBtn.onclick = () => markReminder(rem.id, "missed");

  left.appendChild(takenBtn);
  left.appendChild(missedBtn);

  const right = document.createElement("div");
  right.className = "small-actions";

  const editBtn = document.createElement("button");
  editBtn.className = "btn";
  editBtn.textContent = "Edit";
  editBtn.onclick = () => openEditModal(rem.id);

  const delBtn = document.createElement("button");
  delBtn.className = "btn";
  delBtn.textContent = "Delete";
  delBtn.onclick = () => {
    if (confirm(`Delete reminder "${rem.name}" at ${rem.time}?`)) {
      deleteReminder(rem.id);
    }
  };

  right.appendChild(editBtn);
  right.appendChild(delBtn);

  actions.appendChild(left);
  actions.appendChild(right);

  card.appendChild(row1);
  card.appendChild(row2);
  card.appendChild(actions);

  // highlight if due soon
  const current = nowHHMM();
  if (rem.status === "pending" && rem.time === current) {
    card.style.border = `2px solid ${
      getComputedStyle(document.documentElement).getPropertyValue(
        "--accent-2"
      ) || "#06b6d4"
    }`;
  }

  return card;
}

function renderReminders() {
  remindersWrap.innerHTML = "";
  if (!reminders.length) {
    remindersWrap.innerHTML = `<div class="card"><div class="medicine">No reminders yet</div><p class="meta">Click "Add Reminder" to create one.</p></div>`;
    return;
  }

  // sort by time (HH:MM)
  const sorted = [...reminders].sort((a, b) => {
    if (a.time < b.time) return -1;
    if (a.time > b.time) return 1;
    return 0;
  });

  for (const rem of sorted) {
    remindersWrap.appendChild(createCard(rem));
  }
}

/* -------------------------
   CRUD & Actions
   --------------------------*/
function addReminder(obj) {
  reminders.push(obj);
  saveReminders();
  renderReminders();
}

function updateReminder(id, patch) {
  const i = reminders.findIndex((r) => r.id === id);
  if (i === -1) return;
  reminders[i] = { ...reminders[i], ...patch };
  saveReminders();
  renderReminders();
}

function deleteReminder(id) {
  reminders = reminders.filter((r) => r.id !== id);
  saveReminders();
  renderReminders();
}

function markReminder(id, status) {
  updateReminder(id, { status, notified: true });
}

/* -------------------------
   Modal: Add / Edit
   --------------------------*/
function openModal() {
  modal.classList.remove("hidden");
  medNameInput.focus();
}

function closeModal() {
  modal.classList.add("hidden");
  reminderForm.reset();
  // reset medSound default true
  medSoundInput.checked = true;
}

/* When editing an existing reminder */
function openEditModal(id) {
  const rem = reminders.find((r) => r.id === id);
  if (!rem) return;
  medNameInput.value = rem.name;
  medDoseInput.value = rem.dosage || "";
  medTimeInput.value = rem.time;
  medSoundInput.checked = !!rem.sound;
  openModal();

  // when form saves, we should update instead of creating new
  reminderForm.onsubmit = function (e) {
    e.preventDefault();
    const name = medNameInput.value.trim();
    const dosage = medDoseInput.value.trim();
    const time = medTimeInput.value;
    const sound = medSoundInput.checked;
    updateReminder(id, {
      name,
      dosage,
      time,
      sound,
      status: "pending",
      notified: false,
    });
    reminderForm.onsubmit = defaultFormHandler; // restore default
    closeModal();
  };
}

/* default handler used for create */
function defaultFormHandler(e) {
  e.preventDefault();
  const name = medNameInput.value.trim();
  const dosage = medDoseInput.value.trim();
  const time = medTimeInput.value;
  const sound = medSoundInput.checked;

  if (!name || !time) {
    alert("Please provide medicine name and time.");
    return;
  }

  const newRem = {
    id: makeId(),
    name,
    dosage,
    time, // HH:MM
    sound: !!sound, // boolean: play beep for this reminder
    status: "pending", // 'pending' | 'taken' | 'missed'
    notified: false, // whether we've already alerted this reminder
    createdAt: new Date().toISOString(),
  };
  addReminder(newRem);
  closeModal();
}

reminderForm.onsubmit = defaultFormHandler;

/* -------------------------
   Due handling (alert + sound + UI)
   --------------------------*/
function handleDue(rem) {
  // if already handled or not pending, skip
  if (!rem || rem.notified || rem.status !== "pending") return;

  // mark notified to avoid re-alerting repeatedly
  updateReminder(rem.id, { notified: true });

  // show quick alert (browser alert as fallback)
  const globalSound = globalSoundToggle.checked;

  // play sound if allowed
  if (globalSound && rem.sound) {
    try {
      playBeep(600, 880);
    } catch (e) {
      /* ignore */
    }
  }

  // Show our own modal with options to mark taken/missed/snooze
  dueReminder = rem;
  dueText.innerHTML = `<strong>${escapeHtml(rem.name)}</strong> — ${escapeHtml(
    rem.dosage || ""
  )}<br/><small>Scheduled at ${rem.time}</small>`;
  dueModal.classList.remove("hidden");
}

/* small utility to prevent XSS in inserted HTML */
function escapeHtml(s) {
  return String(s || "").replace(/[&<>"'`]/g, function (m) {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
      "`": "&#96;",
    }[m];
  });
}

/* Snooze: add 10 minutes to reminder time (keeps same day; if passes midnight it wraps) */
function snoozeReminder(rem, minutes = 10) {
  const [hh, mm] = rem.time.split(":").map(Number);
  const d = new Date();
  d.setHours(hh, mm, 0, 0);
  d.setMinutes(d.getMinutes() + minutes);
  const nh = String(d.getHours()).padStart(2, "0");
  const nm = String(d.getMinutes()).padStart(2, "0");
  updateReminder(rem.id, { time: `${nh}:${nm}`, notified: false });
}

/* -------------------------
   Time checking loop
   --------------------------*/
function checkReminders() {
  const current = nowHHMM();
  // find pending reminders that match current time and not notified
  for (const rem of reminders) {
    if (rem.status === "pending" && !rem.notified) {
      // two modes:
      // - exact match HH:MM
      // - if added later and scheduled time already passed, treat as due immediately
      if (rem.time === current) {
        handleDue(rem);
      } else {
        // if time is earlier than current time (already passed today), we consider due as well
        // This covers case of reminders that were added late.
        if (rem.time < current) {
          handleDue(rem);
        }
      }
    }
  }
}

/* Start minute-check interval (every 60 seconds). Also run immediately on load. */
function startChecker() {
  checkReminders();
  // Align first tick to the start of next minute for better UX
  const now = new Date();
  const msToNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
  setTimeout(() => {
    checkReminders();
    setInterval(checkReminders, 60 * 1000); // every minute
  }, msToNextMinute);
}

/* -------------------------
   Event listeners
   --------------------------*/
addBtn.addEventListener("click", () => {
  // Ensure default form handler (in case we edited earlier)
  reminderForm.onsubmit = defaultFormHandler;
  openModal();
});

modalClose.addEventListener("click", closeModal);
modalCancel.addEventListener("click", closeModal);

// clicking outside modal content closes
modal.addEventListener("click", (e) => {
  if (e.target === modal) closeModal();
});
dueModal.addEventListener("click", (e) => {
  if (e.target === dueModal) {
    // allow click outside to just close (not mark)
    dueModal.classList.add("hidden");
    dueReminder = null;
  }
});

markTakenBtn.addEventListener("click", () => {
  if (!dueReminder) return;
  markReminder(dueReminder.id, "taken");
  dueModal.classList.add("hidden");
  dueReminder = null;
});

markMissedBtn.addEventListener("click", () => {
  if (!dueReminder) return;
  markReminder(dueReminder.id, "missed");
  dueModal.classList.add("hidden");
  dueReminder = null;
});

snoozeBtn.addEventListener("click", () => {
  if (!dueReminder) return;
  snoozeReminder(dueReminder, 10);
  dueModal.classList.add("hidden");
  dueReminder = null;
});

clearAllBtn.addEventListener("click", () => {
  if (!confirm("Clear ALL reminders? This cannot be undone.")) return;
  reminders = [];
  saveReminders();
  renderReminders();
});

/* keyboard shortcut: 'a' for add */
document.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "a" && !modal.classList.contains("hidden"))
    return; // skip if typing in modal
  if (e.key.toLowerCase() === "a" && !e.metaKey && !e.ctrlKey) {
    // open add modal
    reminderForm.onsubmit = defaultFormHandler;
    openModal();
  }
});

/* -------------------------
   Init
   --------------------------*/
function init() {
  loadReminders();
  renderReminders();
  startChecker();
}

/* Run */
init();
