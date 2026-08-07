import { Chess } from './vendor/chess.js';

const $ = (id) => document.getElementById(id);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = [1, 2, 3, 4, 5, 6, 7, 8];
const DEFAULT_FEN = new Chess().fen();
const PREF_KEY = 'arena-chess-lab:prefs:v1';
const EXPLORER_PREF_KEY = 'arena-chess-lab:explorer:v1';
const COMPLETIONS_KEY = 'arena-chess-lab:completed-lines:v1';
const GAME_STATE_KEY = 'lineforge:current-run:v1';
const COLOR_PROGRESS_KEY = 'lineforge:color-depth-progress:v1';
const TOKEN_KEY = 'lineforge:lichess-token:persistent';
const OPENROUTER_KEY = 'lineforge:openrouter-key:persistent';
const DEFAULT_OPENROUTER_MODEL = 'google/gemma-4-26b-a4b-it:free';
const OPENROUTER_FALLBACK_MODELS = [
  'google/gemma-4-26b-a4b-it:free',
  'google/gemma-4-31b-it:free',
  'openai/gpt-oss-20b:free',
  'openrouter/free',
  'nvidia/nemotron-3-nano-30b-a3b:free',
  'inclusionai/ling-3.0-flash:free',
  'deepseek/deepseek-v4-flash-latest',
];
const DEPRECATED_OPENROUTER_MODELS = new Set(['deepseek/deepseek-chat-v3-0324:free', 'openrouter/free', 'google/gemma-4-31b-it:free']);
const EXPLORER_HOST = 'https://explorer.lichess.org';
const FIXED_EXPLORER_SOURCES = [
  {
    source: 'masters',
    label: 'Masters database',
    shortLabel: 'Masters',
    description: 'OTB master games from the Lichess masters opening database.',
    moves: 100,
    topGames: 8,
  },
  {
    source: 'lichess',
    label: 'Lichess 2500+ rapid/classical/correspondence',
    shortLabel: 'Lichess 2500+ R/C/Corr',
    description: 'Rated Lichess games in the 2500+ rating bucket at rapid, classical, and correspondence speeds.',
    speeds: ['rapid', 'classical', 'correspondence'],
    ratings: ['2500'],
    moves: 100,
    topGames: 4,
    recentGames: 4,
  },
];
const DEPTH_TIERS = [100000, 50000, 10000, 5000, 1000, 500];
const DEFAULT_DEPTH_INDEX = 4;

const PIECES = {
  w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' },
  b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' },
};

const PROMOTION_SYMBOLS = {
  w: { q: '♕', r: '♖', b: '♗', n: '♘' },
  b: { q: '♛', r: '♜', b: '♝', n: '♞' },
};

const PIECE_NAMES = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };

const state = {
  game: new Chess(),
  playerColor: 'w',
  sideChoice: 'white',
  playerName: 'You',
  opponentName: 'Other Side',
  whiteName: 'You',
  blackName: 'Other Side',
  orientationMode: 'player',
  selected: null,
  legalMoves: [],
  lastMove: null,
  pendingPromotion: null,
  enemyThinking: false,
  enemyPaused: false,
  enemyTimer: null,
  trainingComplete: false,
  mistakes: 0,
  depthTierIndex: DEFAULT_DEPTH_INDEX,
  movePolicy: 'masterFirst',
  colorProgress: null,
  aiCoachEnabled: true,
  openRouterModel: DEFAULT_OPENROUTER_MODEL,
  pendingMistakesByFen: new Map(),
  coachRequestId: 0,
  serverProxyAvailable: false,
  staticHosting: false,
  overrideResult: null,
  overrideReason: '',
  explorerAbort: null,
  explorerDebounce: null,
  explorerCache: new Map(),
  lastExplorerFen: '',
  lastExplorerData: null,
  soundEnabled: true,
  audioContext: null,
};

function init() {
  loadPreferences();
  loadExplorerPreferences();
  loadColorProgress();
  updateDepthLabels();
  wireEvents();
  updateSourceVisibility();
  const restoredRun = restoreCurrentGameState();
  if (!restoredRun) {
    startGame({
      playerName: $('setup-player-name').value || 'You',
      opponentName: $('setup-opponent-name').value || 'Other Side',
      sideChoice: $('setup-side').value || 'white',
      orientationMode: $('setup-orientation').value || 'player',
      startingFen: '',
      announce: false,
    });
  }

  const token = readSession(TOKEN_KEY);
  if (token) $('api-token').value = token;
  const openRouterKey = readSession(OPENROUTER_KEY);
  if (openRouterKey) $('openrouter-key').value = openRouterKey;
  loadCoachPreferences();
  initServerConfig();

  const prefs = readJson(PREF_KEY, {});
  if (prefs.showOnboarding !== false) {
    setTimeout(() => safeShowModal($('onboarding-dialog')), 300);
  }
}


async function initServerConfig() {
  try {
    const response = await fetch('./api/config', { cache: 'no-store' });
    if (!response.ok) {
      enableStaticHostingMode();
      return;
    }
    const config = await response.json();
    state.serverProxyAvailable = Boolean(config.explorerProxy);
    state.staticHosting = false;
    if (config.lichessTokenConfigured) {
      $('proxy-toggle').checked = true;
      saveExplorerPreferences();
      setExplorerPill('Explorer: proxy token ready', '');
      scheduleExplorerFetch(80);
    }
  } catch {
    enableStaticHostingMode();
  }
}

function enableStaticHostingMode() {
  state.serverProxyAvailable = false;
  state.staticHosting = true;
  if ($('proxy-toggle')?.checked) {
    $('proxy-toggle').checked = false;
    saveExplorerPreferences();
  }
  setExplorerPill('Explorer: static hosting', 'soft');
}

function wireEvents() {
  $('board').addEventListener('click', onBoardClick);
  $('board').addEventListener('dragstart', onDragStart);
  $('board').addEventListener('dragover', (event) => event.preventDefault());
  $('board').addEventListener('drop', onDrop);
  $('board').addEventListener('dragend', () => $$('.square.dragging').forEach((el) => el.classList.remove('dragging')));

  $('guide-btn').addEventListener('click', () => safeShowModal($('onboarding-dialog')));
  $('onboarding-close-btn').addEventListener('click', closeOnboarding);
  $('onboarding-primary-btn').addEventListener('click', closeOnboarding);
  $('onboarding-setup-btn').addEventListener('click', () => {
    closeOnboarding();
    safeShowModal($('setup-dialog'));
  });
  $('onboarding-startup-toggle').addEventListener('change', savePreferences);

  $('new-game-btn').addEventListener('click', () => safeShowModal($('setup-dialog')));
  $('setup-cancel-btn').addEventListener('click', () => $('setup-dialog').close());
  $('setup-close-btn').addEventListener('click', () => $('setup-dialog').close());
  $('setup-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const ok = startGame({
      playerName: $('setup-player-name').value.trim() || 'You',
      opponentName: $('setup-opponent-name').value.trim() || 'Other Side',
      sideChoice: $('setup-side').value,
      orientationMode: $('setup-orientation').value,
      startingFen: $('setup-fen').value.trim(),
      announce: true,
    });
    if (ok) $('setup-dialog').close();
  });

  $('export-pgn-btn').addEventListener('click', showPgnDialog);
  $('download-pgn-btn').addEventListener('click', downloadPgn);
  $('download-pgn-modal-btn').addEventListener('click', downloadPgn);
  $('copy-pgn-btn').addEventListener('click', () => copyText(getPgn(), 'PGN copied'));
  $('copy-fen-btn').addEventListener('click', () => copyText(state.game.fen(), 'FEN copied'));
  $('undo-btn').addEventListener('click', undoMove);
  $('flip-btn').addEventListener('click', flipBoard);
  $('resign-btn').addEventListener('click', resignSideToMove);
  $('draw-btn').addEventListener('click', declareDraw);

  $('theme-select').addEventListener('change', () => {
    applyTheme($('theme-select').value);
    savePreferences();
  });
  $('sound-toggle').addEventListener('change', () => {
    state.soundEnabled = $('sound-toggle').checked;
    savePreferences();
  });

  $('refresh-explorer-btn').addEventListener('click', () => fetchExplorer({ force: true }));
  $('depth-slider').addEventListener('input', () => {
    state.depthTierIndex = Number($('depth-slider').value);
    updateDepthLabels();
  });
  $('depth-slider').addEventListener('change', () => {
    state.depthTierIndex = Number($('depth-slider').value);
    enforceDepthLimitForColor(state.playerColor, { announce: true });
    updateDepthLabels();
    saveExplorerPreferences();
    scheduleExplorerFetch(120);
  });
  $('move-policy').addEventListener('change', () => {
    state.movePolicy = $('move-policy').value;
    saveExplorerPreferences();
    scheduleExplorerFetch(120);
  });
  document.querySelector('.right-panel')?.addEventListener('change', (event) => {
    if (event.target.id === 'api-token') return;
    if (event.target.id === 'proxy-toggle' && $('proxy-toggle').checked && !state.serverProxyAvailable) {
      $('proxy-toggle').checked = false;
      toast('Same-origin proxy is not available on static hosting. Use the tab token field or deploy a backend proxy.');
    }
    if (event.target.closest('.settings-details')) {
      updateSourceVisibility();
      saveExplorerPreferences();
      scheduleExplorerFetch(350);
    }
  });

  $('moves-table').addEventListener('click', (event) => {
    const button = event.target.closest('[data-uci]');
    if (!button || button.disabled) return;
    playUci(button.dataset.uci);
  });

  $('save-token-btn').addEventListener('click', () => {
    const token = $('api-token').value.trim();
    if (!token) {
      toast('Paste a Lichess OAuth token first.');
      return;
    }
    writeSession(TOKEN_KEY, token);
    toast('Token saved permanently in this browser for explorer requests.');
    fetchExplorer({ force: true });
  });

  $('clear-token-btn').addEventListener('click', () => {
    $('api-token').value = '';
    removeSession(TOKEN_KEY);
    toast('Explorer token forgotten on this browser.');
    fetchExplorer({ force: true });
  });

  $('save-openrouter-btn').addEventListener('click', () => {
    const key = $('openrouter-key').value.trim();
    if (!key) {
      toast('Paste an OpenRouter API key first.');
      return;
    }
    writeSession(OPENROUTER_KEY, key);
    toast('OpenRouter key saved permanently in this browser for AI mentor explanations.');
  });

  $('clear-openrouter-btn').addEventListener('click', () => {
    $('openrouter-key').value = '';
    removeSession(OPENROUTER_KEY);
    toast('OpenRouter key forgotten on this browser.');
  });

  $('openrouter-key').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      $('save-openrouter-btn').click();
    }
  });

  $('openrouter-model').addEventListener('change', () => {
    state.openRouterModel = $('openrouter-model').value.trim() || DEFAULT_OPENROUTER_MODEL;
    saveCoachPreferences();
  });

  $('ai-coach-toggle').addEventListener('change', () => {
    state.aiCoachEnabled = $('ai-coach-toggle').checked;
    saveCoachPreferences();
  });

  $('coach-close-btn').addEventListener('click', () => hideCoach());

  $('api-token').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      $('save-token-btn').click();
    }
  });

  $$('.promotion-piece').forEach((button) => {
    button.addEventListener('click', () => {
      if (!state.pendingPromotion) return;
      const { from, to } = state.pendingPromotion;
      const promotion = button.dataset.promotion;
      state.pendingPromotion = null;
      $('promotion-dialog').close();
      attemptMove(from, to, promotion);
    });
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      clearSelection();
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      undoMove();
    }
  });
}

