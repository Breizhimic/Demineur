/* ============================================================
   DÉMINEUR — Version Boostée
   Features: Stats, Leaderboard, Undo/Redo, Export/Import,
             Multiple Themes, SEO, Toast notifications
   ============================================================ */

/* ===== STORAGE KEYS ===== */
const STORAGE_KEY      = "demineurSettings";
const STATS_KEY        = "demineurStats";
const LEADERBOARD_KEY  = "demineurLeaderboard";
const GAME_KEY         = "demineurSavedGame";

/* ===== DEFAULT SETTINGS ===== */
const settings = {
  sound: { enabled: true, volume: 0.5 },
  gestures: { tap: "reveal", doubleTap: "flag", tripleTap: "chord", longPress: null },
  invertClicks: false,
  theme: "dark"
};

loadSettings();
applyTheme(settings.theme);

/* ===== DEFAULT STATS ===== */
let stats = {
  gamesPlayed: 0,
  gamesWon: 0,
  totalTime: 0,
  bestTimes: {},       // { "10": 42, "25": 88, ... }
  winStreak: 0,
  bestStreak: 0,
  lastResults: []      // last 20 results: { won, mines, time }
};
loadStats();

/* ===== LEADERBOARD ===== */
let leaderboard = [];  // [{ mines, time, date, rows, cols }]
loadLeaderboard();

/* ===== DOM ===== */
const boardEl        = document.getElementById("board");
const mineCounterEl  = document.getElementById("mineCounter");
const timeCounterEl  = document.getElementById("timeCounter");
const smiley         = document.getElementById("smiley");
const statusMsg      = document.getElementById("statusMsg");
const sessionInfo    = document.getElementById("sessionInfo");

/* ===== GAME STATE ===== */
let zoom = 1;
let grid = [];
let rows = 16, cols = 16, mines = 40;
let flags = 0;
let firstClick = true;
let timer = null;
let time = 0;
let gameOver = false;
let flagMode = false;
let currentMines = 40;

/* ===== UNDO / REDO ===== */
let undoStack = [];
let redoStack = [];
const MAX_UNDO = 30;

/* ===== SOUNDS ===== */
const sounds = {
  click: new Audio("sounds/click.wav"),
  flag:  new Audio("sounds/flag.wav"),
  boom:  new Audio("sounds/bomb.wav"),
  win:   new Audio("sounds/win.wav")
};

function playSound(name) {
  if (!settings.sound.enabled || !sounds[name]) return;
  sounds[name].volume = settings.sound.volume;
  sounds[name].currentTime = 0;
  sounds[name].play().catch(() => {});
}

/* ===== THEME ===== */
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  settings.theme = theme;
  document.querySelectorAll(".theme-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.theme === theme);
  });
}

document.querySelectorAll(".theme-btn").forEach(btn => {
  btn.onclick = () => { applyTheme(btn.dataset.theme); saveSettings(); };
});

/* ===== SMILEY EVENTS ===== */
document.addEventListener("mousedown", e => {
  if (e.button === 0 && e.target.closest("#board") && !gameOver)
    smiley.textContent = "😮";
});
document.addEventListener("mouseup", e => {
  if (e.button === 0 && !gameOver) smiley.textContent = "🙂";
});

/* ===== TOOLBAR BUTTONS ===== */
const undoBtn    = document.getElementById("undoBtn");
const redoBtn    = document.getElementById("redoBtn");
const invertBtn  = document.getElementById("invertClick");
const flagBtn    = document.getElementById("flagMode");
const zoomInBtn  = document.getElementById("zoomIn");
const zoomOutBtn = document.getElementById("zoomOut");
const exportBtn  = document.getElementById("exportBtn");
const importBtn  = document.getElementById("importBtn");
const importFile = document.getElementById("importFile");

undoBtn.onclick = doUndo;
redoBtn.onclick = doRedo;
invertBtn.onclick = () => {
  settings.invertClicks = !settings.invertClicks;
  updateInvertBtn();
  saveSettings();
};
flagBtn.onclick = () => {
  flagMode = !flagMode;
  updateFlagBtn();
};
zoomInBtn.onclick  = () => { zoom = Math.min(zoom + 0.15, 3); updateZoom(); };
zoomOutBtn.onclick = () => { zoom = Math.max(zoom - 0.15, 0.3); updateZoom(); };

exportBtn.onclick = exportGrid;
importBtn.onclick = () => importFile.click();
importFile.onchange = e => { if (e.target.files[0]) importGrid(e.target.files[0]); };

function updateInvertBtn() {
  invertBtn.title = settings.invertClicks ? "G=Drapeau / D=Révéler" : "G=Révéler / D=Drapeau";
  invertBtn.classList.toggle("active", settings.invertClicks);
}

