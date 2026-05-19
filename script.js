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
const GROUND_HEIGHT = 180;
const GROUND_START_Y = WORLD_H - GROUND_HEIGHT;
const GROUND_ANCHOR_RATIO_BY_TYPE = {
  'male-hero': 0.72,
};
// 110px top margin keeps sprites below HUD panel and top decorations.
const CHARACTER_TOP_MARGIN = 110;
// 70px bottom margin keeps sprites visibly above the ground-start boundary.
const CHARACTER_BOTTOM_MARGIN = 70;
const CHARACTER_Y_MIN = CHARACTER_TOP_MARGIN;
const CHARACTER_Y_MAX = GROUND_START_Y - CHARACTER_BOTTOM_MARGIN;
// Simple gravity model (pixels/frame², normalized by frame ratio).
const GRAVITY_ACCEL = 0.35;
// Terminal fall speed in pixels/frame.
const MAX_FALL_SPEED = 9;
// Reference frame duration for 60 FPS timing normalization.
const FRAME_MS = 1000 / 60;
// Frame-ratio clamps avoid extreme jumps after lag spikes and tiny-dt crawl.
const MIN_FRAME_RATIO = 0.5;
const MAX_FRAME_RATIO = 4;
const HERO_SIDE_PADDING = 20;
const HERO_FALLBACK_WIDTH = 128;
const HERO_IDLE_FRAMES = 10;
const HERO_WALK_FRAMES = 10;
const HERO_IDLE_FRAME_MS = 120;
const HERO_WALK_FRAME_MS = 90;
const RESIZE_REFRESH_DEBOUNCE_MS = 120;

/** Maximum number of characters allowed simultaneously */
const MAX_CHARACTERS = 1;

/** How many log entries to keep visible */
const MAX_LOG = 8;
const TIME_UPDATE_INTERVAL_MS = 60_000;

const BG_LAYER_STORAGE_KEYS = {
  back:  'idle-julian-bg-back',
  front: 'idle-julian-bg-front',
};

const HERO_ASSET_PATHS = {
  design: 'assets/characters/male_hero/male_hero-design.png',
  idle:   'assets/characters/male_hero/male_hero-idle.png',
  walk:   'assets/characters/male_hero/male_hero-walk.png',
};

const SKY_DECORATION_EMOJIS = new Set(['☁️', '🦇', '🌕', '⭐']);