function startGame(config) {
  let playerColor = choosePlayerColorForSetup(config.sideChoice);
  if (!playerColor) {
    toast('Both colors are already fully forged. Reset progress to train again.');
    return false;
  }
  if (isColorFullyLearned(playerColor)) {
    const alternative = opposite(playerColor);
    if (!isColorFullyLearned(alternative)) {
      toast(`${colorName(playerColor)} is already fully forged. Switching to ${colorName(alternative)}.`);
      playerColor = alternative;
      $('setup-side').value = alternative === 'w' ? 'white' : 'black';
    } else {
      toast(`You have already learned everything for ${colorName(playerColor)}. Choose another color or reset progress.`);
      return false;
    }
  }
  enforceDepthLimitForColor(playerColor, { announce: true });

  const nextGame = new Chess();
  if (config.startingFen) {
    try {
      nextGame.load(config.startingFen);
    } catch (error) {
      toast(`Invalid FEN: ${error.message || 'could not load the position'}`);
      return false;
    }
  }

  state.game = nextGame;
  state.playerColor = playerColor;
  state.sideChoice = config.sideChoice;
  state.playerName = config.playerName;
  state.opponentName = config.opponentName;
  state.orientationMode = config.orientationMode;
  state.whiteName = playerColor === 'w' ? config.playerName : config.opponentName;
  state.blackName = playerColor === 'b' ? config.playerName : config.opponentName;
  state.selected = null;
  state.legalMoves = [];
  state.lastMove = null;
  state.pendingPromotion = null;
  state.enemyThinking = false;
  state.enemyPaused = false;
  state.trainingComplete = false;
  state.mistakes = 0;
  state.pendingMistakesByFen.clear();
  state.overrideResult = null;
  state.overrideReason = '';
  state.lastExplorerFen = '';
  state.lastExplorerData = null;

  if (state.enemyTimer) clearTimeout(state.enemyTimer);
  if (state.explorerAbort) state.explorerAbort.abort();
  state.explorerCache.clear();

  setPgnHeaders(config.startingFen);
  savePreferences();
  renderAll();
  saveCurrentGameState();
  scheduleExplorerFetch(150);

  if (config.announce) {
    const sideLabel = playerColor === 'w' ? 'White' : 'Black';
    toast(`Learning Openings mode started. You are ${sideLabel}; the enemy replies with the most popular uncompleted database response.`);
  }

  return true;
}