function updateFlagBtn() {
  flagBtn.classList.toggle("active", flagMode);
  flagBtn.title = flagMode ? "Mode drapeau ON" : "Mode drapeau OFF";
}

updateInvertBtn();
updateFlagBtn();

function updateZoom() {
  boardEl.style.transform = `scale(${zoom})`;
  boardEl.style.transformOrigin = "top left";
  // Ajuster la taille du container
  const container = document.getElementById("board-container");
  container.style.width = Math.min(cols * 28 * zoom + 10, window.innerWidth * 0.95) + "px";
}

/* ===== KEYBOARD SHORTCUTS ===== */
document.addEventListener("keydown", e => {
  if (e.ctrlKey && e.key === "z") { e.preventDefault(); doUndo(); }
  if (e.ctrlKey && (e.key === "y" || e.key === "Z")) { e.preventDefault(); doRedo(); }
  if (e.key === "r" || e.key === "R") { if (!e.ctrlKey) startPreset(mines); }
  if (e.key === "f" || e.key === "F") { flagMode = !flagMode; updateFlagBtn(); }
});

/* ===== OPTIONS MODAL ===== */
const modal          = document.getElementById("optionsModal");
const statsModal     = document.getElementById("statsModal");
const leaderboardMod = document.getElementById("leaderboardModal");
const winModal       = document.getElementById("winModal");
const loseModal      = document.getElementById("loseModal");

document.getElementById("openOptions").onclick     = () => modal.classList.remove("hidden");
document.getElementById("closeOptions").onclick    = () => modal.classList.add("hidden");
document.getElementById("closeOptions2").onclick   = () => modal.classList.add("hidden");
document.getElementById("btnStats").onclick        = () => { renderStats(); statsModal.classList.remove("hidden"); };
document.getElementById("closeStats").onclick      = () => statsModal.classList.add("hidden");
document.getElementById("btnLeaderboard").onclick  = () => { renderLeaderboard("all"); leaderboardMod.classList.remove("hidden"); };
document.getElementById("closeLeaderboard").onclick = () => leaderboardMod.classList.add("hidden");

document.getElementById("closeWin").onclick  = () => { winModal.classList.add("hidden"); startPreset(mines); };
document.getElementById("closeLose").onclick = () => { loseModal.classList.add("hidden"); startPreset(mines); };
document.getElementById("winShare").onclick  = shareResult;

// Click outside modal closes it
document.querySelectorAll(".modal").forEach(m => {
  m.addEventListener("click", e => {
    if (e.target === m) m.classList.add("hidden");
  });
});

/* Sound settings */
const soundEnabledEl = document.getElementById("soundEnabled");
const soundVolumeEl  = document.getElementById("soundVolume");
soundEnabledEl.checked   = settings.sound.enabled;
soundVolumeEl.value       = settings.sound.volume * 100;
soundEnabledEl.onchange   = e => { settings.sound.enabled = e.target.checked; saveSettings(); };
soundVolumeEl.oninput     = e => { settings.sound.volume = e.target.value / 100; saveSettings(); };

/* Custom grid */
document.getElementById("startCustom").onclick = () => {
  const r = +document.getElementById("optRows").value;
  const c = +document.getElementById("optCols").value;
  const m = +document.getElementById("optMines").value;
  if (m >= r * c) { showToast("⚠️ Trop de bombes !"); return; }
  rows = r; cols = c; mines = m; currentMines = m;
  modal.classList.add("hidden");
  init();
};

/* Gesture profiles */
document.querySelectorAll("input[name='gestures']").forEach(radio => {
  radio.onchange = e => applyGestureProfile(e.target.value);
});
applyGestureProfile(settings.gestures.longPress === "flag" ? "profile2" : "profile1");

/* Leaderboard filters */
document.querySelectorAll(".filter-btn").forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    renderLeaderboard(btn.dataset.filter);
  };
});

document.getElementById("clearLeaderboard").onclick = () => {
  if (confirm("Effacer tout le classement ?")) {
    leaderboard = [];
    saveLeaderboard();
    renderLeaderboard("all");
  }
};

document.getElementById("resetStats").onclick = () => {
  if (confirm("Réinitialiser toutes les statistiques ?")) {
    stats = { gamesPlayed: 0, gamesWon: 0, totalTime: 0, bestTimes: {}, winStreak: 0, bestStreak: 0, lastResults: [] };
    saveStats();
    renderStats();
  }
};

/* ===== PRESETS ===== */
document.querySelectorAll(".preset-btn").forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll(".preset-btn").forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
    startPreset(+btn.dataset.mines);
  };
});