const TIME_TONES = [
  {
    id: 'pagi',  label: 'Pagi',
    startHour: 5, endHour: 10,
    overlay: 'linear-gradient(to bottom, rgba(255,190,80,0.38) 0%, rgba(255,215,130,0.22) 45%, rgba(255,230,160,0.06) 70%, transparent 100%)',
  },
  {
    id: 'siang', label: 'Siang',
    startHour: 11, endHour: 14,
    overlay: 'linear-gradient(to bottom, rgba(200,240,255,0.10) 0%, rgba(220,245,255,0.04) 50%, transparent 70%)',
  },
  {
    id: 'sore',  label: 'Sore',
    startHour: 15, endHour: 17,
    overlay: 'linear-gradient(to bottom, rgba(240,100,30,0.42) 0%, rgba(255,150,60,0.28) 40%, rgba(255,120,0,0.10) 70%, transparent 100%)',
  },
  {
    id: 'malam', label: 'Malam',
    startHour: 18, endHour: 4,
    overlay: 'linear-gradient(to bottom, rgba(8,18,75,0.72) 0%, rgba(18,28,100,0.52) 45%, rgba(10,15,60,0.25) 70%, rgba(5,8,30,0.10) 100%)',
  },
];

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
    allowedTypes: ['male-hero'],
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
    id: 'jembatan',
    name: 'Jembatan Batu',
    subtitle: 'The Stone Bridge',
    allowedTypes: ['male-hero'],
    decorations: [
      { emoji: '🌉', x: 35, y: 38, size: 80 },
      { emoji: '🌊', x: 5,  y: 68, size: 34 },
      { emoji: '🌊', x: 20, y: 70, size: 28 },
      { emoji: '🌊', x: 60, y: 69, size: 32 },
      { emoji: '🌊', x: 80, y: 68, size: 30 },
      { emoji: '🐟', x: 12, y: 78, size: 26 },
      { emoji: '🐟', x: 72, y: 77, size: 24 },
      { emoji: '🏔️', x: 2,  y: 12, size: 52 },
      { emoji: '🏔️', x: 72, y: 10, size: 60 },
      { emoji: '☁️', x: 15, y: 5,  size: 36 },
      { emoji: '☁️', x: 55, y: 3,  size: 28 },
      { emoji: '🌿', x: 3,  y: 60, size: 28 },
      { emoji: '🌿', x: 88, y: 62, size: 26 },
    ],
  },
  {
    id: 'pinggiran-hutan',
    name: 'Pinggiran Hutan',
    subtitle: 'The Outskirts',
    allowedTypes: ['male-hero'],
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
 * @property {string}  behavior     - 'wanderer'|'patroller'|'bouncer'|'sprinter'|'auto-walker'
 * @property {number}  speed        - Pixels per frame (at 60 fps)
 * @property {number}  [idleMin]    - Minimum idle time (ms)
 * @property {number}  [idleMax]    - Maximum idle time (ms)
 * @property {number}  [patrolLen]  - Patrol range in pixels
 * @property {number}  [sitMin]     - Minimum sit time before sprinting (ms)
 * @property {number}  [sitMax]     - Maximum sit time before sprinting (ms)
 */

/** @type {Object.<string, CharTypeDef>} */
const CHAR_TYPES = {
  'male-hero': {
    label:    'Male Hero',
    emoji:    '🧑',
    behavior: 'auto-walker',
    speed:    1.1,
    idleMin:  1200,
    idleMax:  2300,
  },
};

// ================================================================
// ── GAME STATE ──────────────────────────────────────────────────
// ================================================================

/** @type {MapDef|null} Currently active map */
let currentMap = null;

/**
 * Per-map character state. Each key is a map ID; each value is the array
 * of CharState objects that belong to that map.
 * @type {Object.<string, CharState[]>}
 */
const mapCharacters = {};
MAPS.forEach(m => { mapCharacters[m.id] = []; });

/**
 * Active character list — always points to mapCharacters[currentMap.id].
 * @type {CharState[]}
 */
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
 * @property {number}      vy
 * @property {number}      groundY
 * @property {HTMLDivElement} [spriteEl]
 * @property {HTMLImageElement} [spriteImg]
 * @property {HTMLSpanElement} [spriteFallbackEl]
 * @property {number}      [minX]
 * @property {number}      [maxX]
 * @property {string}      [lastVisualState]
 * @property {number}      [lastFacing]
 * @property {string[]}    [spriteCandidates]
 * @property {number}      [spriteCandidateIndex]
 * @property {number[]}    [spriteCandidateFrameCounts]
 * @property {number}      [spriteFrameCount]
 * @property {number}      [spriteFrameIndex]
 * @property {number}      [spriteFrameElapsed]
 * @property {number}      [cachedFrameWidth]
 */

/** @type {CharState[]} */
let characters = [];

/** Auto-increment ID for each spawned character */
let charIdCounter = 0;

/** Log history (newest first) */
let logEntries = [];

/** Game-loop timing */
let lastTimestamp = 0;
let resizeRefreshTimer = null;

// ================================================================
// ── DOM REFERENCES ──────────────────────────────────────────────
// ================================================================

const gameBox        = document.getElementById('game-box');
const mapDecoEl      = document.getElementById('map-decorations');
const mapNameEl      = document.getElementById('map-name');
const dayCounterEl   = document.getElementById('day-counter');
const timePeriodEl   = document.getElementById('time-period');
const populationEl   = document.getElementById('population');
const charContainer  = document.getElementById('character-container');
const timeToneEl     = document.getElementById('time-tone');
const customBgBackEl  = document.getElementById('custom-bg-back');
const customBgFrontEl = document.getElementById('custom-bg-front');
const logMessagesEl  = document.getElementById('log-messages');
const mapButtonsEl   = document.getElementById('map-buttons');
const spawnButtonsEl = document.getElementById('spawn-buttons');
const clearBtn       = document.getElementById('clear-btn');
const clearBgBtn     = document.getElementById('clear-bg-btn');
const bgUploadButtons = document.querySelectorAll('.bg-upload-btn');
const bgUploadInputs = {
  back:  document.getElementById('bg-upload-back'),
  front: document.getElementById('bg-upload-front'),
};
const customBgLayers = {
  back:  customBgBackEl,
  front: customBgFrontEl,
};

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

/**
 * Determine current real-time day period and tone.
 * @returns {{id:string,label:string,startHour:number,endHour:number,overlay:string}}
 */
function getCurrentTimeTone() {
  const hour = new Date().getHours();
  return TIME_TONES.find(tone => {
    if (tone.startHour <= tone.endHour) {
      return hour >= tone.startHour && hour <= tone.endHour;
    }
    return hour >= tone.startHour || hour <= tone.endHour;
  }) || TIME_TONES[1];
}

/** Update HUD time period label and world tone overlay. */
function updateTimeTone() {
  const tone = getCurrentTimeTone();
  timePeriodEl.textContent = `🕒 ${tone.label}`;
  timeToneEl.style.background = tone.overlay;
  gameBox.dataset.timePeriod = tone.id;
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
    el.style.left = deco.x + '%';
    if (SKY_DECORATION_EMOJIS.has(deco.emoji)) {
      el.classList.add('map-deco--sky');
      el.style.top = deco.y + '%';
    } else {
      el.classList.add('map-deco--ground');
    }
    if (deco.size) el.style.fontSize = deco.size + 'px';
    mapDecoEl.appendChild(el);
  });
}