function setPgnHeaders(startingFen = '') {
  const today = new Date();
  const pgnDate = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`;
  const site = location.protocol.startsWith('http') ? location.origin : 'Local browser';
  state.game.setHeader('Event', 'LineForge training line');
  state.game.setHeader('Site', site);
  state.game.setHeader('Date', pgnDate);
  state.game.setHeader('Round', '-');
  state.game.setHeader('White', state.whiteName);
  state.game.setHeader('Black', state.blackName);
  state.game.setHeader('Result', '*');
  if (startingFen && startingFen !== DEFAULT_FEN) {
    state.game.setHeader('SetUp', '1');
    state.game.setHeader('FEN', startingFen);
  } else {
    safeRemoveHeader('SetUp');
    safeRemoveHeader('FEN');
  }
}

function safeRemoveHeader(key) {
  try {
    state.game.removeHeader(key);
  } catch {
    // Older chess.js versions may not mind, but keep this defensive.
  }
}

function onBoardClick(event) {
  const squareEl = event.target.closest('.square');
  if (!squareEl) return;
  const square = squareEl.dataset.square;

  if (state.selected) {
    const isLegalDestination = state.legalMoves.some((move) => move.to === square);
    if (isLegalDestination) {
      attemptMove(state.selected, square);
      return;
    }
  }

  const piece = state.game.get(square);
  if (piece && piece.color === state.game.turn() && canMoveColor(piece.color)) {
    selectSquare(square);
  } else {
    clearSelection();
  }
}

function onDragStart(event) {
  const squareEl = event.target.closest('.square');
  if (!squareEl || squareEl.getAttribute('draggable') !== 'true') {
    event.preventDefault();
    return;
  }
  const square = squareEl.dataset.square;
  event.dataTransfer.setData('text/plain', square);
  event.dataTransfer.effectAllowed = 'move';
  squareEl.classList.add('dragging');
  selectSquare(square, { silent: true });
}

function onDrop(event) {
  event.preventDefault();
  const target = event.target.closest('.square');
  const from = event.dataTransfer.getData('text/plain');
  const to = target?.dataset.square;
  $$('.square.dragging').forEach((el) => el.classList.remove('dragging'));
  if (from && to) attemptMove(from, to);
}

function selectSquare(square, options = {}) {
  state.selected = square;
  state.legalMoves = state.game.moves({ square, verbose: true });
  if (!options.silent) playSoftTick();
  renderBoard();
}

function clearSelection() {
  state.selected = null;
  state.legalMoves = [];
  renderBoard();
}

function attemptMove(from, to, promotion = null) {
  if (isGameFinished()) return false;
  const turn = state.game.turn();
  if (!canMoveColor(turn)) {
    toast(state.enemyThinking ? 'Enemy database reply is being selected.' : 'It is not your move right now.');
    return false;
  }
  const preMoveFen = state.game.fen();
  const wasPlayerMove = turn === state.playerColor;

  const candidates = state.game.moves({ square: from, verbose: true }).filter((move) => move.to === to);
  if (!candidates.length) {
    clearSelection();
    return false;
  }

  const promotionCandidates = candidates.filter((move) => move.promotion);
  if (promotionCandidates.length && !promotion) {
    state.pendingPromotion = { from, to };
    updatePromotionChoices(turn);
    safeShowModal($('promotion-dialog'));
    return false;
  }

  const requestedMove = { from, to };
  if (promotion) requestedMove.promotion = promotion;

  let made;
  try {
    made = state.game.move(requestedMove);
  } catch {
    made = null;
  }

  if (!made) {
    toast('Illegal move.');
    clearSelection();
    return false;
  }

  afterMove(made, { preMoveFen, wasPlayerMove });
  return true;
}

function playUci(uci) {
  if (!uci || uci.length < 4) return;
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  const promotion = uci.length > 4 ? uci.slice(4, 5) : null;
  attemptMove(from, to, promotion);
}

function afterMove(move, options = {}) {
  state.lastMove = { from: move.from, to: move.to, san: move.san, color: move.color };
  state.selected = null;
  state.legalMoves = [];
  state.enemyPaused = false;
  state.trainingComplete = false;
  state.overrideResult = null;
  state.overrideReason = '';
  syncResultHeader();
  playMoveSound(Boolean(move.captured || move.flags?.includes('c')));
  const postMoveHistory = getHistoryUcis();
  renderAll();

  if (options.wasPlayerMove && !options.skipValidation) {
    setExplorerPill('Checking move quality', 'soft');
    renderExplorerMessage('Checking your move against the 500+ game / 50%+ database rule…', true);
    validatePlayerMoveQuality(options.preMoveFen, move, postMoveHistory).then((isValid) => {
      if (!arraysEqual(getHistoryUcis(), postMoveHistory)) return;
      if (isValid === true) {
        saveCurrentGameState();
        scheduleExplorerFetch(120);
      } else if (isValid === false) {
        undoRejectedPlayerMove(postMoveHistory);
      } else {
        saveCurrentGameState();
        scheduleExplorerFetch(120);
      }
    });
    return;
  }

  saveCurrentGameState();
  scheduleExplorerFetch(120);
}

function updatePromotionChoices(color) {
  $$('.promotion-piece').forEach((button) => {
    const key = button.dataset.promotion;
    button.textContent = PROMOTION_SYMBOLS[color][key];
  });
}

function canMoveColor(color = state.game.turn()) {
  if (isGameFinished() || state.enemyThinking) return false;
  return color === state.playerColor;
}

function isGameFinished() {
  return state.trainingComplete || Boolean(state.overrideResult) || state.game.isGameOver();
}


function undoMove() {
  if (!state.game.history().length) {
    toast('No moves to undo.');
    return;
  }
  if (state.enemyTimer) clearTimeout(state.enemyTimer);
  state.enemyThinking = false;
  state.enemyPaused = false;
  state.trainingComplete = false;
  state.overrideResult = null;
  state.overrideReason = '';

  state.game.undo();

  const history = state.game.history({ verbose: true });
  const last = history.at(-1);
  state.lastMove = last ? { from: last.from, to: last.to, san: last.san, color: last.color } : null;
  clearSelection();
  syncResultHeader();
  renderAll();
  saveCurrentGameState();
  scheduleExplorerFetch(100);
}

function flipBoard() {
  const current = getOrientation();
  state.orientationMode = current === 'white' ? 'black' : 'white';
  $('setup-orientation').value = state.orientationMode;
  savePreferences();
  renderAll();
}

function resignSideToMove() {
  if (isGameFinished()) return;
  const side = state.game.turn();
  state.overrideResult = side === 'w' ? '0-1' : '1-0';
  state.overrideReason = `${colorName(side)} resigned`;
  syncResultHeader();
  renderAll();
  toast(`${colorName(side)} resigned.`);
}

function declareDraw() {
  if (isGameFinished()) return;
  state.overrideResult = '1/2-1/2';
  state.overrideReason = 'Draw agreed';
  syncResultHeader();
  renderAll();
  toast('Game marked as a draw.');
}

function renderAll() {
  renderBoard();
  renderStatus();
  renderMoveList();
  renderPlayers();
  $('fen-output').textContent = state.game.fen();
}

function renderBoard() {
  const board = $('board');
  const orientation = getOrientation();
  const files = orientation === 'white' ? FILES : [...FILES].reverse();
  const ranks = orientation === 'white' ? [...RANKS].reverse() : RANKS;
  const legalMap = new Map();
  for (const move of state.legalMoves) {
    if (!legalMap.has(move.to)) legalMap.set(move.to, []);
    legalMap.get(move.to).push(move);
  }
  const lastSquares = new Set(state.lastMove ? [state.lastMove.from, state.lastMove.to] : []);
  const checkSquare = state.game.isCheck() ? findKingSquare(state.game.turn()) : null;

  board.innerHTML = '';
  for (const rank of ranks) {
    for (const file of files) {
      const square = `${file}${rank}`;
      const fileIndex = FILES.indexOf(file);
      const isLight = (fileIndex + rank) % 2 === 0;
      const piece = state.game.get(square);
      const squareEl = document.createElement('div');
      squareEl.className = `square ${isLight ? 'light' : 'dark'}`;
      squareEl.dataset.square = square;
      squareEl.setAttribute('role', 'gridcell');
      squareEl.setAttribute('aria-label', `${square}${piece ? ` ${colorName(piece.color)} ${PIECE_NAMES[piece.type]}` : ''}`);

      if (state.selected === square) squareEl.classList.add('selected');
      if (lastSquares.has(square)) squareEl.classList.add('last-move');
      if (checkSquare === square) squareEl.classList.add('check');
      if (legalMap.has(square)) {
        const moves = legalMap.get(square);
        const isCapture = moves.some((move) => move.captured) || Boolean(piece);
        squareEl.classList.add(isCapture ? 'legal-capture' : 'legal-destination');
      }

      if (piece && piece.color === state.game.turn() && canMoveColor(piece.color)) {
        squareEl.setAttribute('draggable', 'true');
      }

      if (piece) {
        const pieceEl = document.createElement('span');
        pieceEl.className = `piece ${piece.color === 'w' ? 'white' : 'black'}`;
        pieceEl.textContent = PIECES[piece.color][piece.type];
        pieceEl.setAttribute('aria-hidden', 'true');
        squareEl.appendChild(pieceEl);
      }

      if (file === files[0]) {
        const rankEl = document.createElement('span');
        rankEl.className = 'coord-rank';
        rankEl.textContent = rank;
        squareEl.appendChild(rankEl);
      }
      if (rank === ranks[ranks.length - 1]) {
        const fileEl = document.createElement('span');
        fileEl.className = 'coord-file';
        fileEl.textContent = file;
        squareEl.appendChild(fileEl);
      }

      board.appendChild(squareEl);
    }
  }
}

function renderStatus() {
  const turn = state.game.turn();
  const turnText = `${colorName(turn)} to move${state.game.isCheck() ? ' • check' : ''}${state.enemyThinking ? ' • enemy selecting database reply…' : ''}`;
  $('turn-status').textContent = turnText;

  const status = getGameStatusText();
  $('game-status').textContent = status;
  $('playing-as-pill').textContent = `You: ${colorName(state.playerColor)} • ≥${formatDepth(currentDepth())}`;
  if ($('mistake-total')) $('mistake-total').textContent = String(state.mistakes);

  const result = currentResult();
  $('resign-btn').disabled = result !== '*';
  $('draw-btn').disabled = result !== '*';
  $('undo-btn').disabled = state.game.history().length === 0;
}

function renderPlayers() {
  const orientation = getOrientation();
  const bottomColor = orientation === 'white' ? 'w' : 'b';
  const topColor = opposite(bottomColor);
  setPlayerStrip('top', topColor);
  setPlayerStrip('bottom', bottomColor);
}

function setPlayerStrip(position, color) {
  const name = color === 'w' ? state.whiteName : state.blackName;
  const isAssignedSide = color === state.playerColor;
  const meta = isAssignedSide ? 'Your side' : 'Enemy database side';
  $(`${position}-player-name`).textContent = name;
  $(`${position}-player-meta`).textContent = meta;
  $(`${position}-player-color`).className = `mini-color ${color === 'b' ? 'black' : 'white'}`;
}

function renderMoveList() {
  const history = state.game.history({ verbose: true });
  $('move-count').textContent = `${history.length} ${history.length === 1 ? 'ply' : 'plies'}`;
  const moveList = $('move-list');
  moveList.innerHTML = '';

  if (!history.length) {
    const empty = document.createElement('div');
    empty.className = 'muted';
    empty.textContent = 'Moves will appear here.';
    moveList.appendChild(empty);
  } else {
    for (let i = 0; i < history.length; i += 2) {
      const row = document.createElement('div');
      row.className = 'move-row';
      const number = document.createElement('span');
      number.textContent = `${Math.floor(i / 2) + 1}.`;
      const white = document.createElement('span');
      white.textContent = history[i]?.san || '';
      const black = document.createElement('span');
      black.textContent = history[i + 1]?.san || '';
      row.append(number, white, black);
      moveList.appendChild(row);
    }
    moveList.scrollTop = moveList.scrollHeight;
  }

  const captures = capturedPieces(history);
  $('white-captures').textContent = captures.white || '—';
  $('black-captures').textContent = captures.black || '—';
}

function getGameStatusText() {
  if (state.overrideResult) return `${state.overrideReason} • ${state.overrideResult}`;
  if (state.game.isCheckmate()) return `Checkmate • ${colorName(opposite(state.game.turn()))} wins`;
  if (state.game.isStalemate()) return 'Draw • stalemate';
  if (state.game.isInsufficientMaterial()) return 'Draw • insufficient material';
  if (state.game.isThreefoldRepetition()) return 'Draw • threefold repetition';
  if (state.game.isDrawByFiftyMoves()) return 'Draw • fifty-move rule';
  if (state.game.isDraw()) return 'Draw';
  if (state.trainingComplete) return 'Opening completed';
  if (state.game.isCheck()) return 'Check';
  if (state.enemyThinking) return 'Enemy choosing most popular database response';
  return state.game.turn() === state.playerColor ? 'Your move • database chooser' : 'Enemy database reply pending';
}

function capturedPieces(history) {
  const white = [];
  const black = [];
  for (const move of history) {
    if (!move.captured) continue;
    if (move.color === 'w') white.push(PIECES.b[move.captured]);
    else black.push(PIECES.w[move.captured]);
  }
  return { white: white.join(''), black: black.join('') };
}

function findKingSquare(color) {
  for (const file of FILES) {
    for (const rank of RANKS) {
      const square = `${file}${rank}`;
      const piece = state.game.get(square);
      if (piece?.type === 'k' && piece.color === color) return square;
    }
  }
  return null;
}

function getOrientation() {
  if (state.orientationMode === 'player') return state.playerColor === 'w' ? 'white' : 'black';
  return state.orientationMode;
}

function scheduleExplorerFetch(delay = 450) {
  clearTimeout(state.explorerDebounce);
  setExplorerPill('Explorer: queued', 'soft');
  state.explorerDebounce = setTimeout(() => fetchExplorer(), delay);
}

async function fetchExplorer(options = {}) {
  const fen = state.game.fen();

  if (state.explorerAbort) state.explorerAbort.abort();
  state.explorerAbort = new AbortController();
  setExplorerPill('Explorer: loading fixed sources', 'soft');
  renderExplorerMessage('Looking up Masters database and Lichess 2500+ rapid/classical/correspondence games…', true);

  try {
    const results = [];
    for (const fixedSource of FIXED_EXPLORER_SOURCES) {
      const data = await requestExplorerData(fen, {
        force: options.force,
        signal: state.explorerAbort.signal,
        fixedSource: fixedSource.source,
      });
      results.push({ ...fixedSource, data });
    }

    if (fen !== state.game.fen()) return;
    state.lastExplorerFen = fen;
    state.lastExplorerData = Object.fromEntries(results.map((result) => [result.source, result.data]));
    renderOpeningFromResults(results);

    if (state.game.turn() === state.playerColor) {
      state.enemyThinking = false;
      state.enemyPaused = false;
      renderPlayerMoveChooser(results, fen);
    } else {
      renderEnemyReplyChooser(results, fen);
    }
  } catch (error) {
    if (error.name === 'AbortError') return;
    renderExplorerError(error);
    setExplorerPill('Explorer: offline', 'soft');
  }
}

async function requestExplorerData(fen, options = {}) {
  const config = getExplorerConfig(options.fixedSource || 'lichess');
  const cacheKey = JSON.stringify({ fen, config: { ...config, token: Boolean(config.token) } });
  if (!options.force && state.explorerCache.has(cacheKey)) return state.explorerCache.get(cacheKey);

  const url = buildExplorerUrl(fen, config);
  const headers = {
    Accept: 'application/json',
  };
  if (config.token) headers.Authorization = normalizeBearerToken(config.token);

  const response = await fetch(url, {
    method: 'GET',
    headers,
    signal: options.signal,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw makeHttpError(response.status, body, config.source);
  }

  const data = parseExplorerPayload(await response.text());

  state.explorerCache.set(cacheKey, data);
  if (state.explorerCache.size > 80) {
    const firstKey = state.explorerCache.keys().next().value;
    state.explorerCache.delete(firstKey);
  }
  return data;
}

function getExplorerConfig(source = 'lichess') {
  const fixedSource = FIXED_EXPLORER_SOURCES.find((entry) => entry.source === source) || FIXED_EXPLORER_SOURCES[1];
  return {
    source: fixedSource.source,
    label: fixedSource.label,
    speeds: fixedSource.speeds || [],
    ratings: fixedSource.ratings || [],
    since: '',
    until: '',
    moves: fixedSource.moves || 100,
    topGames: fixedSource.topGames || 4,
    recentGames: fixedSource.recentGames || 4,
    token: $('api-token')?.value.trim() || readSession(TOKEN_KEY) || '',
    useProxy: Boolean($('proxy-toggle')?.checked),
  };
}

function buildExplorerUrl(fen, config) {
  const useProxy = config.useProxy && state.serverProxyAvailable;
  const endpoint = useProxy ? `./api/explorer/${config.source}` : `${EXPLORER_HOST}/${config.source}`;
  const params = new URLSearchParams();
  params.set('fen', fen);
  params.set('moves', String(config.moves));

  if (config.source === 'masters') {
    params.set('topGames', String(config.topGames || 8));
  } else {
    params.set('variant', 'standard');
    params.set('topGames', String(config.topGames || 4));
    params.set('recentGames', String(config.recentGames || 4));
    params.set('speeds', config.speeds.join(','));
    params.set('ratings', config.ratings.join(','));
  }

  return `${endpoint}?${params.toString()}`;
}

function parseExplorerPayload(text) {
  const trimmed = text.trim();
  if (!trimmed) return {};
  try {
    return JSON.parse(trimmed);
  } catch {
    const objects = trimmed.split('\n').map(parseMaybeJsonLine).filter(Boolean);
    return objects.at(-1) || {};
  }
}

function parseMaybeJsonLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function renderOpeningFromResults(results) {
  const openingData = results.find((result) => result.data?.opening)?.data?.opening;
  if (openingData) {
    $('opening-name').textContent = `${openingData.eco ? `${openingData.eco} ` : ''}${openingData.name || 'Known opening'}`;
  } else if (!state.game.history().length) {
    $('opening-name').textContent = 'Starting position';
  } else {
    $('opening-name').textContent = 'Uncatalogued position';
  }
}

function renderPlayerMoveChooser(results, fen) {
  const minDepth = currentDepth();
  const combined = buildCombinedMoveList(results, state.playerColor);
  const plan = choosePlayerCandidatePlan(combined, minDepth, state.playerColor, state.movePolicy);
  const sourceSummary = summarizeResultTotals(results);

  if (!plan.candidates.length) {
    completeOpeningAtDepth(minDepth, 'no-player-candidates');
    return;
  }

  setExplorerPill('Explorer: database moves', '');
  renderDatabaseMovePlan(plan, minDepth, sourceSummary);
  renderReferenceGames(results);
}

function renderEnemyReplyChooser(results, fen) {
  const trainingDepth = currentDepth();
  const enemyColor = state.game.turn();
  const combined = buildCombinedMoveList(results, enemyColor);
  const candidates = combined.sort((a, b) => candidatePopularity(b) - candidatePopularity(a));
  const uncompletedCandidates = candidates.filter((entry) => !isCompletedEnemyCandidate(trainingDepth, entry.uci));
  const sourceSummary = summarizeResultTotals(results);

  const summary = $('explorer-summary');
  summary.innerHTML = '';
  const dot = document.createElement('span');
  dot.className = 'loader-dot';
  summary.appendChild(dot);
  const text = document.createElement('span');
  text.textContent = `${sourceSummary}. Enemy chooses the most popular uncompleted response from Masters or Lichess 2500+ rapid/classical/correspondence. Game count and score are ignored for enemy moves.`;
  summary.appendChild(text);

  $('moves-table').innerHTML = '';
  $('games-list').innerHTML = '';

  if (!candidates.length) {
    completeOpeningAtDepth(trainingDepth, 'no-enemy-candidates');
    return;
  }

  if (!uncompletedCandidates.length) {
    if (isAfterFirstPlayerMove() && state.mistakes === 0) {
      completeColorDepth(trainingDepth, state.playerColor);
    } else {
      completeOpeningAtDepth(trainingDepth, state.mistakes === 0 ? 'all-enemy-candidates-completed' : 'all-enemy-candidates-completed-with-mistakes');
    }
    return;
  }

  state.enemyThinking = true;
  state.enemyPaused = false;
  setExplorerPill('Enemy: most popular response', 'soft');
  renderEnemyCandidateList(uncompletedCandidates, candidates.length - uncompletedCandidates.length);
  renderReferenceGames(results);
  renderAll();

  if (state.enemyTimer) clearTimeout(state.enemyTimer);
  state.enemyTimer = setTimeout(() => {
    if (fen !== state.game.fen() || state.game.turn() !== enemyColor || isGameFinished()) return;
    const picked = uncompletedCandidates[0];
    playEnemyUci(picked.uci);
  }, 650);
}

function buildCombinedMoveList(results, colorForScores) {
  const legal = new Map(state.game.moves({ verbose: true }).map((move) => [toUci(move), move]));
  const combined = new Map();

  for (const result of results) {
    for (const move of result.data?.moves || []) {
      if (!move?.uci || !legal.has(move.uci)) continue;
      if (!combined.has(move.uci)) {
        const legalMove = legal.get(move.uci);
        combined.set(move.uci, {
          uci: move.uci,
          san: move.san || legalMove.san,
          legalMove,
          sources: {},
        });
      }
      const entry = combined.get(move.uci);
      entry.sources[result.source] = buildMoveStats(move, colorForScores);
    }
  }

  return [...combined.values()];
}

function buildMoveStats(move, colorForScores) {
  const total = moveTotal(move);
  const whiteScore = total ? ((move.white || 0) + 0.5 * (move.draws || 0)) / total * 100 : 0;
  const blackScore = total ? ((move.black || 0) + 0.5 * (move.draws || 0)) / total * 100 : 0;
  return {
    total,
    white: move.white || 0,
    draws: move.draws || 0,
    black: move.black || 0,
    whiteScore,
    blackScore,
    colorScore: colorForScores === 'w' ? whiteScore : blackScore,
    averageOpponentRating: move.averageOpponentRating || move.averageRating || null,
  };
}

function choosePlayerCandidatePlan(entries, minDepth, color, policy) {
  const masterEligible = sortBySourceScore(entries.filter((entry) => isEligibleForColor(entry, 'masters', minDepth, color)), 'masters', color);
  const lichessEligible = sortBySourceScore(entries.filter((entry) => isEligibleForColor(entry, 'lichess', minDepth, color)), 'lichess', color);

  if (policy === 'masterFirst') {
    if (masterEligible.length) {
      return {
        mode: 'database',
        policy,
        title: `Masters lane: ${formatDepth(minDepth)}+ qualification games and ${colorName(color)} score ≥ 50%`,
        description: 'Masters has positive-score candidates, so this lane is trained first. Qualification games are combined when both databases score ≥50%; otherwise the larger game count is used.',
        candidates: masterEligible,
        masterEligible,
        lichessEligible,
        activeSource: 'masters',
      };
    }
    if (lichessEligible.length) {
      return {
        mode: 'database',
        policy,
        title: `Lichess lane: no Masters qualifiers; using Lichess 2500+`,
        description: 'Lichess is used because Masters has no qualifying positive-score move at this depth. Qualification still uses the combined/higher-count rule.',
        candidates: lichessEligible,
        masterEligible,
        lichessEligible,
        activeSource: 'lichess',
      };
    }
    return { mode: 'none', policy, candidates: [], masterEligible, lichessEligible, activeSource: null };
  }

  const combined = entries.filter((entry) => getMoveQualification(entry, color).qualifiesAt(minDepth));
  return {
    mode: combined.length ? 'database' : 'none',
    policy,
    title: `Merged lanes: ${formatDepth(minDepth)}+ qualification games and ${colorName(color)} score ≥ 50%`,
    description: 'Moves qualify if either database has your color score ≥50%. If both are positive, game counts combine; if only one is positive, the larger game count is used.',
    candidates: sortCombinedByBestScore(combined, color),
    masterEligible,
    lichessEligible,
    activeSource: 'combined',
  };
}

function getMoveQualification(entry, color) {
  const masters = entry.sources.masters || null;
  const lichess = entry.sources.lichess || null;
  const mastersGames = masters?.total || 0;
  const lichessGames = lichess?.total || 0;
  const mastersScore = masters ? scoreForColorStats(masters, color) : null;
  const lichessScore = lichess ? scoreForColorStats(lichess, color) : null;
  const mastersPositive = mastersScore !== null && mastersScore >= 50;
  const lichessPositive = lichessScore !== null && lichessScore >= 50;
  const positiveCount = Number(mastersPositive) + Number(lichessPositive);
  const qualificationGames = positiveCount === 2
    ? mastersGames + lichessGames
    : positiveCount === 1
      ? Math.max(mastersGames, lichessGames)
      : 0;

  return {
    masters,
    lichess,
    mastersGames,
    lichessGames,
    mastersScore,
    lichessScore,
    mastersPositive,
    lichessPositive,
    positiveCount,
    qualificationGames,
    qualifiesAt: (minDepth) => positiveCount > 0 && qualificationGames >= minDepth,
  };
}

function isEligibleForColor(entry, source, minDepth, color) {
  const q = getMoveQualification(entry, color);
  if (!q.qualifiesAt(minDepth)) return false;
  return source === 'masters' ? q.mastersPositive : q.lichessPositive;
}

function scoreForColorStats(stats, color) {
  return color === 'w' ? stats.whiteScore : stats.blackScore;
}

function sortBySourceScore(entries, source, color) {
  return [...entries].sort((a, b) => {
    const aStats = a.sources[source];
    const bStats = b.sources[source];
    return scoreForColorStats(bStats, color) - scoreForColorStats(aStats, color) || bStats.total - aStats.total;
  });
}

function sortCombinedByBestScore(entries, color) {
  return [...entries].sort((a, b) => bestEligibleScore(b, color) - bestEligibleScore(a, color) || bestGames(b, color) - bestGames(a, color));
}

function bestEligibleScore(entry, color) {
  return Math.max(
    entry.sources.masters ? scoreForColorStats(entry.sources.masters, color) : -Infinity,
    entry.sources.lichess ? scoreForColorStats(entry.sources.lichess, color) : -Infinity,
  );
}

function bestGames(entry, color = state.playerColor) {
  return getMoveQualification(entry, color).qualificationGames;
}

function renderDatabaseMovePlan(plan, minDepth, sourceSummary) {
  const summary = $('explorer-summary');
  summary.innerHTML = '';
  const dot = document.createElement('span');
  dot.className = 'loader-dot';
  dot.style.animation = 'none';
  summary.appendChild(dot);
  const text = document.createElement('span');
  text.textContent = `${sourceSummary}. Showing ${plan.candidates.length} line move${plan.candidates.length === 1 ? '' : 's'} for ${colorName(state.playerColor)} at ≥${formatDepth(minDepth)} qualification games and ≥50% ${colorName(state.playerColor)} score.`;
  summary.appendChild(text);

  const container = $('moves-table');
  container.innerHTML = '';
  const heading = document.createElement('div');
  heading.className = 'explorer-section-heading';
  heading.innerHTML = `<strong>${plan.title}</strong><small>${plan.description}</small>`;
  container.appendChild(heading);

  for (const entry of plan.candidates) {
    container.appendChild(createDatabaseMoveCard(entry, plan.activeSource));
  }
}

function createDatabaseMoveCard(entry, activeSource, displayColor = state.playerColor) {
  const card = document.createElement('article');
  card.className = 'explorer-move combined-move-card';

  const main = document.createElement('div');
  main.className = 'explorer-move-main';

  const button = document.createElement('button');
  button.className = 'move-san-btn';
  button.dataset.uci = entry.uci;
  button.textContent = entry.san || entry.uci;
  button.disabled = !canMoveColor(state.game.turn()) || state.game.turn() !== state.playerColor;
  button.title = button.disabled ? 'Move is unavailable right now.' : 'Play this database-qualified move';

  const meta = document.createElement('div');
  meta.className = 'move-meta';
  const qualification = getMoveQualification(entry, displayColor);
  meta.textContent = activeSource === 'combined'
    ? `Qualified by merged lanes • ${formatNumber(qualification.qualificationGames)} qualification games.`
    : `Selected by ${activeSource === 'masters' ? 'Masters' : 'Lichess'} lane • ${formatNumber(qualification.qualificationGames)} qualification games.`;

  main.append(button, meta);

  const stats = document.createElement('div');
  stats.className = 'source-stat-grid';
  stats.appendChild(createSourceStat('Masters', entry.sources.masters, displayColor));
  stats.appendChild(createSourceStat('Lichess 2500+', entry.sources.lichess, displayColor));

  card.append(main, stats);
  return card;
}

function createSourceStat(label, stats, color) {
  const box = document.createElement('div');
  box.className = `source-stat ${stats ? '' : 'empty'}`;
  if (!stats) {
    box.innerHTML = `<strong>${label}</strong><span>No move in source</span>`;
    return box;
  }
  const score = scoreForColorStats(stats, color);
  const positive = score >= 50 ? 'positive lane' : 'supporting games';
  box.innerHTML = `
    <strong>${label}</strong>
    <span>${formatNumber(stats.total)} games • ${positive}</span>
    <span>${colorName(color)} score ${score.toFixed(1)}%</span>
    <span>W ${stats.whiteScore.toFixed(0)}% / B ${stats.blackScore.toFixed(0)}%</span>
  `;
  return box;
}


function renderEnemyCandidateList(candidates, skippedCompleted = 0) {
  const container = $('moves-table');
  container.innerHTML = '';
  const heading = document.createElement('div');
  heading.className = 'explorer-section-heading enemy-heading';
  heading.innerHTML = `<strong>Enemy most-popular database reply pool</strong><small>${candidates.length} uncompleted legal response${candidates.length === 1 ? '' : 's'} from Masters or Lichess 2500+ rapid/classical/correspondence. Game count and score are ignored. ${skippedCompleted ? `${skippedCompleted} completed zero-mistake option${skippedCompleted === 1 ? '' : 's'} skipped. ` : ''}The most popular option will be played automatically.</small>`;
  container.appendChild(heading);

  for (const entry of candidates) {
    const card = createDatabaseMoveCard(entry, 'combined', state.game.turn());
    card.classList.add('enemy-candidate');
    const meta = card.querySelector('.move-meta');
    if (meta) meta.textContent = 'Enemy most-popular pool: games threshold only. Color score ignored.';
    card.querySelector('button')?.setAttribute('disabled', 'disabled');
    container.appendChild(card);
  }
}

function renderEnemyNoMove() {
  const container = $('moves-table');
  container.innerHTML = '';
  const empty = document.createElement('div');
  empty.className = 'explorer-section-heading enemy-heading';
  empty.innerHTML = `<strong>No enemy database reply</strong><small>No uncompleted legal Masters or Lichess 2500+ response was returned. This branch stops here, but it is only saved as learned when your side runs out of qualifying moves with zero mistakes.</small>`;
  container.appendChild(empty);
}

function renderReferenceGames(results) {
  const container = $('games-list');
  container.innerHTML = '';
  for (const result of results) {
    renderExplorerGames(result.data, result.source, container, {
      clear: false,
      title: `${result.shortLabel} reference games`,
    });
  }
}

function playEnemyUci(uci) {
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  const promotion = uci.length > 4 ? uci.slice(4, 5) : undefined;
  state.enemyThinking = false;
  state.enemyPaused = false;
  let made = null;
  try {
    made = state.game.move({ from, to, promotion });
  } catch {
    made = null;
  }
  if (made) {
    toast(`Enemy played ${made.san} as the most popular uncompleted database response.`);
    afterMove(made, { skipValidation: true });
  } else {
    renderAll();
    toast('Enemy selected an illegal/stale move; refresh the explorer.');
  }
}


function candidatePopularity(entry) {
  return (entry.sources.masters?.total || 0) + (entry.sources.lichess?.total || 0);
}

async function validatePlayerMoveQuality(preMoveFen, move, postMoveHistory) {
  const uci = toUci(move);

  let validationData = state.lastExplorerFen === preMoveFen ? state.lastExplorerData : null;
  try {
    validationData ||= await getValidationExplorerData(preMoveFen);
  } catch (error) {
    console.warn('Database validation lookup failed:', error);
  }

  if (validationData && isMoveDatabaseAcceptableAtFloor(uci, state.playerColor, 500, validationData)) {
    queueCoachForAcceptedMove(preMoveFen, move, validationData);
    return true;
  }

  if (!arraysEqual(getHistoryUcis(), postMoveHistory)) return null;

  // Fail open if validation data is unavailable. This prevents false mistakes
  // when the explorer API is unavailable or still loading.
  if (!validationData) {
    toast('Move validation was unavailable; move accepted without mistake.');
    return true;
  }

  recordMistakeMove(preMoveFen, move, validationData);
  addMistake();
  return false;
}

async function getValidationExplorerData(fen) {
  const results = {};
  for (const fixedSource of FIXED_EXPLORER_SOURCES) {
    results[fixedSource.source] = await requestExplorerData(fen, {
      fixedSource: fixedSource.source,
    });
  }
  return results;
}

function undoRejectedPlayerMove(expectedHistory) {
  if (!arraysEqual(getHistoryUcis(), expectedHistory)) return;
  if (state.enemyTimer) clearTimeout(state.enemyTimer);
  state.enemyThinking = false;
  state.enemyPaused = false;
  state.trainingComplete = false;
  state.game.undo();
  const history = state.game.history({ verbose: true });
  const last = history.at(-1);
  state.lastMove = last ? { from: last.from, to: last.to, san: last.san, color: last.color } : null;
  state.selected = null;
  state.legalMoves = [];
  syncResultHeader();
  renderAll();
  saveCurrentGameState();
  renderExplorerMessage('Move undone. Try another candidate that meets the database rule.');
  setExplorerPill('Move rejected', 'soft');
  scheduleExplorerFetch(350);
}

function isMoveDatabaseAcceptableAtFloor(uci, color, minGames, dataBySource = state.lastExplorerData || {}) {
  const entry = { uci, sources: {} };
  for (const source of ['masters', 'lichess']) {
    const move = dataBySource[source]?.moves?.find((candidate) => candidate.uci === uci);
    if (move) entry.sources[source] = buildMoveStats(move, color);
  }
  return getMoveQualification(entry, color).qualifiesAt(minGames);
}


function recordMistakeMove(fen, move, validationData) {
  if (!fen || !move) return;
  const uci = toUci(move);
  const entry = {
    uci,
    san: move.san || uci,
    fen,
    moveNumber: state.game.moveNumber ? state.game.moveNumber() : null,
    color: state.playerColor,
    stats: summarizeMoveForCoach(uci, state.playerColor, validationData),
  };
  const list = state.pendingMistakesByFen.get(fen) || [];
  list.push(entry);
  state.pendingMistakesByFen.set(fen, list);
  saveCurrentGameState();
}

function queueCoachForAcceptedMove(fen, move, validationData) {
  const mistakes = state.pendingMistakesByFen.get(fen) || [];
  if (!mistakes.length) return;

  if (!state.aiCoachEnabled) return;
  const key = $('openrouter-key')?.value.trim() || readSession(OPENROUTER_KEY);
  if (!key) {
    showCoachMessage(
      'AI mentor not connected',
      'I noticed your corrected move after those rejected attempts, but I need an OpenRouter API key before I can explain it. Add one under “AI line mentor,” then future corrected moves will get a full explanation.',
    );
    return;
  }
  state.pendingMistakesByFen.delete(fen);
  saveCurrentGameState();

  const accepted = {
    uci: toUci(move),
    san: move.san || toUci(move),
    fen,
    color: state.playerColor,
    stats: summarizeMoveForCoach(toUci(move), state.playerColor, validationData),
  };

  requestCoachExplanation({ fen, accepted, mistakes, validationData, key }).catch((error) => {
    showCoachMessage('AI mentor error', `OpenRouter could not generate an explanation: ${error.message || error}`);
  });
}

function summarizeMoveForCoach(uci, color, dataBySource = {}) {
  const entry = { uci, sources: {} };
  for (const source of ['masters', 'lichess']) {
    const move = dataBySource[source]?.moves?.find((candidate) => candidate.uci === uci);
    if (move) entry.sources[source] = buildMoveStats(move, color);
  }
  const q = getMoveQualification(entry, color);
  return {
    qualificationGames: q.qualificationGames,
    qualifies500: q.qualifiesAt(500),
    masters: q.masters ? simplifySourceStats(q.masters, color) : null,
    lichess: q.lichess ? simplifySourceStats(q.lichess, color) : null,
    mastersPositive: q.mastersPositive,
    lichessPositive: q.lichessPositive,
  };
}

function simplifySourceStats(stats, color) {
  return {
    games: stats.total,
    colorScore: Number(scoreForColorStats(stats, color).toFixed(1)),
    whiteScore: Number(stats.whiteScore.toFixed(1)),
    blackScore: Number(stats.blackScore.toFixed(1)),
    whiteWins: stats.white,
    draws: stats.draws,
    blackWins: stats.black,
  };
}

function buildCoachContext({ fen, accepted, mistakes, validationData }) {
  const historyAfter = getHistoryUcis();
  const historyBefore = historyAfter.slice(0, -1);
  const opening = validationData?.masters?.opening || validationData?.lichess?.opening || null;
  return {
    app: 'LineForge',
    task: 'Explain the practical chess reason the accepted move is better than the rejected attempts. Do not use database evidence in the explanation.',
    sideToCoach: colorName(state.playerColor),
    fenBeforeAcceptedMove: fen,
    opening: opening ? { eco: opening.eco || null, name: opening.name || null } : null,
    moveHistoryUciBefore: historyBefore,
    acceptedMove: moveForCoachOnly(accepted),
    rejectedAttempts: mistakes.map(moveForCoachOnly),
    forbiddenTopics: ['database stats', 'Lichess', 'Masters', 'scores', 'percentages', 'game counts', 'win rates', 'popularity'],
    desiredStyle: 'Plain English, 3 to 5 short sentences, raw chess ideas only.',
  };
}

function moveForCoachOnly(move) {
  return {
    san: move.san,
    uci: move.uci,
  };
}

function summarizeTopMovesForCoach(dataBySource = {}, color) {
  const map = new Map();
  for (const source of ['masters', 'lichess']) {
    for (const move of dataBySource[source]?.moves?.slice(0, 18) || []) {
      if (!map.has(move.uci)) map.set(move.uci, { uci: move.uci, san: move.san, sources: {} });
      map.get(move.uci).sources[source] = simplifySourceStats(buildMoveStats(move, color), color);
    }
  }
  return [...map.values()].slice(0, 20);
}

async function requestCoachExplanation(payload) {
  const id = ++state.coachRequestId;
  let requestedModel = $('openrouter-model')?.value.trim() || state.openRouterModel || DEFAULT_OPENROUTER_MODEL;
  if (DEPRECATED_OPENROUTER_MODELS.has(requestedModel)) requestedModel = DEFAULT_OPENROUTER_MODEL;
  state.openRouterModel = requestedModel;
  if ($('openrouter-model')) $('openrouter-model').value = requestedModel;
  saveCoachPreferences();
  showCoachMessage('Thinking...', 'I am comparing your rejected attempts with the line move you found. One moment.');

  const context = buildCoachContext(payload);
  const messages = [
    {
      role: 'system',
      content: 'You are the LineForge Mentor, a friendly chess opening coach for club players. Keep the explanation very short and accessible. Explain the accepted move as a practical chess idea, then briefly say why the rejected attempt or attempts were less useful. Do not analyze every rejected move one by one unless there is only one. Group similar mistakes together. Avoid jargon unless you explain it in plain words. Do not discuss databases, Lichess, Masters, numbers, percentages, scores, win rates, game counts, qualification games, API rules, model names, statistics, popularity, or reliability. Output plain ASCII text only: no Markdown, no bullets, no tables, no emojis, no arrows, no chess figurines, no special Unicode symbols. Maximum 90 words. Use 3 to 5 short sentences total.',
    },
    {
      role: 'user',
      content: `In 90 words or fewer, explain why the accepted move is practically better than the rejected attempts. Talk only about raw chess ideas. Do not mention databases, Lichess, Masters, scores, percentages, game counts, win rates, popularity, or reliability. Do not cover every rejected move separately; group the mistakes into one simple idea if possible. Use plain ASCII text only. Use this JSON context only to identify the position and moves:\n${JSON.stringify(context, null, 2)}`,
    },
  ];

  const models = uniqueStrings([requestedModel, ...OPENROUTER_FALLBACK_MODELS]);
  const errors = [];
  for (let i = 0; i < models.length; i += 1) {
    const model = models[i];
    if (id !== state.coachRequestId) return;
    showCoachMessage('Thinking...', `Trying ${model}${i ? ' after the previous model was unavailable' : ''}...`);
    try {
      const explanation = await callOpenRouterModel({ key: payload.key, model, messages });
      if (id !== state.coachRequestId) return;
      state.openRouterModel = model;
      if ($('openrouter-model')) $('openrouter-model').value = model;
      saveCoachPreferences();
      showCoachMessage('Why that line move was better', cleanCoachExplanation(explanation, context));
      return;
    } catch (error) {
      errors.push(`${model}: ${error.message || error}`);
      const suggested = extractSuggestedOpenRouterSlug(error.message || '');
      if (suggested && !models.includes(suggested)) models.push(suggested);
    }
  }

  throw new Error(errors.join(' | '));
}

async function callOpenRouterModel({ key, model, messages }) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': location.href,
      'X-Title': 'LineForge',
    },
    body: JSON.stringify({
      model,
      temperature: 0.35,
      max_tokens: 220,
      messages,
    }),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`OpenRouter ${response.status}: ${text.slice(0, 500)}`);
  }
  const json = JSON.parse(text);
  const explanation = json.choices?.[0]?.message?.content?.trim();
  if (!explanation) throw new Error(`No explanation returned by ${model}.`);
  return explanation;
}

function extractSuggestedOpenRouterSlug(message) {
  return message.match(/use this slug instead:\s*([A-Za-z0-9_.~/:+-]+)/i)?.[1] || null;
}

function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean))];
}


function cleanCoachExplanation(message, context) {
  const plain = toPlainAscii(message).replace(/\s+/g, ' ').trim();
  const sentences = plain.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [];
  const cleanSentences = sentences
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence && !hasStatsLanguage(sentence));
  const cleaned = cleanSentences.join(' ').trim();
  if (cleaned && !hasStatsLanguage(cleaned)) return limitWords(cleaned, 95);
  return fallbackCoachExplanation(context);
}

function hasStatsLanguage(text) {
  return /\b(database|databases|lichess|masters?|score|scores|scored|scoring|percentage|percent|statistics?|stats?|games?|winrate|rates?|wins?|won|draws?|losses|loses|lost|ratio|ratios|popular|popularity|reliable|reliability|qualification|api)\b|%|\d+\s*percent/i.test(text);
}

function fallbackCoachExplanation(context) {
  const accepted = context?.acceptedMove?.san || context?.acceptedMove?.uci || 'the accepted move';
  const rejected = (context?.rejectedAttempts || []).map((move) => move.san || move.uci).filter(Boolean);
  const rejectedText = rejected.length ? `Moves like ${rejected.slice(0, 3).join(', ')} did less to improve your setup.` : 'The rejected attempts did less to improve your setup.';
  return `${accepted} fits the position better because it helps your pieces work together and keeps your plan flexible. ${rejectedText} Aim for moves that improve a piece, support the center, and make castling or king safety easier. This move is the cleaner step in the line.`;
}

function limitWords(text, maxWords) {
  const words = text.split(/\s+/).filter(Boolean);
  return words.length <= maxWords ? text : `${words.slice(0, maxWords).join(' ')}.`;
}

function showCoachMessage(status, message) {
  const coach = $('ai-coach');
  const statusEl = $('coach-status');
  const messageEl = $('coach-message');
  if (!coach || !statusEl || !messageEl) return;
  statusEl.textContent = toPlainAscii(status);
  messageEl.innerHTML = formatCoachMessage(message);
  coach.classList.remove('hidden');
}

function formatCoachMessage(message) {
  const plain = toPlainAscii(message)
    .replace(/\*\*/g, '')
    .replace(/__/g, '')
    .replace(/`/g, '')
    .replace(/^\s*#{1,6}\s*/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .trim();
  const paragraphs = plain.split(/\n\s*\n|\r?\n/).map((part) => part.trim()).filter(Boolean);
  if (!paragraphs.length) return '<p></p>';
  return paragraphs.map((part) => `<p>${escapeHtml(part)}</p>`).join('');
}