smiley.onclick = () => startPreset(mines);

function startPreset(mineCount) {
  mines = mineCount;
  currentMines = mineCount;
  const DENSITY = 0.2;
  const cells = Math.ceil(mines / DENSITY);
  const side = Math.ceil(Math.sqrt(cells));
  rows = cols = side;
  init();
}

/* ===== INIT ===== */
function init() {
  clearInterval(timer);
  time = 0; flags = 0; firstClick = true; gameOver = false;
  undoStack = []; redoStack = [];
  updateUndoRedoBtns();
  localStorage.removeItem(GAME_KEY); // Effacer toute sauvegarde précédente

  timeCounterEl.textContent  = "000";
  mineCounterEl.textContent  = mines.toString().padStart(3, "0");
  smiley.textContent = "🙂";
  statusMsg.textContent = "Cliquez sur une case pour commencer";

  boardEl.innerHTML = "";
  boardEl.style.gridTemplateColumns = `repeat(${cols}, 28px)`;
  grid = [];

  for (let r = 0; r < rows; r++) {
    grid[r] = [];
    for (let c = 0; c < cols; c++) {
      const cell = {
        isMine: false, revealed: false, flagged: false, count: 0,
        el: document.createElement("div")
      };
      cell.el.className = "cell";
      boardEl.appendChild(cell.el);
      grid[r][c] = cell;
      attachEvents(r, c);
    }
  }
  updateZoom();
  updateSessionInfo();
}

/* ===== UNDO / REDO ===== */
function saveSnapshot() {
  const snap = grid.map(row => row.map(cell => ({
    revealed: cell.revealed,
    flagged: cell.flagged,
    isMine: cell.isMine,
    count: cell.count
  })));
  undoStack.push({ snap, time, flags, firstClick });
  if (undoStack.length > MAX_UNDO) undoStack.shift();
  redoStack = [];
  updateUndoRedoBtns();
}

function doUndo() {
  if (undoStack.length === 0 || gameOver) return;
  // Save current for redo
  const currSnap = grid.map(row => row.map(cell => ({
    revealed: cell.revealed, flagged: cell.flagged, isMine: cell.isMine, count: cell.count
  })));
  redoStack.push({ snap: currSnap, time, flags, firstClick });

  const { snap, time: t, flags: f, firstClick: fc } = undoStack.pop();
  time = t; flags = f; firstClick = fc;
  timeCounterEl.textContent = time.toString().padStart(3, "0");

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const s = snap[r][c];
      const cell = grid[r][c];
      cell.revealed = s.revealed; cell.flagged = s.flagged;
      cell.isMine = s.isMine; cell.count = s.count;
      renderCell(r, c);
    }
  }
  mineCounterEl.textContent = (mines - flags).toString().padStart(3, "0");
  updateUndoRedoBtns();
  showToast("↩ Annulation");
}

function doRedo() {
  if (redoStack.length === 0) return;
  const currSnap = grid.map(row => row.map(cell => ({
    revealed: cell.revealed, flagged: cell.flagged, isMine: cell.isMine, count: cell.count
  })));
  undoStack.push({ snap: currSnap, time, flags, firstClick });

  const { snap, time: t, flags: f, firstClick: fc } = redoStack.pop();
  time = t; flags = f; firstClick = fc;
  timeCounterEl.textContent = time.toString().padStart(3, "0");

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const s = snap[r][c];
      const cell = grid[r][c];
      cell.revealed = s.revealed; cell.flagged = s.flagged;
      cell.isMine = s.isMine; cell.count = s.count;
      renderCell(r, c);
    }
  }
  mineCounterEl.textContent = (mines - flags).toString().padStart(3, "0");
  updateUndoRedoBtns();
  showToast("↪ Rétablissement");
}

function renderCell(r, c) {
  const cell = grid[r][c];
  const el = cell.el;
  el.className = "cell";
  el.textContent = "";

  if (cell.revealed) {
    el.classList.add("revealed");
    if (cell.isMine) {
      el.textContent = "💥";
    } else if (cell.count > 0) {
      el.textContent = cell.count;
      el.classList.add(`n${cell.count}`);
    }
  } else if (cell.flagged) {
    el.textContent = "🚩";
  }
}

function updateUndoRedoBtns() {
  undoBtn.disabled = undoStack.length === 0 || gameOver;
  redoBtn.disabled = redoStack.length === 0;
  undoBtn.textContent = `↩ Undo${undoStack.length ? ` (${undoStack.length})` : ""}`;
}

