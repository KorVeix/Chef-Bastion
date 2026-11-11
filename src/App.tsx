import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChefBastionCanvas,
  DragPointerState,
  HudSnapshot,
} from './components/ChefBastionCanvas';
import {
  AchievementsCodexModal,
  ChefWardrobeModal,
  ComicPopBanner,
  FloatingComboLayer,
  SettingsModal,
  TacticalOnboardingModal,
} from './components/GameModals';
import { soundEngine } from './game/audio';
import {
  ACHIEVEMENTS_CATALOG,
  createInitialBoardPieces,
  DEFAULT_PROGRESS,
  DEFAULT_SETTINGS,
  getBiomeForLevel,
  getLevelForecast,
  getTacticalOnboardingCard,
  getTutorialGuideForLevel,
  isDynamicOnboardingLevel,
  isWorldUnlocked,
  LEVEL_DURATION_SECONDS,
  SPECIAL_WEAPONS_CATALOG,
  STRATEGIC_BOOST_SHIELD_COST,
  STRATEGIC_BOOST_ULTIMATE_COST,
  UTENSIL_CATALOG,
  UTENSIL_MICRO_TIPS,
  WORLD_UNLOCK_LEVELS,
  WORLDS_CATALOG,
} from './game/rules';
import {
  ArmorId,
  BugType,
  ComicPopEvent,
  FloatingComboEvent,
  GameSettings,
  GameState,
  HatId,
  KillStarRating,
  PlayerProgress,
  SpecialWeaponId,
  UtensilPiece,
  UtensilType,
  WorldId,
} from './game/types';

const SAVE_STORAGE_KEY = 'chef_bastion_save_v1';
const SETTINGS_STORAGE_KEY = 'chef_bastion_settings_v1';
const LEGACY_BOARD_STORAGE_KEY = 'chef_bastion_board_v1';