function toPlainAscii(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—−]/g, '-')
    .replace(/…/g, '...')
    .replace(/≥/g, '>=')
    .replace(/≤/g, '<=')
    .replace(/→|⇒|⟶/g, '->')
    .replace(/←|⇐|⟵/g, '<-')
    .replace(/×/g, 'x')
    .replace(/•/g, '-')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function hideCoach() {
  $('ai-coach')?.classList.add('hidden');
}

function addMistake() {
  state.mistakes += 1;
  saveCurrentGameState();
  toast('Hmm, try making a better move!');
  renderStatus();
}

function completeOpeningAtDepth(depth, reason) {
  state.enemyThinking = false;
  state.enemyPaused = false;
  state.trainingComplete = true;
  const learned = reason === 'no-player-candidates';
  const message = learned
    ? `Congrats, youve learned this opening with ${state.mistakes} mistakes at a depth of ${depth} games!`
    : `This branch has no uncompleted enemy response at a depth of ${depth} games.`;
  if (state.mistakes === 0 && learned) saveCompletedLine(depth, message);

  setExplorerPill('Opening completed', '');
  const summary = $('explorer-summary');
  summary.innerHTML = '';
  const dot = document.createElement('span');
  dot.className = 'loader-dot';
  dot.style.animation = 'none';
  summary.appendChild(dot);
  const text = document.createElement('span');
  text.textContent = message;
  summary.appendChild(text);

  const moves = $('moves-table');
  moves.innerHTML = '';
  const card = document.createElement('div');
  card.className = 'completion-card';
  const reasonText = completionReasonText(reason);
  card.innerHTML = `<strong>${message}</strong><small>${reasonText}${state.mistakes === 0 && learned ? ' This line was saved and will be skipped by the enemy at this depth.' : ' This did not save a new learned line because learning a line requires reaching no player candidates with zero mistakes.'}</small>`;
  moves.appendChild(card);
  $('games-list').innerHTML = '';
  saveCurrentGameState();
  toast(message);
  renderAll();
}