/**
 * Switch the active map.
 * Each map has its own independent character roster — characters from the
 * previous map are hidden and restored when returning to that map.
 *
 * @param {MapDef} map
 */
function switchMap(map) {
  // Save & hide previous map's characters
  if (currentMap !== null) {
    characters.forEach(c => { c.el.style.display = 'none'; });
  }

  currentMap = map;

  // Restore this map's characters (or start with an empty list)
  characters = mapCharacters[map.id];
  characters.forEach(c => { c.el.style.display = ''; });

  // Swap background CSS class
  gameBox.className = `map-${map.id}`;

  // HUD
  mapNameEl.textContent = `📍 ${map.name}`;

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
  const spriteFallbackEl = document.createElement('span');
  spriteFallbackEl.className = 'char-sprite-fallback';
  spriteFallbackEl.textContent = typeDef.emoji;
  const spriteImg = document.createElement('img');
  spriteImg.className = 'char-sprite-img';
  spriteImg.alt = `${typeDef.label} sprite`;
  spriteImg.draggable = false;
  spriteEl.appendChild(spriteFallbackEl);
  spriteEl.appendChild(spriteImg);

  const labelEl = document.createElement('div');
  labelEl.className = 'char-label';
  labelEl.textContent = typeDef.label;

  el.appendChild(spriteEl);
  el.appendChild(labelEl);
  el.style.left = x + 'px';
  el.style.top  = y + 'px';
  charContainer.appendChild(el);
  const measuredWidth = Math.max(
    HERO_FALLBACK_WIDTH,
    Math.round(el.offsetWidth || HERO_FALLBACK_WIDTH),
  );
  const groundY = getGroundYForCharacter(el, type);

  /** @type {CharState} */
  const char = {
    id,
    type,
    typeDef,
    el,
    x,
    y,
    targetX:    x,
    targetY:    groundY,
    state:      'idle',
    timer:      0,
    direction:  1,
    patrolA:    null,
    patrolB:    null,
    vy:         0,
    groundY,
    spriteEl,
    spriteImg,
    spriteFallbackEl,
    minX:       HERO_SIDE_PADDING,
    maxX:       Math.max(HERO_SIDE_PADDING, WORLD_W - measuredWidth - HERO_SIDE_PADDING),
    lastVisualState: '',
    lastFacing: 0,
    spriteFrameCount: 1,
    spriteFrameIndex: 0,
    spriteFrameElapsed: 0,
  };
  char.cachedFrameWidth = Math.max(1, Math.round(char.spriteEl.getBoundingClientRect().width));
  spriteImg.onload = () => {
    if (!char.spriteFallbackEl || !char.spriteImg) return;
    spriteImg.style.display = 'block';
    char.spriteFallbackEl.style.display = 'none';
    configureHeroSpriteImage(char);
  };
  spriteImg.onerror = () => {
    if (!char.spriteCandidates?.length) return;
    const nextIndex = (char.spriteCandidateIndex ?? 0) + 1;
    if (nextIndex < char.spriteCandidates.length) {
      setHeroSpriteCandidate(char, nextIndex);
    } else if (char.spriteFallbackEl) {
      spriteImg.style.display = 'none';
      char.spriteFallbackEl.style.display = 'block';
    }
  };

  initBehavior(char);
  syncHeroVisual(char, true);
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

    case 'auto-walker':
      setupAutoWalker(char);
      break;
  }
}

