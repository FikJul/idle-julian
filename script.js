/* ================================================================
   IDLE JULIAN — Fantasy RPG Village
   script.js
   ================================================================ */

'use strict';

// ================================================================
// ── CONFIGURATION ───────────────────────────────────────────────
// ================================================================

/**
 * Release / baseline date for the Global Day counter.
 * DAY 1 = 2026-05-18. Each real-world calendar day increments the
 * counter by 1. The value never resets on refresh or re-deploy.
 */
const RELEASE_DATE = new Date('2026-05-18T00:00:00Z');

/** Size of the game world (matches CSS) */
const WORLD_W = 800;
const WORLD_H = 600;
const SKY_HEIGHT = WORLD_H * 0.7;
// Keep characters below HUD/cloud decorations and above the 70/30 ground split.
const CHARACTER_TOP_MARGIN = 110;
const CHARACTER_BOTTOM_MARGIN = 70;
const CHARACTER_Y_MIN = CHARACTER_TOP_MARGIN;
const CHARACTER_Y_MAX = SKY_HEIGHT - CHARACTER_BOTTOM_MARGIN;

/** Maximum number of characters allowed simultaneously */
const MAX_CHARACTERS = 14;

/** How many log entries to keep visible */
const MAX_LOG = 8;

// ================================================================
// ── MAP DATA ────────────────────────────────────────────────────
// Add a new map by pushing an object into this array.
// ================================================================

/**
 * @typedef {Object} MapDef
 * @property {string}   id           - Unique identifier (used as CSS class suffix)
 * @property {string}   name         - Display name (Bahasa Indonesia)
 * @property {string}   subtitle     - English subtitle
 * @property {string[]} allowedTypes - Character type keys that may exist here
 * @property {Array<{emoji:string, x:number, y:number, size?:number}>} decorations
 */

/** @type {MapDef[]} */
const MAPS = [
  {
    id: 'alun-alun',
    name: 'Alun-Alun Desa',
    subtitle: 'Village Square',
    allowedTypes: ['warga', 'ksatria', 'kucing'],
    decorations: [
      { emoji: '🌳', x: 4,  y: 38, size: 44 },
      { emoji: '🌳', x: 84, y: 36, size: 44 },
      { emoji: '🏠', x: 38, y: 6,  size: 48 },
      { emoji: '🏠', x: 55, y: 6,  size: 40 },
      { emoji: '⛲', x: 47, y: 42, size: 40 },
      { emoji: '🌾', x: 12, y: 66, size: 28 },
      { emoji: '🌾', x: 22, y: 68, size: 24 },
      { emoji: '🌾', x: 70, y: 67, size: 28 },
      { emoji: '🛤️', x: 44, y: 55, size: 52 },
      { emoji: '☁️', x: 10, y: 5,  size: 36 },
      { emoji: '☁️', x: 65, y: 3,  size: 28 },
    ],
  },
  {
    id: 'kedai-minum',
    name: 'Kedai Minum',
    subtitle: 'The Tavern',
    allowedTypes: ['warga', 'kucing'],
    decorations: [
      { emoji: '🍺', x: 8,  y: 12, size: 36 },
      { emoji: '🍻', x: 78, y: 10, size: 36 },
      { emoji: '🪑', x: 20, y: 55, size: 34 },
      { emoji: '🪑', x: 55, y: 55, size: 34 },
      { emoji: '🪑', x: 35, y: 55, size: 34 },
      { emoji: '🕯️', x: 50, y: 8,  size: 30 },
      { emoji: '🕯️', x: 15, y: 8,  size: 30 },
      { emoji: '🛢️', x: 3,  y: 65, size: 34 },
      { emoji: '🛢️', x: 90, y: 62, size: 34 },
      { emoji: '🪵', x: 85, y: 68, size: 32 },
      { emoji: '🎶', x: 72, y: 22, size: 28 },
    ],
  },
  {
    id: 'pinggiran-hutan',
    name: 'Pinggiran Hutan',
    subtitle: 'The Outskirts',
    allowedTypes: ['warga', 'slime', 'kucing'],
    decorations: [
      { emoji: '🌲', x: 3,  y: 25, size: 52 },
      { emoji: '🌲', x: 12, y: 30, size: 44 },
      { emoji: '🌲', x: 74, y: 22, size: 52 },
      { emoji: '🌲', x: 86, y: 30, size: 44 },
      { emoji: '🌿', x: 30, y: 66, size: 28 },
      { emoji: '🍄', x: 42, y: 65, size: 28 },
      { emoji: '🍄', x: 60, y: 68, size: 24 },
      { emoji: '🪨', x: 55, y: 63, size: 32 },
      { emoji: '🦇', x: 47, y: 6,  size: 28 },
      { emoji: '🌕', x: 82, y: 4,  size: 36 },
      { emoji: '⭐', x: 18, y: 8,  size: 22 },
      { emoji: '⭐', x: 60, y: 5,  size: 18 },
    ],
  },
];