function completionReasonText(reason) {
  if (reason === 'no-player-candidates') return 'No qualifying database move exists for your side at this depth.';
  if (reason === 'all-enemy-candidates-completed') return 'All remaining enemy replies at this node were already completed with zero mistakes for this depth.';
  if (reason === 'all-enemy-candidates-completed-with-mistakes') return 'All enemy replies here are learned, but this run has mistakes, so it cannot complete the color-depth.';
  return 'No enemy database reply exists in the fixed Masters/Lichess sources.';
}


function completeColorDepth(depth, color) {
  const progress = ensureColorProgress();
  const colorProgress = progress[color];
  const depthIndex = DEPTH_TIERS.indexOf(depth);
  colorProgress.completedDepths ||= [];
  if (!colorProgress.completedDepths.includes(depth)) colorProgress.completedDepths.push(depth);

  let message;
  if (depthIndex >= DEPTH_TIERS.length - 1) {
    colorProgress.fullyLearned = true;
    colorProgress.maxDepthIndex = DEPTH_TIERS.length - 1;
    message = `You have already learned everything for ${colorName(color)} at 500 games. Use another color.`;
  } else {
    colorProgress.maxDepthIndex = Math.max(colorProgress.maxDepthIndex || 0, depthIndex + 1);
    const nextDepth = DEPTH_TIERS[colorProgress.maxDepthIndex];
    message = `${colorName(color)} at ${depth} games is complete. Max depth for ${colorName(color)} is now ${nextDepth} games.`;
  }

  saveColorProgress();
  state.trainingComplete = true;
  state.enemyThinking = false;
  state.enemyPaused = false;
  state.depthTierIndex = Math.max(state.depthTierIndex, colorProgress.maxDepthIndex || 0);
  updateDepthLabels();
  saveExplorerPreferences();
  saveCurrentGameState();
  renderColorDepthCompletion(message, colorProgress.fullyLearned);

  if (colorProgress.fullyLearned) forceAnotherColor(color);
}