/** @param {CharState} char */
function setupAutoWalker(char) {
  char.direction = Math.random() < 0.5 ? -1 : 1;
  char.state = 'walking';
  char.targetY = char.groundY;
}

/**
 * @param {CharState} char
 * @param {boolean} forceSpriteReload
 */
function syncHeroVisual(char, forceSpriteReload = false) {
  if (!char.spriteEl || !char.spriteImg || !char.spriteFallbackEl) return;
  const isWalking = char.state === 'walking';
  const facing = char.direction >= 0 ? 1 : -1;
  if (forceSpriteReload || char.lastFacing !== facing) {
    char.spriteEl.style.transform = `scaleX(${facing})`;
    char.lastFacing = facing;
  }
  char.el.classList.toggle('is-walking', isWalking);

  if (!forceSpriteReload && char.lastVisualState === char.state) return;
  char.lastVisualState = char.state;
  const preferredPath = isWalking ? HERO_ASSET_PATHS.walk : HERO_ASSET_PATHS.idle;
  const preferredFrames = isWalking ? HERO_WALK_FRAMES : HERO_IDLE_FRAMES;
  char.spriteCandidates = [preferredPath, HERO_ASSET_PATHS.design];
  char.spriteCandidateFrameCounts = [preferredFrames, 1];
  setHeroSpriteCandidate(char, 0);
}

/**
 * @param {CharState} char
 * @param {number} candidateIndex
 */
function setHeroSpriteCandidate(char, candidateIndex) {
  if (!char.spriteImg || !char.spriteCandidates?.length) return;
  if (candidateIndex < 0 || candidateIndex >= char.spriteCandidates.length) {
    if (char.spriteFallbackEl) {
      char.spriteImg.style.display = 'none';
      char.spriteFallbackEl.style.display = 'block';
    }
    return;
  }
  const frameCounts = char.spriteCandidateFrameCounts ?? [];
  char.spriteCandidateIndex = candidateIndex;
  char.spriteFrameCount = Math.max(1, frameCounts[candidateIndex] ?? 1);
  char.spriteFrameIndex = 0;
  char.spriteFrameElapsed = 0;
  renderHeroSpriteFrame(char);
  char.spriteImg.src = char.spriteCandidates[candidateIndex];
}

/** @param {CharState} char */
function configureHeroSpriteImage(char) {
  if (!char.spriteImg || !char.spriteEl) return;
  const frameCount = Math.max(1, char.spriteFrameCount ?? 1);
  const frameWidth = getHeroSpriteFrameWidth(char, true);
  char.spriteImg.style.width = `${frameWidth * frameCount}px`;
  char.spriteImg.style.height = '100%';
  renderHeroSpriteFrame(char);
}

/**
 * @param {CharState} char
 * @param {boolean} [forceRefresh=false]
 * @returns {number}
 */
function getHeroSpriteFrameWidth(char, forceRefresh = false) {
  if (
    !forceRefresh &&
    typeof char.cachedFrameWidth === 'number' &&
    char.cachedFrameWidth > 0
  ) {
    return char.cachedFrameWidth;
  }
  if (!char.spriteEl) return 1;
  const frameWidth = Math.max(1, Math.round(char.spriteEl.getBoundingClientRect().width));
  char.cachedFrameWidth = frameWidth;
  return frameWidth;
}

/** Recompute cached sprite frame widths after layout-affecting changes. */
function refreshHeroSpriteFrameWidthCache() {
  characters.forEach(char => {
    if (char.type !== 'male-hero') return;
    getHeroSpriteFrameWidth(char, true);
    renderHeroSpriteFrame(char);
  });
}

/** Debounced refresh for sprite frame width cache on viewport resize. */
function handleResizeFrameCacheRefresh() {
  clearTimeout(resizeRefreshTimer);
  resizeRefreshTimer = window.setTimeout(() => {
    refreshHeroSpriteFrameWidthCache();
  }, RESIZE_REFRESH_DEBOUNCE_MS);
}

