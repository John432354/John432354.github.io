/**
 * Educational Vocab Games Suite — Main Application Bootstrapper
 *
 * Orchestrates:
 * - Subject `.zip` Upload / Export (`AP Lang.zip` -> Unit folders -> Topic `.txt`)
 * - Unit & Topic selective toggles + `-` Multi-Answers + `//` Java-comment Explanations
 * - Game 1: Krillion (Speed-Depth + 3-Pass Kev-0.6B AI + Give-Up Study Lock)
 * - Game 2: Unlimited Multi-Answer Vocab Wordle (Zero AI + Simultaneous Boards + Dynamic Skip Cooldown)
 * - Full On-Page Creator Specification & Live `.txt` Sandbox
 */

import { GAME_DEFAULTS } from './config/constants.js';
import { STORAGE_KEYS } from './state/storage-keys.js';
import { SubjectRepository } from './state/subject-store.js';
import { StatsRepository } from './state/stats-store.js';
import { KevJudgeClient } from './kev/kev-client.js';
import { DiveSessionEngine } from './game/dive-engine.js';
import { VocabWordleEngine } from './wordle/wordle-engine.js';
import {
  parseSubjectFromZipFile,
  exportSubjectToZipBlob,
  buildSampleApLangZipBlob,
} from './zip/subject-zip-importer.js';
import { downloadBlobFile } from './cloud/gdrive-helper.js';
import { OceanSceneRenderer } from './ocean/ocean-canvas.js';
import { OceanSoundEffects } from './audio/sound-effects.js';
import { HudView } from './ui/hud-view.js';
import { HomeLobbyView } from './ui/home-view.js';
import { ActiveDiveView } from './ui/dive-view.js';
import { DiveResultsView } from './ui/results-view.js';
import { VocabWordleView } from './ui/wordle-view.js';
import { CreatorSpecView } from './ui/spec-view.js';
import { SubjectModal } from './ui/subject-modal.js';
import { AiSettingsModal } from './ui/ai-settings-modal.js';

function loadSavedSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    const merged = raw ? { ...GAME_DEFAULTS, ...JSON.parse(raw) } : { ...GAME_DEFAULTS };
    merged.companionId = merged.companionId || merged.companion || 'krill';
    merged.companion = merged.companionId;
    return merged;
  } catch {
    return { ...GAME_DEFAULTS };
  }
}

function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  } catch {
    // ignore storage quota errors
  }
}