function renderColorDepthCompletion(message, fullyLearned) {
  setExplorerPill(fullyLearned ? 'Color fully forged' : 'Depth complete', '');
  const summary = $('explorer-summary');
  summary.innerHTML = '';
  const dot = document.createElement('span');
  dot.className = 'loader-dot';
  dot.style.animation = 'none';
  summary.appendChild(dot);
  const text = document.createElement('span');
  text.textContent = message;
  summary.appendChild(text);

  const moves = $('moves-table');
  moves.innerHTML = '';
  const card = document.createElement('div');
  card.className = 'completion-card';
  card.innerHTML = `<strong>${escapeHtml(message)}</strong><small>${fullyLearned ? 'That color is complete at every depth. Start a run with the other color.' : 'LineForge lowered the max game depth for this color. Start a new run at the next depth.'}</small>`;
  moves.appendChild(card);
  $('games-list').innerHTML = '';
  toast(message);
  renderAll();
}

function forceAnotherColor(completedColor) {
  const other = opposite(completedColor);
  if (!isColorFullyLearned(other)) {
    $('setup-side').value = other === 'w' ? 'white' : 'black';
    setTimeout(() => safeShowModal($('setup-dialog')), 800);
  }
}

function isAfterFirstPlayerMove() {
  return state.game.history({ verbose: true }).filter((move) => move.color === state.playerColor).length === 1;
}

