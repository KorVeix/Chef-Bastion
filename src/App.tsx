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
  KitchenUpgradesModal,
  LiveComandasOverlay,
  QuickGuideModal,
  SettingsModal,
  StrategicCampaignModal,
  TacticalInspectorBanner,
  TacticalOnboardingModal,
  ThermalReceiptModal,
  WardrobeTabId,
} from './components/GameModals';
import { soundEngine } from './game/audio';
import {
  buildThermalReceipt,
  formatSurvivalMMSS,
  getInitialAerosolAmmo,
  rollRushTrayBatch,
  RUSH_ADRENALINE_MILESTONES,
  ThermalReceiptSummary,
} from './game/roguelite';
import {
  ACHIEVEMENTS_CATALOG,
  computeKitchenUpgradeEffects,
  computeStrategicMatchCoins,
  createInitialBoardPieces,
  DEFAULT_PROGRESS,
  DEFAULT_SETTINGS,
  formatDefeatNearMissCopy,
  getBiomeForLevel,
  getLevelForecast,
  getTacticalInspectorCard,
  getTacticalOnboardingCard,
  getTutorialGuideForLevel,
  groupTrayPiecesForDisplay,
  hasRemainingShopUnlocks,
  isAchievementPurchasableWithCoins,
  isDynamicOnboardingLevel,
  KITCHEN_UPGRADES_CATALOG,
  LEVEL_DURATION_SECONDS,
  MENU_PLATE_BUFF_META,
  normalizeKitchenUpgrades,
  purchaseKitchenUpgrade,
  pushFloatingComboNonOverlapping,
  resolveAndroidBackAction,
  shouldRecommendStrategicFirst,
  SPECIAL_WEAPONS_CATALOG,
  STRATEGIC_BOOST_SHIELD_COST,
  STRATEGIC_BOOST_ULTIMATE_COST,
  UTENSIL_CATALOG,
  UTENSIL_MICRO_TIPS,
  UTENSIL_ROLE_TAGS,
  WORLD_UNLOCK_LEVELS,
} from './game/rules';
import {
  ArmorId,
  BugType,
  ComicPopEvent,
  FloatingComboEvent,
  GameMode,
  GameSettings,
  GameState,
  HatId,
  KillStarRating,
  KitchenUpgradeId,
  PlayerProgress,
  SpecialWeaponId,
  TacticalInspectionTarget,
  UtensilPiece,
  UtensilType,
  WorldId,
} from './game/types';
import { usePWAInstall } from './hooks/usePWAInstall';

const SAVE_STORAGE_KEY = 'chef_bastion_save_v1';
const SETTINGS_STORAGE_KEY = 'chef_bastion_settings_v1';
const ACTIVE_SESSION_STORAGE_KEY = 'chef_bastion_active_session_v1';
const LEGACY_BOARD_STORAGE_KEY = 'chef_bastion_board_v1';

