/***********************
* CONFIG & SETTINGS
***********************/
const STORAGE_KEY = "demineurSettings"

const settings = {
sound: {
enabled: true,
volume: 0.5
},
gestures: {
tap: "reveal",
doubleTap: "flag",
tripleTap: "chord",
longPress: null
},
// Inverse les actions clique gauche / clic droit
invertClicks: false
};

loadSettings();

/***********************
* DOM ELEMENTS
***********************/
const boardEl = document.getElementById("board");
const mineCounterEl = document.getElementById("mineCounter");
const timeCounterEl = document.getElementById("timeCounter");
const smiley = document.getElementById("smiley");

const modal = document.getElementById("optionsModal");
const openOptionsBtn = document.getElementById("openOptions");
const closeOptionsBtn = document.getElementById("closeOptions");

const winModal = document.getElementById("winModal");
const closeWinBtn = document.getElementById("closeWin");

const zoomInBtn = document.getElementById("zoomIn");
const zoomOutBtn = document.getElementById("zoomOut");
const invertClickBtn = document.getElementById("invertClick");

/***********************
* SMILEY MOUSE EVENTS
***********************/
document.addEventListener("mousedown", (e) => {
    if (e.button === 0 && e.target.closest("#board") && !gameOver) {
        smiley.textContent = "😮";
    }
});

document.addEventListener("mouseup", (e) => {
    if (e.button === 0 && !gameOver) {
        smiley.textContent = "🙂";
    }
});

/***********************
* GAME STATE
***********************/
let zoom = 1;
let grid = [];
let rows = 16, cols = 16, mines = 40;
let flags = 0;
let firstClick = true;
let timer = null;
let time = 0;
let gameOver = false; // added flag to prevent actions after end

const DENSITY = 0.2;

/***********************
* SOUNDS (optionnels)
***********************/
const sounds = {
click: new Audio("sounds/click.wav"),
flag: new Audio("sounds/flag.wav"),
boom: new Audio("sounds/bomb.wav"),    // fichier s'appelle bomb.wav dans le dossier
win: new Audio("sounds/win.wav")
};

function playSound(name) {
if (!settings.sound.enabled || !sounds[name]) return;
sounds[name].volume = settings.sound.volume;
sounds[name].currentTime = 0;
sounds[name].play();
}

/***********************
* OPTIONS MENU
***********************/
openOptionsBtn.onclick = () => modal.classList.remove("hidden");
closeOptionsBtn.onclick = () => modal.classList.add("hidden");

closeWinBtn.onclick = () => winModal.classList.add("hidden");

document.getElementById("soundEnabled").checked = settings.sound.enabled;
document.getElementById("soundVolume").value = settings.sound.volume * 100;

document.getElementById("soundEnabled").onchange = e => {
settings.sound.enabled = e.target.checked;
saveSettings();
};

document.getElementById("soundVolume").oninput = e => {
settings.sound.volume = e.target.value / 100;
saveSettings();
};

document.getElementById("startCustom").onclick = () => {
const r = +document.getElementById("optRows").value;
const c = +document.getElementById("optCols").value;
const m = +document.getElementById("optMines").value;

if (m >= r * c) {
alert("Trop de bombes pour cette grille.");
return;
}

rows = r;
cols = c;
mines = m;
modal.classList.add("hidden");
init();
};

document.querySelectorAll("input[name='gestures']").forEach(radio => {
radio.onchange = e => applyGestureProfile(e.target.value);
});

applyGestureProfile(
settings.gestures.longPress === "flag" ? "profile2" : "profile1"
);

zoomInBtn.onclick = () => {
  zoom = Math.min(zoom + 0.1, 3);
  updateZoom();
};

zoomOutBtn.onclick = () => {
  zoom = Math.max(zoom - 0.1, 0.3);
  updateZoom();
};

function updateZoom() {
  boardEl.style.transform = `scale(${zoom})`;
  boardEl.style.transformOrigin = "top left";
}

function updateInvertClickButton() {
  invertClickBtn.textContent = settings.invertClicks ? "🔁" : "⇄";
  invertClickBtn.title = settings.invertClicks
    ? "Clic gauche = drapeau, clic droit = révéler"
    : "Clic gauche = révéler, clic droit = drapeau";
}

invertClickBtn.onclick = () => {
  settings.invertClicks = !settings.invertClicks;
  updateInvertClickButton();
  saveSettings();
};

updateInvertClickButton();


/***********************
* PRESETS
***********************/
document.querySelectorAll("#presets button").forEach(btn => {
btn.onclick = () => startPreset(+btn.dataset.mines);
});

smiley.onclick = () => startPreset(mines);

function startPreset(mineCount) {
mines = mineCount;
const cells = Math.ceil(mines / DENSITY);
const side = Math.ceil(Math.sqrt(cells));
rows = cols = side;
init();
}