function choosePlayerColorForSetup(sideChoice) {
  const available = ['w', 'b'].filter((color) => !isColorFullyLearned(color));
  if (!available.length) return null;
  if (sideChoice === 'random') return available[Math.floor(Math.random() * available.length)];
  return sideChoice === 'black' ? 'b' : 'w';
}

function enforceDepthLimitForColor(color, options = {}) {
  const maxDepthIndex = getColorMaxDepthIndex(color);
  if (state.depthTierIndex < maxDepthIndex) {
    state.depthTierIndex = maxDepthIndex;
    updateDepthLabels();
    saveExplorerPreferences();
    if (options.announce) toast(`${colorName(color)} max depth is ${formatDepth(currentDepth())}; higher depths are already complete.`);
  }
}

function getColorMaxDepthIndex(color) {
  return ensureColorProgress()[color]?.maxDepthIndex || 0;
}

function isColorFullyLearned(color) {
  return Boolean(ensureColorProgress()[color]?.fullyLearned);
}

function loadColorProgress() {
  const stored = readJson(COLOR_PROGRESS_KEY, null);
  state.colorProgress = normalizeColorProgress(stored);
}

function ensureColorProgress() {
  if (!state.colorProgress) state.colorProgress = normalizeColorProgress(readJson(COLOR_PROGRESS_KEY, null));
  return state.colorProgress;
}

function normalizeColorProgress(stored) {
  const defaults = {
    w: { maxDepthIndex: 0, completedDepths: [], fullyLearned: false },
    b: { maxDepthIndex: 0, completedDepths: [], fullyLearned: false },
  };
  for (const color of ['w', 'b']) {
    const value = stored?.[color] || {};
    defaults[color] = {
      maxDepthIndex: Math.min(Math.max(Number(value.maxDepthIndex || 0), 0), DEPTH_TIERS.length - 1),
      completedDepths: Array.isArray(value.completedDepths) ? value.completedDepths : [],
      fullyLearned: Boolean(value.fullyLearned),
    };
  }
  return defaults;
}

function saveColorProgress() {
  writeJson(COLOR_PROGRESS_KEY, ensureColorProgress());
}

function saveCompletedLine(depth, message) {
  const completions = readJson(COMPLETIONS_KEY, {});
  const key = String(depth);
  const line = getHistoryUcis();
  completions[key] ||= [];
  if (!completions[key].some((entry) => arraysEqual(entry.line, line))) {
    completions[key].push({ line, color: state.playerColor, message, completedAt: new Date().toISOString() });
    writeJson(COMPLETIONS_KEY, completions);
  }
}

function isCompletedEnemyCandidate(depth, enemyUci) {
  const completions = readJson(COMPLETIONS_KEY, {});
  const entries = completions[String(depth)] || [];
  if (!entries.length) return false;
  const prefix = [...getHistoryUcis(), enemyUci];
  return entries.some((entry) => entry.color === state.playerColor && historyStartsWith(entry.line || [], prefix));
}

function getHistoryUcis() {
  return state.game.history({ verbose: true }).map(toUci);
}

function historyStartsWith(history, prefix) {
  if (!Array.isArray(history) || !Array.isArray(prefix) || history.length < prefix.length) return false;
  return prefix.every((move, index) => history[index] === move);
}

function arraysEqual(a, b) {
  return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, index) => value === b[index]);
}

function summarizeResultTotals(results) {
  return results.map((result) => `${result.shortLabel}: ${formatNumber(rootTotal(result.data))} games`).join(' • ');
}

function currentDepth() {
  const rawIndex = Number(state.depthTierIndex);
  const index = Math.min(Math.max(Number.isFinite(rawIndex) ? rawIndex : DEFAULT_DEPTH_INDEX, 0), DEPTH_TIERS.length - 1);
  return DEPTH_TIERS[index] || 1000;
}

function nextHigherDepth(depth) {
  const index = DEPTH_TIERS.indexOf(depth);
  if (index <= 0) return DEPTH_TIERS[0];
  return DEPTH_TIERS[index - 1];
}

function formatDepth(depth) {
  if (depth >= 1000) return `${formatNumber(depth / 1000)}k`;
  return String(depth);
}

function updateDepthLabels() {
  if ($('depth-slider')) $('depth-slider').value = String(state.depthTierIndex);
  if ($('depth-label')) $('depth-label').textContent = formatDepth(currentDepth());
  if ($('enemy-depth-label')) $('enemy-depth-label').textContent = 'any games';
  if ($('move-policy')) $('move-policy').value = state.movePolicy;
}

function renderExplorerData(data, source) {
  renderOpeningFromResults([{ source, data }]);
  renderExplorerMessage(`${source}: ${formatNumber(rootTotal(data))} games.`);
}

function renderExplorerGames(data, source, container = $('games-list'), options = {}) {
  if (options.clear !== false) container.innerHTML = '';
  const games = uniqueGames([...(data?.topGames || []), ...(data?.recentGames || [])]).slice(0, 7);
  if (!games.length) return;

  const title = document.createElement('div');
  title.className = 'section-title explorer-games-heading';
  title.style.marginTop = '0.5rem';
  title.innerHTML = `<span>${options.title || 'Reference games'}</span>`;
  container.appendChild(title);

  for (const game of games) {
    const link = document.createElement('a');
    link.className = 'game-link';
    link.href = gameUrl(game, source);
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.textContent = formatGameTitle(game);
    const small = document.createElement('small');
    small.textContent = formatGameMeta(game);
    link.appendChild(small);
    container.appendChild(link);
  }
}

function renderExplorerMessage(message, loading = false) {
  $('moves-table').innerHTML = '';
  $('games-list').innerHTML = '';
  const summary = $('explorer-summary');
  summary.innerHTML = '';
  const dot = document.createElement('span');
  dot.className = 'loader-dot';
  if (!loading) dot.style.animation = 'none';
  summary.appendChild(dot);
  const text = document.createElement('span');
  text.textContent = message;
  summary.appendChild(text);
}

function renderExplorerError(error) {
  state.enemyThinking = false;
  let message = error.message || 'Could not load opening statistics.';
  if (error.status === 401) {
    message = 'Lichess explorer returned 401 Unauthorized. On GitHub Pages/static hosting, paste a Lichess token into the tab token field. local-secrets.json only works with npm start or another backend proxy. Board play and PGN export still work.';
  } else if (error.status === 429) {
    message = 'Lichess rate limit reached. Wait a minute, then refresh the explorer.';
  }
  renderExplorerMessage(message);
  renderAll();
}

function makeHttpError(status, body, source) {
  const plainBody = body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
  const error = new Error(`Explorer ${source} request failed (${status})${plainBody ? `: ${plainBody}` : ''}`);
  error.status = status;
  return error;
}

function updateSourceVisibility() {
  // Explorer sources are intentionally hardcoded now: Masters + Lichess 2500+ rapid/classical/correspondence.
}


function closeOnboarding() {
  savePreferences();
  const dialog = $('onboarding-dialog');
  if (dialog?.open) dialog.close();
}

function showPgnDialog() {
  $('pgn-output').value = getPgn();
  safeShowModal($('pgn-dialog'));
  $('pgn-output').select();
}

function getPgn() {
  syncResultHeader();
  try {
    return state.game.pgn({ maxWidth: 92, newline: '\n' });
  } catch {
    return state.game.pgn();
  }
}

function downloadPgn() {
  const filenameDate = new Date().toISOString().slice(0, 10);
  const cleanWhite = slugify(state.whiteName || 'White');
  const cleanBlack = slugify(state.blackName || 'Black');
  downloadText(`lineforge-${cleanWhite}-vs-${cleanBlack}-${filenameDate}.pgn`, getPgn(), 'application/x-chess-pgn');
}

function syncResultHeader() {
  state.game.setHeader('Result', currentResult());
}

function currentResult() {
  if (state.overrideResult) return state.overrideResult;
  if (state.game.isCheckmate()) return state.game.turn() === 'w' ? '0-1' : '1-0';
  if (state.game.isDraw()) return '1/2-1/2';
  return '*';
}