// ================================================================
// ── CHARACTER TYPE DATA ─────────────────────────────────────────
// Add a new character type by adding a key here.
// ================================================================

/**
 * @typedef {Object} CharTypeDef
 * @property {string}  label        - Display name
 * @property {string}  emoji        - Sprite emoji
 * @property {string}  behavior     - 'wanderer'|'patroller'|'bouncer'|'sprinter'
 * @property {number}  speed        - Pixels per frame (at 60 fps)
 * @property {number}  [idleMin]    - Minimum idle time (ms)
 * @property {number}  [idleMax]    - Maximum idle time (ms)
 * @property {number}  [patrolLen]  - Patrol range in pixels
 * @property {number}  [sitMin]     - Minimum sit time before sprinting (ms)
 * @property {number}  [sitMax]     - Maximum sit time before sprinting (ms)
 */

/** @type {Object.<string, CharTypeDef>} */
const CHAR_TYPES = {
  warga: {
    label:    'Warga',
    emoji:    '🧑',
    behavior: 'wanderer',
    speed:    0.9,
    idleMin:  2000,
    idleMax:  4500,
  },
  ksatria: {
    label:     'Ksatria',
    emoji:     '⚔️',
    behavior:  'patroller',
    speed:     1.4,
    patrolLen: 220,
  },
  slime: {
    label:    'Slime',
    emoji:    '🟢',
    behavior: 'bouncer',
    speed:    1.1,
    idleMin:  600,
    idleMax:  1800,
  },
  kucing: {
    label:   'Kucing',
    emoji:   '🐱',
    behavior:'sprinter',
    speed:   6.5,
    sitMin:  5000,
    sitMax:  11000,
  },
};

// ================================================================
// ── GAME STATE ──────────────────────────────────────────────────
// ================================================================

/** @type {MapDef} Currently active map */
let currentMap = MAPS[0];

/**
 * @typedef {Object} CharState
 * @property {number}      id
 * @property {string}      type
 * @property {CharTypeDef} typeDef
 * @property {HTMLElement} el
 * @property {number}      x          - Current X (left edge of element)
 * @property {number}      y          - Current Y (top  edge of element)
 * @property {number}      targetX
 * @property {number}      targetY
 * @property {string}      state      - Behaviour state machine value
 * @property {number}      timer      - Countdown in ms
 * @property {number}      direction  - +1 / -1 for patroller
 * @property {{x:number,y:number}|null} patrolA
 * @property {{x:number,y:number}|null} patrolB
 */

/** @type {CharState[]} */
let characters = [];

/** Auto-increment ID for each spawned character */
let charIdCounter = 0;

/** Log history (newest first) */
let logEntries = [];

/** Game-loop timing */
let lastTimestamp = 0;

// ================================================================
// ── DOM REFERENCES ──────────────────────────────────────────────
// ================================================================

const gameBox        = document.getElementById('game-box');
const mapDecoEl      = document.getElementById('map-decorations');
const mapNameEl      = document.getElementById('map-name');
const dayCounterEl   = document.getElementById('day-counter');
const populationEl   = document.getElementById('population');
const charContainer  = document.getElementById('character-container');
const logMessagesEl  = document.getElementById('log-messages');
const mapButtonsEl   = document.getElementById('map-buttons');
const spawnButtonsEl = document.getElementById('spawn-buttons');
const clearBtn       = document.getElementById('clear-btn');

// ================================================================
// ── DAY COUNTER ─────────────────────────────────────────────────
// ================================================================

/**
 * Calculate the Global Day number.
 * Day 1 is the release date. Each subsequent calendar day increments by 1.
 * The value only depends on real-world time, so it never resets.
 *
 * @returns {number}
 */
function calculateGlobalDay() {
  const nowUtc     = Date.UTC(
    new Date().getUTCFullYear(),
    new Date().getUTCMonth(),
    new Date().getUTCDate()
  );
  const baseUtc    = Date.UTC(2026, 4, 18); // month is 0-indexed → May = 4
  const msPerDay   = 86_400_000;
  const diffDays   = Math.floor((nowUtc - baseUtc) / msPerDay);
  return Math.max(1, diffDays + 1);
}

/** Write the current day to the HUD. */
function updateDayDisplay() {
  dayCounterEl.textContent = `DAY ${calculateGlobalDay()}`;
}