/* ===== EVENTS ===== */
function attachEvents(r, c) {
  let tapCount = 0, tapTimer = null, longPressTimer = null;
  const el = grid[r][c].el;

  el.addEventListener("mousedown", () => {
    if (grid[r][c].revealed && grid[r][c].count > 0 && !gameOver) {
      neighbors(r, c)
        .filter(([nr, nc]) => !grid[nr][nc].revealed && !grid[nr][nc].flagged)
        .forEach(([nr, nc]) => {
          const fc = neighbors(r, c).filter(([a, b]) => grid[a][b].flagged).length;
          if (fc < grid[r][c].count) grid[nr][nc].el.classList.add("highlighted");
        });
    }
  });

  el.addEventListener("mouseup", clearHighlights);
  el.addEventListener("click", () => handleAction(settings.invertClicks ? "flag" : "reveal", r, c));
  el.addEventListener("contextmenu", e => {
    e.preventDefault();
    handleAction(settings.invertClicks ? "reveal" : "flag", r, c);
  });

  el.addEventListener("touchstart", () => {
    if (settings.gestures.longPress)
      longPressTimer = setTimeout(() => handleAction(settings.gestures.longPress, r, c), 500);
  });

  el.addEventListener("touchend", e => {
    e.preventDefault();
    clearTimeout(longPressTimer);
    tapCount++;
    clearTimeout(tapTimer);
    tapTimer = setTimeout(() => {
      if (tapCount === 1 && settings.gestures.tap) handleAction(settings.gestures.tap, r, c);
      if (tapCount === 2 && settings.gestures.doubleTap) handleAction(settings.gestures.doubleTap, r, c);
      if (tapCount === 3 && settings.gestures.tripleTap) handleAction(settings.gestures.tripleTap, r, c);
      tapCount = 0;
    }, 300);
  });
}

function handleAction(action, r, c) {
  clearHighlights();
  if (flagMode && action !== "chord") {
    const cell = grid[r][c];
    action = (cell && cell.revealed && cell.count > 0) ? "chord" : "flag";
  }
  if (action === "reveal") handleReveal(r, c);
  else if (action === "flag") toggleFlag(r, c);
  else if (action === "chord") chord(r, c);
}

function clearHighlights() {
  document.querySelectorAll(".cell.highlighted").forEach(el => el.classList.remove("highlighted"));
}

/* ===== GAME LOGIC ===== */
function handleReveal(r, c) {
  const cell = grid[r][c];
  if (cell.revealed && cell.count > 0) {
    chord(r, c);
    return;
  }
  if (gameOver || cell.flagged || cell.revealed) return;

  if (firstClick) {
    saveSnapshot(); // save before mines are placed (for undo from start)
    placeMines(r, c);
    timer = setInterval(() => {
      time++;
      timeCounterEl.textContent = Math.min(time, 999).toString().padStart(3, "0");
    }, 1000);
    firstClick = false;
    statusMsg.textContent = `🎯 ${mines} mines — bonne chance !`;
  } else {
    saveSnapshot();
  }

  if (cell.isMine) {
    cell.el.classList.add("losing-mine");
    cell.el.textContent = "💥";
    revealAllMines();
    smiley.textContent = "😵";
    playSound("boom");
    clearInterval(timer);
    gameOver = true;
    updateUndoRedoBtns();
    onLose();
    return;
  }

  reveal(r, c);
  playSound("click");
  checkWin();
}

function reveal(r, c) {
  const cell = grid[r][c];
  if (cell.revealed || cell.flagged) return;
  cell.revealed = true;
  cell.el.classList.add("revealed");
  if (cell.count > 0) {
    cell.el.textContent = cell.count;
    cell.el.classList.add(`n${cell.count}`);
  } else {
    neighbors(r, c).forEach(([nr, nc]) => reveal(nr, nc));
  }
}

function toggleFlag(r, c) {
  const cell = grid[r][c];
  if (cell.revealed || gameOver) return;

  // Premier drapeau : placer les mines maintenant en forçant une mine sur cette case
  if (firstClick) {
    placeMinesWithFlag(r, c);
    timer = setInterval(() => {
      time++;
      timeCounterEl.textContent = Math.min(time, 999).toString().padStart(3, "0");
    }, 1000);
    firstClick = false;
    statusMsg.textContent = `🎯 ${mines} mines — bonne chance !`;
  }

  // Bloquer si toutes les mines sont déjà drapeautées et qu'on essaie d'en ajouter un de plus
  if (!cell.flagged && flags >= mines) {
    showToast("⚠️ Plus de drapeaux disponibles !");
    return;
  }

  saveSnapshot();
  cell.flagged = !cell.flagged;
  cell.el.textContent = cell.flagged ? "🚩" : "";
  if (cell.flagged) cell.el.classList.add("flagged");
  flags += cell.flagged ? 1 : -1;
  mineCounterEl.textContent = (mines - flags).toString().padStart(3, "0");
  playSound("flag");
  setTimeout(() => cell.el.classList.remove("flagged"), 200);
}