/** @param {CharState} char */
function renderHeroSpriteFrame(char) {
  if (!char.spriteImg || !char.spriteEl) return;
  const frameCount = Math.max(1, char.spriteFrameCount ?? 1);
  const frameIndex = Math.max(0, Math.min(frameCount - 1, char.spriteFrameIndex ?? 0));
  const frameWidth = getHeroSpriteFrameWidth(char);
  const frameShiftPx = frameIndex * frameWidth;
  char.spriteImg.style.transform = `translateX(-${frameShiftPx}px)`;
}

/**
 * @param {CharState} char
 * @param {number} dt
 */
function updateHeroSpriteAnimation(char, dt) {
  if (char.type !== 'male-hero' || !char.spriteImg) return;
  const frameCount = Math.max(1, char.spriteFrameCount ?? 1);
  if (frameCount <= 1 || char.spriteImg.style.display === 'none') return;
  const frameDuration = char.state === 'walking' ? HERO_WALK_FRAME_MS : HERO_IDLE_FRAME_MS;
  char.spriteFrameElapsed = (char.spriteFrameElapsed ?? 0) + dt;
  while (char.spriteFrameElapsed >= frameDuration) {
    char.spriteFrameElapsed -= frameDuration;
    char.spriteFrameIndex = ((char.spriteFrameIndex ?? 0) + 1) % frameCount;
    renderHeroSpriteFrame(char);
  }
}

// ================================================================
// ── BEHAVIOUR HELPERS ───────────────────────────────────────────
// ================================================================

/** @param {CharState} char */
function pickWanderTarget(char) {
  char.targetX = 50 + Math.random() * (WORLD_W - 140);
  // Keep vertical lane fixed: movement is left/right only.
  char.targetY = char.groundY;
  char.state   = 'moving';
}

/** Set up a horizontal patrol corridor. @param {CharState} char */
function setupPatrol(char) {
  const half = char.typeDef.patrolLen / 2;
  char.patrolA = { x: Math.max(50,          char.x - half), y: char.groundY };
  char.patrolB = { x: Math.min(WORLD_W - 50, char.x + half), y: char.groundY };

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
    updateHeroSpriteAnimation(char, deltaTime);
    applyGravity(char, deltaTime);
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
    case 'auto-walker': updateAutoWalker(char, dt); break;
  }
}

/** @param {CharState} char @param {number} dt */
function updateAutoWalker(char, dt) {
  if (char.state === 'idle') {
    char.timer -= dt;
    if (char.timer <= 0) {
      char.state = 'walking';
      syncHeroVisual(char);
      addLog(`🚶 ${char.typeDef.label} #${char.id} mulai berjalan`);
    }
    return;
  }
  if (char.state !== 'walking') return;

  const minX = char.minX ?? HERO_SIDE_PADDING;
  if (typeof char.maxX !== 'number') {
    const measuredWidth = Math.max(
      HERO_FALLBACK_WIDTH,
      Math.round(char.el.offsetWidth || HERO_FALLBACK_WIDTH),
    );
    char.maxX = Math.max(minX, WORLD_W - measuredWidth - HERO_SIDE_PADDING);
  }
  const maxX = char.maxX;
  char.x += char.typeDef.speed * char.direction;
  syncHeroVisual(char);

  if (char.x <= minX) {
    char.x = minX;
    char.direction = 1;
    char.state = 'idle';
    char.timer = randomBetween(char.typeDef.idleMin, char.typeDef.idleMax);
    syncHeroVisual(char);
    addLog(`↪️ ${char.typeDef.label} #${char.id} berbalik ke kanan`);
  } else if (char.x >= maxX) {
    char.x = maxX;
    char.direction = -1;
    char.state = 'idle';
    char.timer = randomBetween(char.typeDef.idleMin, char.typeDef.idleMax);
    syncHeroVisual(char);
    addLog(`↩️ ${char.typeDef.label} #${char.id} berbalik ke kiri`);
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
    return true;
  }

  char.x += Math.sign(deltaX) * speed;
  return false;
}

/** @param {HTMLElement} el @param {string} type */
function getGroundYForCharacter(el, type = '') {
  const spriteEl = el.querySelector('.char-sprite');
  const spriteHeight =
    spriteEl instanceof HTMLElement
      ? spriteEl.getBoundingClientRect().height
      : el.getBoundingClientRect().height;
  const anchorRatio = GROUND_ANCHOR_RATIO_BY_TYPE[type] ?? 1;
  const anchorHeight = Math.round(spriteHeight * anchorRatio);
  return GROUND_START_Y - anchorHeight;
}