function loadSavedProgress(): PlayerProgress {
  try {
    // Purge legacy board storage so levels NEVER start with pre-placed pieces from old sessions
    localStorage.removeItem(LEGACY_BOARD_STORAGE_KEY);
    const raw = localStorage.getItem(SAVE_STORAGE_KEY);
    if (!raw) return DEFAULT_PROGRESS;
    return { ...DEFAULT_PROGRESS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PROGRESS;
  }
}

function loadSavedSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

const BUG_FORECAST_ICONS: Record<BugType, { icon: string; label: string }> = {
  speed_ant: { icon: '🐜', label: 'Hormiga' },
  cap_beetle: { icon: '🐀', label: 'Blindada' },
  acid_wasp: { icon: '🪰', label: 'Mosca Ácida' },
  shift_roach: { icon: '🪳', label: 'Saltarraíl' },
  king_crab: { icon: '🦀', label: 'Rey Plaga' },
};

function getTargetLeftClass(xPct: number): string {
  if (xPct < 34) return 'left-[26%]';
  if (xPct < 50) return 'left-[42%]';
  if (xPct < 66) return 'left-[58%]';
  return 'left-[74%]';
}

function getTargetTopClass(yPct: number): string {
  if (yPct < 33) return 'top-[27%]';
  if (yPct < 42) return 'top-[35%]';
  if (yPct < 51) return 'top-[43%]';
  if (yPct < 60) return 'top-[51%]';
  return 'top-[58%]';
}

export default function App() {
  const [gameState, setGameState] = useState<GameState>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') return 'playing';
    }
    return 'title';
  });

  const [progress, setProgress] = useState<PlayerProgress>(loadSavedProgress);
  // Every level ALWAYS starts with 100% of pieces in the bottom tray (rail: null, row: null)
  const piecesRef = useRef<UtensilPiece[]>(
    createInitialBoardPieces(loadSavedProgress().currentLevel)
  );
  const selectedPieceIdRef = useRef<string | null>(null);
  const triggerUltimateRef = useRef<boolean>(false);
  const startWaveRef = useRef<boolean>(false);
  const dragPointerRef = useRef<DragPointerState>({
    active: false,
    pieceId: null,
    clientX: 0,
    clientY: 0,
  });
  const boostUltimateRef = useRef<boolean>(false);
  const boostPlateShieldRef = useRef<boolean>(false);

  const [hud, setHud] = useState<HudSnapshot>(() => {
    const initLvl = loadSavedProgress().currentLevel;
    return {
      phase: 1,
      inPlacementPhase: !isDynamicOnboardingLevel(initLvl),
      phaseKills: 0,
      phaseTargetKills: 4,
      sanitationSeals: 3,
      score: 0,
      pressurePct: 45,
      slowMoActive: false,
      prepTimer: 0,
      levelTimer: LEVEL_DURATION_SECONDS,
      biome: getBiomeForLevel(initLvl),
      smartComboHintMessage: null,
      selectedPieceId: null,
      hoveredCell: null,
      activeWarningRails: [null, null, null, null],
      pieces: piecesRef.current,
      hazmatShieldReady: loadSavedProgress().equippedArmor === 'hazmat_epi',
      armoredPlates: 0,
      lastStandActive: false,
      forecast: getLevelForecast(initLvl),
      bossHud: null,
      tutorialTargetScreen: null,
    };
  });

  const [resetSignal, setResetSignal] = useState(0);
  const [settings, setSettings] = useState<GameSettings>(loadSavedSettings);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [showCodex, setShowCodex] = useState(false);
  const [showWardrobe, setShowWardrobe] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [usedUltBoost, setUsedUltBoost] = useState(false);
  const [usedShieldBoost, setUsedShieldBoost] = useState(false);
  const [longPressTip, setLongPressTip] = useState<{ pieceId: string; text: string } | null>(null);
  const trayPressRef = useRef<{
    pieceId: string;
    type: UtensilType;
    startX: number;
    startY: number;
    dragged: boolean;
    longPressed: boolean;
    timerId: number | null;
  } | null>(null);
  const suppressNextTrayClickRef = useRef<boolean>(false);
  const [comicPop, setComicPop] = useState<ComicPopEvent | null>(null);
  const [floatingCombos, setFloatingCombos] = useState<FloatingComboEvent[]>([]);
  const [endOutcome, setEndOutcome] = useState<{
    victory: boolean;
    score: number;
    phaseReached: number;
    remainingKillsToNext: number;
    bugsCleaned: number;
  } | null>(null);

  const handleUpdateSettings = useCallback((patch: Partial<GameSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      soundEngine.applySettings(next);
      return next;
    });
  }, []);

  // Sync document.body.dataset.state, persist settings & sync establishment background music (changes every 10 levels)
  useEffect(() => {
    document.body.dataset.state = gameState;
    soundEngine.applySettings(settings);
    soundEngine.syncBackgroundMusic(gameState === 'playing' && !settings.muted, progress.currentLevel);
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // ignore storage errors
    }
    return () => {
      if (gameState !== 'playing') {
        soundEngine.stopBackgroundMusic();
      }
    };
  }, [gameState, progress.currentLevel, settings]);

  // Auto-save progress whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(progress));
    } catch {
      // ignore storage errors
    }
  }, [progress]);

  // Trigger ~1.15s Comic Pop-up banner
  const triggerComicPop = useCallback((pop: ComicPopEvent) => {
    setComicPop(pop);
    window.setTimeout(() => {
      setComicPop((curr) => (curr?.id === pop.id ? null : curr));
    }, 1150);
  }, []);

  // Trigger ~1.45s Floating Combo Notification over the 3D board
  const triggerFloatingCombo = useCallback((evt: FloatingComboEvent) => {
    setFloatingCombos((prev) => [...prev.slice(-2), evt]);
    window.setTimeout(() => {
      setFloatingCombos((prev) => prev.filter((item) => item.id !== evt.id));
    }, 1450);
  }, []);

  const handleHudUpdate = useCallback((snap: HudSnapshot) => {
    setHud({ ...snap, pieces: [...snap.pieces] });
  }, []);

  // Deterministic Power-Up Utensil Unlock on Levels 5+ when Phase 1 -> 2 or Phase 2 -> 3 completes
  const handleUnlockUtensil = useCallback(
    (uType: UtensilType) => {
      const meta = UTENSIL_CATALOG[uType];
      // Add new piece into the bottom tray (rail: null, row: null) so it never auto-places on the board!
      const alreadyCount = piecesRef.current.filter((p) => p.type === uType).length;
      if (alreadyCount < 2 && piecesRef.current.length < 5) {
        piecesRef.current = [
          ...piecesRef.current,
          {
            id: `u-${uType}-${Date.now()}`,
            type: uType,
            level: 1,
            rail: null,
            row: null,
            gunkTimer: 0,
            cooldown: 0.2,
            fireTimer: 0,
            comboType: 'none',
          },
        ];
      }

      triggerComicPop({
        id: `unlock-${uType}-${Date.now()}`,
        title: `¡NUEVA ARMA EN BANDEJA: ${meta.shortName.toUpperCase()}!`,
        subtitle: meta.comboRecipe,
        color: 'yellow',
        createdAt: Date.now(),
      });
    },
    [triggerComicPop]
  );

  // Grant Achievement & Reward on 1★ / 2★ / 3★ specific kill (or Stagnation Shop purchase)
  const applyAchievementReward = useCallback(
    (achId: string, coinsBonus = 0, fromShopCost = 0) => {
      const ach = ACHIEVEMENTS_CATALOG.find((a) => a.id === achId);
      if (!ach) return;

      setProgress((prev) => {
        const already = prev.unlockedAchievements.includes(achId);
        const nextUnlocked = already
          ? prev.unlockedAchievements
          : [...prev.unlockedAchievements, achId];

        const nextHats = [...prev.unlockedHats];
        const nextArmors = [...prev.unlockedArmors];
        const nextSpecials = [...prev.unlockedSpecials];
        const nextWorlds = [...prev.unlockedWorlds];
        let extraCoins = coinsBonus - fromShopCost;

        if (!already) {
          if (ach.rewardType === 'coins') extraCoins += 150;
          if (ach.rewardType === 'hat' && !nextHats.includes(ach.rewardId as HatId)) {
            nextHats.push(ach.rewardId as HatId);
          }
          if (ach.rewardType === 'armor' && !nextArmors.includes(ach.rewardId as ArmorId)) {
            nextArmors.push(ach.rewardId as ArmorId);
          }
          if (
            ach.rewardType === 'special_weapon' &&
            !nextSpecials.includes(ach.rewardId as SpecialWeaponId)
          ) {
            nextSpecials.push(ach.rewardId as SpecialWeaponId);
            if (!nextWorlds.includes('fridge_vault')) {
              nextWorlds.push('fridge_vault');
            }
          }
        }

        return {
          ...prev,
          coins: Math.max(0, prev.coins + extraCoins),
          unlockedAchievements: nextUnlocked,
          unlockedHats: nextHats,
          unlockedArmors: nextArmors,
          unlockedSpecials: nextSpecials,
          unlockedWorlds: nextWorlds,
          equippedHat:
            !already && ach.rewardType === 'hat' ? (ach.rewardId as HatId) : prev.equippedHat,
          equippedArmor:
            !already && ach.rewardType === 'armor'
              ? (ach.rewardId as ArmorId)
              : prev.equippedArmor,
          equippedSpecial:
            !already && ach.rewardType === 'special_weapon'
              ? (ach.rewardId as SpecialWeaponId)
              : prev.equippedSpecial,
        };
      });
    },
    []
  );

  const handleAchievementKill = useCallback(
    (achId: string, _stars: KillStarRating, coinsEarned: number) => {
      applyAchievementReward(achId, coinsEarned, 0);
    },
    [applyAchievementReward]
  );

  const handleBuyAchievementInShop = useCallback(
    (achId: string) => {
      const ach = ACHIEVEMENTS_CATALOG.find((a) => a.id === achId);
      if (!ach || progress.coins < ach.unlockCostCoins) return;
      soundEngine.playStarKill(3);
      applyAchievementReward(achId, 0, ach.unlockCostCoins);
      triggerComicPop({
        id: `shop-${achId}-${Date.now()}`,
        title: '¡LOGRO DESBLOQUEADO!',
        subtitle: ach.rewardLabel,
        stars: ach.star,
        color: 'pink',
        createdAt: Date.now(),
      });
    },
    [applyAchievementReward, progress.coins, triggerComicPop]
  );

  const handleGameEnd = useCallback(
    (
      victory: boolean,
      finalStats: {
        score: number;
        phaseReached: number;
        remainingKillsToNext: number;
        bugsCleaned: number;
      }
    ) => {
      setEndOutcome({ victory, ...finalStats });
      setGameState('gameover');
      setProgress((prev) => {
        const nextLevel = victory ? prev.currentLevel + 1 : prev.currentLevel;
        const nextHighest = Math.max(prev.highestLevel, nextLevel);
        const nextWorlds = [...prev.unlockedWorlds];
        (Object.keys(WORLD_UNLOCK_LEVELS) as WorldId[]).forEach((wId) => {
          if (nextHighest >= WORLD_UNLOCK_LEVELS[wId] && !nextWorlds.includes(wId)) {
            nextWorlds.push(wId);
          }
        });
        return {
          ...prev,
          currentLevel: nextLevel,
          highestLevel: nextHighest,
          unlockedWorlds: nextWorlds,
          coins: prev.coins + (victory ? 120 : 40),
          bestScore: Math.max(prev.bestScore, finalStats.score),
          totalBugsCleaned: prev.totalBugsCleaned + finalStats.bugsCleaned,
        };
      });
    },
    []
  );

  const startGame = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    // Always start the level with a 100% empty board (all pieces in the bottom tray)
    const initialPieces = createInitialBoardPieces(progress.currentLevel);
    piecesRef.current = initialPieces;
    selectedPieceIdRef.current = null;
    startWaveRef.current = false;
    boostUltimateRef.current = false;
    boostPlateShieldRef.current = false;
    dragPointerRef.current = { active: false, pieceId: null, clientX: 0, clientY: 0 };
    setUsedUltBoost(false);
    setUsedShieldBoost(false);
    setLongPressTip(null);
    setEndOutcome(null);
    setFloatingCombos([]);
    setShowCodex(false);
    setShowWardrobe(false);
    setShowOnboardingModal(false);
    setResetSignal((n) => n + 1);
    document.body.dataset.state = 'playing';
    setGameState('playing');
  }, [progress.currentLevel]);

  const resetBoardToDefault = useCallback(() => {
    const initialPieces = createInitialBoardPieces(progress.currentLevel);
    piecesRef.current = initialPieces;
    selectedPieceIdRef.current = null;
    startWaveRef.current = false;
    boostUltimateRef.current = false;
    boostPlateShieldRef.current = false;
    dragPointerRef.current = { active: false, pieceId: null, clientX: 0, clientY: 0 };
    setUsedUltBoost(false);
    setUsedShieldBoost(false);
    setLongPressTip(null);
    setFloatingCombos([]);
    setResetSignal((n) => n + 1);
    setGameState('playing');
  }, [progress.currentLevel]);

  // Reset all progress to Level 1 ("Empezar de 0")
  const handleResetProgressFromZero = useCallback(() => {
    try {
      localStorage.removeItem(SAVE_STORAGE_KEY);
      localStorage.removeItem(LEGACY_BOARD_STORAGE_KEY);
    } catch {
      // ignore storage errors
    }
    setProgress(DEFAULT_PROGRESS);
    piecesRef.current = createInitialBoardPieces(1);
    selectedPieceIdRef.current = null;
    startWaveRef.current = false;
    setEndOutcome(null);
    setShowCodex(false);
    setShowWardrobe(false);
    setResetSignal((n) => n + 1);
    soundEngine.playSnapPiece(true);
    triggerComicPop({
      id: `reset-zero-${Date.now()}`,
      title: '🔄 PROGRESO REINICIADO (NIVEL 1)',
      subtitle: 'Tutorial paso a paso activado desde el Nivel 1',
      color: 'cyan',
      createdAt: Date.now(),
    });
  }, [triggerComicPop]);

  // Global keyboard shortcuts (Enter/Space on Title/GameOver, Esc/P for Pause, M for Mute)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (showCodex || showWardrobe || showSettings) {
        if (e.code === 'Escape') {
          setShowCodex(false);
          setShowWardrobe(false);
          setShowSettings(false);
        }
        return;
      }

      if (gameState === 'title' || gameState === 'gameover') {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          startGame();
        }
        return;
      }

      if (e.code === 'Escape' || e.code === 'KeyP') {
        e.preventDefault();
        setGameState((s) => (s === 'playing' ? 'paused' : s === 'paused' ? 'playing' : s));
      } else if (e.code === 'KeyM') {
        handleUpdateSettings({ muted: !settings.muted });
      } else if (e.code === 'KeyH') {
        setDockCollapsed((c) => !c);
      } else if (e.code === 'KeyR' && gameState === 'playing') {
        startGame();
      } else if (e.code === 'KeyB' && gameState === 'playing') {
        setShowCodex(true);
      } else if (e.code === 'Space' && gameState === 'playing' && hud.pressurePct >= 100) {
        e.preventDefault();
        triggerUltimateRef.current = true;
      }
    };

    const onBlur = () => {
      selectedPieceIdRef.current = null;
      dragPointerRef.current = { active: false, pieceId: null, clientX: 0, clientY: 0 };
      setLongPressTip(null);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('blur', onBlur);
    };
  }, [gameState, handleUpdateSettings, hud.pressurePct, settings.muted, showCodex, showSettings, showWardrobe, startGame]);

  // Global Tray Pointer Move / Up listener for 350ms Long-Press Micro-Tip & Direct -45px Y Drag
  useEffect(() => {
    const onWinPointerMove = (e: PointerEvent) => {
      const st = trayPressRef.current;
      if (!st || st.dragged) return;
      const dist = Math.hypot(e.clientX - st.startX, e.clientY - st.startY);
      if (dist > 8) {
        st.dragged = true;
        suppressNextTrayClickRef.current = true;
        if (st.timerId !== null) {
          window.clearTimeout(st.timerId);
          st.timerId = null;
        }
        setLongPressTip(null);
        selectedPieceIdRef.current = st.pieceId;
        dragPointerRef.current = {
          active: true,
          pieceId: st.pieceId,
          clientX: e.clientX,
          clientY: e.clientY,
        };
        soundEngine.playSlowMoEnter();
      }
    };

    const finishTrayGesture = (cancelled: boolean) => {
      const st = trayPressRef.current;
      if (!st) return;
      if (st.timerId !== null) {
        window.clearTimeout(st.timerId);
      }
      if (st.dragged || st.longPressed) {
        suppressNextTrayClickRef.current = true;
      }
      if (cancelled) {
        dragPointerRef.current = { active: false, pieceId: null, clientX: 0, clientY: 0 };
      }
      trayPressRef.current = null;
      setLongPressTip(null);
    };

    const onWinPointerUp = () => finishTrayGesture(false);
    const onWinPointerCancel = () => finishTrayGesture(true);

    window.addEventListener('pointermove', onWinPointerMove);
    window.addEventListener('pointerup', onWinPointerUp);
    window.addEventListener('pointercancel', onWinPointerCancel);
    return () => {
      window.removeEventListener('pointermove', onWinPointerMove);
      window.removeEventListener('pointerup', onWinPointerUp);
      window.removeEventListener('pointercancel', onWinPointerCancel);
    };
  }, []);

  const handleBuyStrategicUltimateBoost = useCallback(() => {
    if (usedUltBoost || progress.coins < STRATEGIC_BOOST_ULTIMATE_COST) return;
    setProgress((p) => ({
      ...p,
      coins: Math.max(0, p.coins - STRATEGIC_BOOST_ULTIMATE_COST),
    }));
    boostUltimateRef.current = true;
    setUsedUltBoost(true);
    soundEngine.playSnapPiece(true);
  }, [progress.coins, usedUltBoost]);

  const handleBuyStrategicShieldBoost = useCallback(() => {
    if (usedShieldBoost || progress.coins < STRATEGIC_BOOST_SHIELD_COST) return;
    setProgress((p) => ({
      ...p,
      coins: Math.max(0, p.coins - STRATEGIC_BOOST_SHIELD_COST),
    }));
    boostPlateShieldRef.current = true;
    setUsedShieldBoost(true);
    soundEngine.playSnapPiece(true);
  }, [progress.coins, usedShieldBoost]);

  const equippedSpecialMeta = SPECIAL_WEAPONS_CATALOG[progress.equippedSpecial];
  const tutorialGuide = getTutorialGuideForLevel(progress.currentLevel, hud.pieces);
  const onboardingCard = getTacticalOnboardingCard(progress.currentLevel);
  const activeBiome = getBiomeForLevel(progress.currentLevel);
  const placedCount = hud.pieces.filter((p) => p.rail !== null && p.row !== null).length;
  const formatWaveTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Compute approximate tray card start X% for the single-focus animated onboarding drag guide
  const tutorialPieceIdx = hud.tutorialTargetScreen
    ? hud.pieces.findIndex((p) => p.id === hud.tutorialTargetScreen?.pieceId)
    : -1;
  const traySpanPct = Math.min(48, Math.max(20, hud.pieces.length * 10));
  const tutorialTrayStartXPct =
    tutorialPieceIdx >= 0 && hud.pieces.length > 0
      ? 46 -
        traySpanPct / 2 +
        ((tutorialPieceIdx + 0.5) / hud.pieces.length) * traySpanPct
      : 45;

  return (
    <main className="relative w-full h-[100dvh] overflow-hidden select-none">
      {/* Isolated 60fps Three.js WebGL Viewport */}
      <ChefBastionCanvas
        gameState={gameState}
        wardrobeOpen={showWardrobe}
        worldId={progress.currentWorld}
        level={progress.currentLevel}
        hatId={progress.equippedHat}
        armorId={progress.equippedArmor}
        specialWeaponId={progress.equippedSpecial}
        settings={settings}
        piecesRef={piecesRef}
        selectedPieceIdRef={selectedPieceIdRef}
        triggerUltimateRef={triggerUltimateRef}
        startWaveRef={startWaveRef}
        dragPointerRef={dragPointerRef}
        boostUltimateRef={boostUltimateRef}
        boostPlateShieldRef={boostPlateShieldRef}
        resetSignal={resetSignal}
        onHudUpdate={handleHudUpdate}
        onComicPop={triggerComicPop}
        onFloatingCombo={triggerFloatingCombo}
        onUnlockUtensil={handleUnlockUtensil}
        onAchievementKill={handleAchievementKill}
        onGameEnd={handleGameEnd}
      />

      {/* Floating Combo Notifications (e.g. "¡Combo x2!") */}
      <FloatingComboLayer combos={floatingCombos} />

      {/* Comic-Book 1s Pop-up Banner */}
      <ComicPopBanner pop={comicPop} />

      {/* =====================================================================
          1. TITLE SCREEN OVERLAY (Hidden when Wardrobe or Codex is open so 3D Chef is unobstructed)
         ===================================================================== */}
      {gameState === 'title' && !showWardrobe && !showCodex && (
        <section
          aria-label="Pantalla de Título de Chef Bastion"
          className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-5 sm:p-8 bg-gradient-to-b from-amber-950/80 via-transparent to-amber-950/90"
        >
          {/* Top Bar: Auto-saved Coins, Settings & Reset from 0 */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="pointer-events-auto flex items-center gap-2.5 bg-amber-950/90 border border-amber-600/60 px-3 py-2 rounded-xl text-xs font-extrabold text-amber-100">
              <span className="font-mono tabular-nums text-yellow-300">
                🪙 {progress.coins}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                ★ {progress.unlockedAchievements.length}/{ACHIEVEMENTS_CATALOG.length} Logros
              </span>
            </div>

            <div className="pointer-events-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowSettings(true)}
                className="px-3 py-2 rounded-xl bg-amber-900/95 hover:bg-amber-800 border border-amber-500/70 text-amber-100 text-xs font-extrabold transition cursor-pointer whitespace-nowrap"
              >
                ⚙️ Ajustes
              </button>
              <button
                type="button"
                onClick={handleResetProgressFromZero}
                className="px-3 py-2 rounded-xl bg-rose-950/90 hover:bg-rose-900 border border-rose-500/70 text-rose-100 text-xs font-extrabold transition cursor-pointer whitespace-nowrap"
              >
                🔄 Empezar de 0
              </button>
            </div>
          </div>

          {/* Center-Left Negative Space Lockup + Primary CTA */}
          <div className="my-auto max-w-md space-y-5">
            {/* Bespoke Inline SVG Title Emblem */}
            <svg
              viewBox="0 0 460 135"
              className="w-full max-w-[390px] drop-shadow-[0_6px_0_rgba(20,10,4,0.95)]"
              role="img"
              aria-label="CHEF BASTION: Higiene Letal 3D"
            >
              <rect
                x="6"
                y="8"
                width="448"
                height="118"
                rx="22"
                fill="#451a03"
                stroke="#facc15"
                strokeWidth="6"
              />
              <rect
                x="16"
                y="18"
                width="428"
                height="98"
                rx="16"
                fill="#78350f"
                stroke="#d97706"
                strokeWidth="2"
              />
              {/* Chef Hat Badge */}
              <g transform="translate(28, 28)">
                <path
                  d="M16 42 C4 34 6 12 24 10 C32 -2 56 -2 64 10 C82 12 84 34 72 42 L68 64 L20 64 Z"
                  fill="#ffffff"
                  stroke="#0f172a"
                  strokeWidth="5"
                />
                <rect
                  x="19"
                  y="56"
                  width="50"
                  height="14"
                  rx="4"
                  fill="#00d2ff"
                  stroke="#0f172a"
                  strokeWidth="4"
                />
              </g>
              <text
                x="124"
                y="64"
                fill="#fde047"
                stroke="#0f172a"
                strokeWidth="7"
                paintOrder="stroke fill"
                fontFamily="Outfit, sans-serif"
                fontWeight="900"
                fontSize="41"
                letterSpacing="1"
              >
                CHEF BASTION
              </text>
              <text
                x="126"
                y="98"
                fill="#ffffff"
                fontFamily="Plus Jakarta Sans, sans-serif"
                fontWeight="800"
                fontSize="15.5"
                letterSpacing="2.5"
              >
                HIGIENE LETAL · BULLET HELL 3D
              </text>
            </svg>

            {/* World Selector Tabs (Locked with padlock by real progression; DEV_UNLOCK_ALL_WORLDS in rules.ts) */}
            <div className="pointer-events-auto flex flex-wrap items-center gap-1.5 bg-amber-950/90 border border-amber-600/60 p-1.5 rounded-xl">
              {(Object.keys(WORLDS_CATALOG) as WorldId[]).map((wId) => {
                const unlocked = isWorldUnlocked(wId, progress);
                const active = progress.currentWorld === wId;
                const reqLvl = WORLD_UNLOCK_LEVELS[wId];
                const baseLabel =
                  wId === 'sunny_counter'
                    ? '1. Encimera'
                    : wId === 'fridge_vault'
                    ? '2. Nevera ❄️'
                    : wId === 'iron_stoves'
                    ? '3. Fogones 🔥'
                    : '4. Obrador 🧁';
                const label = unlocked ? baseLabel : `🔒 ${baseLabel} (Nv.${reqLvl})`;
                return (
                  <button
                    key={wId}
                    type="button"
                    disabled={!unlocked}
                    aria-label={
                      unlocked
                        ? `Seleccionar mundo ${baseLabel}`
                        : `Mundo bloqueado ${baseLabel}, requiere Nivel ${reqLvl}`
                    }
                    onClick={() => {
                      if (!unlocked) return;
                      setProgress((p) => ({
                        ...p,
                        currentWorld: wId,
                      }));
                    }}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-extrabold transition whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-yellow-400 text-slate-950 shadow cursor-pointer'
                        : unlocked
                        ? 'text-amber-100 hover:bg-amber-800/60 cursor-pointer'
                        : 'text-amber-400/50 bg-black/30 border border-amber-900/50 cursor-not-allowed'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Primary Start Action + Secondary Hub Actions */}
            <div className="pointer-events-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <button
                type="button"
                data-start="true"
                onClick={startGame}
                className="px-7 py-4 rounded-2xl bg-yellow-400 hover:bg-yellow-300 active:scale-95 text-slate-950 font-display font-black text-xl tracking-wide border-4 border-slate-950 shadow-[0_5px_0_#0f172a] transition cursor-pointer whitespace-nowrap shrink-0"
              >
                ¡JUGAR NIVEL {progress.currentLevel}!
              </button>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowCodex(true)}
                  className="flex-1 sm:flex-initial px-3.5 py-3.5 rounded-xl bg-amber-900/95 hover:bg-amber-800 text-amber-100 font-extrabold text-xs border-2 border-amber-500/70 transition whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Álbum 3★ ({progress.unlockedAchievements.length}/{ACHIEVEMENTS_CATALOG.length})
                </button>
                <button
                  type="button"
                  onClick={() => setShowWardrobe(true)}
                  className="flex-1 sm:flex-initial px-3.5 py-3.5 rounded-xl bg-cyan-950/95 hover:bg-cyan-900 text-cyan-200 font-extrabold text-xs border-2 border-cyan-500/70 transition whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Vestuario 3D
                </button>
              </div>
            </div>
          </div>

          {/* Single flat borderless mobile-first inline touch hint at bottom safe margin */}
          <div className="text-xs font-bold text-amber-100/90 tracking-wide">
            Coloca tus armas en la encimera antes de cada oleada · Combina en Línea, Puente o Escuadra 90°
          </div>
        </section>
      )}

      {/* =====================================================================
          2. PLAYING HUD (Matching 1794109185461.jpg — Top Status Cluster, Blue Tactical Pill, & Gunmetal Serving Tray)
         ===================================================================== */}
      {gameState === 'playing' && (
        <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-1.5 sm:p-3">
          {/* Top Row: Left Status Cluster + Center/Right Blue Tactical Pill + Utility Controls */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-start justify-between gap-2">
              {/* Top-Left Status Cluster matching 1794109185461.jpg + 120s Wave Timer & Biome */}
              <div className="bg-stone-900/90 border-2 border-stone-950 rounded-xl px-2.5 py-1.5 shadow-[0_3px_0_#0f172a] flex flex-col gap-0.5 shrink-0">
                <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-black tracking-wide text-white leading-none drop-shadow">
                  <span>
                    NV.{progress.currentLevel} · FASE {hud.phase}/3
                  </span>
                  {progress.currentLevel >= 5 && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-500/25 border border-amber-400/60 font-mono text-[10px] text-yellow-300">
                      {hud.levelTimer > 0
                        ? `⏱️ ${formatWaveTimer(hud.levelTimer)}`
                        : '🧹 ¡LIMPIA EL TABLERO!'}
                    </span>
                  )}
                </div>
                <div className="text-[9px] font-extrabold text-cyan-300 leading-none mt-0.5">
                  {activeBiome.shortName}
                  {progress.currentLevel >= 31 ? ' · 📐 Lateral' : ''}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[9px] font-black uppercase tracking-wider text-stone-200 leading-none">
                    PLATOS
                  </span>
                  <div
                    className="flex items-center gap-1"
                    aria-label={`Sellos de Sanidad: ${hud.sanitationSeals} de 3`}
                  >
                    {[0, 1, 2].map((idx) => (
                      <svg
                        key={idx}
                        viewBox="0 0 24 24"
                        className="w-4 h-4 sm:w-4.5 sm:h-4.5"
                        aria-hidden="true"
                      >
                        <circle
                          cx="12"
                          cy="12"
                          r="10"
                          fill={idx < hud.sanitationSeals ? '#3b82f6' : '#334155'}
                          stroke="#0f172a"
                          strokeWidth="2.5"
                        />
                        <path
                          d="M7.5 12.5 L10.5 15.5 L16.5 8.5"
                          fill="none"
                          stroke={idx < hud.sanitationSeals ? '#ffffff' : '#64748b'}
                          strokeWidth="2.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ))}
                  </div>
                  <span className="font-mono tabular-nums text-[10px] font-black text-amber-300 ml-0.5">
                    {hud.phaseKills}/{hud.phaseTargetKills}
                  </span>
                  {hud.hazmatShieldReady && (
                    <span
                      title="Traje EPI Amarillo listo para absorber el 1er impacto o ácido"
                      className="text-[9px] font-black text-yellow-300 ml-1"
                    >
                      · ☣️ EPI
                    </span>
                  )}
                  {hud.armoredPlates > 0 && (
                    <span
                      title="Blindaje de plato activo"
                      className="text-[9px] font-black text-cyan-300 ml-0.5"
                    >
                      · 🛡️×{hud.armoredPlates}
                    </span>
                  )}
                </div>
              </div>

              {/* Top-Right Utility Controls */}
              <div className="pointer-events-auto flex items-center gap-1 shrink-0">
                {onboardingCard && (
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label="Ver Tarjeta Táctica del Nivel"
                    onClick={(e) => {
                      e.currentTarget.blur();
                      setShowOnboardingModal(true);
                    }}
                    className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-stone-900/95 border-2 border-stone-950 shadow-[0_2px_0_#0f172a] flex items-center justify-center text-cyan-300 hover:bg-stone-800 transition shrink-0 text-xs font-black cursor-pointer"
                  >
                    ?
                  </button>
                )}

                <button
                  type="button"
                  tabIndex={-1}
                  aria-label="Abrir Álbum 3 Estrellas y Tienda"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    setShowCodex(true);
                  }}
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-stone-900/95 border-2 border-stone-950 shadow-[0_2px_0_#0f172a] flex items-center justify-center text-yellow-300 hover:bg-stone-800 transition shrink-0"
                >
                  <span className="text-xs font-black">3★</span>
                </button>

                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={settings.muted ? 'Activar Sonido' : 'Silenciar Sonido'}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    handleUpdateSettings({ muted: !settings.muted });
                  }}
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-stone-900/95 border-2 border-stone-950 shadow-[0_2px_0_#0f172a] flex items-center justify-center text-stone-100 hover:bg-stone-800 transition shrink-0"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2">
                    {settings.muted ? (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    )}
                  </svg>
                </button>

                <button
                  type="button"
                  tabIndex={-1}
                  aria-label="Pausar Partida"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    setGameState('paused');
                  }}
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-stone-900/95 border-2 border-stone-950 shadow-[0_2px_0_#0f172a] flex items-center justify-center text-stone-100 hover:bg-stone-800 transition shrink-0"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6" />
                  </svg>
                </button>

                <button
                  type="button"
                  tabIndex={-1}
                  aria-label="Reiniciar Nivel"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    startGame();
                  }}
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-stone-900/95 border-2 border-stone-950 shadow-[0_2px_0_#0f172a] flex items-center justify-center text-stone-100 hover:bg-stone-800 transition shrink-0"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Segmented Top Boss HP Bar (Mini-Bosses X5 & 3-Phase Grand Bosses X0 with 33% & 66% notches) */}
            {hud.bossHud && (
              <div
                data-testid="boss-hp-bar"
                className={`mx-auto w-full max-w-md rounded-xl border-2 px-3 py-1.5 shadow-[0_3px_0_#0f172a] transition ${
                  hud.bossHud.phaseJustBroke
                    ? 'bg-fuchsia-950/95 border-yellow-300 scale-[1.02]'
                    : 'bg-stone-950/92 border-amber-500/90'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-[10px] sm:text-xs font-black text-white leading-tight">
                  <span className="truncate text-amber-300">
                    {hud.bossHud.tier === 'grand' ? '👑' : '🦀'} {hud.bossHud.name}
                  </span>
                  <span className="font-mono tabular-nums text-yellow-300 shrink-0">
                    {hud.bossHud.hpPct}% HP
                  </span>
                </div>

                {/* Continuous SVG Boss Bar with 2 Crisp Notches at 33% and 66% HP */}
                <div className="mt-1">
                  <svg
                    viewBox="0 0 200 12"
                    preserveAspectRatio="none"
                    className="w-full h-3 rounded-md border border-slate-950 bg-slate-900 overflow-hidden"
                    role="img"
                    aria-label={`Vida del Jefe: ${hud.bossHud.hpPct}%`}
                  >
                    <rect
                      x="0"
                      y="0"
                      width={Math.max(0, Math.min(200, hud.bossHud.hpPct * 2))}
                      height="12"
                      fill={
                        hud.bossHud.phaseJustBroke
                          ? '#fde047'
                          : hud.bossHud.tier === 'grand' && hud.bossHud.phase === 1
                          ? '#a855f7'
                          : hud.bossHud.tier === 'grand' && hud.bossHud.phase === 2
                          ? '#f59e0b'
                          : '#ef4444'
                      }
                    />
                    {hud.bossHud.tier === 'grand' && (
                      <>
                        <line
                          x1="66"
                          y1="0"
                          x2="66"
                          y2="12"
                          stroke="#ffffff"
                          strokeWidth="2"
                        />
                        <line
                          x1="132"
                          y1="0"
                          x2="132"
                          y2="12"
                          stroke="#ffffff"
                          strokeWidth="2"
                        />
                      </>
                    )}
                  </svg>
                </div>

                <div className="mt-0.5 flex items-center justify-between gap-2 text-[9px] font-extrabold text-amber-100/90 leading-tight">
                  <span className="truncate">{hud.bossHud.phaseLabel}</span>
                  {hud.bossHud.tier === 'grand' && (
                    <span className="font-mono text-fuchsia-300 shrink-0">66% · 33%</span>
                  )}
                </div>
              </div>
            )}

            {/* Strategic Placement Mode Forecast & Economy Boosters (Level 4+ ONLY; ultra-compact so upper vents stay 100% uncovered) */}
            <div className="flex items-center justify-between gap-1.5">
              {hud.inPlacementPhase && !isDynamicOnboardingLevel(progress.currentLevel) ? (
                <div className="pointer-events-auto w-full max-w-lg bg-gradient-to-b from-blue-700 to-blue-900 border-2 border-slate-950 rounded-xl px-2 py-1 shadow-[0_2px_0_#0f172a] flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="min-w-0 flex flex-wrap items-center gap-1 text-[9px] sm:text-[10px] font-extrabold text-white leading-tight">
                      <span className="font-black uppercase text-yellow-300 whitespace-nowrap">
                        ⏱️ ESTRATÉGICO
                      </span>
                      <span aria-hidden="true" className="text-blue-300">
                        ·
                      </span>
                      <span className="inline-flex items-center gap-0.5">
                        {hud.forecast.bugTypes.map((bType) => (
                          <span
                            key={bType}
                            title={BUG_FORECAST_ICONS[bType].label}
                            className="text-[11px] leading-none"
                          >
                            {BUG_FORECAST_ICONS[bType].icon}
                          </span>
                        ))}
                      </span>
                      {hud.forecast.bossTier !== 'none' && (
                        <span className="text-yellow-300 font-black whitespace-nowrap">
                          {hud.forecast.bossTier === 'grand' ? '👑JEFE 3F' : '🦀MINI'}
                        </span>
                      )}
                      <span className="font-mono text-emerald-300 whitespace-nowrap">
                        [{hud.forecast.activeRails.map((r) => `R${r + 1}`).join(' ')}
                        {hud.forecast.hasLateralConduits ? '+📐' : ''}]
                      </span>
                      <span className="font-mono tabular-nums text-amber-200 whitespace-nowrap">
                        🪙{progress.coins}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        startWaveRef.current = true;
                        soundEngine.playSnapPiece(true);
                      }}
                      className={`px-2.5 py-1 rounded-lg font-display font-black text-[11px] border-2 shrink-0 transition cursor-pointer whitespace-nowrap ${
                        placedCount > 0
                          ? 'bg-emerald-400 hover:bg-emerald-300 text-slate-950 border-slate-950 shadow-[0_2px_0_#0f172a] animate-pulse'
                          : 'bg-slate-950 hover:bg-slate-800 text-amber-300 border-amber-400/70'
                      }`}
                    >
                      ▶️ ¡EMPEZAR!
                    </button>
                  </div>

                  {/* Optional Coin Boosters for this attempt (Unlocked from Level 15+) */}
                  {progress.currentLevel >= 15 && (
                    <div className="flex items-center gap-1.5 pt-0.5 border-t border-blue-400/30">
                      <button
                        type="button"
                        disabled={usedUltBoost || progress.coins < STRATEGIC_BOOST_ULTIMATE_COST}
                        onClick={handleBuyStrategicUltimateBoost}
                        className={`px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] font-black border transition whitespace-nowrap cursor-pointer ${
                          usedUltBoost
                            ? 'bg-emerald-950 border-emerald-400 text-emerald-300 cursor-default'
                            : progress.coins >= STRATEGIC_BOOST_ULTIMATE_COST
                            ? 'bg-slate-950 hover:bg-slate-900 text-amber-300 border-amber-400'
                            : 'bg-slate-900/60 border-slate-700 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        {usedUltBoost
                          ? '✓ +50% Ulti'
                          : `⚡ +50% Ulti · ${STRATEGIC_BOOST_ULTIMATE_COST}🪙`}
                      </button>

                      <button
                        type="button"
                        disabled={usedShieldBoost || progress.coins < STRATEGIC_BOOST_SHIELD_COST}
                        onClick={handleBuyStrategicShieldBoost}
                        className={`px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] font-black border transition whitespace-nowrap cursor-pointer ${
                          usedShieldBoost
                            ? 'bg-emerald-950 border-emerald-400 text-emerald-300 cursor-default'
                            : progress.coins >= STRATEGIC_BOOST_SHIELD_COST
                            ? 'bg-slate-950 hover:bg-slate-900 text-cyan-300 border-cyan-400'
                            : 'bg-slate-900/60 border-slate-700 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        {usedShieldBoost
                          ? '✓ Plato Blindado'
                          : `🛡️ Blindar Plato · ${STRATEGIC_BOOST_SHIELD_COST}🪙`}
                      </button>
                    </div>
                  )}
                </div>
              ) : hud.prepTimer > 0 ? (
                <div className="bg-gradient-to-b from-blue-600 to-blue-800 border-2 border-slate-950 px-3 py-1 rounded-full text-[10px] font-black text-white shadow-[0_2px_0_#0f172a] whitespace-nowrap">
                  ⏳ SIGUIENTE OLEADA EN {Math.ceil(hud.prepTimer)}S · REVISA LOS CONDUCTOS
                </div>
              ) : null}
            </div>

            {/* Salvada In Extremis Banner Cue (1.2s slow-mo on last intact plate) */}
            {hud.lastStandActive && (
              <div className="mx-auto bg-rose-950/95 border-2 border-rose-400 px-3 py-1 rounded-xl text-[10px] font-black text-rose-100 shadow-[0_2px_0_#0f172a] whitespace-nowrap">
                ⏱️ ¡ÚLTIMO PLATO · CÁMARA LENTA!
              </div>
            )}
          </div>

          {/* Salvada In Extremis Soft Red Edge Pulse Vignette (Zero backdrop-filter) */}
          {hud.lastStandActive && (
            <div
              aria-hidden="true"
              className="pointer-events-none fixed inset-0 z-10 border-[6px] border-red-500/80 shadow-[inset_0_0_52px_rgba(239,68,68,0.75)] animate-pulse"
            />
          )}

          {/* Single-Focus Animated Drag Guide + Minimal Floating Cell Label (Levels 1-3 & 31) */}
          {hud.tutorialTargetScreen && !hud.selectedPieceId && !dockCollapsed && (
            <div className="pointer-events-none fixed inset-0 z-20">
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                className="w-full h-full"
                aria-hidden="true"
              >
                <defs>
                  <marker
                    id="onboarding-arrow"
                    markerWidth="5"
                    markerHeight="5"
                    refX="3.5"
                    refY="2.5"
                    orient="auto"
                  >
                    <polygon points="0 0, 5 2.5, 0 5" fill="#4ade80" />
                  </marker>
                </defs>
                <line
                  x1={tutorialTrayStartXPct}
                  y1={88}
                  x2={hud.tutorialTargetScreen.xPct}
                  y2={hud.tutorialTargetScreen.yPct + 2}
                  stroke="#4ade80"
                  strokeWidth="0.65"
                  strokeDasharray="2.2 1.6"
                  markerEnd="url(#onboarding-arrow)"
                />
              </svg>

              <div
                data-testid="onboarding-short-tag"
                className={`fixed ${getTargetLeftClass(
                  hud.tutorialTargetScreen.xPct
                )} ${getTargetTopClass(
                  hud.tutorialTargetScreen.yPct
                )} -translate-x-1/2 -translate-y-full -mt-2 bg-slate-950/95 border-2 border-lime-400 text-lime-300 px-2.5 py-0.5 rounded-lg text-[10px] font-black tracking-wide whitespace-nowrap shadow-[0_3px_0_#0f172a]`}
              >
                {hud.tutorialTargetScreen.shortTag}
              </div>
            </div>
          )}

          {/* =================================================================
              GUNMETAL SERVING TRAY WITH METALLIC SIDE HANDLES + GOLDEN COIN ULTIMATE
              (Compact height so the 3D Chef & table legs are 100% visible above it!)
             ================================================================= */}
          <div className="pointer-events-auto mx-auto w-full max-w-[360px] flex flex-col items-center pb-0.5">
            {!dockCollapsed && (
              <div className="relative flex items-center justify-center w-full px-3">
                {/* Left Metallic Serving Tray Handle */}
                <div
                  aria-hidden="true"
                  className="w-3 h-8 sm:h-10 -mr-1 rounded-l-lg border-[2.5px] border-r-0 border-slate-950 bg-gradient-to-b from-slate-400 to-slate-600 shadow-[0_3px_0_#0f172a] flex items-center justify-end pr-0.5"
                >
                  <div className="w-1 h-5 sm:h-6 rounded-l bg-slate-800 border border-r-0 border-slate-950" />
                </div>

                {/* Main Gunmetal Serving Tray Body */}
                <div className="flex-1 rounded-2xl bg-gradient-to-b from-slate-600 via-slate-700 to-slate-800 border-[2.5px] border-slate-950 p-1 shadow-[0_4px_0_#0f172a] flex items-center gap-1">
                  <div className="flex-1 rounded-xl bg-slate-800/95 border-2 border-slate-950 px-1.5 py-1 flex items-center gap-1.5 min-w-0">
                    {/* Utensil Slots with Custom SVG 3D Weapon Illustrations */}
                    <div className="flex-1 flex items-center gap-1.5 min-w-0">
                      {hud.pieces.map((piece) => {
                        const isSelected = hud.selectedPieceId === piece.id;
                        const isGunked = piece.gunkTimer > 0;
                        const inTray = piece.rail === null;
                        // STRICT SINGLE FOCUS: never illuminate a second tray card while another piece is selected
                        const isTutorialNext =
                          !hud.selectedPieceId &&
                          inTray &&
                          tutorialGuide?.nextTarget?.pieceId === piece.id;
                        const activeMicroTip =
                          longPressTip?.pieceId === piece.id ? longPressTip.text : null;
                        const compactLabel =
                          piece.type === 'spray_flus'
                            ? 'Flus-Flus'
                            : piece.type === 'scourer_nanas'
                            ? 'Estropajo'
                            : piece.type === 'aerosol_torch'
                            ? 'Aerosol UV'
                            : piece.type === 'soap_bar'
                            ? 'Jabón 45°'
                            : piece.type === 'mop_vortex'
                            ? 'Fregona'
                            : piece.type === 'corner_square'
                            ? 'Escuadra 90°'
                            : piece.type === 'wc_shield'
                            ? 'Gel WC'
                            : 'Lejía';

                        return (
                          <button
                            key={piece.id}
                            type="button"
                            onPointerDown={(e) => {
                              suppressNextTrayClickRef.current = false;
                              if (trayPressRef.current?.timerId) {
                                window.clearTimeout(trayPressRef.current.timerId);
                              }
                              setLongPressTip(null);
                              const timerId = window.setTimeout(() => {
                                if (trayPressRef.current && !trayPressRef.current.dragged) {
                                  trayPressRef.current.longPressed = true;
                                  setLongPressTip({
                                    pieceId: piece.id,
                                    text: UTENSIL_MICRO_TIPS[piece.type],
                                  });
                                }
                              }, 350);
                              trayPressRef.current = {
                                pieceId: piece.id,
                                type: piece.type,
                                startX: e.clientX,
                                startY: e.clientY,
                                dragged: false,
                                longPressed: false,
                                timerId,
                              };
                            }}
                            onClick={() => {
                              if (suppressNextTrayClickRef.current) {
                                suppressNextTrayClickRef.current = false;
                                return;
                              }
                              if (isGunked) {
                                piece.gunkTimer = 0;
                                soundEngine.playSnapPiece(true);
                                return;
                              }
                              selectedPieceIdRef.current = isSelected ? null : piece.id;
                              soundEngine.playSlowMoEnter();
                            }}
                            className={`touch-none relative flex-1 min-w-0 h-12 sm:h-14 rounded-xl border-2 flex flex-col items-center justify-between py-0.5 px-1 transition cursor-pointer ${
                              isSelected
                                ? 'bg-slate-700 border-cyan-400 scale-105 shadow-[0_0_10px_#22d3ee]'
                                : isGunked
                                ? 'bg-lime-950 border-lime-400'
                                : isTutorialNext
                                ? 'bg-slate-700 border-lime-400 shadow-[0_0_10px_#4ade80]'
                                : 'bg-slate-700/90 border-slate-950 hover:bg-slate-600/90 shadow-inner'
                            }`}
                          >
                            {/* 350ms Long-Press <= 4-Word Micro-Label */}
                            {activeMicroTip && (
                              <span
                                role="tooltip"
                                data-testid="tray-micro-tip"
                                className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 z-40 bg-slate-950 border border-cyan-400 text-cyan-200 px-2 py-0.5 rounded-md text-[10px] font-extrabold whitespace-nowrap shadow-lg"
                              >
                                {activeMicroTip}
                              </span>
                            )}

                            {isTutorialNext && !isSelected && !activeMicroTip && (
                              <span
                                aria-hidden="true"
                                className="absolute -top-2 right-0.5 text-[11px] animate-bounce"
                              >
                                👆
                              </span>
                            )}

                            {/* Bespoke SVG Illustration matching the 3D Weapon in 1794109185461.jpg */}
                            <div className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center shrink-0">
                              {piece.type === 'aerosol_torch' ? (
                                <svg viewBox="0 0 40 48" className="w-full h-full drop-shadow">
                                  <rect x="9" y="13" width="22" height="30" rx="3" fill="#7c3aed" stroke="#0f172a" strokeWidth="2.5" />
                                  <path d="M9 14 C9 8 31 8 31 14 Z" fill="#cbd5e1" stroke="#0f172a" strokeWidth="2.5" />
                                  <rect x="16" y="3" width="8" height="6" rx="1.5" fill="#ffffff" stroke="#0f172a" strokeWidth="2.2" />
                                  <text x="20" y="29" textAnchor="middle" fill="#ffffff" fontSize="6.5" fontWeight="900">UV</text>
                                </svg>
                              ) : piece.type === 'spray_flus' ? (
                                <svg viewBox="0 0 40 48" className="w-full h-full drop-shadow">
                                  <path d="M10 21 C10 15 30 15 30 21 L29 43 C29 45 11 45 11 43 Z" fill="#22d3ee" stroke="#0f172a" strokeWidth="2.5" />
                                  <rect x="13" y="25" width="14" height="14" rx="2" fill="#fb7185" stroke="#0f172a" strokeWidth="1.8" />
                                  <path d="M11 8 L30 8 L27 16 L14 16 Z" fill="#ef4444" stroke="#0f172a" strokeWidth="2.5" />
                                  <path d="M26 13 L32 20" stroke="#ef4444" strokeWidth="3.2" strokeLinecap="round" />
                                </svg>
                              ) : piece.type === 'scourer_nanas' ? (
                                <svg viewBox="0 0 44 40" className="w-full h-full drop-shadow">
                                  <path d="M4 19 L26 10 L40 19 L18 28 Z" fill="#22c55e" stroke="#0f172a" strokeWidth="2.5" />
                                  <path d="M4 19 L18 28 L18 36 L4 27 Z" fill="#eab308" stroke="#0f172a" strokeWidth="2.5" />
                                  <path d="M18 28 L40 19 L40 27 L18 36 Z" fill="#ca8a04" stroke="#0f172a" strokeWidth="2.5" />
                                </svg>
                              ) : piece.type === 'soap_bar' ? (
                                <svg viewBox="0 0 44 40" className="w-full h-full drop-shadow">
                                  <rect x="6" y="12" width="32" height="17" rx="5" transform="rotate(-12 22 21)" fill="#f472b6" stroke="#0f172a" strokeWidth="2.5" />
                                  <rect x="11" y="15" width="22" height="11" rx="3" transform="rotate(-12 22 21)" fill="#fbcfe8" />
                                </svg>
                              ) : piece.type === 'corner_square' ? (
                                <svg viewBox="0 0 44 44" className="w-full h-full drop-shadow">
                                  <path d="M6 8 H36 V18 H18 V36 H6 Z" fill="#facc15" stroke="#0f172a" strokeWidth="2.5" />
                                  <path d="M18 18 L34 34" stroke="#22d3ee" strokeWidth="4" strokeLinecap="round" />
                                  <polygon points="24,36 36,36 36,24" fill="#22d3ee" stroke="#0f172a" strokeWidth="1.5" />
                                </svg>
                              ) : (
                                <svg viewBox="0 0 40 48" className="w-full h-full drop-shadow">
                                  <line x1="20" y1="5" x2="20" y2="30" stroke="#ef4444" strokeWidth="4" strokeLinecap="round" />
                                  <path d="M8 39 C8 25 32 25 32 39 Z" fill="#2dd4bf" stroke="#0f172a" strokeWidth="2.5" />
                                </svg>
                              )}
                            </div>

                            <span className="text-[9px] sm:text-[10px] font-black text-white truncate max-w-full leading-tight pb-0.5 drop-shadow-[0_1.5px_0_#0f172a]">
                              {isGunked ? '🤢 Limpiar' : compactLabel}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Circular Golden Coin-Style ULTIMATE Button matching 1794109185461.jpg */}
                    <button
                      type="button"
                      disabled={hud.pressurePct < 100}
                      aria-label={`Ultimate ${equippedSpecialMeta.name}: Presión ${hud.pressurePct}%`}
                      onClick={() => {
                        triggerUltimateRef.current = true;
                      }}
                      className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full border-[2.5px] border-slate-950 flex flex-col items-center justify-center shrink-0 transition shadow-[0_3px_0_#0f172a] ${
                        hud.pressurePct >= 100
                          ? 'bg-gradient-to-b from-yellow-300 via-amber-400 to-amber-500 animate-pulse cursor-pointer scale-105'
                          : 'bg-gradient-to-b from-amber-300 via-yellow-400 to-amber-600 cursor-pointer'
                      }`}
                    >
                      <div className="w-9.5 h-9.5 sm:w-11 sm:h-11 rounded-full border-2 border-amber-700/70 bg-gradient-to-b from-yellow-300 to-amber-500 flex flex-col items-center justify-center px-0.5">
                        <span className="text-[8px] sm:text-[9px] font-black text-white leading-none drop-shadow-[0_1.5px_0_#0f172a]">
                          Ultimate
                        </span>
                        <span className="font-mono tabular-nums text-[10px] sm:text-[11px] font-black text-white leading-tight drop-shadow-[0_1.5px_0_#0f172a]">
                          {hud.pressurePct >= 100 ? '100%' : `${hud.pressurePct}%`}
                        </span>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Right Metallic Serving Tray Handle */}
                <div
                  aria-hidden="true"
                  className="w-3 h-8 sm:h-10 -ml-1 rounded-r-lg border-[2.5px] border-l-0 border-slate-950 bg-gradient-to-b from-slate-400 to-slate-600 shadow-[0_3px_0_#0f172a] flex items-center justify-start pl-0.5"
                >
                  <div className="w-1 h-5 sm:h-6 rounded-r bg-slate-800 border border-l-0 border-slate-950" />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          3. PAUSE MODAL (Triggered by Escape or Pause Button)
         ===================================================================== */}
      {gameState === 'paused' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Juego en Pausa"
          data-testid="pause-modal"
          className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4"
        >
          <div className="w-full max-w-sm rounded-2xl bg-amber-950 border-4 border-amber-500 p-6 text-amber-50 shadow-2xl space-y-4">
            <h2 className="text-2xl font-display font-black text-yellow-300 text-center">
              INSPECCIÓN EN PAUSA
            </h2>

            <div className="grid grid-cols-2 gap-2.5 text-center bg-amber-900/50 p-3 rounded-xl border border-amber-700">
              <div>
                <div className="text-[10px] font-bold uppercase text-amber-300">NIVEL / FASE</div>
                <div className="font-mono tabular-nums text-lg font-black">
                  Nv.{progress.currentLevel} · {hud.phase}/3
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase text-amber-300">PUNTUACIÓN</div>
                <div className="font-mono tabular-nums text-lg font-black text-yellow-300">
                  {hud.score}
                </div>
              </div>
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => setGameState('playing')}
                className="w-full py-3 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-black text-sm border-2 border-slate-950 shadow-[0_3px_0_#0f172a] cursor-pointer transition"
              >
                ▶️ Continuar Partida
              </button>
              <button
                type="button"
                onClick={() => setShowSettings(true)}
                className="w-full py-2.5 rounded-xl bg-cyan-950 hover:bg-cyan-900 text-cyan-200 border border-cyan-400/70 font-extrabold text-xs cursor-pointer transition"
              >
                ⚙️ Ajustes y Audio
              </button>
              <button
                type="button"
                onClick={resetBoardToDefault}
                className="w-full py-2.5 rounded-xl bg-amber-800 hover:bg-amber-700 text-amber-100 font-bold text-xs cursor-pointer transition"
              >
                🧹 Vaciar Encimera y Colocar de Nuevo
              </button>
              <button
                type="button"
                onClick={() => {
                  handleResetProgressFromZero();
                  setGameState('title');
                }}
                className="w-full py-2.5 rounded-xl bg-rose-950 hover:bg-rose-900 text-rose-100 border border-rose-500/60 font-bold text-xs cursor-pointer transition"
              >
                🔄 Empezar de 0 (Volver a Nivel 1)
              </button>
              <button
                type="button"
                onClick={() => setGameState('title')}
                className="w-full py-2.5 rounded-xl bg-amber-900/70 hover:bg-amber-900 text-amber-200 font-bold text-xs cursor-pointer transition"
              >
                🚪 Salir al Menú Principal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          4. VICTORY / GAME OVER MODAL (With Near-Miss & Stagnation Shop CTA)
         ===================================================================== */}
      {gameState === 'gameover' && endOutcome && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={
            endOutcome.victory ? 'Cocina Desinfectada Victoria' : 'Clausurado por Sanidad Fin del Juego'
          }
          className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-black/85 p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-amber-950 border-4 border-yellow-400 p-6 text-amber-50 shadow-2xl space-y-4">
            <div className="text-center">
              <h2 className="text-2xl sm:text-3xl font-display font-black text-yellow-300">
                {endOutcome.victory
                  ? '¡COCINA DESINFECTADA!'
                  : '¡CLAUSURADO POR SANIDAD!'}
              </h2>
              <p className="text-xs font-bold text-amber-200 mt-1">
                {endOutcome.victory
                  ? `¡Progreso guardado automáticamente en el Nivel ${progress.currentLevel}!`
                  : `¡Casi lo logras! Te faltaron solo ${endOutcome.remainingKillsToNext} plagas para superar el Cambio ${endOutcome.phaseReached}/3.`}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center bg-amber-900/50 p-3 rounded-xl border border-amber-700">
              <div>
                <div className="text-[10px] font-bold uppercase text-amber-300">PUNTOS</div>
                <div className="font-mono tabular-nums text-lg font-black text-white">
                  {endOutcome.score}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase text-amber-300">RÉCORD</div>
                <div className="font-mono tabular-nums text-lg font-black text-yellow-300">
                  {progress.bestScore}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase text-amber-300">MONEDAS</div>
                <div className="font-mono tabular-nums text-lg font-black text-emerald-300">
                  🪙 {progress.coins}
                </div>
              </div>
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                data-start="true"
                onClick={startGame}
                className="w-full py-3.5 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-display font-black text-base border-2 border-slate-950 shadow-[0_4px_0_#0f172a]"
              >
                {endOutcome.victory
                  ? `¡Jugar Nivel ${progress.currentLevel}!`
                  : 'Reintentar Nivel Ahora'}
              </button>

              <button
                type="button"
                onClick={() => setShowCodex(true)}
                className="w-full py-2.5 rounded-xl bg-cyan-950 hover:bg-cyan-900 text-cyan-200 border border-cyan-400/70 font-extrabold text-xs"
              >
                ¿Atascado? Desbloquear Armas 3★ en el Álbum (🪙 {progress.coins})
              </button>

              <button
                type="button"
                onClick={() => setGameState('title')}
                className="w-full py-2 rounded-xl bg-amber-900/60 hover:bg-amber-900 text-amber-200 font-bold text-xs"
              >
                Ir al Menú Principal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals for On-Demand Tactical Help Card ('?'), 3★ Achievements Codex & 3D Chef Wardrobe */}
      {gameState === 'playing' && onboardingCard && showOnboardingModal && (
        <TacticalOnboardingModal
          card={onboardingCard}
          onDismiss={() => setShowOnboardingModal(false)}
        />
      )}
      {showCodex && (
        <AchievementsCodexModal
          progress={progress}
          onClose={() => setShowCodex(false)}
          onBuyAchievement={handleBuyAchievementInShop}
        />
      )}
      {showWardrobe && (
        <ChefWardrobeModal
          progress={progress}
          onClose={() => setShowWardrobe(false)}
          onEquipHat={(h) => setProgress((p) => ({ ...p, equippedHat: h }))}
          onEquipArmor={(a) => setProgress((p) => ({ ...p, equippedArmor: a }))}
          onEquipSpecial={(s) => setProgress((p) => ({ ...p, equippedSpecial: s }))}
        />
      )}
      {showSettings && (
        <SettingsModal
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
          onResetDefaults={() => setSettings(DEFAULT_SETTINGS)}
          onClose={() => setShowSettings(false)}
        />
      )}
    </main>
  );
}