function chord(r, c) {
  const cell = grid[r][c];
  if (gameOver || !cell.revealed || cell.count === 0) return;
  const neigh = neighbors(r, c);
  const flagCount = neigh.filter(([nr, nc]) => grid[nr][nc].flagged).length;
  if (flagCount !== cell.count) return;
  saveSnapshot();

  let revealedAny = false;
  let exploded = false;

  neigh.forEach(([nr, nc]) => {
    const ncell = grid[nr][nc];
    if (!ncell.flagged && !ncell.revealed) {
      if (ncell.isMine) {
        ncell.el.classList.add("losing-mine");
        ncell.el.textContent = "💥";
        revealAllMines();
        smiley.textContent = "😵";
        playSound("boom");
        clearInterval(timer);
        gameOver = true;
        updateUndoRedoBtns();
        exploded = true;
      } else {
        reveal(nr, nc);
        revealedAny = true;
      }
    }
  });

  if (exploded) { onLose(); return; }
  if (revealedAny) { playSound("click"); checkWin(); }
}

/* ===== MINES ===== */
function placeMines(exR, exC) {
  let valid = false;
  while (!valid) {
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) { grid[r][c].isMine = false; grid[r][c].count = 0; }

    let placed = 0;
    while (placed < mines) {
      const r = Math.floor(Math.random() * rows);
      const c = Math.floor(Math.random() * cols);
      if (Math.abs(r - exR) <= 2 && Math.abs(c - exC) <= 2) continue;
      if (!grid[r][c].isMine) { grid[r][c].isMine = true; placed++; }
    }

    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        grid[r][c].count = neighbors(r, c).filter(([nr, nc]) => grid[nr][nc].isMine).length;

    if (grid[exR][exC].count === 0) valid = true;
  }
}


// Variante de placeMines pour quand le premier clic est un drapeau :
// la case drapeautée DOIT être une mine, les autres mines sont placées aléatoirement.
function placeMinesWithFlag(flagR, flagC) {
  // Reset
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) { grid[r][c].isMine = false; grid[r][c].count = 0; }

  // Forcer une mine sur la case drapeautée
  grid[flagR][flagC].isMine = true;
  let placed = 1;

  // Placer le reste des mines aléatoirement (sans contrainte de zone safe)
  while (placed < mines) {
    const r = Math.floor(Math.random() * rows);
    const c = Math.floor(Math.random() * cols);
    if (r === flagR && c === flagC) continue;
    if (!grid[r][c].isMine) { grid[r][c].isMine = true; placed++; }
  }

  // Calculer les comptes
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      grid[r][c].count = neighbors(r, c).filter(([nr, nc]) => grid[nr][nc].isMine).length;
}

function neighbors(r, c) {
  const list = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) list.push([nr, nc]);
    }
  return list;
}

function revealAllMines() {
  grid.flat().forEach(cell => {
    if (cell.isMine && !cell.revealed) {
      cell.el.textContent = "💣";
      cell.revealed = true;
      cell.el.classList.add("revealed");
    }
  });
}

/* ===== WIN / LOSE ===== */
function checkWin() {
  let revealedSafe = 0;
  const totalSafe = rows * cols - mines;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (grid[r][c].revealed && !grid[r][c].isMine) revealedSafe++;

  if (revealedSafe === totalSafe) {
    clearInterval(timer);
    smiley.textContent = "😎";
    playSound("win");
    gameOver = true;
    updateUndoRedoBtns();

    // Flag remaining mines
    grid.flat().forEach(cell => {
      if (cell.isMine && !cell.flagged) { cell.el.textContent = "🏁"; }
    });

    // Win animation
    setTimeout(() => {
      grid.flat().filter(cell => !cell.isMine).forEach((cell, i) => {
        setTimeout(() => cell.el.classList.add("win-animate"), i * 2);
      });
    }, 100);

    onWin();
  }
}