// ================================================================
// ── LOG SYSTEM ──────────────────────────────────────────────────
// ================================================================

/**
 * Append a message to the live event log.
 * @param {string} msg
 */
function addLog(msg) {
  const hh = String(new Date().getHours()).padStart(2, '0');
  const mm = String(new Date().getMinutes()).padStart(2, '0');
  const ss = String(new Date().getSeconds()).padStart(2, '0');
  logEntries.unshift(`[${hh}:${mm}:${ss}] ${msg}`);
  if (logEntries.length > MAX_LOG) logEntries.length = MAX_LOG;
  renderLog();
}

/** Re-render the log DOM. */
function renderLog() {
  logMessagesEl.innerHTML = '';
  logEntries.forEach((text, i) => {
    const div = document.createElement('div');
    div.className =
      'log-entry' +
      (i === 0 ? ' fresh' : '') +
      (i >= 4   ? ' older' : i >= 2 ? ' old' : '');
    div.textContent = text;
    logMessagesEl.appendChild(div);
  });
}

// ================================================================
// ── MAP MANAGEMENT ──────────────────────────────────────────────
// ================================================================

/** Rebuild the decoration emoji elements for the active map. */
function renderMapDecorations() {
  mapDecoEl.innerHTML = '';
  currentMap.decorations.forEach(deco => {
    const el = document.createElement('div');
    el.className = 'map-deco';
    el.textContent = deco.emoji;
    el.style.left   = deco.x + '%';
    el.style.top    = deco.y + '%';
    if (deco.size) el.style.fontSize = deco.size + 'px';
    mapDecoEl.appendChild(el);
  });
}

/**
 * Switch the active map.
 * Characters whose type is not allowed in the new map are removed.
 *
 * @param {MapDef} map
 */
function switchMap(map) {
  currentMap = map;

  // Swap background CSS class
  gameBox.className = `map-${map.id}`;

  // HUD
  mapNameEl.textContent = `📍 ${map.name}`;

  // Remove characters not permitted on this map
  characters = characters.filter(char => {
    if (!map.allowedTypes.includes(char.type)) {
      char.el.remove();
      return false;
    }
    return true;
  });

  renderMapDecorations();
  renderSpawnButtons();
  updateMapButtonStates();
  updatePopulationDisplay();

  addLog(`✦ Pindah ke ${map.name} (${map.subtitle})`);
}

// ================================================================
// ── CHARACTER FACTORY ───────────────────────────────────────────
// ================================================================

/**
 * Create a new character DOM element and state object.
 *
 * @param {string} type - Key from CHAR_TYPES
 * @returns {CharState|null}
 */
function createCharacter(type) {
  const typeDef = CHAR_TYPES[type];
  if (!typeDef) return null;

  const id = ++charIdCounter;

  // Random starting position (keep away from edges)
  const x = 60 + Math.random() * (WORLD_W - 160);
  const y = CHARACTER_Y_MIN + Math.random() * (CHARACTER_Y_MAX - CHARACTER_Y_MIN);

  // Build DOM element
  const el = document.createElement('div');
  el.className = `character char-${type}`;
  el.dataset.charId = String(id);

  const spriteEl = document.createElement('div');
  spriteEl.className = 'char-sprite';
  spriteEl.textContent = typeDef.emoji;

  const labelEl = document.createElement('div');
  labelEl.className = 'char-label';
  labelEl.textContent = typeDef.label;

  el.appendChild(spriteEl);
  el.appendChild(labelEl);
  el.style.left = x + 'px';
  el.style.top  = y + 'px';
  charContainer.appendChild(el);

  /** @type {CharState} */
  const char = {
    id,
    type,
    typeDef,
    el,
    x,
    y,
    targetX:    x,
    targetY:    y,
    state:      'idle',
    timer:      0,
    direction:  1,
    patrolA:    null,
    patrolB:    null,
  };

  initBehavior(char);
  return char;
}

/**
 * Set up initial behaviour-specific state.
 * @param {CharState} char
 */
function initBehavior(char) {
  switch (char.typeDef.behavior) {
    case 'wanderer':
      pickWanderTarget(char);
      break;

    case 'patroller':
      setupPatrol(char);
      break;

    case 'bouncer':
      pickWanderTarget(char);
      break;

    case 'sprinter':
      char.state = 'sitting';
      char.timer = randomBetween(char.typeDef.sitMin, char.typeDef.sitMax);
      break;
  }
}

// ================================================================
// ── BEHAVIOUR HELPERS ───────────────────────────────────────────
// ================================================================