/***********************
* GAME INIT
***********************/
function init() {
clearInterval(timer);
time = 0;
flags = 0;
firstClick = true;
gameOver = false; // allow new interactions

timeCounterEl.textContent = "000"
mineCounterEl.textContent = mines.toString().padStart(3, "0");
smiley.textContent = "🙂"

boardEl.innerHTML = ""
boardEl.style.gridTemplateColumns = `repeat(${cols}, 28px)`;

grid = [];

for (let r = 0; r < rows; r++) {
grid[r] = [];
for (let c = 0; c < cols; c++) {
const cell = {
isMine: false,
revealed: false,
flagged: false,
count: 0,
el: document.createElement("div")
};

cell.el.className = "cell"
boardEl.appendChild(cell.el);
grid[r][c] = cell;

attachEvents(r, c);
}
}
updateZoom();
}

/***********************
* EVENTS & GESTURES
***********************/
function attachEvents(r, c) {
let tapCount = 0;
let tapTimer = null;
let longPressTimer = null;

const el = grid[r][c].el;

el.addEventListener("mousedown", () => {
    if (grid[r][c].revealed && grid[r][c].count > 0) {
        const neigh = neighbors(r, c);
        const flagCount = neigh.filter(([nr, nc]) => grid[nr][nc].flagged).length;
        if (flagCount < grid[r][c].count) {
            const unrevealedUnflagged = neigh.filter(([nr, nc]) => !grid[nr][nc].revealed && !grid[nr][nc].flagged);
            unrevealedUnflagged.forEach(([nr, nc]) => grid[nr][nc].el.classList.add('highlighted'));
        }
    }
});

el.addEventListener("mouseup", () => {
    clearHighlights();
});

el.addEventListener("click", () => handleAction(settings.invertClicks ? "flag" : "reveal", r, c));

el.addEventListener("contextmenu", e => {
  e.preventDefault();
  handleAction(settings.invertClicks ? "reveal" : "flag", r, c);
});

el.addEventListener("touchstart", () => {
if (settings.gestures.longPress) {
longPressTimer = setTimeout(() => {
handleAction(settings.gestures.longPress, r, c);
}, 500);
}
});

el.addEventListener("touchend", e => {
e.preventDefault();
clearTimeout(longPressTimer);

tapCount++;
clearTimeout(tapTimer);

tapTimer = setTimeout(() => {
if (tapCount === 1 && settings.gestures.tap)
handleAction(settings.gestures.tap, r, c);
if (tapCount === 2 && settings.gestures.doubleTap)
handleAction(settings.gestures.doubleTap, r, c);
if (tapCount === 3 && settings.gestures.tripleTap)
handleAction(settings.gestures.tripleTap, r, c);
tapCount = 0;
}, 300);
});
}

function handleAction(action, r, c) {
clearHighlights();
if (action === "reveal") handleReveal(r, c);
if (action === "flag") toggleFlag(r, c);
if (action === "chord") chord(r, c);
}

function clearHighlights() {
document.querySelectorAll('.cell.highlighted').forEach(el => el.classList.remove('highlighted'));
}

function handleReveal(r, c) {
    const cell = grid[r][c];

    // 👉 Clic sur un nombre déjà révélé = chord
    if (cell.revealed && cell.count > 0) {
        const neigh = neighbors(r, c);
        const flagCount = neigh.filter(([nr, nc]) => grid[nr][nc].flagged).length;

        // Règle officielle : chord seulement si nb de drapeaux = chiffre
        if (flagCount !== cell.count) return;

        let revealedAny = false;

        neigh.forEach(([nr, nc]) => {
            const ncell = grid[nr][nc];

            if (!ncell.flagged && !ncell.revealed) {

                // 💥 Bombe non drapeautée → explosion
                if (ncell.isMine) {
                    // Mark all mines around the number as losing-mine
                    neigh.forEach(([nnr, nnc]) => {
                        if (grid[nnr][nnc].isMine) {
                            grid[nnr][nnc].el.classList.add("losing-mine");
                        }
                    });
                    ncell.revealed = true;
                    ncell.el.classList.add("revealed");
                    ncell.el.classList.add("losing-mine");

                    revealAllMines();
                    smiley.textContent = "😵";
                    playSound("boom");
                    clearInterval(timer);
                    gameOver = true;
                    return;
                }

                // 👉 Case sûre
                reveal(nr, nc);
                revealedAny = true;
            }
        });

        if (!gameOver && revealedAny) playSound("click");
        if (!gameOver) checkWin();
        return;
    }

    // 👉 Le reste de handleReveal reste inchangé
    if (gameOver || cell.flagged || cell.revealed) return;

    if (firstClick) {
        placeMines(r, c);
        timer = setInterval(() => {
            time++;
            timeCounterEl.textContent = time.toString().padStart(3, "0");
        }, 1000);
        firstClick = false;
    }

    if (cell.isMine) {
        cell.el.classList.add("losing-mine");
        revealAllMines();
        smiley.textContent = "😵";
        playSound("boom");
        clearInterval(timer);
        gameOver = true;
        return;
    }

    reveal(r, c);
    playSound("click");
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

    checkWin(); // 👉 AJOUT ICI
}