function loadSavedProgress(): PlayerProgress {
  try {
    // Purge legacy board storage so levels NEVER start with pre-placed pieces from old sessions
    localStorage.removeItem(LEGACY_BOARD_STORAGE_KEY);
    const raw = localStorage.getItem(SAVE_STORAGE_KEY);
    if (!raw) return DEFAULT_PROGRESS;
    const parsed = JSON.parse(raw) as Partial<PlayerProgress>;
    return {
      ...DEFAULT_PROGRESS,
      ...parsed,
      kitchenUpgrades: normalizeKitchenUpgrades(parsed.kitchenUpgrades),
    };
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

  const [gameMode, setGameMode] = useState<GameMode>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('mode') === 'strategic') return 'strategic';
    }
    return 'rush';
  });
  const gameModeRef = useRef<GameMode>(gameMode);
  gameModeRef.current = gameMode;

  const [progress, setProgress] = useState<PlayerProgress>(loadSavedProgress);
  const progressRef = useRef<PlayerProgress>(progress);
  progressRef.current = progress;

  // Every level/session ALWAYS starts with 100% of pieces in the bottom tray and >= 1 Flus-Flus!
  const piecesRef = useRef<UtensilPiece[]>(
    gameMode === 'rush'
      ? rollRushTrayBatch({
          elapsedSeconds: 0,
          unlockedMilestones: loadSavedProgress().unlockedRushMilestones ?? [],
        }).map((slot) => {
          const initAmmo =
            slot.type === 'aerosol_torch' ? getInitialAerosolAmmo(slot.level) : undefined;
          return {
            id: slot.id,
            type: slot.type,
            level: slot.level,
            rail: null,
            row: null,
            gunkTimer: 0,
            cooldown: 0.15,
            fireTimer: 0.08,
            comboType: 'none',
            ammo: initAmmo,
            maxAmmo: initAmmo,
          };
        })
      : createInitialBoardPieces(loadSavedProgress().currentLevel)
  );
  const selectedPieceIdRef = useRef<string | null>(null);
  const inspectionTargetRef = useRef<TacticalInspectionTarget | null>(null);
  const triggerUltimateRef = useRef<boolean>(false);
  const startWaveRef = useRef<boolean>(false);
  const pickComandaIndexRef = useRef<number | null>(null);
  const dragPointerRef = useRef<DragPointerState>({
    active: false,
    pieceId: null,
    clientX: 0,
    clientY: 0,
  });
  const boostUltimateRef = useRef<boolean>(false);
  const boostPlateShieldRef = useRef<boolean>(false);

  const [hud, setHud] = useState<HudSnapshot>(() => {
    const initProg = loadSavedProgress();
    const initLvl = initProg.currentLevel;
    return {
      phase: 1,
      inPlacementPhase: !isDynamicOnboardingLevel(initLvl),
      phaseKills: 0,
      phaseTargetKills: 4,
      sanitationSeals: 3,
      score: 0,
      pressurePct: computeKitchenUpgradeEffects(initProg.kitchenUpgrades).initialUltimatePct,
      slowMoActive: false,
      prepTimer: 0,
      levelTimer: LEVEL_DURATION_SECONDS,
      biome: getBiomeForLevel(initLvl),
      smartComboHintMessage: null,
      selectedPieceId: null,
      inspectionTarget: null,
      hoveredCell: null,
      activeWarningRails: [null, null, null, null],
      pieces: piecesRef.current,
      hazmatShieldReady: initProg.equippedArmor === 'hazmat_epi',
      armoredPlates: 0,
      lastStandActive: false,
      forecast: getLevelForecast(initLvl),
      bossHud: null,
      tutorialTargetScreen: null,
      intactPlates: [true, true, true, true],
      vipPlateRail: null,
      chefWhipCooldown: 0,
      chefWhipThreatReady: false,
      streakCount: 0,
    };
  });

  const { shouldShowInstallUI, install: installPwaApp } = usePWAInstall();
  const [resetSignal, setResetSignal] = useState(0);
  const [settings, setSettings] = useState<GameSettings>(loadSavedSettings);
  const settingsRef = useRef<GameSettings>(settings);
  settingsRef.current = settings;
  const gameStateRef = useRef<GameState>(gameState);
  gameStateRef.current = gameState;
  const hudRef = useRef<HudSnapshot>(hud);
  hudRef.current = hud;

  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [showQuickGuide, setShowQuickGuide] = useState(false);
  const [showCodex, setShowCodex] = useState(false);
  const [codexInitialPage, setCodexInitialPage] = useState<'all' | BugType>('all');
  const [showWardrobe, setShowWardrobe] = useState(false);
  const [wardrobeTab, setWardrobeTab] = useState<WardrobeTabId>('hats');
  const [previewHat, setPreviewHat] = useState<HatId>(() => loadSavedProgress().equippedHat);
  const [previewArmor, setPreviewArmor] = useState<ArmorId>(() => loadSavedProgress().equippedArmor);
  const [previewSpecial, setPreviewSpecial] = useState<SpecialWeaponId>(
    () => loadSavedProgress().equippedSpecial
  );
  const wardrobeYawRef = useRef<number>(0);
  const [showSettings, setShowSettings] = useState(false);
  const [showKitchenUpgrades, setShowKitchenUpgrades] = useState(false);
  const [showStrategicModal, setShowStrategicModal] = useState(false);
  const [confirmPauseReset, setConfirmPauseReset] = useState(false);
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
  const [rushReceipt, setRushReceipt] = useState<ThermalReceiptSummary | null>(null);
  const [endOutcome, setEndOutcome] = useState<{
    victory: boolean;
    score: number;
    phaseReached: number;
    remainingKillsToNext: number;
    bugsCleaned: number;
    vipSaved?: boolean;
    coinsEarned?: number;
    classicToqueBonusApplied?: boolean;
  } | null>(null);

  const openCodexModal = useCallback((initialPage: 'all' | BugType = 'all') => {
    setCodexInitialPage(initialPage);
    setShowCodex(true);
  }, []);

  const openWardrobeModal = useCallback(() => {
    setPreviewHat(progressRef.current.equippedHat);
    setPreviewArmor(progressRef.current.equippedArmor);
    setPreviewSpecial(progressRef.current.equippedSpecial);
    setWardrobeTab('hats');
    wardrobeYawRef.current = 0;
    setShowWardrobe(true);
  }, []);

  const handleUpdateSettings = useCallback((patch: Partial<GameSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      soundEngine.applySettings(next);
      return next;
    });
  }, []);

  // Sync document.body.dataset.state & mode, persist settings & sync establishment background music
  useEffect(() => {
    document.body.dataset.state = gameState;
    document.body.dataset.mode = gameMode;
    if (gameState !== 'paused') {
      setConfirmPauseReset(false);
    }
    soundEngine.applySettings(settings);
    soundEngine.syncBackgroundMusic(
      gameState === 'playing' && !settings.muted,
      progress.currentLevel,
      gameMode
    );
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
  }, [gameMode, gameState, progress.currentLevel, settings]);

  // Auto-save progress whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(progress));
    } catch {
      // ignore storage errors
    }
  }, [progress]);

  // APK Lifecycle Auto-Save on `visibilitychange` and `pagehide` (saves wallet, settings & active session snapshot)
  useEffect(() => {
    const flushAllStateToStorage = () => {
      try {
        localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(progressRef.current));
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settingsRef.current));
        if (gameStateRef.current === 'playing' || gameStateRef.current === 'paused') {
          localStorage.setItem(
            ACTIVE_SESSION_STORAGE_KEY,
            JSON.stringify({
              savedAt: Date.now(),
              gameMode: gameModeRef.current,
              gameState: gameStateRef.current,
              level: progressRef.current.currentLevel,
              score: hudRef.current.score,
              phase: hudRef.current.phase,
              sanitationSeals: hudRef.current.sanitationSeals,
            })
          );
        }
      } catch {
        // ignore storage quota / private mode errors
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (gameStateRef.current === 'playing') {
          setGameState('paused');
        }
        flushAllStateToStorage();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', flushAllStateToStorage);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', flushAllStateToStorage);
    };
  }, []);

  // Trigger ~1.15s Comic Pop-up banner
  const triggerComicPop = useCallback((pop: ComicPopEvent) => {
    setComicPop(pop);
    window.setTimeout(() => {
      setComicPop((curr) => (curr?.id === pop.id ? null : curr));
    }, 1150);
  }, []);

  // Trigger crisp 0.65s clean unboxed Floating Combo Notification over the 3D board (pooled <= 6, zero Y overlap)
  const triggerFloatingCombo = useCallback((evt: FloatingComboEvent) => {
    setFloatingCombos((prev) => pushFloatingComboNonOverlapping(prev, evt));
    window.setTimeout(() => {
      setFloatingCombos((prev) => prev.filter((item) => item.id !== evt.id));
    }, 650);
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
      const ach = ACHIEVEMENTS_CATALOG.find((a) => a.id === achId);
      const isFirstTimeUnlock = Boolean(
        ach && !progressRef.current.unlockedAchievements.includes(achId)
      );
      applyAchievementReward(achId, coinsEarned, 0);
      if (isFirstTimeUnlock && ach) {
        triggerComicPop({
          id: `first-recipe-${achId}-${Date.now()}`,
          title: `🏆 ¡RECETA DESBLOQUEADA: ${ach.title}!`,
          subtitle: ach.rewardLabel,
          stars: ach.star,
          color: ach.star === 3 ? 'cyan' : ach.star === 2 ? 'green' : 'yellow',
          createdAt: Date.now(),
        });
      }
    },
    [applyAchievementReward, triggerComicPop]
  );

  const handleBuyAchievementInShop = useCallback(
    (achId: string) => {
      const ach = ACHIEVEMENTS_CATALOG.find((a) => a.id === achId);
      if (!ach || !isAchievementPurchasableWithCoins(ach) || progress.coins < ach.unlockCostCoins) {
        return;
      }
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

  // Permanent Rush Adrenaline Milestone Unlocks (Zero Pause, Floating Toast)
  const handleRushMilestoneUnlock = useCallback((milestoneId: string) => {
    const milestone = RUSH_ADRENALINE_MILESTONES.find((m) => m.id === milestoneId);
    if (!milestone) return;

    setProgress((prev) => {
      const currentMilestones = prev.unlockedRushMilestones ?? [];
      if (currentMilestones.includes(milestoneId)) return prev;

      const nextHats = [...prev.unlockedHats];
      const nextArmors = [...prev.unlockedArmors];
      const nextSpecials = [...prev.unlockedSpecials];

      if (milestone.unlockHat && !nextHats.includes(milestone.unlockHat)) {
        nextHats.push(milestone.unlockHat);
      }
      if (milestone.unlockArmor && !nextArmors.includes(milestone.unlockArmor)) {
        nextArmors.push(milestone.unlockArmor);
      }
      if (milestone.unlockSpecial && !nextSpecials.includes(milestone.unlockSpecial)) {
        nextSpecials.push(milestone.unlockSpecial);
      }

      return {
        ...prev,
        coins: prev.coins + milestone.coinsBonus,
        unlockedRushMilestones: [...currentMilestones, milestoneId],
        unlockedHats: nextHats,
        unlockedArmors: nextArmors,
        unlockedSpecials: nextSpecials,
        equippedHat: milestone.unlockHat ?? prev.equippedHat,
        equippedArmor: milestone.unlockArmor ?? prev.equippedArmor,
        equippedSpecial: milestone.unlockSpecial ?? prev.equippedSpecial,
      };
    });
  }, []);

  // Streak Milestone Coin Bonus (x8 and x15 streaks)
  const handleStreakCoinBonus = useCallback(
    (streak: number, bonusCoins: number) => {
      setProgress((prev) => ({
        ...prev,
        coins: prev.coins + bonusCoins,
      }));
      soundEngine.playStarKill(2);
      triggerFloatingCombo({
        id: `streak-coin-${streak}-${Date.now()}`,
        multiplier: streak,
        label: `🔥 RACHA x${streak} · +${bonusCoins}🪙`,
        detail: 'Bono de Racha',
        xPct: 52,
        yPct: 34,
        color: 'yellow',
        createdAt: Date.now(),
      });
    },
    [triggerFloatingCombo]
  );

  // Permanent Account Passive Upgrade Purchase ("Mejoras de Cocina", 3 levels each)
  const handleBuyKitchenUpgrade = useCallback(
    (upgradeId: KitchenUpgradeId) => {
      const res = purchaseKitchenUpgrade(progressRef.current, upgradeId);
      if (!res.ok) return;
      setProgress(res.updatedProgress);
      soundEngine.playStarKill(2);
      const meta = KITCHEN_UPGRADES_CATALOG[upgradeId];
      triggerComicPop({
        id: `upgrade-${upgradeId}-${res.newLevel}-${Date.now()}`,
        title: `🔧 ¡MEJORA NV.${res.newLevel}/3: ${meta.title.toUpperCase()}!`,
        subtitle: meta.levelLabels[res.newLevel],
        color: 'yellow',
        createdAt: Date.now(),
      });
    },
    [triggerComicPop]
  );

  // Validated Serverless Base64 Progress Restore
  const handleImportBackup = useCallback(
    (importedProgress: PlayerProgress, importedSettings?: GameSettings) => {
      setProgress(importedProgress);
      if (importedSettings) {
        setSettings(importedSettings);
        soundEngine.applySettings(importedSettings);
      }
      piecesRef.current = createInitialBoardPieces(importedProgress.currentLevel);
      setResetSignal((n) => n + 1);
    },
    []
  );

  const handleGameEnd = useCallback(
    (
      victory: boolean,
      finalStats: {
        score: number;
        phaseReached: number;
        remainingKillsToNext: number;
        bugsCleaned: number;
        vipSaved?: boolean;
        allFourPlatesIntact?: boolean;
        survivedSeconds?: number;
        mergesCount?: number;
        evolutionsCount?: number;
        comandasPicked?: number;
        milestonesCoins?: number;
      }
    ) => {
      if (gameModeRef.current === 'rush') {
        const receipt = buildThermalReceipt({
          survivedSeconds: finalStats.survivedSeconds ?? 0,
          previousBestSeconds: progressRef.current.bestRushSeconds ?? 0,
          bugsCleaned: finalStats.bugsCleaned,
          mergesCount: finalStats.mergesCount ?? 0,
          evolutionsCount: finalStats.evolutionsCount ?? 0,
          comandasPicked: finalStats.comandasPicked ?? 0,
          milestonesCoins: finalStats.milestonesCoins ?? 0,
          score: finalStats.score,
        });
        const netEndCoins = Math.max(
          0,
          receipt.totalCoinsEarned - (finalStats.milestonesCoins ?? 0)
        );
        setRushReceipt(receipt);
        setEndOutcome(null);
        setGameState('gameover');
        setProgress((prev) => ({
          ...prev,
          coins: prev.coins + netEndCoins,
          bestRushSeconds: Math.max(prev.bestRushSeconds ?? 0, receipt.survivedSeconds),
          bestScore: Math.max(prev.bestScore, finalStats.score),
          totalBugsCleaned: prev.totalBugsCleaned + finalStats.bugsCleaned,
        }));
        return;
      }

      const vipSaved = Boolean(victory && finalStats.vipSaved);
      const { coinsEarned, classicToqueBonusApplied } = computeStrategicMatchCoins({
        victory,
        vipSaved,
        allFourPlatesIntact: Boolean(finalStats.allFourPlatesIntact),
        equippedHat: progressRef.current.equippedHat,
        baseVictoryCoins: 120,
        baseDefeatCoins: 40,
      });
      setRushReceipt(null);
      setEndOutcome({
        victory,
        ...finalStats,
        vipSaved,
        coinsEarned,
        classicToqueBonusApplied,
      });
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
          coins: prev.coins + coinsEarned,
          bestScore: Math.max(prev.bestScore, finalStats.score),
          totalBugsCleaned: prev.totalBugsCleaned + finalStats.bugsCleaned,
        };
      });
    },
    []
  );

  // Launch Survival Rush directly in 0.0s with zero prep pauses!
  const startRushGame = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setGameMode('rush');
    gameModeRef.current = 'rush';
    document.body.dataset.mode = 'rush';
    piecesRef.current = rollRushTrayBatch({
      elapsedSeconds: 0,
      unlockedMilestones: progressRef.current.unlockedRushMilestones ?? [],
    }).map((slot) => {
      const initAmmo =
        slot.type === 'aerosol_torch' ? getInitialAerosolAmmo(slot.level) : undefined;
      return {
        id: slot.id,
        type: slot.type,
        level: slot.level,
        rail: null,
        row: null,
        gunkTimer: 0,
        cooldown: 0.15,
        fireTimer: 0.08,
        comboType: 'none',
        ammo: initAmmo,
        maxAmmo: initAmmo,
      };
    });
    selectedPieceIdRef.current = null;
    inspectionTargetRef.current = null;
    startWaveRef.current = false;
    pickComandaIndexRef.current = null;
    boostUltimateRef.current = false;
    boostPlateShieldRef.current = false;
    dragPointerRef.current = { active: false, pieceId: null, clientX: 0, clientY: 0 };
    setUsedUltBoost(false);
    setUsedShieldBoost(false);
    setLongPressTip(null);
    setEndOutcome(null);
    setRushReceipt(null);
    setFloatingCombos([]);
    setShowQuickGuide(false);
    setShowCodex(false);
    setShowWardrobe(false);
    setShowKitchenUpgrades(false);
    setShowStrategicModal(false);
    setShowOnboardingModal(false);
    setResetSignal((n) => n + 1);
    document.body.dataset.state = 'playing';
    setGameState('playing');
  }, []);

  // Launch Tactical Strategic Campaign Mode
  const startStrategicGame = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setGameMode('strategic');
    gameModeRef.current = 'strategic';
    document.body.dataset.mode = 'strategic';
    const initialPieces = createInitialBoardPieces(progress.currentLevel);
    piecesRef.current = initialPieces;
    selectedPieceIdRef.current = null;
    inspectionTargetRef.current = null;
    startWaveRef.current = false;
    pickComandaIndexRef.current = null;
    boostUltimateRef.current = false;
    boostPlateShieldRef.current = false;
    dragPointerRef.current = { active: false, pieceId: null, clientX: 0, clientY: 0 };
    setUsedUltBoost(false);
    setUsedShieldBoost(false);
    setLongPressTip(null);
    setEndOutcome(null);
    setRushReceipt(null);
    setFloatingCombos([]);
    setShowQuickGuide(false);
    setShowCodex(false);
    setShowWardrobe(false);
    setShowKitchenUpgrades(false);
    setShowStrategicModal(false);
    setShowOnboardingModal(false);
    setResetSignal((n) => n + 1);
    document.body.dataset.state = 'playing';
    setGameState('playing');
  }, [progress.currentLevel]);

  const restartCurrentMatch = useCallback(() => {
    if (gameModeRef.current === 'rush') {
      startRushGame();
    } else {
      startStrategicGame();
    }
  }, [startRushGame, startStrategicGame]);

  const resetBoardToDefault = useCallback(() => {
    const initialPieces = createInitialBoardPieces(progress.currentLevel);
    piecesRef.current = initialPieces;
    selectedPieceIdRef.current = null;
    inspectionTargetRef.current = null;
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

  // Reset all progress to Level 1 ("Empezar de 0" — ONLY accessible from Pause/Settings with confirmation)
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
    inspectionTargetRef.current = null;
    startWaveRef.current = false;
    pickComandaIndexRef.current = null;
    setEndOutcome(null);
    setRushReceipt(null);
    setConfirmPauseReset(false);
    setShowQuickGuide(false);
    setShowCodex(false);
    setShowWardrobe(false);
    setShowKitchenUpgrades(false);
    setShowStrategicModal(false);
    setResetSignal((n) => n + 1);
    soundEngine.playSnapPiece(true);
    triggerComicPop({
      id: `reset-zero-${Date.now()}`,
      title: '🔄 PROGRESO REINICIADO (NIVEL 1)',
      subtitle: 'Monedas, récords y niveles restaurados a cero',
      color: 'cyan',
      createdAt: Date.now(),
    });
  }, [triggerComicPop]);

  // Android Hardware / Gesture "Back" Interception (`popstate` + Capacitor/Cordova `backbutton`)
  const hasInterceptableOverlay =
    showQuickGuide ||
    showOnboardingModal ||
    showCodex ||
    showWardrobe ||
    showSettings ||
    showKitchenUpgrades ||
    showStrategicModal ||
    gameState !== 'title';

  const uiBackStateRef = useRef({
    gameState,
    showQuickGuide,
    showOnboardingModal,
    showCodex,
    showWardrobe,
    showSettings,
    showKitchenUpgrades,
    showStrategicModal,
  });
  uiBackStateRef.current = {
    gameState,
    showQuickGuide,
    showOnboardingModal,
    showCodex,
    showWardrobe,
    showSettings,
    showKitchenUpgrades,
    showStrategicModal,
  };

  useEffect(() => {
    if (!hasInterceptableOverlay) return;
    try {
      const st = window.history.state as { chefBastionBackGuard?: boolean } | null;
      if (!st?.chefBastionBackGuard) {
        window.history.pushState({ chefBastionBackGuard: true }, '');
      }
    } catch {
      // ignore sandboxed history errors
    }
  }, [hasInterceptableOverlay]);

  useEffect(() => {
    const applyBackResolution = (fromPopState: boolean, ev?: Event) => {
      const action = resolveAndroidBackAction(uiBackStateRef.current);
      if (action === 'noop') return;
      if (ev && !fromPopState) {
        ev.preventDefault();
      }
      if (action === 'close_quick_guide') setShowQuickGuide(false);
      else if (action === 'close_onboarding') setShowOnboardingModal(false);
      else if (action === 'close_codex') setShowCodex(false);
      else if (action === 'close_wardrobe') setShowWardrobe(false);
      else if (action === 'close_settings') setShowSettings(false);
      else if (action === 'close_upgrades') setShowKitchenUpgrades(false);
      else if (action === 'close_strategic') setShowStrategicModal(false);
      else if (action === 'open_pause') setGameState('paused');
      else if (action === 'resume_from_pause') setGameState('playing');
      else if (action === 'exit_gameover_to_title') setGameState('title');

      // Re-arm history guard if we are still inside gameplay or another modal
      if (fromPopState && action !== 'exit_gameover_to_title') {
        const stillInGame =
          uiBackStateRef.current.gameState !== 'title' || action === 'open_pause';
        if (stillInGame) {
          try {
            window.history.pushState({ chefBastionBackGuard: true }, '');
          } catch {
            // ignore history errors
          }
        }
      }
    };

    const onPopState = (ev: PopStateEvent) => applyBackResolution(true, ev);
    const onNativeBackButton = (ev: Event) => applyBackResolution(false, ev);

    window.addEventListener('popstate', onPopState);
    document.addEventListener('backbutton', onNativeBackButton);
    return () => {
      window.removeEventListener('popstate', onPopState);
      document.removeEventListener('backbutton', onNativeBackButton);
    };
  }, []);

  // Global keyboard shortcuts (Enter/Space on Title/GameOver, Esc/P for Pause, M for Mute)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        showQuickGuide ||
        showCodex ||
        showWardrobe ||
        showSettings ||
        showKitchenUpgrades ||
        showStrategicModal
      ) {
        if (e.code === 'Escape') {
          setShowQuickGuide(false);
          setShowCodex(false);
          setShowWardrobe(false);
          setShowSettings(false);
          setShowKitchenUpgrades(false);
          setShowStrategicModal(false);
        } else if (
          showStrategicModal &&
          (e.code === 'Enter' || e.code === 'Space')
        ) {
          e.preventDefault();
          startStrategicGame();
        }
        return;
      }

      if (gameState === 'title') {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          if (shouldRecommendStrategicFirst(progressRef.current)) {
            startStrategicGame();
          } else {
            startRushGame();
          }
        }
        return;
      }

      if (gameState === 'gameover') {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          restartCurrentMatch();
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
        restartCurrentMatch();
      } else if (e.code === 'KeyB' && gameState === 'playing') {
        openCodexModal('all');
      } else if (e.code === 'Space' && gameState === 'playing' && hud.pressurePct >= 100) {
        e.preventDefault();
        triggerUltimateRef.current = true;
      }
    };

    const onBlur = () => {
      selectedPieceIdRef.current = null;
      inspectionTargetRef.current = null;
      dragPointerRef.current = { active: false, pieceId: null, clientX: 0, clientY: 0 };
      setLongPressTip(null);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('blur', onBlur);
    };
  }, [
    gameState,
    handleUpdateSettings,
    hud.pressurePct,
    openCodexModal,
    restartCurrentMatch,
    settings.muted,
    showCodex,
    showKitchenUpgrades,
    showQuickGuide,
    showSettings,
    showStrategicModal,
    showWardrobe,
    startRushGame,
    startStrategicGame,
  ]);

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
      if (st.dragged) {
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

  const isRush = gameMode === 'rush';
  const rushHud = isRush ? hud.rushHud ?? null : null;
  const trayGroups = groupTrayPiecesForDisplay(hud.pieces);

  const equippedSpecialMeta = SPECIAL_WEAPONS_CATALOG[progress.equippedSpecial];
  const tutorialGuide = getTutorialGuideForLevel(progress.currentLevel, hud.pieces);
  const liveTutorialGuide = getTutorialGuideForLevel(progress.currentLevel, piecesRef.current);
  const onboardingCard = getTacticalOnboardingCard(progress.currentLevel);
  const activeBiome = getBiomeForLevel(progress.currentLevel);
  const placedCount = hud.pieces.filter((p) => p.rail !== null && p.row !== null).length;
  const formatWaveTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Compute approximate tray card start X% for the single-focus animated onboarding drag guide
  const tutorialGroupIdx = hud.tutorialTargetScreen
    ? trayGroups.findIndex((g) =>
        g.pieces.some((p) => p.id === hud.tutorialTargetScreen?.pieceId)
      )
    : -1;
  const traySpanPct = Math.min(48, Math.max(20, trayGroups.length * 14));
  const tutorialTrayStartXPct =
    tutorialGroupIdx >= 0 && trayGroups.length > 0
      ? 46 -
        traySpanPct / 2 +
        ((tutorialGroupIdx + 0.5) / trayGroups.length) * traySpanPct
      : 45;

  const recommendStrategicFirst = shouldRecommendStrategicFirst(progress);

  const activeInspectionTarget: TacticalInspectionTarget | null = hud.selectedPieceId
    ? (() => {
        const p = hud.pieces.find((item) => item.id === hud.selectedPieceId);
        return p
          ? {
              kind: 'piece',
              pieceId: p.id,
              pieceType: p.type,
              level: p.level,
              evolutionId: p.evolutionId,
            }
          : hud.inspectionTarget ?? null;
      })()
    : hud.inspectionTarget ?? null;

  const inspectorCard =
    gameState === 'playing'
      ? getTacticalInspectorCard(activeInspectionTarget, {
          pieces: hud.pieces,
          intactPlates: hud.intactPlates,
          vipPlateRail: hud.vipPlateRail,
          equippedSpecial: progress.equippedSpecial,
          ultimateCharge: hud.pressurePct,
          isRushMode: isRush,
        })
      : null;

  const clearTacticalInspection = useCallback(() => {
    inspectionTargetRef.current = null;
    selectedPieceIdRef.current = null;
    setHud((prev) => ({
      ...prev,
      selectedPieceId: null,
      inspectionTarget: null,
    }));
  }, []);

  return (
    <main className="app-viewport-shell relative select-none">
      {/* Isolated 60fps Three.js WebGL Viewport */}
      <ChefBastionCanvas
        gameState={gameState}
        gameMode={gameMode}
        wardrobeOpen={showWardrobe}
        wardrobeTab={wardrobeTab}
        wardrobePreviewHat={previewHat}
        wardrobePreviewArmor={previewArmor}
        wardrobePreviewSpecial={previewSpecial}
        wardrobeYawRef={wardrobeYawRef}
        worldId={progress.currentWorld}
        level={progress.currentLevel}
        hatId={progress.equippedHat}
        armorId={progress.equippedArmor}
        specialWeaponId={progress.equippedSpecial}
        kitchenUpgrades={progress.kitchenUpgrades}
        unlockedRushMilestones={progress.unlockedRushMilestones ?? []}
        settings={settings}
        piecesRef={piecesRef}
        selectedPieceIdRef={selectedPieceIdRef}
        inspectionTargetRef={inspectionTargetRef}
        triggerUltimateRef={triggerUltimateRef}
        startWaveRef={startWaveRef}
        pickComandaIndexRef={pickComandaIndexRef}
        dragPointerRef={dragPointerRef}
        boostUltimateRef={boostUltimateRef}
        boostPlateShieldRef={boostPlateShieldRef}
        resetSignal={resetSignal}
        onHudUpdate={handleHudUpdate}
        onComicPop={triggerComicPop}
        onFloatingCombo={triggerFloatingCombo}
        onUnlockUtensil={handleUnlockUtensil}
        onAchievementKill={handleAchievementKill}
        onRushMilestoneUnlock={handleRushMilestoneUnlock}
        onStreakCoinBonus={handleStreakCoinBonus}
        onGameEnd={handleGameEnd}
      />

      {/* Floating Combo Notifications (pooled <= 6, zero Y overlap) */}
      <FloatingComboLayer combos={floatingCombos} />

      {/* Compact Single-Line Notice Banner (suppressed when Inspector or Comandas are active) */}
      <ComicPopBanner
        pop={comicPop}
        suppressNotice={Boolean(inspectorCard || (isRush && rushHud?.activeComandas))}
      />

      {/* =====================================================================
          1. TITLE SCREEN OVERLAY (APK Safe Areas, 44x44 Targets, Onboarding-Aware Hierarchy)
         ===================================================================== */}
      {gameState === 'title' &&
        !showQuickGuide &&
        !showWardrobe &&
        !showCodex &&
        !showStrategicModal &&
        !showKitchenUpgrades && (
          <section
            aria-label="Pantalla de Título de Chef Bastion"
            className="pointer-events-none fixed inset-0 z-30 flex flex-col justify-between px-4 sm:px-8 apk-safe-top apk-safe-bottom bg-gradient-to-b from-amber-950/80 via-transparent to-amber-950/90"
          >
            {/* Top Bar: Auto-saved Coins, Quick Guide ('❓') & Settings (Guaranteed >= 36px safe top on mobile/APK) */}
            <div className="relative z-30 flex items-center justify-between gap-2 flex-wrap">
              <div className="pointer-events-auto min-h-[44px] flex items-center gap-2 bg-amber-950/92 border border-amber-600/60 px-3 py-2 rounded-xl text-xs font-extrabold text-amber-100">
                <span className="font-mono tabular-nums text-yellow-300">
                  🪙 {progress.coins}
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  ★ {progress.unlockedAchievements.length}/{ACHIEVEMENTS_CATALOG.length} Logros
                </span>
              </div>

              <div className="pointer-events-auto flex items-center gap-2">
                {/* Completely hidden inside Capacitor/WebView/Standalone via usePWAInstall */}
                {shouldShowInstallUI && (
                  <button
                    type="button"
                    data-testid="pwa-install-btn"
                    onClick={() => {
                      void installPwaApp();
                    }}
                    className="apk-touch-target px-3 py-2 rounded-xl bg-emerald-950/95 hover:bg-emerald-900 border border-emerald-400/70 text-emerald-200 text-xs font-extrabold transition cursor-pointer whitespace-nowrap inline-flex items-center justify-center"
                  >
                    📲 Instalar
                  </button>
                )}

                <button
                  type="button"
                  data-testid="open-quick-guide-btn"
                  aria-label="Abrir Guía Rápida Visual"
                  onClick={() => setShowQuickGuide(true)}
                  className="apk-touch-target w-11 h-11 rounded-full bg-cyan-950/95 hover:bg-cyan-900 border-2 border-cyan-400/80 text-cyan-200 text-sm font-black transition cursor-pointer inline-flex items-center justify-center shadow-[0_2px_0_#0f172a]"
                >
                  ❓
                </button>

                <button
                  type="button"
                  onClick={() => setShowSettings(true)}
                  className="apk-touch-target px-3.5 py-2 rounded-xl bg-amber-900/95 hover:bg-amber-800 border border-amber-500/70 text-amber-100 text-xs font-extrabold transition cursor-pointer whitespace-nowrap inline-flex items-center justify-center"
                >
                  ⚙️ Ajustes
                </button>
              </div>
            </div>

            {/* Main Lockup + Roguelite-First CTA Hierarchy (No my-auto overflow on 20:9 displays) */}
            <div className="max-w-md w-full space-y-3 sm:space-y-4">
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
                  fontSize="14.2"
                  letterSpacing="1.8"
                >
                  HIGIENE LETAL · BULLET HELL 3D
                </text>
              </svg>

              {/* Logical Onboarding CTA Hierarchy: New players (< Lv.3) see Strategic FIRST; Veterans (>= Lv.3) see Rush FIRST */}
              <div className="pointer-events-auto flex flex-col gap-2.5 max-w-[400px]">
                {recommendStrategicFirst ? (
                  <>
                    <button
                      type="button"
                      data-start="true"
                      data-testid="open-strategic-btn"
                      onClick={startStrategicGame}
                      className="apk-touch-target w-full px-5 py-3.5 sm:py-4 rounded-2xl bg-yellow-400 hover:bg-yellow-300 active:scale-95 text-slate-950 border-4 border-slate-950 shadow-[0_6px_0_#0f172a] transition cursor-pointer flex flex-col items-center justify-center text-center"
                    >
                      <span className="inline-flex items-center justify-center gap-2 font-display font-black text-lg sm:text-xl tracking-wide leading-tight">
                        <span>🧠 MODO ESTRATÉGICO (NIVEL {progress.currentLevel})</span>
                      </span>
                      <span className="font-sans font-extrabold text-xs text-slate-800 mt-0.5">
                        ¡Empieza aquí! Aprende cada arma paso a paso
                      </span>
                    </button>

                    <button
                      type="button"
                      data-testid="hero-rush-btn"
                      onClick={startRushGame}
                      className="apk-touch-target w-full px-4 py-3 rounded-2xl bg-slate-900/95 hover:bg-slate-800 active:scale-95 text-amber-200 font-display font-black text-sm sm:text-base tracking-wide border-2 border-amber-400/80 shadow-[0_4px_0_#0f172a] transition cursor-pointer flex flex-col items-center justify-center text-center"
                    >
                      <span>⚡ JUGAR SUPERVIVENCIA (RUSH)</span>
                      <span className="font-sans font-bold text-[11px] text-slate-300 mt-0.5 tabular-nums">
                        ¡Bullet Hell sin pausas! · Récord: {formatSurvivalMMSS(progress.bestRushSeconds ?? 0)}
                      </span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      data-start="true"
                      data-testid="hero-rush-btn"
                      onClick={startRushGame}
                      className="apk-touch-target w-full px-5 py-3.5 sm:py-4 rounded-2xl bg-yellow-400 hover:bg-yellow-300 active:scale-95 text-slate-950 border-4 border-slate-950 shadow-[0_6px_0_#0f172a] transition cursor-pointer flex flex-col items-center justify-center text-center"
                    >
                      <span className="inline-flex items-center justify-center gap-2 font-display font-black text-lg sm:text-xl tracking-wide leading-tight">
                        <svg
                          viewBox="0 0 24 24"
                          className="w-5 h-5 sm:w-6 sm:h-6 shrink-0"
                          aria-hidden="true"
                        >
                          <polygon
                            points="13,2 4,14 11,14 9,22 20,10 13,10"
                            fill="#0f172a"
                            stroke="#ffffff"
                            strokeWidth="1.4"
                            strokeLinejoin="round"
                          />
                        </svg>
                        <span>JUGAR SUPERVIVENCIA (RUSH)</span>
                      </span>
                      <span className="font-sans font-extrabold text-xs text-slate-800 mt-0.5 tabular-nums">
                        ¡Bullet Hell sin pausas! · Récord: {formatSurvivalMMSS(progress.bestRushSeconds ?? 0)}
                      </span>
                    </button>

                    <button
                      type="button"
                      data-testid="open-strategic-btn"
                      onClick={() => setShowStrategicModal(true)}
                      className="apk-touch-target w-full px-4 py-3 rounded-2xl bg-slate-900/95 hover:bg-slate-800 active:scale-95 text-cyan-200 font-display font-black text-sm sm:text-base tracking-wide border-2 border-cyan-400/80 shadow-[0_4px_0_#0f172a] transition cursor-pointer inline-flex items-center justify-center"
                    >
                      🧠 MODO ESTRATÉGICO (NIVEL {progress.currentLevel})
                    </button>
                  </>
                )}

                <div className="grid grid-cols-3 gap-1.5 sm:gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => openCodexModal('all')}
                    className="apk-touch-target px-2 py-2.5 rounded-xl bg-amber-900/95 hover:bg-amber-800 text-amber-100 font-extrabold text-[11px] sm:text-xs border-2 border-amber-500/70 transition whitespace-nowrap cursor-pointer inline-flex items-center justify-center"
                  >
                    Álbum 3★ ({progress.unlockedAchievements.length}/{ACHIEVEMENTS_CATALOG.length})
                  </button>
                  <button
                    type="button"
                    data-testid="open-kitchen-upgrades-btn"
                    onClick={() => setShowKitchenUpgrades(true)}
                    className="apk-touch-target px-2 py-2.5 rounded-xl bg-emerald-950/95 hover:bg-emerald-900 text-emerald-200 font-extrabold text-[11px] sm:text-xs border-2 border-emerald-400/75 transition whitespace-nowrap cursor-pointer inline-flex items-center justify-center"
                  >
                    🔧 Mejoras
                  </button>
                  <button
                    type="button"
                    onClick={openWardrobeModal}
                    className="apk-touch-target px-2 py-2.5 rounded-xl bg-cyan-950/95 hover:bg-cyan-900 text-cyan-200 font-extrabold text-[11px] sm:text-xs border-2 border-cyan-500/70 transition whitespace-nowrap cursor-pointer inline-flex items-center justify-center"
                  >
                    Vestuario 3D
                  </button>
                </div>
              </div>
            </div>

            {/* Bottom Safe Margin: Gameplay Merge Hint + Official CritFuse Mobile Games Studio Badge (Inline SVG) */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="text-[11px] sm:text-xs font-bold text-amber-100/90 tracking-wide leading-snug">
                Funde armas iguales en caliente (Nv.1 ➔ Plata ➔ Oro) · Une 2 Oro en Evolución Suprema
              </div>
              <div
                data-testid="critfuse-studio-badge"
                className="inline-flex items-center gap-2 self-start sm:self-auto rounded-xl bg-slate-950/92 border border-orange-500/65 px-2.5 py-1.5 shadow-md"
              >
                <svg
                  viewBox="0 0 40 44"
                  className="w-6 h-6 shrink-0"
                  aria-hidden="true"
                >
                  <path
                    d="M20 2 L6 8 V21 C6 31 12 38 20 42 Z"
                    fill="#334155"
                    stroke="#94a3b8"
                    strokeWidth="2.2"
                  />
                  <path
                    d="M20 2 L34 8 V21 C34 31 28 38 20 42 Z"
                    fill="#9a3412"
                    stroke="#f97316"
                    strokeWidth="2.2"
                  />
                  <text
                    x="13"
                    y="27"
                    textAnchor="middle"
                    fill="#e2e8f0"
                    fontFamily="Outfit, sans-serif"
                    fontWeight="900"
                    fontSize="15"
                  >
                    C
                  </text>
                  <text
                    x="27"
                    y="27"
                    textAnchor="middle"
                    fill="#fb923c"
                    fontFamily="Outfit, sans-serif"
                    fontWeight="900"
                    fontSize="15"
                  >
                    F
                  </text>
                  <polygon
                    points="22,9 15,23 20,23 18,35 26,20 21,20"
                    fill="#fde047"
                    stroke="#0f172a"
                    strokeWidth="1"
                  />
                </svg>
                <div className="flex flex-col leading-none">
                  <span className="text-[11px] font-display font-black tracking-wide text-white">
                    Crit<span className="text-orange-400">Fuse</span>{' '}
                    <span className="text-[9.5px] font-sans font-extrabold text-slate-300 uppercase">
                      Mobile Games
                    </span>
                  </span>
                  <span className="text-[9.5px] font-mono font-bold text-amber-300/90 mt-0.5">
                    critfuse.com
                  </span>
                </div>
              </div>
            </div>
          </section>
        )}

      {/* =====================================================================
          2. PLAYING HUD (APK Safe Top >= 36px, Safe Bottom >= 14px, 44x44 Buttons)
         ===================================================================== */}
      {gameState === 'playing' && (
        <div className="pointer-events-none fixed inset-0 z-30 flex flex-col justify-between px-1.5 sm:px-3 apk-safe-top apk-safe-bottom">
          {/* Top Row: Left Status Cluster + Live Comandas / Forecast + 44x44 Utility Controls */}
          <div className="relative z-30 flex flex-col gap-1.5">
            <div className="flex items-start justify-between gap-1.5 sm:gap-2">
              {/* Top-Left Status Cluster */}
              <div className="pointer-events-auto bg-stone-900/92 border-2 border-stone-950 rounded-xl px-2 py-1.5 shadow-[0_3px_0_#0f172a] flex flex-col gap-0.5 min-w-0 max-w-[170px] sm:max-w-none shrink">
                {isRush && rushHud ? (
                  <>
                    <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-black tracking-wide text-white leading-none drop-shadow">
                      <span
                        data-testid="rush-survival-clock"
                        className="font-mono tabular-nums text-sm sm:text-base text-yellow-300"
                      >
                        ⏱️ {formatSurvivalMMSS(rushHud.elapsedSec)}
                      </span>
                      <span
                        data-testid="frenzy-thermometer-badge"
                        className={`px-1.5 py-0.5 rounded border text-[9.5px] font-black leading-none ${
                          rushHud.frenzy.color === 'red'
                            ? 'bg-rose-600/30 border-rose-400 text-rose-200 animate-pulse'
                            : rushHud.frenzy.color === 'orange'
                            ? 'bg-orange-500/30 border-orange-400 text-orange-200'
                            : rushHud.frenzy.color === 'yellow'
                            ? 'bg-yellow-500/25 border-yellow-400 text-yellow-200'
                            : 'bg-cyan-500/25 border-cyan-400 text-cyan-200'
                        }`}
                      >
                        {rushHud.frenzy.shortBadge}
                      </span>
                    </div>

                    {/* Frenzy Thermometer + XP Bar (SVG, zero inline style) */}
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="font-mono tabular-nums text-[9px] font-black text-cyan-300 leading-none shrink-0">
                        XP NV.{rushHud.rushLevel}
                      </span>
                      <svg
                        viewBox="0 0 100 7"
                        preserveAspectRatio="none"
                        className="w-24 sm:w-28 h-1.5 rounded-full bg-slate-950 border border-slate-700 overflow-hidden"
                        role="img"
                        aria-label={`Experiencia Comanda: ${rushHud.xpPct}%`}
                      >
                        <rect
                          x="0"
                          y="0"
                          width={Math.max(0, Math.min(100, rushHud.xpPct))}
                          height="7"
                          fill="#38bdf8"
                        />
                      </svg>
                    </div>
                  </>
                ) : (
                  <>
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
                  </>
                )}

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
                  {!isRush && (
                    <span className="font-mono tabular-nums text-[10px] font-black text-amber-300 ml-0.5">
                      {hud.phaseKills}/{hud.phaseTargetKills}
                    </span>
                  )}
                  {isRush && rushHud?.roombaActive && (
                    <span
                      title="Roomba Kamikaze con Cuchillos patrullando frente a los platos"
                      className="text-[9px] font-black text-rose-300 ml-0.5"
                    >
                      · 🔪 Roomba
                    </span>
                  )}
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

                {/* "Menú Vivo" Subtle Passive Plate Buff Micro-Indicators (Tap to Inspect at 0.08x!) */}
                <div
                  data-testid="live-menu-buffs"
                  className="pointer-events-auto grid grid-cols-2 sm:flex sm:items-center gap-1 mt-0.5"
                >
                  {MENU_PLATE_BUFF_META.map((meta) => {
                    const intact = hud.intactPlates[meta.rail] ?? true;
                    const isVip = hud.vipPlateRail === meta.rail;
                    const isInspectedPlate =
                      activeInspectionTarget?.kind === 'plate' &&
                      activeInspectionTarget.rail === meta.rail;
                    return (
                      <button
                        key={meta.rail}
                        type="button"
                        data-testid={`plate-buff-${meta.rail}`}
                        data-vip={isVip ? 'true' : 'false'}
                        data-intact={intact ? 'true' : 'false'}
                        aria-label={`Inspeccionar ${meta.name}: ${meta.desc}`}
                        onClick={() => {
                          selectedPieceIdRef.current = null;
                          const nextTarget: TacticalInspectionTarget | null = isInspectedPlate
                            ? null
                            : { kind: 'plate', rail: meta.rail };
                          inspectionTargetRef.current = nextTarget;
                          setHud((prev) => ({
                            ...prev,
                            selectedPieceId: null,
                            inspectionTarget: nextTarget,
                          }));
                          if (nextTarget) soundEngine.playSlowMoEnter();
                        }}
                        className={`px-1 py-0.5 rounded text-[8.5px] font-black leading-none border text-center transition cursor-pointer ${
                          isInspectedPlate
                            ? 'border-cyan-300 bg-cyan-900/90 text-cyan-100'
                            : !intact
                            ? 'border-stone-800 bg-stone-950/50 text-stone-500 line-through opacity-45'
                            : isVip
                            ? 'border-yellow-400 bg-yellow-500/25 text-yellow-200 shadow-[0_0_6px_rgba(250,204,21,0.55)]'
                            : 'border-stone-700 bg-stone-950/90 text-stone-200'
                        }`}
                      >
                        {isVip ? `★${meta.shortTag}` : meta.shortTag}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Top-Right Utility Controls (Single clean row of >= 44x44px hit targets on Mobile/APK) */}
              <div className="pointer-events-auto relative z-30 flex items-center justify-end gap-1 flex-nowrap shrink-0">
                <button
                  type="button"
                  tabIndex={-1}
                  data-testid="open-quick-guide-btn"
                  aria-label="Abrir Guía Rápida Visual"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    setGameState('paused');
                    setShowQuickGuide(true);
                  }}
                  className="apk-touch-target w-11 h-11 rounded-full bg-cyan-950/95 border-2 border-cyan-400/80 shadow-[0_2px_0_#0f172a] flex items-center justify-center text-cyan-200 hover:bg-cyan-900 transition shrink-0 text-sm font-black cursor-pointer"
                >
                  ❓
                </button>

                <button
                  type="button"
                  tabIndex={-1}
                  aria-label="Abrir Álbum 3 Estrellas y Tienda"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    openCodexModal('all');
                  }}
                  className="apk-touch-target hidden sm:flex w-11 h-11 rounded-xl bg-stone-900/95 border-2 border-stone-950 shadow-[0_2px_0_#0f172a] items-center justify-center text-yellow-300 hover:bg-stone-800 transition shrink-0 cursor-pointer"
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
                  className="apk-touch-target w-11 h-11 rounded-xl bg-stone-900/95 border-2 border-stone-950 shadow-[0_2px_0_#0f172a] flex items-center justify-center text-stone-100 hover:bg-stone-800 transition shrink-0 cursor-pointer"
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
                  className="apk-touch-target w-11 h-11 rounded-xl bg-stone-900/95 border-2 border-stone-950 shadow-[0_2px_0_#0f172a] flex items-center justify-center text-stone-100 hover:bg-stone-800 transition shrink-0 cursor-pointer"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6" />
                  </svg>
                </button>

                <button
                  type="button"
                  tabIndex={-1}
                  aria-label="Reiniciar Partida"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    restartCurrentMatch();
                  }}
                  className="apk-touch-target w-11 h-11 rounded-xl bg-stone-900/95 border-2 border-stone-950 shadow-[0_2px_0_#0f172a] flex items-center justify-center text-stone-100 hover:bg-stone-800 transition shrink-0 cursor-pointer"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Live Non-Pausing Comandas Strip (3 translucent tickets, <= 4 words, 10s auto-pick center) */}
            {isRush && rushHud?.activeComandas && (
              <LiveComandasOverlay
                comandas={rushHud.activeComandas}
                timerSec={rushHud.comandaTimer}
                onPick={(idx) => {
                  pickComandaIndexRef.current = idx;
                }}
              />
            )}

            {/* 0.08x Tactical Inspector Banner (2 plain lines in-flow below top HUD & Comandas — zero overlap!) */}
            <TacticalInspectorBanner
              card={inspectorCard}
              onClose={clearTacticalInspection}
            />

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

            {/* Strategic Placement Mode Forecast & Economy Boosters (Strategic Mode ONLY, Level 4+) */}
            {!isRush && (
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
            )}

            {/* Salvada In Extremis Banner Cue (1.2s slow-mo on last intact plate) */}
            {hud.lastStandActive && (
              <div className="mx-auto bg-rose-950/95 border-2 border-rose-400 px-3 py-1 rounded-xl text-[10px] font-black text-rose-100 shadow-[0_2px_0_#0f172a] whitespace-nowrap">
                ⏱️ ¡ÚLTIMO PLATO · CÁMARA LENTA!
              </div>
            )}
            {/* Active Chef Reflex Cue when a plague steps into the critical strip and Trapazo (18s CD) is ready */}
            {hud.chefWhipThreatReady && (
              <div
                data-testid="chef-whip-ready-cue"
                className="mx-auto bg-cyan-950/95 border-2 border-cyan-400 px-2.5 py-0.5 rounded-xl text-[9.5px] font-black text-cyan-200 shadow-[0_2px_0_#0f172a] whitespace-nowrap animate-pulse"
              >
                🧣 ¡TOCA AL CHEF: TRAPAZO LISTO!
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

          {/* Golden "¡EVOLUCIONAR!" Floating Cue when dragging/selecting a Gold Lv.3 weapon with compatible board partner */}
          {isRush && rushHud?.evolutionPreviewScreen && (
            <div
              data-testid="supreme-evolution-cue"
              className={`pointer-events-none fixed z-30 ${getTargetLeftClass(
                rushHud.evolutionPreviewScreen.xPct
              )} ${getTargetTopClass(
                rushHud.evolutionPreviewScreen.yPct
              )} -translate-x-1/2 -translate-y-full -mt-2 bg-yellow-400 border-2 border-slate-950 text-slate-950 px-2.5 py-1 rounded-xl text-[10px] font-display font-black tracking-wide whitespace-nowrap shadow-[0_3px_0_#0f172a] animate-bounce`}
            >
              {rushHud.evolutionPreviewScreen.label} · {rushHud.evolutionPreviewScreen.evoName}
            </div>
          )}

          {/* Single-Focus Animated Drag Guide + Minimal Floating Cell Label (Strategic Levels 1-3 & 31) */}
          {!isRush &&
            hud.tutorialTargetScreen &&
            liveTutorialGuide?.nextTarget?.pieceId === hud.tutorialTargetScreen.pieceId &&
            !hud.selectedPieceId &&
            !selectedPieceIdRef.current &&
            !dragPointerRef.current.active &&
            !dockCollapsed && (
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

          {/* Compact Lateral Streak Counter ("Combo xN") — Coin Bonuses at x8 & x15 */}
          {hud.streakCount >= 2 && (
            <div
              data-testid="lateral-streak-badge"
              className={`pointer-events-none fixed right-2 top-[38%] z-30 rounded-xl border-2 px-2.5 py-1 shadow-[0_3px_0_#0f172a] flex flex-col items-end leading-none transition ${
                hud.streakCount >= 15
                  ? 'bg-amber-500 border-slate-950 text-slate-950 scale-105'
                  : hud.streakCount >= 8
                  ? 'bg-cyan-950/95 border-yellow-400 text-yellow-300'
                  : 'bg-slate-950/90 border-cyan-400/80 text-cyan-200'
              }`}
            >
              <span className="font-display font-black text-xs sm:text-sm tracking-wide tabular-nums">
                🔥 Combo x{hud.streakCount}
              </span>
              <span
                className={`text-[8.5px] font-mono font-black mt-0.5 ${
                  hud.streakCount >= 15 ? 'text-slate-900' : 'text-amber-200/90'
                }`}
              >
                {hud.streakCount >= 15
                  ? '★ BONO x15 ACTIVO'
                  : hud.streakCount >= 8
                  ? '🪙 BONO x8 · PRÓX x15'
                  : 'PRÓX BONO 🪙 x8'}
              </span>
            </div>
          )}

          {/* =================================================================
              GUNMETAL SERVING TRAY + LIVE RUSH SUPPLY BAR + GOLDEN ULTIMATE COIN
             ================================================================= */}
          <div
            data-testid="serving-tray-dock"
            className="pointer-events-auto touch-none overscroll-none select-none mx-auto w-full max-w-[392px] flex flex-col items-center"
          >
            {!dockCollapsed && (
              <>
                {/* Continuous Rush Supply Bar + Pure Icon-Only Board Weapon Cap (4 -> 8, zero text) */}
                {isRush && rushHud && (
                  <div
                    data-testid="rush-supply-bar"
                    className="w-full px-4 mb-1"
                  >
                    <div className="rounded-xl bg-slate-950/92 border-2 border-slate-950 px-2.5 py-1 shadow-[0_2px_0_#0f172a]">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[9.5px] font-black leading-none text-yellow-300 tracking-wide">
                          ⚡ SUMINISTRO · COSTE {rushHud.supplyCost}
                        </span>
                        <div
                          data-testid="rush-board-cap-icons"
                          role="img"
                          aria-label={`Límite de armas en mesa: ${rushHud.boardWeaponCount} de ${rushHud.maxBoardWeapons}`}
                          className={`flex items-center gap-0.5 px-1 py-0.5 rounded-md border transition-transform ${
                            rushHud.capFlashActive
                              ? 'bg-red-950/90 border-red-400 scale-105'
                              : 'bg-slate-900/90 border-slate-800'
                          }`}
                        >
                          {Array.from({ length: rushHud.maxBoardWeapons }, (_, slotIdx) => {
                            const filled = slotIdx < rushHud.boardWeaponCount;
                            return (
                              <svg
                                key={slotIdx}
                                viewBox="0 0 16 16"
                                aria-hidden="true"
                                className="w-3.5 h-3.5 shrink-0"
                              >
                                <path
                                  d="M3 13.5h10v-2H11.5L10.8 6.5h1.2V4.5H9.8V2.5H6.2v2H4v2h1.2L4.5 11.5H3v2z"
                                  fill={
                                    rushHud.capFlashActive
                                      ? '#ef4444'
                                      : filled
                                      ? '#facc15'
                                      : '#1e293b'
                                  }
                                  stroke={
                                    rushHud.capFlashActive
                                      ? '#fecaca'
                                      : filled
                                      ? '#0f172a'
                                      : '#64748b'
                                  }
                                  strokeWidth="1.25"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            );
                          })}
                        </div>
                        <span className="text-[9.5px] font-black leading-none font-mono tabular-nums text-cyan-200">
                          {rushHud.supply}/{rushHud.supplyMax}
                        </span>
                      </div>
                      <svg
                        viewBox="0 0 100 8"
                        preserveAspectRatio="none"
                        className="w-full h-2 rounded-full bg-slate-800 border border-slate-950 overflow-hidden"
                        role="img"
                        aria-label={`Barra de Suministro: ${rushHud.supply} de ${rushHud.supplyMax}`}
                      >
                        <rect
                          x="0"
                          y="0"
                          width={Math.max(
                            0,
                            Math.min(100, (rushHud.supply / Math.max(1, rushHud.supplyMax)) * 100)
                          )}
                          height="8"
                          fill={rushHud.supply >= rushHud.supplyCost ? '#facc15' : '#38bdf8'}
                        />
                        <line
                          x1={(rushHud.supplyCost / Math.max(1, rushHud.supplyMax)) * 100}
                          y1="0"
                          x2={(rushHud.supplyCost / Math.max(1, rushHud.supplyMax)) * 100}
                          y2="8"
                          stroke="#0f172a"
                          strokeWidth="1.4"
                        />
                        {rushHud.supplyCost * 2 < rushHud.supplyMax && (
                          <line
                            x1={((rushHud.supplyCost * 2) / Math.max(1, rushHud.supplyMax)) * 100}
                            y1="0"
                            x2={((rushHud.supplyCost * 2) / Math.max(1, rushHud.supplyMax)) * 100}
                            y2="8"
                            stroke="#0f172a"
                            strokeWidth="1.4"
                          />
                        )}
                      </svg>
                    </div>
                  </div>
                )}

                <div className="relative flex items-center justify-center w-full px-1.5 sm:px-2.5">
                  {/* Left Metallic Serving Tray Handle */}
                  <div
                    aria-hidden="true"
                    className="w-2.5 h-9 sm:h-11 -mr-1 rounded-l-lg border-[2.5px] border-r-0 border-slate-950 bg-gradient-to-b from-slate-400 to-slate-600 shadow-[0_3px_0_#0f172a] flex items-center justify-end pr-0.5"
                  >
                    <div className="w-1 h-5 sm:h-6 rounded-l bg-slate-800 border border-r-0 border-slate-950" />
                  </div>

                  {/* Main Gunmetal Serving Tray Body */}
                  <div className="flex-1 rounded-2xl bg-gradient-to-b from-slate-600 via-slate-700 to-slate-800 border-[2.5px] border-slate-950 p-1 shadow-[0_4px_0_#0f172a] flex items-center gap-1 min-w-0">
                    <div className="flex-1 rounded-xl bg-slate-800/95 border-2 border-slate-950 px-1 py-1 flex items-center gap-1 min-w-0">
                      {/* Stacked Utensil Slots (Generous height + Micro-Role under every weapon name!) */}
                      <div
                        data-testid="gunmetal-tray-slots"
                        className="flex-1 flex items-center gap-1 min-w-0"
                      >
                        {trayGroups.length === 0 ? (
                          <div className="flex-1 h-[62px] sm:h-[68px] rounded-xl border border-slate-700/80 bg-slate-900/70 px-3 flex items-center justify-center text-[11px] font-extrabold text-slate-300 text-center">
                            ✓ Arsenal en mesa · Arrastra en la encimera para mover
                          </div>
                        ) : (
                          trayGroups.map((group) => {
                            const selectedMatch = group.pieces.find(
                              (p) => p.id === hud.selectedPieceId
                            );
                            const tutorialMatch = tutorialGuide?.nextTarget
                              ? group.pieces.find(
                                  (p) => p.id === tutorialGuide.nextTarget?.pieceId
                                )
                              : undefined;
                            const piece = selectedMatch ?? tutorialMatch ?? group.representative;
                            const isSelected = Boolean(selectedMatch);
                            const isGunked = piece.gunkTimer > 0;
                            const waitingSupply =
                              isRush && rushHud !== null && rushHud.supply < rushHud.supplyCost;
                            // STRICT SINGLE FOCUS: never illuminate a second tray card while another piece is selected
                            const isTutorialNext =
                              !isRush && !hud.selectedPieceId && Boolean(tutorialMatch);
                            const activeMicroTip =
                              longPressTip &&
                              group.pieces.some((p) => p.id === longPressTip.pieceId)
                                ? longPressTip.text
                                : null;
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
                                ? 'Escuadra'
                                : piece.type === 'wc_shield'
                                ? 'Gel WC'
                                : 'Lejía';

                            const roleTag = UTENSIL_ROLE_TAGS[piece.type];

                            const tierBorderClass =
                              piece.level === 3
                                ? 'border-yellow-400 bg-amber-950/60'
                                : piece.level === 2
                                ? 'border-slate-200 bg-slate-600/90'
                                : 'border-slate-950 bg-slate-700/90 hover:bg-slate-600/90';

                            return (
                              <button
                                key={group.groupKey}
                                type="button"
                                data-testid="tray-weapon-slot"
                                data-level={piece.level}
                                data-count={group.count}
                                onPointerDown={(e) => {
                                  suppressNextTrayClickRef.current = false;
                                  if (trayPressRef.current?.timerId) {
                                    window.clearTimeout(trayPressRef.current.timerId);
                                  }
                                  setLongPressTip(null);
                                  const nextInsp: TacticalInspectionTarget = {
                                    kind: 'piece',
                                    pieceId: piece.id,
                                    pieceType: piece.type,
                                    level: piece.level,
                                    evolutionId: piece.evolutionId,
                                  };
                                  inspectionTargetRef.current = nextInsp;
                                  setHud((prev) => ({
                                    ...prev,
                                    inspectionTarget: nextInsp,
                                  }));
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
                                  const nextSelId = isSelected ? null : piece.id;
                                  selectedPieceIdRef.current = nextSelId;
                                  const nextInsp: TacticalInspectionTarget | null = nextSelId
                                    ? {
                                        kind: 'piece',
                                        pieceId: piece.id,
                                        pieceType: piece.type,
                                        level: piece.level,
                                        evolutionId: piece.evolutionId,
                                      }
                                    : null;
                                  inspectionTargetRef.current = nextInsp;
                                  setHud((prev) => ({
                                    ...prev,
                                    selectedPieceId: nextSelId,
                                    inspectionTarget: nextInsp,
                                  }));
                                  soundEngine.playSlowMoEnter();
                                }}
                                className={`touch-none relative flex-1 min-w-0 h-[62px] sm:h-[68px] rounded-xl border-2 flex flex-col items-center justify-between py-1 px-0.5 transition cursor-pointer ${
                                  isSelected
                                    ? 'bg-slate-700 border-cyan-400 scale-[1.03] shadow-[0_0_10px_#22d3ee]'
                                    : isGunked
                                    ? 'bg-lime-950 border-lime-400'
                                    : isTutorialNext
                                    ? 'bg-slate-700 border-lime-400 shadow-[0_0_10px_#4ade80]'
                                    : `${tierBorderClass} shadow-inner`
                                } ${waitingSupply && !isSelected ? 'opacity-60' : ''}`}
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

                                {/* Rush Silver Lv.2 / Gold Lv.3 Badge */}
                                {piece.level >= 2 && (
                                  <span
                                    className={`pointer-events-none absolute -top-1.5 left-0.5 px-1 rounded text-[8px] font-black leading-tight border ${
                                      piece.level === 3
                                        ? 'bg-yellow-400 text-slate-950 border-slate-950'
                                        : 'bg-slate-200 text-slate-950 border-slate-950'
                                    }`}
                                  >
                                    {piece.level === 3 ? '🥇3' : '🥈2'}
                                  </span>
                                )}

                                {/* Stack Counter Badge (x2 / x3) */}
                                {group.count >= 2 && (
                                  <span
                                    data-testid="tray-stack-count"
                                    className="pointer-events-none absolute -top-1.5 right-0.5 px-1.5 py-0.5 rounded-md bg-cyan-400 text-slate-950 border border-slate-950 font-mono tabular-nums text-[10px] font-black leading-none shadow"
                                  >
                                    x{group.count}
                                  </span>
                                )}

                                {isTutorialNext && !isSelected && !activeMicroTip && (
                                  <span
                                    aria-hidden="true"
                                    className="absolute -top-2 left-1 text-[11px] animate-bounce"
                                  >
                                    👆
                                  </span>
                                )}

                                {/* Bespoke SVG Illustration matching the 3D Weapon */}
                                <div className="w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center shrink-0">
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
                                  ) : piece.type === 'wc_shield' ? (
                                    <svg viewBox="0 0 40 48" className="w-full h-full drop-shadow">
                                      <path d="M12 18 L28 18 L31 42 L9 42 Z" fill="#10b981" stroke="#0f172a" strokeWidth="2.5" />
                                      <path d="M16 7 L26 11 L22 18 L14 18 Z" fill="#34d399" stroke="#0f172a" strokeWidth="2.3" />
                                    </svg>
                                  ) : piece.type === 'bleach_cannon' ? (
                                    <svg viewBox="0 0 40 48" className="w-full h-full drop-shadow">
                                      <rect x="9" y="14" width="22" height="29" rx="4" fill="#f8fafc" stroke="#0f172a" strokeWidth="2.5" />
                                      <rect x="15" y="6" width="10" height="8" rx="2" fill="#f97316" stroke="#0f172a" strokeWidth="2.2" />
                                      <circle cx="20" cy="29" r="5" fill="#fde047" stroke="#0f172a" strokeWidth="2" />
                                    </svg>
                                  ) : (
                                    <svg viewBox="0 0 40 48" className="w-full h-full drop-shadow">
                                      <line x1="20" y1="5" x2="20" y2="30" stroke="#ef4444" strokeWidth="4" strokeLinecap="round" />
                                      <path d="M8 39 C8 25 32 25 32 39 Z" fill="#2dd4bf" stroke="#0f172a" strokeWidth="2.5" />
                                    </svg>
                                  )}
                                </div>

                                <div className="flex flex-col items-center leading-none gap-0.5 max-w-full">
                                  <span className="text-[9.5px] sm:text-[10.5px] font-black text-white whitespace-nowrap leading-none drop-shadow-[0_1.5px_0_#0f172a]">
                                    {isGunked ? '🤢 Limpiar' : compactLabel}
                                  </span>
                                  <span
                                    data-testid="tray-role-tag"
                                    className="text-[8px] sm:text-[8.5px] font-extrabold text-cyan-300 whitespace-nowrap leading-none"
                                  >
                                    {roleTag}
                                  </span>
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>

                      {/* Circular Golden Coin-Style ULTIMATE Button (Fires at 100%; Inspects at 0.08x when <100%!) */}
                      <button
                        type="button"
                        data-testid="ultimate-btn"
                        aria-label={`Ultimate ${equippedSpecialMeta.name}: Presión ${hud.pressurePct}%`}
                        onClick={() => {
                          if (hud.pressurePct >= 100) {
                            inspectionTargetRef.current = null;
                            triggerUltimateRef.current = true;
                          } else {
                            selectedPieceIdRef.current = null;
                            const isAlreadyUlt = activeInspectionTarget?.kind === 'ultimate';
                            const nextTarget: TacticalInspectionTarget | null = isAlreadyUlt
                              ? null
                              : { kind: 'ultimate' };
                            inspectionTargetRef.current = nextTarget;
                            setHud((prev) => ({
                              ...prev,
                              selectedPieceId: null,
                              inspectionTarget: nextTarget,
                            }));
                            if (nextTarget) soundEngine.playSlowMoEnter();
                          }
                        }}
                        className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full border-[2.5px] flex flex-col items-center justify-center shrink-0 transition shadow-[0_3px_0_#0f172a] cursor-pointer ${
                          activeInspectionTarget?.kind === 'ultimate'
                            ? 'border-cyan-300 bg-gradient-to-b from-yellow-300 via-amber-400 to-amber-500 scale-105'
                            : hud.pressurePct >= 100
                            ? 'border-slate-950 bg-gradient-to-b from-yellow-300 via-amber-400 to-amber-500 animate-pulse scale-105'
                            : 'border-slate-950 bg-gradient-to-b from-amber-300 via-yellow-400 to-amber-600'
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
                    className="w-2.5 h-9 sm:h-11 -ml-1 rounded-r-lg border-[2.5px] border-l-0 border-slate-950 bg-gradient-to-b from-slate-400 to-slate-600 shadow-[0_3px_0_#0f172a] flex items-center justify-start pl-0.5"
                  >
                    <div className="w-1 h-5 sm:h-6 rounded-r bg-slate-800 border border-l-0 border-slate-950" />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          3. PAUSE MODAL (Triggered by Escape or Pause Button · 2-Step Reset Confirmation)
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
                <div className="text-[10px] font-bold uppercase text-amber-300">
                  {isRush ? 'TIEMPO RUSH' : 'NIVEL / FASE'}
                </div>
                <div className="font-mono tabular-nums text-lg font-black">
                  {isRush
                    ? formatSurvivalMMSS(rushHud?.elapsedSec ?? 0)
                    : `Nv.${progress.currentLevel} · ${hud.phase}/3`}
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
              {!isRush ? (
                <button
                  type="button"
                  onClick={resetBoardToDefault}
                  className="w-full py-2.5 rounded-xl bg-amber-800 hover:bg-amber-700 text-amber-100 font-bold text-xs cursor-pointer transition"
                >
                  🧹 Vaciar Encimera y Colocar de Nuevo
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startRushGame}
                  className="w-full py-2.5 rounded-xl bg-amber-800 hover:bg-amber-700 text-amber-100 font-bold text-xs cursor-pointer transition"
                >
                  ⚡ Reiniciar Ronda Supervivencia Rush
                </button>
              )}

              {/* Safe 2-Step Confirmation for "Empezar de 0" */}
              {!confirmPauseReset ? (
                <button
                  type="button"
                  onClick={() => setConfirmPauseReset(true)}
                  className="w-full py-2.5 rounded-xl bg-rose-950 hover:bg-rose-900 text-rose-100 border border-rose-500/60 font-bold text-xs cursor-pointer transition"
                >
                  🔄 Empezar de 0 (Borrar Progreso)
                </button>
              ) : (
                <div className="rounded-xl bg-rose-950/90 border-2 border-rose-400 p-2.5 space-y-2">
                  <p className="text-[11px] font-extrabold text-rose-100 text-center">
                    ¿Borrar monedas, récords y volver al Nivel 1?
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmPauseReset(false)}
                      className="py-2 rounded-lg bg-amber-900 hover:bg-amber-800 text-amber-100 font-bold text-xs cursor-pointer transition"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      data-testid="confirm-pause-reset-zero"
                      onClick={() => {
                        handleResetProgressFromZero();
                        setGameState('title');
                      }}
                      className="py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-black text-xs border border-slate-950 cursor-pointer transition"
                    >
                      ⚠️ Sí, Borrar
                    </button>
                  </div>
                </div>
              )}

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
          4A. RUSH GAME OVER: THERMAL RESTAURANT RECEIPT ("Ticket Térmico")
         ===================================================================== */}
      {gameState === 'gameover' && isRush && rushReceipt && (
        <ThermalReceiptModal
          receipt={rushReceipt}
          totalWalletCoins={progress.coins}
          onPlayRushAgain={startRushGame}
          onExitToTitle={() => setGameState('title')}
        />
      )}

      {/* =====================================================================
          4B. STRATEGIC VICTORY / GAME OVER MODAL (With Near-Miss & Shop CTA)
         ===================================================================== */}
      {gameState === 'gameover' && !isRush && endOutcome && (
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
                  : formatDefeatNearMissCopy(
                      endOutcome.remainingKillsToNext,
                      endOutcome.phaseReached
                    )}
              </p>
              {endOutcome.victory && endOutcome.vipSaved && (
                <div
                  data-testid="vip-saved-badge"
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-yellow-400/20 border-2 border-yellow-400 text-yellow-200 text-xs font-black"
                >
                  ⭐ ¡Plato del Crítico VIP salvado! Monedas ×2 (+{endOutcome.coinsEarned ?? 240} 🪙)
                </div>
              )}
              {endOutcome.victory && !endOutcome.vipSaved && endOutcome.classicToqueBonusApplied && (
                <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-400/15 border border-emerald-400/70 text-emerald-200 text-xs font-extrabold">
                  🎩 +10% Gorro Clásico por 4/4 platos intactos (+{endOutcome.coinsEarned} 🪙)
                </div>
              )}
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
                onClick={startStrategicGame}
                className="w-full py-3.5 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-display font-black text-base border-2 border-slate-950 shadow-[0_4px_0_#0f172a] cursor-pointer transition"
              >
                {endOutcome.victory
                  ? `¡Jugar Nivel ${progress.currentLevel}!`
                  : 'Reintentar Nivel Ahora'}
              </button>

              {!endOutcome.victory && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {hasRemainingShopUnlocks(progress) && (
                    <button
                      type="button"
                      data-testid="defeat-album-shop-btn"
                      onClick={() => openCodexModal('all')}
                      className="apk-touch-target w-full py-2.5 px-2 rounded-xl bg-cyan-950 hover:bg-cyan-900 text-cyan-200 border border-cyan-400/70 font-extrabold text-xs cursor-pointer transition inline-flex items-center justify-center"
                    >
                      Álbum 3★ · 🪙 {progress.coins}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowKitchenUpgrades(true)}
                    className="apk-touch-target w-full py-2.5 px-2 rounded-xl bg-emerald-950 hover:bg-emerald-900 text-emerald-200 border border-emerald-400/70 font-extrabold text-xs cursor-pointer transition inline-flex items-center justify-center"
                  >
                    🔧 Mejoras de Cocina
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => setGameState('title')}
                className="apk-touch-target w-full py-2 rounded-xl bg-amber-900/60 hover:bg-amber-900 text-amber-200 font-bold text-xs cursor-pointer transition inline-flex items-center justify-center"
              >
                Ir al Menú Principal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals for Strategic Campaign Selector, On-Demand Tactical Help Card ('?'), 3★ Codex, Kitchen Upgrades, 3D Wardrobe & Settings */}
      {showStrategicModal && (
        <StrategicCampaignModal
          progress={progress}
          onSelectWorld={(wId) => setProgress((p) => ({ ...p, currentWorld: wId }))}
          onLaunchStrategic={startStrategicGame}
          onClose={() => setShowStrategicModal(false)}
        />
      )}
      {showKitchenUpgrades && (
        <KitchenUpgradesModal
          progress={progress}
          onBuyUpgrade={handleBuyKitchenUpgrade}
          onClose={() => setShowKitchenUpgrades(false)}
        />
      )}
      {gameState === 'playing' && !isRush && onboardingCard && showOnboardingModal && (
        <TacticalOnboardingModal
          card={onboardingCard}
          onDismiss={() => setShowOnboardingModal(false)}
        />
      )}
      {showCodex && (
        <AchievementsCodexModal
          progress={progress}
          initialPage={codexInitialPage}
          onClose={() => setShowCodex(false)}
          onBuyAchievement={handleBuyAchievementInShop}
        />
      )}
      {showWardrobe && (
        <ChefWardrobeModal
          progress={progress}
          activeTab={wardrobeTab}
          onChangeTab={setWardrobeTab}
          previewHat={previewHat}
          previewArmor={previewArmor}
          previewSpecial={previewSpecial}
          onPreviewHat={setPreviewHat}
          onPreviewArmor={setPreviewArmor}
          onPreviewSpecial={setPreviewSpecial}
          wardrobeYawRef={wardrobeYawRef}
          onClose={() => setShowWardrobe(false)}
          onEquipHat={(h) => {
            setPreviewHat(h);
            setProgress((p) => ({ ...p, equippedHat: h }));
          }}
          onEquipArmor={(a) => {
            setPreviewArmor(a);
            setProgress((p) => ({ ...p, equippedArmor: a }));
          }}
          onEquipSpecial={(s) => {
            setPreviewSpecial(s);
            setProgress((p) => ({ ...p, equippedSpecial: s }));
          }}
          onOpenAlbumForBug={(bugType) => {
            setShowWardrobe(false);
            openCodexModal(bugType);
          }}
        />
      )}
      {showSettings && (
        <SettingsModal
          settings={settings}
          progress={progress}
          onUpdateSettings={handleUpdateSettings}
          onImportBackup={handleImportBackup}
          onResetDefaults={() => setSettings(DEFAULT_SETTINGS)}
          onResetProgressFromZero={handleResetProgressFromZero}
          onClose={() => setShowSettings(false)}
        />
      )}
      {showQuickGuide && (
        <QuickGuideModal onClose={() => setShowQuickGuide(false)} />
      )}
    </main>
  );
}