/** @param {CharState} char */
function pickWanderTarget(char) {
  char.targetX = 50 + Math.random() * (WORLD_W - 140);
  // Keep vertical lane fixed: movement is left/right only.
  char.targetY = char.y;
  char.state   = 'moving';
}

/** Set up a horizontal patrol corridor. @param {CharState} char */
function setupPatrol(char) {
  const half = char.typeDef.patrolLen / 2;
  char.patrolA = { x: Math.max(50,          char.x - half), y: char.y };
  char.patrolB = { x: Math.min(WORLD_W - 50, char.x + half), y: char.y };

  char.targetX = char.patrolB.x;
  char.targetY = char.patrolB.y;
  char.state   = 'patrolling';
}

/** @param {number} min @param {number} max @returns {number} */
function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

// ================================================================
// ── CHARACTER UPDATE (called every frame) ───────────────────────
// ================================================================

/**
 * Advance all characters by deltaTime milliseconds.
 * @param {number} deltaTime
 */
function updateCharacters(deltaTime) {
  characters.forEach(char => {
    updateCharacter(char, deltaTime);
    // Write position back to DOM
    char.el.style.left = char.x + 'px';
    char.el.style.top  = char.y + 'px';
  });
}

/** @param {CharState} char @param {number} dt */
function updateCharacter(char, dt) {
  switch (char.typeDef.behavior) {
    case 'wanderer':  updateWanderer(char, dt);  break;
    case 'patroller': updatePatroller(char);      break;
    case 'bouncer':   updateBouncer(char, dt);   break;
    case 'sprinter':  updateSprinter(char, dt);  break;
  }
}

// ── Wanderer ─────────────────────────────────────────────────────
/** @param {CharState} char @param {number} dt */
function updateWanderer(char, dt) {
  if (char.state === 'idle') {
    char.timer -= dt;
    if (char.timer <= 0) {
      pickWanderTarget(char);
      addLog(`🚶 ${char.typeDef.label} #${char.id} mulai berjalan`);
    }
    return;
  }
  if (char.state === 'moving') {
    if (moveTowards(char, char.typeDef.speed)) {
      char.state = 'idle';
      char.timer = randomBetween(char.typeDef.idleMin, char.typeDef.idleMax);
      addLog(`💤 ${char.typeDef.label} #${char.id} beristirahat`);
    }
  }
}

// ── Patroller ────────────────────────────────────────────────────
/** @param {CharState} char */
function updatePatroller(char) {
  if (moveTowards(char, char.typeDef.speed)) {
    // Flip patrol direction
    if (char.direction === 1) {
      char.targetX  = char.patrolA.x;
      char.targetY  = char.patrolA.y;
      char.direction = -1;
    } else {
      char.targetX  = char.patrolB.x;
      char.targetY  = char.patrolB.y;
      char.direction = 1;
    }
    addLog(`🛡️ ${char.typeDef.label} #${char.id} berbalik arah`);
  }
}

// ── Bouncer (Slime) ──────────────────────────────────────────────
/** @param {CharState} char @param {number} dt */
function updateBouncer(char, dt) {
  if (char.state === 'idle') {
    char.timer -= dt;
    if (char.timer <= 0) {
      pickWanderTarget(char);
    }
    return;
  }
  if (char.state === 'moving') {
    if (moveTowards(char, char.typeDef.speed * 1.3)) {
      char.state = 'idle';
      char.timer = randomBetween(char.typeDef.idleMin, char.typeDef.idleMax);
      addLog(`💚 Slime #${char.id} memantul ke lokasi baru!`);
    }
  }
}

// ── Sprinter (Kucing) ────────────────────────────────────────────
/** @param {CharState} char @param {number} dt */
function updateSprinter(char, dt) {
  if (char.state === 'sitting') {
    char.timer -= dt;
    if (char.timer <= 0) {
      pickWanderTarget(char);
      char.state = 'sprinting';
      char.el.classList.add('is-sprinting');
      addLog(`🐱 Kucing #${char.id} tiba-tiba berlari kencang!`);
    }
    return;
  }
  if (char.state === 'sprinting') {
    if (moveTowards(char, char.typeDef.speed)) {
      char.state = 'sitting';
      char.el.classList.remove('is-sprinting');
      char.timer = randomBetween(char.typeDef.sitMin, char.typeDef.sitMax);
      addLog(`😴 Kucing #${char.id} duduk diam seolah tidak terjadi apa-apa`);
    }
  }
}

// ── Physics helper ───────────────────────────────────────────────
/**
 * Move char one step towards its target.
 * @param {CharState} char
 * @param {number}    speed  pixels/frame
 * @returns {boolean} true when arrived
 */