function onWin() {
  // Update stats
  stats.gamesPlayed++;
  stats.gamesWon++;
  stats.totalTime += time;
  stats.winStreak++;
  if (stats.winStreak > stats.bestStreak) stats.bestStreak = stats.winStreak;
  const key = String(mines);
  if (!stats.bestTimes[key] || time < stats.bestTimes[key]) stats.bestTimes[key] = time;
  stats.lastResults.unshift({ won: true, mines, time });
  if (stats.lastResults.length > 20) stats.lastResults.pop();
  saveStats();

  // Leaderboard
  leaderboard.push({ mines, time, rows, cols, date: new Date().toLocaleDateString("fr-FR") });
  leaderboard.sort((a, b) => a.time - b.time);
  if (leaderboard.length > 100) leaderboard.pop();
  saveLeaderboard();

  // Win modal
  const isRecord = stats.bestTimes[key] === time && stats.gamesWon > 1;
  const winRate = Math.round((stats.gamesWon / stats.gamesPlayed) * 100);
  document.getElementById("winDetails").innerHTML = `
    <div style="display:flex;flex-direction:column;gap:6px">
      <div>⏱ Temps : <strong>${formatTime(time)}</strong>${isRecord ? " 🏆 RECORD !" : ""}</div>
      <div>💣 Mines : <strong>${mines}</strong> sur ${rows}×${cols}</div>
      <div>🔥 Série : <strong>${stats.winStreak}</strong> victoires consécutives</div>
      <div>📈 Taux de victoire : <strong>${winRate}%</strong></div>
      ${stats.bestTimes[key] ? `<div>🥇 Meilleur temps (${mines} mines) : <strong>${formatTime(stats.bestTimes[key])}</strong></div>` : ""}
    </div>
  `;
  winModal.classList.remove("hidden");
  statusMsg.textContent = `🎉 Gagné en ${formatTime(time)} !`;
}

function onLose() {
  stats.gamesPlayed++;
  stats.winStreak = 0;
  stats.lastResults.unshift({ won: false, mines, time });
  if (stats.lastResults.length > 20) stats.lastResults.pop();
  saveStats();

  const winRate = stats.gamesPlayed > 0 ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100) : 0;
  document.getElementById("loseDetails").innerHTML = `
    <div style="display:flex;flex-direction:column;gap:6px">
      <div>⏱ Survécu : <strong>${formatTime(time)}</strong></div>
      <div>💣 Mines : <strong>${mines}</strong></div>
      <div>📈 Taux de victoire : <strong>${winRate}%</strong></div>
      <div style="margin-top:6px;color:#8a8aaa;font-size:12px">💡 Tip : utilisez <strong>Undo</strong> pour apprendre de vos erreurs !</div>
    </div>
  `;
  loseModal.classList.remove("hidden");
  statusMsg.textContent = "💥 Boom ! Utilisez Undo pour apprendre.";
}