function toggleFlag(r, c) {
const cell = grid[r][c];
if (cell.revealed) return;

cell.flagged = !cell.flagged;
cell.el.textContent = cell.flagged ? "🚩" : ""
flags += cell.flagged ? 1 : -1;
mineCounterEl.textContent = (mines - flags).toString().padStart(3, "0");
playSound("flag");
}

function chord(r, c) {
    const cell = grid[r][c];
    if (gameOver || !cell.revealed || cell.count === 0) return;

    const neigh = neighbors(r, c);
    const flagCount = neigh.filter(([nr, nc]) => grid[nr][nc].flagged).length;

    // Règle officielle : chord seulement si nb de drapeaux = chiffre
    if (flagCount !== cell.count) return;

    let revealedAny = false;

    neigh.forEach(([nr, nc]) => {
        const ncell = grid[nr][nc];

        if (!ncell.flagged && !ncell.revealed) {

            // 💥 Bombe non drapeautée → explosion
            if (ncell.isMine) {
                // Mark all mines around the number as losing-mine
                neigh.forEach(([nnr, nnc]) => {
                    if (grid[nnr][nnc].isMine) {
                        grid[nnr][nnc].el.classList.add("losing-mine");
                    }
                });
                ncell.revealed = true;
                ncell.el.classList.add("revealed");
                ncell.el.classList.add("losing-mine");

                revealAllMines();
                smiley.textContent = "😵";
                playSound("boom");
                clearInterval(timer);
                gameOver = true;
                return;
            }

            // 👉 Case sûre
            reveal(nr, nc);
            revealedAny = true;
        }
    });

    if (!gameOver && revealedAny) playSound("click");
    if (!gameOver) checkWin();
}

/***********************
* MINES & HELPERS
***********************/
function checkWin() {
    let revealedSafe = 0;
    const totalSafe = rows * cols - mines;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const cell = grid[r][c];
            if (cell.revealed && !cell.isMine) {
                revealedSafe++;
            }
        }
    }

    if (revealedSafe === totalSafe) {
        clearInterval(timer);
        smiley.textContent = "😎";
        playSound("win");
        winModal.classList.remove("hidden");
        gameOver = true;
    }
}

function placeMines(exR, exC) {
    let valid = false;

    while (!valid) {

        // 1. Reset
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                grid[r][c].isMine = false;
                grid[r][c].count = 0;
            }
        }

        // 2. Placer les mines en évitant une zone 5×5 autour du clic
        let placed = 0;
        while (placed < mines) {
            const r = Math.floor(Math.random() * rows);
            const c = Math.floor(Math.random() * cols);

            // Zone interdite : carré 5×5 centré sur le clic
            if (Math.abs(r - exR) <= 2 && Math.abs(c - exC) <= 2) continue;

            if (!grid[r][c].isMine) {
                grid[r][c].isMine = true;
                placed++;
            }
        }

        // 3. Calculer les nombres
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                grid[r][c].count = neighbors(r, c)
                    .filter(([nr, nc]) => grid[nr][nc].isMine).length;
            }
        }

        // 4. Vérifier que la case cliquée est bien un 0
        if (grid[exR][exC].count === 0) {
            valid = true;
        }
    }
}

function neighbors(r, c) {
const list = [];
for (let dr = -1; dr <= 1; dr++) {
for (let dc = -1; dc <= 1; dc++) {
if (!dr && !dc) continue;
const nr = r + dr, nc = c + dc;
if (nr >= 0 && nr < rows && nc >= 0 && nc < cols)
list.push([nr, nc]);
}
}
return list;
}

function revealAllMines() {
grid.flat().forEach(cell => {
if (cell.isMine) cell.el.textContent = "💣"
});
}

/***********************
* SETTINGS PERSISTENCE
***********************/
function saveSettings() {
localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function loadSettings() {
const saved = localStorage.getItem(STORAGE_KEY);
if (!saved) return;
const parsed = JSON.parse(saved);
Object.assign(settings.sound, parsed.sound);
Object.assign(settings.gestures, parsed.gestures);
if (typeof parsed.invertClicks === "boolean") settings.invertClicks = parsed.invertClicks;
}

function applyGestureProfile(profile) {
if (profile === "profile1") {
settings.gestures = {
tap: "reveal",
doubleTap: "flag",
tripleTap: "chord",
longPress: null
};
} else {
settings.gestures = {
tap: "reveal",
doubleTap: "chord",
tripleTap: null,
longPress: "flag"
};
}
saveSettings();
}

/***********************
* START GAME
***********************/
init();