function bootstrapApp() {
  let settings = loadSavedSettings();
  const subjectRepo = new SubjectRepository();
  const statsRepo = new StatsRepository();
  const soundFx = new OceanSoundEffects(settings.soundEnabled);
  const kevClient = new KevJudgeClient();

  const canvas = document.getElementById('ocean-canvas');
  const hudRoot = document.getElementById('hud-root');
  const mainRoot = document.getElementById('app-root');
  const modalRoot = document.getElementById('modal-root');

  const ocean = new OceanSceneRenderer(canvas);
  ocean.setCompanion(settings.companionId);
  ocean.start();

  // 'lobby' | 'dive' | 'results' | 'wordle' | 'spec'
  let currentScreen = 'lobby';

  const updateSettings = (patch) => {
    settings = { ...settings, ...patch };
    if (patch.companionId) {
      settings.companion = patch.companionId;
      ocean.setCompanion(patch.companionId);
    }
    if (patch.companion) {
      settings.companionId = patch.companion;
      ocean.setCompanion(patch.companion);
    }
    saveSettings(settings);
    if (typeof patch.soundEnabled === 'boolean') {
      soundFx.setEnabled(settings.soundEnabled);
      hudView.updateSound(settings.soundEnabled);
    }
    if (currentScreen === 'lobby') renderCurrentScreen();
  };

  // Shared Subject `.zip` upload handler (supports multiple `.zip` files at once)
  const handleUploadZipFiles = async (files) => {
    const importedNames = [];
    const errors = [];

    for (const file of files) {
      try {
        const parsedSubject = await parseSubjectFromZipFile(file);
        subjectRepo.saveCustomSubject(parsedSubject);
        importedNames.push(
          `${parsedSubject.name} (${parsedSubject.cards.length} terms across ${parsedSubject.zipStats.topicCount} topic files)`
        );
      } catch (err) {
        errors.push(`${file.name}: ${err.message}`);
      }
    }

    if (importedNames.length > 0) {
      soundFx.playSonarPing();
    }
    if (errors.length > 0) {
      alert(`Some .zip files could not be imported:\n\n${errors.join('\n')}`);
    }
    if (currentScreen !== 'lobby') {
      navigateToScreen('lobby');
    } else {
      renderCurrentScreen();
    }
  };

  const handleExportSubjectZip = (subjectId) => {
    const subj = subjectRepo.getSubjectById(subjectId);
    if (!subj) return;
    const { filename, blob } = exportSubjectToZipBlob(subj);
    downloadBlobFile(filename, blob);
  };

  const handleDownloadSampleZip = () => {
    const { filename, blob } = buildSampleApLangZipBlob();
    downloadBlobFile(filename, blob);
  };

  const handleLoadSampleZipIntoSuite = async () => {
    const { filename, blob } = buildSampleApLangZipBlob();
    const file = new File([blob], filename, { type: 'application/zip' });
    await handleUploadZipFiles([file]);
  };

  const navigateToScreen = (nextScreen) => {
    if (currentScreen === 'dive' && nextScreen !== 'dive' && nextScreen !== 'results') {
      diveEngine.abortDive();
    }
    if (currentScreen === 'wordle' && nextScreen !== 'wordle') {
      wordleView.unmountKeyboardListener();
      wordleEngine.quitSession();
    }
    currentScreen = nextScreen;
    hudView.setActiveRoute(nextScreen);
    if (nextScreen === 'lobby' || nextScreen === 'spec') {
      ocean.setTargetDepth(0, null);
      hudView.updateDepth(0);
    }
    renderCurrentScreen();
  };

  const subjectModal = new SubjectModal(modalRoot, {
    getAllSubjects: () => subjectRepo.getAllSubjects(),
    onUploadZipFiles: handleUploadZipFiles,
    onExportSubjectZip: handleExportSubjectZip,
    onOpenSpec: () => navigateToScreen('spec'),
    onSaveSubject: (draft) => {
      subjectRepo.saveCustomSubject(draft);
      renderCurrentScreen();
    },
  });

  const aiModal = new AiSettingsModal(modalRoot, {
    kevClient,
    getSettings: () => settings,
    onUpdateSettings: updateSettings,
  });

  const hudView = new HudView(hudRoot, {
    onNavigateHome: () => navigateToScreen('lobby'),
    onNavigateSpec: () => navigateToScreen('spec'),
    onOpenAiModal: () => aiModal.open(),
    onOpenSubjectModal: (mode) => subjectModal.open(mode),
    onToggleSound: () => updateSettings({ soundEnabled: !settings.soundEnabled }),
  });
  hudView.updateSound(settings.soundEnabled);

  // Game 1: Krillion Engine
  const diveEngine = new DiveSessionEngine({
    kevClient,
    soundFx,
    onDepthChange: (meters, tier) => {
      ocean.setTargetDepth(meters, tier);
      hudView.updateDepth(meters);
    },
    onUpdate: (session, meta) => {
      if (!session) {
        ocean.setSonarState({ isJudging: false, completedPasses: 0 });
        if (currentScreen === 'dive') {
          navigateToScreen('lobby');
        }
        return;
      }

      ocean.setSonarState({
        isJudging: session.phase === 'judging',
        completedPasses: session.livePasses?.length || 0,
      });

      if (session.phase === 'finished') {
        currentScreen = 'results';
        renderCurrentScreen();
        return;
      }

      currentScreen = 'dive';
      diveView.render(session, kevClient.status, meta);
    },
  });

  // Game 2: Vocab Wordle Engine
  const wordleEngine = new VocabWordleEngine({
    soundFx,
    onUpdate: (wState, meta) => {
      if (!wState) return;
      statsRepo.saveWordleStats(wState.stats);
      if (currentScreen === 'wordle') {
        wordleView.render(wState, meta);
      }
    },
  });

  const lobbyView = new HomeLobbyView(mainRoot, {
    onOpenSpec: () => navigateToScreen('spec'),
    onLoadSampleZip: handleLoadSampleZipIntoSuite,
    onUploadZipFiles: handleUploadZipFiles,
    onExportSubjectZip: handleExportSubjectZip,
    onOpenSubjectModal: (mode) => subjectModal.open(mode),
    onOpenAiModal: () => aiModal.open(),
    onToggleSubject: (id) => {
      subjectRepo.toggleSubjectSelection(id);
      renderCurrentScreen();
    },
    onToggleUnit: (subjectId, unitName, enable) => {
      subjectRepo.toggleUnit(subjectId, unitName, enable);
      renderCurrentScreen();
    },
    onToggleTopic: (subjectId, unitName, topicName) => {
      subjectRepo.toggleTopic(subjectId, unitName, topicName);
      renderCurrentScreen();
    },
    onEditSubject: (id) => {
      const subj = subjectRepo.getSubjectById(id);
      if (subj) subjectModal.open('create', subj);
    },
    onDeleteSubject: (id) => {
      const subj = subjectRepo.getSubjectById(id);
      if (!subj) return;
      if (confirm(`Delete subject "${subj.name}"?`)) {
        subjectRepo.deleteCustomSubject(id);
        renderCurrentScreen();
      }
    },
    onChangeSetting: (key, val) => updateSettings({ [key]: val }),
    onRefreshLobby: () => renderCurrentScreen(),
    onLaunchDive: () => {
      const filtered = subjectRepo.getFilteredSelectedSubjects();
      if (filtered.length === 0) return;
      diveView.lastRenderedKey = null;
      diveEngine.startNewDive({ subjects: filtered, settings });
    },
    onLaunchWordle: () => {
      const filtered = subjectRepo.getFilteredSelectedSubjects();
      if (filtered.length === 0) return;
      wordleEngine.stats = statsRepo.getWordleStats();
      currentScreen = 'wordle';
      hudView.setActiveRoute('wordle');
      ocean.setTargetDepth(320, null); // Gentle Twilight Zone ambient backdrop for Wordle
      hudView.updateDepth(320);
      wordleEngine.startSession(filtered);
    },
  });

  const diveView = new ActiveDiveView(mainRoot, {
    onSubmitAnswer: (ans) => diveEngine.submitAnswer(ans),
    onGiveUpRound: () => diveEngine.giveUpRound(),
    onAdvanceRound: () => {
      const summary = diveEngine.advanceNextRound();
      if (summary) {
        statsRepo.recordCompletedDive(summary);
        currentScreen = 'results';
        renderCurrentScreen();
      }
    },
    onAbortDive: () => navigateToScreen('lobby'),
    onRetryDiveLoad: () => {
      const filtered = subjectRepo.getFilteredSelectedSubjects();
      if (filtered.length > 0) {
        diveEngine.startNewDive({ subjects: filtered, settings });
      }
    },
  });

  const resultsView = new DiveResultsView(mainRoot, {
    onPlayAgain: () => {
      const filtered = subjectRepo.getFilteredSelectedSubjects();
      if (filtered.length === 0) {
        navigateToScreen('lobby');
        return;
      }
      diveView.lastRenderedKey = null;
      diveEngine.startNewDive({ subjects: filtered, settings });
    },
    onReturnHome: () => navigateToScreen('lobby'),
  });

  const wordleView = new VocabWordleView(mainRoot, {
    onKeyInput: (key) => wordleEngine.handleKey(key),
    onFocusBoard: (idx) => wordleEngine.setFocusedBoard(idx),
    onSkipQuestion: () => wordleEngine.skipQuestion(),
    onNextWord: () => wordleEngine.advanceToNextWord(),
    onQuitWordle: () => navigateToScreen('lobby'),
  });

  const specView = new CreatorSpecView(mainRoot, {
    onDownloadSampleZip: handleDownloadSampleZip,
    onLoadSampleZip: handleLoadSampleZipIntoSuite,
    onBackToHub: () => navigateToScreen('lobby'),
  });

  function renderCurrentScreen() {
    if (currentScreen !== 'wordle') {
      wordleView.unmountKeyboardListener();
    }

    if (currentScreen === 'lobby') {
      lobbyView.render({
        subjects: subjectRepo.getAllSubjects(),
        selectedSubjectIds: subjectRepo.getSelectedIds(),
        filteredSubjects: subjectRepo.getFilteredSelectedSubjects(),
        subjectRepo,
        settings,
        stats: statsRepo.getStats(),
        wordleStats: statsRepo.getWordleStats(),
        kevStatus: kevClient.status,
      });
    } else if (currentScreen === 'dive') {
      diveView.render(diveEngine.getSession(), kevClient.status);
    } else if (currentScreen === 'results') {
      resultsView.render(diveEngine.getSession());
    } else if (currentScreen === 'wordle') {
      wordleView.render(wordleEngine.getState());
    } else if (currentScreen === 'spec') {
      specView.render();
    }
  }

  kevClient.onStatusChange((status) => {
    hudView.updateKevStatus(status);
    if (!modalRoot.hidden && modalRoot.querySelector('#ai-modal-backdrop')) {
      aiModal.render();
    }
    if (currentScreen === 'dive' && diveEngine.getSession()?.phase === 'warming_ai') {
      diveView.render(diveEngine.getSession(), status);
    } else if (currentScreen === 'lobby' && status.state === 'loading') {
      renderCurrentScreen();
    }
  });

  renderCurrentScreen();
  kevClient.checkCache();
}

window.addEventListener('DOMContentLoaded', bootstrapApp);