/* ===== EXPORT / IMPORT ===== */
function exportGrid() {
  if (firstClick) { showToast("⚠️ Commencez une partie d'abord !"); return; }

  const data = {
    version: 2,
    rows, cols, mines,
    grid: grid.map(row => row.map(cell => ({
      isMine: cell.isMine,
      revealed: cell.revealed,
      flagged: cell.flagged,
      count: cell.count
    }))),
    time,
    gameOver,
    meta: { date: new Date().toISOString(), author: "breizhimic/demineur" }
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `demineur_${mines}mines_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("✅ Grille exportée !");
}

function importGrid(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.grid || !data.rows || !data.cols) throw new Error("Format invalide");

      rows = data.rows; cols = data.cols; mines = data.mines;
      currentMines = mines;
      time = data.time || 0;
      gameOver = data.gameOver || false;
      firstClick = false;
      flags = 0;

      clearInterval(timer);
      boardEl.innerHTML = "";
      boardEl.style.gridTemplateColumns = `repeat(${cols}, 28px)`;
      grid = [];

      for (let r = 0; r < rows; r++) {
        grid[r] = [];
        for (let c = 0; c < cols; c++) {
          const s = data.grid[r][c];
          const cell = {
            isMine: s.isMine, revealed: s.revealed,
            flagged: s.flagged, count: s.count,
            el: document.createElement("div")
          };
          cell.el.className = "cell";
          if (s.flagged) flags++;
          boardEl.appendChild(cell.el);
          grid[r][c] = cell;
          renderCell(r, c);
          if (!gameOver) attachEvents(r, c);
        }
      }

      mineCounterEl.textContent = (mines - flags).toString().padStart(3, "0");
      timeCounterEl.textContent = time.toString().padStart(3, "0");
      smiley.textContent = gameOver ? "😵" : "🙂";

      if (!gameOver) {
        timer = setInterval(() => {
          time++;
          timeCounterEl.textContent = Math.min(time, 999).toString().padStart(3, "0");
        }, 1000);
      }

      updateZoom();
      undoStack = []; redoStack = [];
      updateUndoRedoBtns();
      showToast(`✅ Grille importée : ${rows}×${cols}, ${mines} mines`);
      statusMsg.textContent = `Grille importée — ${mines} mines`;
    } catch (err) {
      showToast("❌ Fichier invalide : " + err.message);
    }
    importFile.value = "";
  };
  reader.readAsText(file);
}

/* ===== SHARE ===== */
function shareResult() {
  const key = String(mines);
  const best = stats.bestTimes[key];
  const text = `🎉 J'ai gagné au Démineur en ${formatTime(time)} avec ${mines} mines !${best === time ? " 🏆 Nouveau record !" : ""}\n\nEssaie : https://breizhimic.github.io/demineur/`;
  if (navigator.share) {
    navigator.share({ title: "Démineur", text }).catch(() => {});
  } else {
    navigator.clipboard.writeText(text).then(() => showToast("📋 Copié !"));
  }
}

/* ===== STATS RENDERING ===== */
function renderStats() {
  const winRate = stats.gamesPlayed > 0 ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100) : 0;
  const avgTime = stats.gamesWon > 0 ? Math.round(stats.totalTime / stats.gamesWon) : 0;

  let bestTimesHTML = Object.entries(stats.bestTimes)
    .sort((a, b) => +a[0] - +b[0])
    .map(([k, v]) => `<div>🏅 ${k} mines : <strong>${formatTime(v)}</strong></div>`)
    .join("") || "<div style='color:var(--text-muted)'>Aucun record</div>";

  // Mini chart: last 20 results
  const wins   = stats.lastResults.filter(r => r.won).length;
  const losses = stats.lastResults.filter(r => !r.won).length;

  document.getElementById("statsBody").innerHTML = `
    <div class="stats-grid">
      <div class="stat-card">
        <span class="stat-value">${stats.gamesPlayed}</span>
        <div class="stat-label">Parties</div>
      </div>
      <div class="stat-card">
        <span class="stat-value">${winRate}%</span>
        <div class="stat-label">Victoires</div>
      </div>
      <div class="stat-card">
        <span class="stat-value">${stats.bestStreak}</span>
        <div class="stat-label">Meilleure série</div>
      </div>
      <div class="stat-card">
        <span class="stat-value">${avgTime > 0 ? formatTime(avgTime) : "–"}</span>
        <div class="stat-label">Temps moyen</div>
      </div>
    </div>
    <div style="margin-bottom:12px">
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:1px">🏆 Records par nombre de mines</div>
      <div style="background:var(--surface2);border-radius:6px;padding:10px;font-family:var(--font-mono);font-size:13px;display:flex;flex-direction:column;gap:4px">${bestTimesHTML}</div>
    </div>
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:1px">📈 Dernières 20 parties</div>
    <div style="display:flex;gap:4px;height:50px;align-items:flex-end;background:var(--surface2);border-radius:6px;padding:8px">
      ${stats.lastResults.map(r => `
        <div style="flex:1;background:${r.won ? '#44cc66' : '#e94560'};border-radius:2px 2px 0 0;min-height:4px;height:${r.won ? '100%' : '40%'};title='${r.won ? "✓" : "✗"} ${r.mines}m ${formatTime(r.time)}'"></div>
      `).join("") || "<div style='color:var(--text-muted);font-size:12px'>Pas encore de parties</div>"}
    </div>
    <div style="display:flex;gap:16px;margin-top:6px;font-size:11px;color:var(--text-muted)">
      <span style="display:flex;align-items:center;gap:4px"><span style="display:inline-block;width:10px;height:10px;background:#44cc66;border-radius:2px"></span> Victoires (${wins})</span>
      <span style="display:flex;align-items:center;gap:4px"><span style="display:inline-block;width:10px;height:10px;background:#e94560;border-radius:2px"></span> Défaites (${losses})</span>
    </div>
  `;
}