function moveTowards(char, speed) {
  const deltaX = char.targetX - char.x;
  const horizontalDist = Math.abs(deltaX);

  if (horizontalDist <= speed) {
    char.x = char.targetX;
    char.y = char.targetY;
    return true;
  }

  char.x += Math.sign(deltaX) * speed;
  return false;
}

// ================================================================
// ── SPAWN SYSTEM ────────────────────────────────────────────────
// ================================================================

/**
 * Spawn one character of the given type on the current map.
 * Respects map allowedTypes and MAX_CHARACTERS.
 *
 * @param {string} type
 */
function spawnCharacter(type) {
  if (!currentMap.allowedTypes.includes(type)) {
    addLog(`⚠️ ${CHAR_TYPES[type]?.label ?? type} tidak bisa di sini!`);
    return;
  }
  if (characters.length >= MAX_CHARACTERS) {
    addLog(`⚠️ Penuh! Maks ${MAX_CHARACTERS} karakter.`);
    return;
  }

  const char = createCharacter(type);
  if (char) {
    characters.push(char);
    updatePopulationDisplay();
    addLog(`✨ ${char.typeDef.label} #${char.id} muncul di ${currentMap.name}!`);
  }
}

/** Remove all characters from the current map. */
function clearAllCharacters() {
  characters.forEach(c => c.el.remove());
  characters = [];
  updatePopulationDisplay();
  addLog(`🗑 Semua karakter dihapus.`);
}

// ================================================================
// ── UI BUILDERS ─────────────────────────────────────────────────
// ================================================================

/** Build map-switch buttons (called once on init). */
function buildMapButtons() {
  mapButtonsEl.innerHTML = '';
  MAPS.forEach(map => {
    const btn = document.createElement('button');
    btn.className    = 'pixel-btn map-btn';
    btn.dataset.mapId = map.id;
    btn.title        = map.subtitle;
    btn.textContent  = map.name;
    btn.onclick      = () => switchMap(map);
    mapButtonsEl.appendChild(btn);
  });
}

/** Update active/inactive state on map buttons. */
function updateMapButtonStates() {
  document.querySelectorAll('.map-btn').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.mapId === currentMap.id);
  });
}

/**
 * Rebuild spawn buttons filtered by the current map's allowedTypes.
 * Called whenever the map changes.
 */
function renderSpawnButtons() {
  spawnButtonsEl.innerHTML = '';
  currentMap.allowedTypes.forEach(type => {
    const def = CHAR_TYPES[type];
    if (!def) return;
    const btn = document.createElement('button');
    btn.className   = 'pixel-btn spawn-btn';
    btn.title       = `Spawn ${def.label}`;
    btn.textContent = `${def.emoji} ${def.label}`;
    btn.onclick     = () => spawnCharacter(type);
    spawnButtonsEl.appendChild(btn);
  });
}

/** Refresh the population counter in the HUD. */
function updatePopulationDisplay() {
  populationEl.textContent = `👥 ${characters.length} character${characters.length !== 1 ? 's' : ''}`;
}

// ================================================================
// ── GAME LOOP ───────────────────────────────────────────────────
// ================================================================

/**
 * Main requestAnimationFrame loop.
 * @param {number} ts - DOMHighResTimeStamp provided by the browser
 */
function gameLoop(ts) {
  const dt = ts - lastTimestamp;
  lastTimestamp = ts;

  // Guard against huge delta on first frame or tab-switch resume
  if (dt > 0 && dt < 1000) {
    updateCharacters(dt);
  }

  requestAnimationFrame(gameLoop);
}

// ================================================================
// ── INITIALISATION ──────────────────────────────────────────────
// ================================================================

function init() {
  // 1. Compute and show the persistent Global Day
  updateDayDisplay();

  // 2. Build static UI
  buildMapButtons();
  clearBtn.addEventListener('click', clearAllCharacters);

  // 3. Load the default map (Village Square)
  switchMap(MAPS[0]);

  // 4. Spawn a small starting population
  spawnCharacter('warga');
  spawnCharacter('warga');
  spawnCharacter('ksatria');
  spawnCharacter('kucing');

  // 5. Welcome message
  addLog(`🌟 Selamat datang di ${MAPS[0].name}!`);
  addLog(`📅 Global Day: ${calculateGlobalDay()}`);

  // 6. Kick off the game loop
  requestAnimationFrame(ts => {
    lastTimestamp = ts;
    requestAnimationFrame(gameLoop);
  });
}

// Run once the DOM is fully ready
document.addEventListener('DOMContentLoaded', init);