function saveCurrentGameState() {
  try {
    const payload = {
      version: 1,
      savedAt: new Date().toISOString(),
      pgn: getPgn(),
      fen: state.game.fen(),
      playerColor: state.playerColor,
      sideChoice: state.sideChoice,
      playerName: state.playerName,
      opponentName: state.opponentName,
      whiteName: state.whiteName,
      blackName: state.blackName,
      orientationMode: state.orientationMode,
      lastMove: state.lastMove,
      mistakes: state.mistakes,
      trainingComplete: state.trainingComplete,
      overrideResult: state.overrideResult,
      overrideReason: state.overrideReason,
      depthTierIndex: state.depthTierIndex,
      movePolicy: state.movePolicy,
      pendingMistakesByFen: Array.from(state.pendingMistakesByFen.entries()),
    };
    localStorage.setItem(GAME_STATE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore persistence failures.
  }
}

function restoreCurrentGameState() {
  const saved = readJson(GAME_STATE_KEY, null);
  if (!saved) return false;
  try {
    const restored = new Chess();
    if (saved.pgn) restored.loadPgn(saved.pgn);
    else if (saved.fen) restored.load(saved.fen);
    else return false;

    state.game = restored;
    state.playerColor = saved.playerColor || 'w';
    state.sideChoice = saved.sideChoice || (state.playerColor === 'w' ? 'white' : 'black');
    state.playerName = saved.playerName || 'You';
    state.opponentName = saved.opponentName || 'Other Side';
    state.whiteName = saved.whiteName || (state.playerColor === 'w' ? state.playerName : state.opponentName);
    state.blackName = saved.blackName || (state.playerColor === 'b' ? state.playerName : state.opponentName);
    state.orientationMode = saved.orientationMode || 'player';
    state.lastMove = saved.lastMove || deriveLastMove();
    state.selected = null;
    state.legalMoves = [];
    state.pendingPromotion = null;
    state.enemyThinking = false;
    state.enemyPaused = false;
    state.trainingComplete = Boolean(saved.trainingComplete);
    state.mistakes = Number(saved.mistakes || 0);
    state.overrideResult = saved.overrideResult || null;
    state.overrideReason = saved.overrideReason || '';
    state.depthTierIndex = Number.isFinite(Number(saved.depthTierIndex)) ? Number(saved.depthTierIndex) : state.depthTierIndex;
    state.movePolicy = saved.movePolicy || state.movePolicy;
    state.pendingMistakesByFen = new Map(Array.isArray(saved.pendingMistakesByFen) ? saved.pendingMistakesByFen : []);

    $('setup-player-name').value = state.playerName;
    $('setup-opponent-name').value = state.opponentName;
    $('setup-side').value = state.sideChoice;
    $('setup-orientation').value = state.orientationMode;
    updateDepthLabels();
    renderAll();
    scheduleExplorerFetch(180);
    toast('Restored your saved LineForge run.');
    return true;
  } catch (error) {
    console.warn('Could not restore saved game state:', error);
    localStorage.removeItem(GAME_STATE_KEY);
    return false;
  }
}

function deriveLastMove() {
  const history = state.game.history({ verbose: true });
  const last = history.at(-1);
  return last ? { from: last.from, to: last.to, san: last.san, color: last.color } : null;
}

function loadPreferences() {
  const prefs = readJson(PREF_KEY, {});
  const theme = prefs.theme || 'walnut';
  $('theme-select').value = theme;
  applyTheme(theme);
  state.soundEnabled = prefs.soundEnabled !== false;
  $('sound-toggle').checked = state.soundEnabled;

  if (prefs.setup) {
    $('setup-player-name').value = prefs.setup.playerName || 'You';
    $('setup-opponent-name').value = prefs.setup.opponentName || 'Other Side';
    $('setup-side').value = prefs.setup.sideChoice || 'white';
    $('setup-orientation').value = prefs.setup.orientationMode || 'player';
  }

  if ($('onboarding-startup-toggle')) {
    $('onboarding-startup-toggle').checked = prefs.showOnboarding !== false;
  }
}

function savePreferences() {
  writeJson(PREF_KEY, {
    theme: $('theme-select').value,
    soundEnabled: $('sound-toggle').checked,
    setup: {
      playerName: $('setup-player-name').value,
      opponentName: $('setup-opponent-name').value,
      sideChoice: $('setup-side').value,
      orientationMode: $('setup-orientation').value,
    },
    showOnboarding: $('onboarding-startup-toggle') ? $('onboarding-startup-toggle').checked : true,
  });
}


function loadCoachPreferences() {
  const prefs = readJson('lineforge:coach-prefs:v1', {});
  state.aiCoachEnabled = prefs.enabled !== false;
  state.openRouterModel = prefs.model && !DEPRECATED_OPENROUTER_MODELS.has(prefs.model) ? prefs.model : DEFAULT_OPENROUTER_MODEL;
  if ($('ai-coach-toggle')) $('ai-coach-toggle').checked = state.aiCoachEnabled;
  if ($('openrouter-model')) $('openrouter-model').value = state.openRouterModel;
}

function saveCoachPreferences() {
  writeJson('lineforge:coach-prefs:v1', {
    enabled: state.aiCoachEnabled,
    model: state.openRouterModel || DEFAULT_OPENROUTER_MODEL,
  });
}

function loadExplorerPreferences() {
  const prefs = readJson(EXPLORER_PREF_KEY, null);
  const savedDepthIndex = Number(prefs?.depthTierIndex ?? DEFAULT_DEPTH_INDEX);
  state.depthTierIndex = Math.min(Math.max(Number.isFinite(savedDepthIndex) ? savedDepthIndex : DEFAULT_DEPTH_INDEX, 0), DEPTH_TIERS.length - 1);
  state.movePolicy = prefs?.movePolicy || 'masterFirst';
  if ($('depth-slider')) $('depth-slider').value = String(state.depthTierIndex);
  if ($('move-policy')) $('move-policy').value = state.movePolicy;
  if ($('proxy-toggle')) $('proxy-toggle').checked = Boolean(prefs?.useProxy);
}

function saveExplorerPreferences() {
  writeJson(EXPLORER_PREF_KEY, {
    fixedSources: 'masters+lichess-2500-rapid-classical-correspondence',
    depthTierIndex: state.depthTierIndex,
    movePolicy: state.movePolicy,
    useProxy: Boolean($('proxy-toggle')?.checked),
  });
}

function applyTheme(theme) {
  document.body.classList.remove('theme-emerald', 'theme-midnight', 'theme-mono');
  if (theme !== 'walnut') document.body.classList.add(`theme-${theme}`);
}


function colorName(color) {
  return color === 'w' ? 'White' : 'Black';
}

function opposite(color) {
  return color === 'w' ? 'b' : 'w';
}


function toUci(move) {
  return `${move.from}${move.to}${move.promotion || ''}`;
}

function moveTotal(move) {
  return (move?.white || 0) + (move?.draws || 0) + (move?.black || 0);
}

function rootTotal(data) {
  return (data?.white || 0) + (data?.draws || 0) + (data?.black || 0);
}

function pct(value, total) {
  if (!total) return '0%';
  return `${((value || 0) / total * 100).toFixed(total > 1000 ? 1 : 0)}%`;
}

function formatNumber(value) {
  return new Intl.NumberFormat().format(value || 0);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}


function uniqueGames(games) {
  const seen = new Set();
  const unique = [];
  for (const game of games) {
    const key = game.id || `${game.white?.name}-${game.black?.name}-${game.month}-${game.year}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(game);
  }
  return unique;
}

function gameUrl(game, source) {
  if (!game?.id) return 'https://lichess.org/analysis';
  return source === 'masters'
    ? `${EXPLORER_HOST}/masters/pgn/${encodeURIComponent(game.id)}`
    : `https://lichess.org/${encodeURIComponent(game.id)}`;
}

function formatGameTitle(game) {
  const white = formatPlayer(game.white, 'White');
  const black = formatPlayer(game.black, 'Black');
  return `${white} vs ${black}`;
}

function formatPlayer(player, fallback) {
  if (!player) return fallback;
  const name = player.name || fallback;
  return player.rating ? `${name} (${player.rating})` : name;
}

function formatGameMeta(game) {
  const result = game.winner ? `${colorName(game.winner === 'white' ? 'w' : 'b')} won` : 'Draw/unknown result';
  const date = game.month || game.year || '';
  const speed = game.speed ? `${game.speed}` : '';
  const mode = game.mode ? `${game.mode}` : '';
  return [result, speed, mode, date].filter(Boolean).join(' • ');
}

function normalizeBearerToken(token) {
  return token.toLowerCase().startsWith('bearer ') ? token : `Bearer ${token}`;
}

function setExplorerPill(text, variant = '') {
  const pill = $('connection-pill');
  pill.textContent = text;
  pill.className = `pill ${variant}`.trim();
}

function safeShowModal(dialog) {
  if (!dialog) return;
  if (typeof dialog.showModal === 'function') {
    if (!dialog.open) dialog.showModal();
  } else {
    dialog.setAttribute('open', '');
  }
}

async function copyText(text, successMessage = 'Copied') {
  try {
    await navigator.clipboard.writeText(text);
    toast(successMessage);
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
    toast(successMessage);
  }
}

function downloadText(filename, text, mime) {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  toast('Download started.');
}

function slugify(value) {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'player';
}

function toast(message) {
  const region = $('toast-region');
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  region.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(8px)';
  }, 3200);
  setTimeout(() => el.remove(), 3800);
}

function playSoftTick() {
  if (!state.soundEnabled) return;
  playTone(260, 0.012, 0.018);
}

function playMoveSound(capture = false) {
  if (!state.soundEnabled) return;
  playTone(capture ? 160 : 220, capture ? 0.035 : 0.022, capture ? 0.055 : 0.038);
}

function playTone(frequency, gainValue, duration) {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    state.audioContext ||= new AudioContext();
    const ctx = state.audioContext;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.value = gainValue;
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    oscillator.stop(ctx.currentTime + duration + 0.01);
  } catch {
    // Audio is a polish only; ignore browsers that block it.
  }
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage failures in private browsing or locked down previews.
  }
}

function readSession(key) {
  try {
    return localStorage.getItem(key) || sessionStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

function writeSession(key, value) {
  try {
    localStorage.setItem(key, value);
    try { sessionStorage.setItem(key, value); } catch {}
  } catch {
    try { sessionStorage.setItem(key, value); } catch {}
  }
}

function removeSession(key) {
  try { localStorage.removeItem(key); } catch {}
  try { sessionStorage.removeItem(key); } catch {}
}

init();