/* ===== LEADERBOARD RENDERING ===== */
function renderLeaderboard(filter) {
  let entries = leaderboard;
  if (filter !== "all") entries = leaderboard.filter(e => String(e.mines) === filter);

  if (entries.length === 0) {
    document.getElementById("leaderboardBody").innerHTML =
      `<div style="text-align:center;padding:20px;color:var(--text-muted)">Aucun score — gagnez une partie !</div>`;
    return;
  }

  const medals = ["🥇", "🥈", "🥉"];
  const rows = entries.slice(0, 20).map((e, i) => `
    <tr>
      <td><span class="rank-medal">${medals[i] || (i+1)}</span></td>
      <td><strong>${formatTime(e.time)}</strong></td>
      <td>${e.mines} 💣</td>
      <td>${e.rows}×${e.cols}</td>
      <td>${e.date}</td>
    </tr>
  `).join("");

  document.getElementById("leaderboardBody").innerHTML = `
    <table>
      <thead><tr><th>#</th><th>Temps</th><th>Mines</th><th>Grille</th><th>Date</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

/* ===== SESSION INFO ===== */
function updateSessionInfo() {
  const winRate = stats.gamesPlayed > 0 ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100) : 0;
  sessionInfo.textContent = `${stats.gamesPlayed} parties · ${winRate}% · série: ${stats.winStreak}`;
}

/* ===== TOAST ===== */
let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById("undoToast");
  el.textContent = msg;
  el.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add("hidden"), 2500);
}

/* ===== HELPERS ===== */
function formatTime(s) {
  if (s < 60) return `${s}s`;
  return `${Math.floor(s/60)}m${(s%60).toString().padStart(2,"0")}s`;
}

/* ===== PERSISTENCE ===== */
function saveSettings()    { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); }
function saveStats()       { localStorage.setItem(STATS_KEY, JSON.stringify(stats)); }
function saveLeaderboard() { localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(leaderboard)); }

function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!s) return;
    Object.assign(settings.sound, s.sound || {});
    Object.assign(settings.gestures, s.gestures || {});
    if (typeof s.invertClicks === "boolean") settings.invertClicks = s.invertClicks;
    if (s.theme) settings.theme = s.theme;
  } catch(e) {}
}

function loadStats() {
  try {
    const s = JSON.parse(localStorage.getItem(STATS_KEY));
    if (s) Object.assign(stats, s);
  } catch(e) {}
}

function loadLeaderboard() {
  try {
    const s = JSON.parse(localStorage.getItem(LEADERBOARD_KEY));
    if (Array.isArray(s)) leaderboard = s;
  } catch(e) {}
}

/* ===== GAME STATE PERSISTENCE ===== */
function saveGame() {
  // Ne sauvegarder que si la partie est en cours (pas avant le 1er clic, pas après game over)
  if (firstClick || gameOver) {
    localStorage.removeItem(GAME_KEY);
    return;
  }
  const data = {
    rows, cols, mines, time, flags,
    grid: grid.map(row => row.map(cell => ({
      isMine: cell.isMine,
      revealed: cell.revealed,
      flagged: cell.flagged,
      count: cell.count
    })))
  };
  localStorage.setItem(GAME_KEY, JSON.stringify(data));
}

function loadGame() {
  try {
    const raw = localStorage.getItem(GAME_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data.grid || !data.rows || !data.cols) return false;

    rows = data.rows; cols = data.cols; mines = data.mines;
    currentMines = mines;
    time = data.time || 0;
    flags = data.flags || 0;
    firstClick = false;
    gameOver = false;

    clearInterval(timer);
    boardEl.innerHTML = "";
    boardEl.style.gridTemplateColumns = `repeat(${cols}, 28px)`;
    grid = [];

    for (let r = 0; r < rows; r++) {
      grid[r] = [];
      for (let c = 0; c < cols; c++) {
        const s = data.grid[r][c];
        const cell = {
          isMine: s.isMine, revealed: s.revealed,
          flagged: s.flagged, count: s.count,
          el: document.createElement("div")
        };
        cell.el.className = "cell";
        boardEl.appendChild(cell.el);
        grid[r][c] = cell;
        renderCell(r, c);
        attachEvents(r, c);
      }
    }

    mineCounterEl.textContent = (mines - flags).toString().padStart(3, "0");
    timeCounterEl.textContent = time.toString().padStart(3, "0");
    smiley.textContent = "🙂";
    statusMsg.textContent = `↩ Partie restaurée — ${mines} mines`;

    // Relancer le chrono
    timer = setInterval(() => {
      time++;
      timeCounterEl.textContent = Math.min(time, 999).toString().padStart(3, "0");
    }, 1000);

    updateZoom();
    undoStack = []; redoStack = [];
    updateUndoRedoBtns();
    updateSessionInfo();
    showToast("↩ Partie précédente restaurée !");
    return true;
  } catch(e) {
    localStorage.removeItem(GAME_KEY);
    return false;
  }
}

// Sauvegarder la partie quand l'utilisateur quitte la page
window.addEventListener("beforeunload", saveGame);

function applyGestureProfile(profile) {
  if (profile === "profile1") {
    settings.gestures = { tap: "reveal", doubleTap: "flag", tripleTap: "chord", longPress: null };
  } else {
    settings.gestures = { tap: "reveal", doubleTap: "chord", tripleTap: null, longPress: "flag" };
  }
  document.querySelectorAll("input[name='gestures']").forEach(r => {
    r.checked = r.value === profile;
  });
  saveSettings();
}

/* ===== START ===== */
// Tenter de restaurer la partie en cours, sinon lancer un preset par défaut
if (!loadGame()) {
  document.querySelector(".preset-btn[data-mines='50']")?.classList.add("selected");
  startPreset(50);
}