/** @param {CharState} char @param {number} dt */
function applyGravity(char, dt) {
  const frameRatio = Math.max(MIN_FRAME_RATIO, Math.min(MAX_FRAME_RATIO, dt / FRAME_MS));
  if (char.y < char.groundY) {
    char.vy = Math.min(MAX_FALL_SPEED, char.vy + GRAVITY_ACCEL * frameRatio);
    char.y = Math.min(char.groundY, char.y + char.vy * frameRatio);
  } else {
    char.y = char.groundY;
    char.vy = 0;
  }
  char.targetY = char.groundY;
  if (char.patrolA && char.patrolB) {
    char.patrolA.y = char.groundY;
    char.patrolB.y = char.groundY;
  }
}

/**
 * @param {'back'|'front'} layer
 * @param {string|null} imageDataUrl
 */
function applyCustomBackgroundLayer(layer, imageDataUrl) {
  const layerEl = customBgLayers[layer];
  if (!layerEl) return;
  if (imageDataUrl) {
    layerEl.style.backgroundImage = `url("${imageDataUrl}")`;
    layerEl.style.opacity = '1';
  } else {
    layerEl.style.backgroundImage = 'none';
    layerEl.style.opacity = '0';
  }
}

/**
 * @param {'back'|'front'} layer
 * @returns {string|null}
 */
function readStoredBackground(layer) {
  try {
    return localStorage.getItem(BG_LAYER_STORAGE_KEYS[layer]);
  } catch {
    return null;
  }
}

/**
 * @param {'back'|'front'} layer
 * @param {string|null} value
 */
function writeStoredBackground(layer, value) {
  try {
    if (value) {
      localStorage.setItem(BG_LAYER_STORAGE_KEYS[layer], value);
    } else {
      localStorage.removeItem(BG_LAYER_STORAGE_KEYS[layer]);
    }
  } catch {
    addLog('⚠️ Gagal menyimpan background di browser.');
  }
}

/** Load all persisted custom background layers from localStorage. */
function loadCustomBackgroundLayers() {
  /** @type {Array<'back'|'front'>} */
  const layers = ['back', 'front'];
  layers.forEach(layer => {
    applyCustomBackgroundLayer(layer, readStoredBackground(layer));
  });
}

/**
 * @param {'back'|'front'} layer
 * @param {File} file
 */
function uploadBackgroundLayer(layer, file) {
  if (!file) return;
  const isWebpByMime = file.type === 'image/webp';
  const isWebpByName = file.name.toLowerCase().endsWith('.webp');
  if (!isWebpByMime && !isWebpByName) {
    addLog('⚠️ File harus format WEBP.');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const result = /** @type {string} */ (reader.result);
    writeStoredBackground(layer, result);
    applyCustomBackgroundLayer(layer, result);
    addLog(`🖼️ Layer ${layer.toUpperCase()} diperbarui.`);
  };
  reader.readAsDataURL(file);
}

/** Bind upload and clear interactions for custom backgrounds. */
function bindBackgroundControls() {
  bgUploadButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const layer = btn.dataset.layer;
      const input = bgUploadInputs[layer];
      if (!input) return;
      input.click();
    });
  });

  /** @type {Array<'back'|'front'>} */
  const layers = ['back', 'front'];
  layers.forEach(layer => {
    const input = bgUploadInputs[layer];
    if (!input) return;
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (file) uploadBackgroundLayer(layer, file);
      input.value = '';
    });
  });

  clearBgBtn?.addEventListener('click', () => {
    layers.forEach(layer => {
      writeStoredBackground(layer, null);
      applyCustomBackgroundLayer(layer, null);
    });
    addLog('🧹 Semua layer background dihapus.');
  });
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
  const mapChars = mapCharacters[currentMap.id];
  mapChars.forEach(c => c.el.remove());
  mapChars.length = 0;
  // Keep the `characters` reference in sync
  characters = mapChars;
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
  updateTimeTone();
  setInterval(updateTimeTone, TIME_UPDATE_INTERVAL_MS);

  // 2. Build static UI
  buildMapButtons();
  bindBackgroundControls();
  loadCustomBackgroundLayers();
  clearBtn.addEventListener('click', clearAllCharacters);
  window.addEventListener('resize', handleResizeFrameCacheRefresh);

  // 3. Load the default map (Village Square)
  switchMap(MAPS[0]);

  // 4. Spawn a small starting population
  spawnCharacter('male-hero');

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
