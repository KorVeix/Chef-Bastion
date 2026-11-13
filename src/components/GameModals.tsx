import React, { useEffect, useRef, useState } from 'react';
import { soundEngine } from '../game/audio';
import { exportMetrics, loadMetrics, summarizeMetrics } from '../game/analytics';
import { ComandaTicket, COMANDA_AUTO_PICK_SECONDS, ThermalReceiptSummary } from '../game/roguelite';
import {
  ACHIEVEMENTS_CATALOG,
  ARMORS_CATALOG,
  DEFAULT_SETTINGS,
  exportProgressToBase64,
  getBiomeForLevel,
  HATS_CATALOG,
  importProgressFromBase64,
  isAchievementPurchasableWithCoins,
  isWorldUnlocked,
  KITCHEN_UPGRADES_CATALOG,
  normalizeKitchenUpgrades,
  SPECIAL_WEAPONS_CATALOG,
  WORLD_UNLOCK_LEVELS,
  WORLDS_CATALOG,
} from '../game/rules';
import {
  ArmorId,
  BugType,
  ComicPopEvent,
  FloatingComboEvent,
  GameSettings,
  HatId,
  KitchenUpgradeId,
  PlayerProgress,
  SpecialWeaponId,
  TacticalInspectorCardData,
  TacticalOnboardingCardData,
  WorldId,
} from '../game/types';

export type WardrobeTabId = 'hats' | 'armors' | 'specials';

function getHorizontalAnchorClass(xPct: number): string {
  if (xPct < 30) return 'left-[24%]';
  if (xPct < 50) return 'left-[40%]';
  if (xPct < 68) return 'left-[60%]';
  return 'left-[76%]';
}

function getVerticalAnchorClass(yPct: number): string {
  if (yPct < 28) return 'top-[24%]';
  if (yPct < 36) return 'top-[32%]';
  if (yPct < 44) return 'top-[40%]';
  if (yPct < 52) return 'top-[48%]';
  if (yPct < 60) return 'top-[56%]';
  return 'top-[64%]';
}

export const FloatingComboLayer: React.FC<{ combos: FloatingComboEvent[] }> = ({ combos }) => {
  if (combos.length === 0) return null;

  const textColors: Record<FloatingComboEvent['color'], string> = {
    yellow: 'text-yellow-300',
    cyan: 'text-cyan-300',
    orange: 'text-orange-300',
    pink: 'text-fuchsia-300',
    green: 'text-lime-300',
  };

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-0 z-30 overflow-hidden"
    >
      {combos.map((item) => {
        const compactLine = item.detail ? `${item.label} · ${item.detail}` : item.label;
        return (
          <div
            key={item.id}
            data-testid="floating-combo-toast"
            className={`fixed ${getHorizontalAnchorClass(item.xPct)} ${getVerticalAnchorClass(
              item.yPct
            )} animate-combo-float whitespace-nowrap`}
          >
            <span
              className={`font-display font-black ${
                item.emphasis ? 'text-2xl sm:text-3xl' : 'text-sm sm:text-base'
              } tracking-tight leading-none drop-shadow-[0_2px_2px_rgba(0,0,0,0.98)] [text-shadow:_-1.5px_-1.5px_0_#0f172a,_1.5px_-1.5px_0_#0f172a,_-1.5px_1.5px_0_#0f172a,_1.5px_1.5px_0_#0f172a] ${textColors[item.color]}`}
            >
              {compactLine}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export const ComicPopBanner: React.FC<{
  pop: ComicPopEvent | null;
  suppressNotice?: boolean;
}> = ({ pop, suppressNotice = false }) => {
  if (!pop || suppressNotice) return null;

  const bgMap: Record<ComicPopEvent['color'], string> = {
    yellow: 'bg-slate-950/94 text-yellow-300 border-yellow-400/90',
    cyan: 'bg-slate-950/94 text-cyan-300 border-cyan-400/90',
    orange: 'bg-slate-950/94 text-orange-300 border-orange-400/90',
    pink: 'bg-slate-950/94 text-fuchsia-300 border-fuchsia-400/90',
    green: 'bg-slate-950/94 text-lime-300 border-lime-400/90',
  };

  const singleLineText = pop.id.startsWith('shield-block')
    ? '🛡️ Blindaje frontal: usa Puente UV ⚡ o Jabón 🧼'
    : pop.subtitle
    ? `${pop.title} · ${pop.subtitle}`
    : pop.title;

  return (
    <div
      aria-live="polite"
      data-testid="top-unlock-banner"
      className="pointer-events-none fixed inset-x-0 top-[150px] sm:top-[116px] z-30 flex justify-center px-3"
    >
      <div
        className={`border px-3 py-1 rounded-lg shadow-[0_2px_0_#0f172a] max-w-[92vw] sm:max-w-lg truncate text-[11px] font-display font-black tracking-wide ${bgMap[pop.color]}`}
      >
        {pop.stars ? `${'★'.repeat(pop.stars)} ` : ''}
        {singleLineText}
      </div>
    </div>
  );
};

export const TacticalInspectorBanner: React.FC<{
  card: TacticalInspectorCardData | null;
  onClose: () => void;
}> = ({ card, onClose }) => {
  if (!card) return null;

  const borderMap: Record<TacticalInspectorCardData['accent'], string> = {
    cyan: 'border-cyan-400',
    yellow: 'border-yellow-400',
    pink: 'border-fuchsia-400',
    green: 'border-lime-400',
  };

  return (
    <div
      role="region"
      aria-label="Ficha Táctica de Arma"
      data-testid="tactical-inspector-banner"
      className="pointer-events-none mx-auto w-full max-w-md px-0.5 z-40"
    >
      <div
        className={`pointer-events-auto w-full rounded-xl bg-slate-950/95 border-2 ${
          borderMap[card.accent]
        } px-2.5 py-1.5 shadow-[0_3px_0_#0f172a] text-amber-50`}
      >
        <div className="flex items-center justify-between gap-2 pb-1 border-b border-slate-800">
          <div className="min-w-0 flex items-center gap-1.5">
            <span className="font-display font-black text-xs sm:text-sm text-white truncate">
              {card.title}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-600 text-[9px] font-mono font-black text-cyan-300 shrink-0">
              {card.badge}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="px-1.5 py-0.5 rounded bg-yellow-400/20 border border-yellow-400/70 text-[9px] font-mono font-black text-yellow-300">
              ⏱️ 0.08x
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar Ficha Táctica"
              className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-black flex items-center justify-center cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        <p className="text-[10.5px] sm:text-[11px] font-bold text-white leading-tight mt-1">
          <span className="text-cyan-300 font-black">QUÉ HACE: </span>
          {card.whatItDoes}
        </p>
        <p className="text-[10px] sm:text-[10.5px] font-semibold text-amber-200/95 leading-tight mt-0.5">
          <span className="text-yellow-300 font-black">COMBINA: </span>
          {card.combineOrMerge}
        </p>
      </div>
    </div>
  );
};

interface CodexModalProps {
  progress: PlayerProgress;
  initialPage?: 'all' | BugType;
  onClose: () => void;
  onBuyAchievement: (achId: string) => void;
}

const CODEX_ENEMY_PAGES: {
  id: 'all' | BugType;
  tabLabel: string;
  title: string;
  dossier: string;
}[] = [
  {
    id: 'all',
    tabLabel: '📖 Todas',
    title: 'Catálogo Completo de Plagas y Recetas 3★',
    dossier: 'Filtra por página de plaga o desbloquea recompensas al instante con monedas.',
  },
  {
    id: 'speed_ant',
    tabLabel: '🐜 Hormiga',
    title: 'Página 1 · Hormiga Velocista (speed_ant)',
    dossier: 'Avanza rápido en grupo con casco de miga. Débil al Abanico de Espuma ×5 (Estropajo + Flus-Flus).',
  },
  {
    id: 'cap_beetle',
    tabLabel: '🐀 Blindada',
    title: 'Página 2 · Rata / Escarabajo Chapa (cap_beetle)',
    dossier: 'Chapa frontal metálica. Funde su escudo con Puente Láser UV violeta o rodéala en diagonal.',
  },
  {
    id: 'acid_wasp',
    tabLabel: '🪰 Mosca',
    title: 'Página 3 · Mosca Bombardera Ácida (acid_wasp)',
    dossier: 'Escupe miel ácida que pringa tus armas. Rebota su disparo con Gel WC o absorbe el 1º con Traje EPI.',
  },
  {
    id: 'shift_roach',
    tabLabel: '🪳 Saltarraíl',
    title: 'Página 4 · Cucaracha Saltarraíl (shift_roach)',
    dossier: 'Cambia de carril e invade por conductos laterales (Nv.31+). Intercéptala con Escuadra 90° o Jabón + Fregona.',
  },
  {
    id: 'king_crab',
    tabLabel: '👑 Jefe',
    title: 'Página 5 · Mini-Jefes (X5) y Grandes Jefes 3 Fases (X0)',
    dossier: '100-67% Coraza (×2.5 UV/Explosivo) · 66-34% Sabotaje/Evasión · 33-0% Frenesí y Emboscada.',
  },
];

export const AchievementsCodexModal: React.FC<CodexModalProps> = ({
  progress,
  initialPage = 'all',
  onClose,
  onBuyAchievement,
}) => {
  const [activePage, setActivePage] = useState<'all' | BugType>(initialPage);
  useEffect(() => {
    setActivePage(initialPage);
  }, [initialPage]);
  const currentPageMeta =
    CODEX_ENEMY_PAGES.find((p) => p.id === activePage) ?? CODEX_ENEMY_PAGES[0];
  const visibleAchievements =
    activePage === 'all'
      ? ACHIEVEMENTS_CATALOG
      : ACHIEVEMENTS_CATALOG.filter((ach) => ach.bugType === activePage);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Álbum de Plagas 3 Estrellas y Tienda de Desbloqueo"
      className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-6"
    >
      <div className="w-full max-w-xl max-h-[88dvh] flex flex-col rounded-2xl bg-amber-950 border-2 border-amber-500/80 text-amber-50 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-amber-800/80 bg-amber-900/60 shrink-0">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-amber-300 tracking-tight">
              ÁLBUM 3★ Y PÁGINAS DE PLAGAS
            </h2>
            <p className="text-xs text-amber-200/80 mt-0.5">
              Ejecuta la receta en partida o desbloquea el equipo con monedas
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono tabular-nums text-sm font-extrabold text-yellow-300 whitespace-nowrap">
              🪙 {progress.coins}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar Álbum"
              className="rounded-xl bg-amber-800 hover:bg-amber-700 px-3 py-1.5 text-xs font-extrabold text-amber-100 cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>

        {/* Dedicated Enemy Pages Selector (Includes speed_ant & shift_roach pages) */}
        <div
          role="tablist"
          aria-label="Páginas del Álbum por tipo de plaga"
          className="flex items-center gap-1.5 overflow-x-auto px-4 py-2.5 bg-amber-950 border-b border-amber-800/70 shrink-0"
        >
          {CODEX_ENEMY_PAGES.map((page) => {
            const selected = activePage === page.id;
            return (
              <button
                key={page.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActivePage(page.id)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-extrabold transition whitespace-nowrap shrink-0 cursor-pointer ${
                  selected
                    ? 'bg-yellow-400 text-slate-950 shadow'
                    : 'bg-amber-900/50 text-amber-200 hover:bg-amber-800/70'
                }`}
              >
                {page.tabLabel}
              </button>
            );
          })}
        </div>

        <div className="overflow-y-auto p-4 pb-6 space-y-3">
          {/* Active Enemy Page Dossier Header */}
          <div className="rounded-xl bg-amber-900/35 border border-amber-700/60 px-3.5 py-2.5">
            <div className="text-xs font-black text-yellow-300">{currentPageMeta.title}</div>
            <p className="text-[11px] text-amber-100/85 mt-0.5">{currentPageMeta.dossier}</p>
          </div>

          {visibleAchievements.map((ach) => {
            const isUnlocked = progress.unlockedAchievements.includes(ach.id);
            const canAfford = progress.coins >= ach.unlockCostCoins;

            return (
              <div
                key={ach.id}
                className={`rounded-xl border p-3.5 transition ${
                  isUnlocked
                    ? 'bg-emerald-950/70 border-emerald-500/60'
                    : 'bg-amber-900/40 border-amber-700/60'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-black text-yellow-400">
                      {'★'.repeat(ach.star)}
                      {'☆'.repeat(3 - ach.star)}
                    </span>
                    <h3 className="text-sm font-black text-white">{ach.title}</h3>
                  </div>

                  {/* LEGO-style zero-text Pictogram Recipe */}
                  <div className="flex items-center gap-1 bg-black/40 px-2.5 py-1 rounded-lg text-sm">
                    {ach.recipeIcons.map((ic, i) => (
                      <span key={i}>{ic}</span>
                    ))}
                  </div>
                </div>

                <p className="text-xs text-amber-100/90 mt-1.5">{ach.description}</p>

                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10">
                  <div className="text-xs font-bold text-cyan-300">
                    🎁 Premio: <span className="text-white">{ach.rewardLabel}</span>
                  </div>

                  {isUnlocked ? (
                    <span className="text-xs font-extrabold text-emerald-300">
                      ✓ LOGRO COMPLETADO
                    </span>
                  ) : !isAchievementPurchasableWithCoins(ach) ? (
                    <span
                      data-testid={`coin-only-in-match-${ach.id}`}
                      className="text-[11px] font-bold text-amber-300/90"
                    >
                      🎯 Solo en partida
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={!canAfford}
                      onClick={() => onBuyAchievement(ach.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition whitespace-nowrap shrink-0 ${
                        canAfford
                          ? 'bg-yellow-400 text-slate-950 hover:bg-yellow-300 shadow cursor-pointer'
                          : 'bg-amber-950 text-amber-500 border border-amber-800 cursor-not-allowed'
                      }`}
                    >
                      Desbloquear Ahora (🪙 {ach.unlockCostCoins})
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

interface WardrobeModalProps {
  progress: PlayerProgress;
  activeTab: WardrobeTabId;
  onChangeTab: (tab: WardrobeTabId) => void;
  previewHat: HatId;
  previewArmor: ArmorId;
  previewSpecial: SpecialWeaponId;
  onPreviewHat: (hat: HatId) => void;
  onPreviewArmor: (armor: ArmorId) => void;
  onPreviewSpecial: (spec: SpecialWeaponId) => void;
  onClose: () => void;
  onEquipHat: (hat: HatId) => void;
  onEquipArmor: (armor: ArmorId) => void;
  onEquipSpecial: (spec: SpecialWeaponId) => void;
  onOpenAlbumForBug: (bugType: BugType) => void;
  wardrobeYawRef: React.MutableRefObject<number>;
}

export const ChefWardrobeModal: React.FC<WardrobeModalProps> = ({
  progress,
  activeTab,
  onChangeTab,
  previewHat,
  previewArmor,
  previewSpecial,
  onPreviewHat,
  onPreviewArmor,
  onPreviewSpecial,
  onClose,
  onEquipHat,
  onEquipArmor,
  onEquipSpecial,
  onOpenAlbumForBug,
  wardrobeYawRef,
}) => {
  const dragSpinRef = useRef<{ active: boolean; lastX: number }>({
    active: false,
    lastX: 0,
  });

  // Determine whether the currently previewed item in the active tab is locked, and locate its 3★ Album challenge!
  const lockedPreviewChallenge = (() => {
    if (activeTab === 'hats' && !progress.unlockedHats.includes(previewHat)) {
      const ach = ACHIEVEMENTS_CATALOG.find((a) => a.rewardId === previewHat);
      return {
        itemName: HATS_CATALOG[previewHat].name,
        bugType: ach?.bugType ?? 'speed_ant',
        achTitle: ach?.title ?? 'Reto en el Álbum 3★',
      };
    }
    if (activeTab === 'armors' && !progress.unlockedArmors.includes(previewArmor)) {
      const ach = ACHIEVEMENTS_CATALOG.find((a) => a.rewardId === previewArmor);
      return {
        itemName: ARMORS_CATALOG[previewArmor].name,
        bugType: ach?.bugType ?? 'acid_wasp',
        achTitle: ach?.title ?? 'Reto en el Álbum 3★',
      };
    }
    if (activeTab === 'specials' && !progress.unlockedSpecials.includes(previewSpecial)) {
      const ach = ACHIEVEMENTS_CATALOG.find((a) => a.rewardId === previewSpecial);
      return {
        itemName: SPECIAL_WEAPONS_CATALOG[previewSpecial].name,
        bugType: ach?.bugType ?? 'cap_beetle',
        achTitle: ach?.title ?? 'Reto en el Álbum 3★',
      };
    }
    return null;
  })();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Armería y Vestuario 3D del Chef Bastion"
      className="pointer-events-auto fixed inset-0 z-50 flex flex-col justify-between bg-gradient-to-b from-transparent via-transparent to-black/90 px-2.5 pb-2.5 sm:px-5 sm:pb-5 apk-safe-top apk-safe-bottom"
    >
      {/* Interactive Upper 3D Turntable Viewport (Zero top pill covering Chef's hats!) */}
      <div
        data-testid="wardrobe-3d-turntable"
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest('button')) return;
          dragSpinRef.current = { active: true, lastX: e.clientX };
          e.currentTarget.setPointerCapture?.(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!dragSpinRef.current.active) return;
          const dx = e.clientX - dragSpinRef.current.lastX;
          dragSpinRef.current.lastX = e.clientX;
          wardrobeYawRef.current += dx * 0.014;
        }}
        onPointerUp={() => {
          dragSpinRef.current.active = false;
        }}
        onPointerCancel={() => {
          dragSpinRef.current.active = false;
        }}
        className="relative flex-1 w-full max-w-xl mx-auto flex flex-col justify-between touch-none cursor-grab active:cursor-grabbing select-none"
      >
        {/* Corner-Only Spin Micro-Hint + Clean Close Button (Center 100% open for Chef & Hats!) */}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <span className="pointer-events-none text-[10.5px] font-extrabold text-amber-100/90 drop-shadow-[0_2px_2px_rgba(0,0,0,0.95)] pl-1">
            ↻ Arrastra para girar 3D
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar Vestuario"
            className="apk-touch-target rounded-xl bg-slate-950/90 border-2 border-amber-400 hover:bg-slate-900 px-3.5 py-2 text-xs font-black text-white shadow-lg cursor-pointer transition inline-flex items-center justify-center"
          >
            ✕ Cerrar
          </button>
        </div>
      </div>

      {/* Compact Non-Scrolling 3-Tab Bottom Drawer */}
      <div className="w-full max-w-xl mx-auto rounded-2xl bg-amber-950/96 border-2 border-amber-500/90 text-amber-50 shadow-2xl overflow-hidden shrink-0">
        {/* 3 Fixed Camera-Synced Category Tabs */}
        <div
          role="tablist"
          aria-label="Categorías del Vestuario 3D"
          className="grid grid-cols-3 gap-1.5 p-2 bg-amber-900/75 border-b border-amber-800/80"
        >
          {(
            [
              { id: 'hats', label: '🎩 Gorros' },
              { id: 'armors', label: '🦺 Trajes' },
              { id: 'specials', label: '⚔️ Armas Élite' },
            ] as const
          ).map((tab) => {
            const selected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={selected}
                data-testid={`wardrobe-tab-${tab.id}`}
                onClick={() => {
                  soundEngine.playSnapPiece(false);
                  onChangeTab(tab.id);
                }}
                className={`py-2 px-2 rounded-xl text-xs font-display font-black transition whitespace-nowrap cursor-pointer ${
                  selected
                    ? 'bg-yellow-400 text-slate-950 border-2 border-slate-950 shadow-[0_2px_0_#0f172a]'
                    : 'bg-amber-950/70 text-amber-100 border border-amber-700/60 hover:bg-amber-800/70'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Fixed Tab Panel Body (Zero Vertical Scroll) */}
        <div className="p-3 space-y-2.5">
          {activeTab === 'hats' && (
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(HATS_CATALOG) as HatId[]).map((hId) => {
                const h = HATS_CATALOG[hId];
                const unlocked = progress.unlockedHats.includes(hId);
                const equipped = progress.equippedHat === hId;
                const isPreviewing = previewHat === hId;
                return (
                  <button
                    key={hId}
                    type="button"
                    data-testid={`wardrobe-hat-${hId}`}
                    onClick={() => {
                      soundEngine.playSnapPiece(unlocked);
                      onPreviewHat(hId);
                      if (unlocked) {
                        onEquipHat(hId);
                      }
                    }}
                    className={`text-left p-2.5 rounded-xl border-2 transition cursor-pointer ${
                      isPreviewing && !unlocked
                        ? 'bg-fuchsia-950/75 border-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.35)]'
                        : equipped
                        ? 'bg-cyan-950 border-cyan-400'
                        : unlocked
                        ? 'bg-amber-900/50 border-amber-700 hover:border-amber-400'
                        : 'bg-slate-950/65 border-amber-900/70 hover:border-amber-500/70'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] sm:text-xs font-black text-white leading-tight">
                        {h.name}
                      </span>
                      <span
                        className={`text-[10px] font-extrabold shrink-0 ${
                          equipped
                            ? 'text-cyan-300'
                            : unlocked
                            ? 'text-emerald-300'
                            : 'text-amber-300'
                        }`}
                      >
                        {equipped ? 'EQUIPADO' : unlocked ? 'Equipar' : '🔒 Probar'}
                      </span>
                    </div>
                    <p className="text-[10.5px] font-semibold text-amber-200/85 mt-1 leading-snug">
                      {h.bonus}
                    </p>
                  </button>
                );
              })}
            </div>
          )}

          {activeTab === 'armors' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {(Object.keys(ARMORS_CATALOG) as ArmorId[]).map((aId) => {
                const a = ARMORS_CATALOG[aId];
                const unlocked = progress.unlockedArmors.includes(aId);
                const equipped = progress.equippedArmor === aId;
                const isPreviewing = previewArmor === aId;
                return (
                  <button
                    key={aId}
                    type="button"
                    data-testid={`wardrobe-armor-${aId}`}
                    onClick={() => {
                      soundEngine.playSnapPiece(unlocked);
                      onPreviewArmor(aId);
                      if (unlocked) {
                        onEquipArmor(aId);
                      }
                    }}
                    className={`text-left p-2.5 rounded-xl border-2 transition cursor-pointer ${
                      isPreviewing && !unlocked
                        ? 'bg-fuchsia-950/75 border-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.35)]'
                        : equipped
                        ? 'bg-cyan-950 border-cyan-400'
                        : unlocked
                        ? 'bg-amber-900/50 border-amber-700 hover:border-amber-400'
                        : 'bg-slate-950/65 border-amber-900/70 hover:border-amber-500/70'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-black text-white leading-tight">{a.name}</span>
                      <span
                        className={`text-[10px] font-extrabold shrink-0 ${
                          equipped
                            ? 'text-cyan-300'
                            : unlocked
                            ? 'text-emerald-300'
                            : 'text-amber-300'
                        }`}
                      >
                        {equipped ? 'EQUIPADO' : unlocked ? 'Equipar' : '🔒 Probar'}
                      </span>
                    </div>
                    <p className="text-[10.5px] font-semibold text-amber-200/85 mt-1 leading-snug">
                      {a.bonus}
                    </p>
                  </button>
                );
              })}
            </div>
          )}

          {activeTab === 'specials' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {(Object.keys(SPECIAL_WEAPONS_CATALOG) as SpecialWeaponId[]).map((sId) => {
                const s = SPECIAL_WEAPONS_CATALOG[sId];
                const unlocked = progress.unlockedSpecials.includes(sId);
                const equipped = progress.equippedSpecial === sId;
                const isPreviewing = previewSpecial === sId;
                return (
                  <button
                    key={sId}
                    type="button"
                    data-testid={`wardrobe-special-${sId}`}
                    onClick={() => {
                      soundEngine.playSnapPiece(unlocked);
                      onPreviewSpecial(sId);
                      if (unlocked) {
                        onEquipSpecial(sId);
                      }
                    }}
                    className={`text-left p-2.5 rounded-xl border-2 transition cursor-pointer ${
                      isPreviewing && !unlocked
                        ? 'bg-fuchsia-950/75 border-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.35)]'
                        : equipped
                        ? 'bg-cyan-950 border-cyan-400'
                        : unlocked
                        ? 'bg-amber-900/50 border-amber-700 hover:border-amber-400'
                        : 'bg-slate-950/65 border-amber-900/70 hover:border-amber-500/70'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-black text-white leading-tight">
                        {s.icon} {s.name}
                      </span>
                      <span
                        className={`text-[10px] font-extrabold shrink-0 ${
                          equipped
                            ? 'text-cyan-300'
                            : unlocked
                            ? 'text-emerald-300'
                            : 'text-amber-300'
                        }`}
                      >
                        {equipped ? 'EQUIPADO' : unlocked ? 'Equipar' : '🔒 Probar'}
                      </span>
                    </div>
                    <p className="text-[10.5px] font-semibold text-amber-200/85 mt-1 leading-snug">
                      {s.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          )}

          {/* Direct Jump Bar when Previewing a Locked Achievement Item */}
          {lockedPreviewChallenge && (
            <div
              data-testid="wardrobe-locked-action-bar"
              className="rounded-xl bg-slate-950/95 border border-amber-400/80 px-2.5 py-2 flex items-center justify-between gap-2"
            >
              <span
                data-testid="wardrobe-locked-preview-tag"
                className="text-[10.5px] font-black uppercase text-amber-300 whitespace-nowrap"
              >
                🔒 Vista previa bloqueada
              </span>
              <button
                type="button"
                data-testid="wardrobe-jump-album-btn"
                onClick={() => onOpenAlbumForBug(lockedPreviewChallenge.bugType)}
                className="px-3 py-1.5 rounded-lg bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-extrabold text-[11px] whitespace-nowrap shrink-0 cursor-pointer transition shadow"
              >
                📖 Ver reto en el Álbum
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface TacticalOnboardingModalProps {
  card: TacticalOnboardingCardData;
  onDismiss: () => void;
}

export const TacticalOnboardingModal: React.FC<TacticalOnboardingModalProps> = ({
  card,
  onDismiss,
}) => {
  const rails = [1, 2, 3, 4];
  const rows = [3, 4, 5, 6];

  const colorMap: Record<'green' | 'orange' | 'cyan' | 'yellow', string> = {
    green: 'bg-lime-400 text-slate-950 border-slate-950 shadow-[0_3px_0_#0f172a]',
    orange: 'bg-orange-500 text-white border-slate-950 shadow-[0_3px_0_#0f172a]',
    cyan: 'bg-cyan-400 text-slate-950 border-slate-950 shadow-[0_3px_0_#0f172a]',
    yellow: 'bg-yellow-400 text-slate-950 border-slate-950 shadow-[0_3px_0_#0f172a]',
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Tarjeta Táctica: ${card.title}`}
      className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-5"
    >
      <div className="w-full max-w-md rounded-2xl bg-amber-950 border-4 border-yellow-400 text-amber-50 shadow-2xl overflow-hidden flex flex-col">
        <div className="bg-amber-900/90 border-b-2 border-amber-700 px-4 py-3 flex items-center justify-between gap-2">
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-yellow-300">
              {card.badge}
            </div>
            <h2 className="text-lg sm:text-xl font-display font-black text-white leading-tight">
              {card.title}
            </h2>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-slate-950 text-yellow-300 font-mono text-xs font-black">
            NV.{card.level}
          </span>
        </div>

        <div className="p-4 space-y-3.5 overflow-y-auto max-h-[78dvh]">
          <p className="text-xs font-bold text-amber-100 leading-relaxed">{card.subtitle}</p>

          {/* Graphic 4x4 Countertop Diagram (Raíl 1..4 x Fila 3..6) */}
          <div className="rounded-xl bg-amber-900/70 border-2 border-amber-700 p-3 space-y-2">
            <div className="flex items-center justify-between text-[10px] font-black uppercase text-amber-300">
              <span>DIAGRAMA TÁCTICO DE CASILLAS</span>
              <span>👻 FANTASMA 3D ACTIVO</span>
            </div>

            <div className="grid grid-cols-4 gap-1.5 text-center text-[10px] font-black text-amber-200">
              {rails.map((r) => (
                <div key={r} className="bg-black/30 rounded py-0.5">
                  Raíl {r}
                </div>
              ))}
            </div>

            <div className="space-y-1.5">
              {rows.map((rowNum) => (
                <div key={rowNum} className="grid grid-cols-4 gap-1.5">
                  {rails.map((railNum) => {
                    const match = card.cells.find(
                      (c) => c.rail === railNum && c.row === rowNum
                    );
                    return (
                      <div
                        key={`${railNum}-${rowNum}`}
                        className={`h-12 rounded-xl border-2 flex flex-col items-center justify-center px-1 transition ${
                          match
                            ? `${colorMap[match.highlightColor]} scale-[1.03]`
                            : 'bg-amber-950/80 border-amber-800/70 text-amber-500/60'
                        }`}
                      >
                        {match ? (
                          <>
                            <span className="text-base leading-none">{match.icon}</span>
                            <span className="text-[9px] font-black leading-tight text-center truncate max-w-full mt-0.5">
                              R{railNum}·F{rowNum}
                            </span>
                          </>
                        ) : (
                          <span className="text-[9px] font-mono">
                            R{railNum}·F{rowNum}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Step legend */}
            <div className="pt-1.5 space-y-1">
              {card.cells.map((c, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 text-xs font-extrabold text-white bg-black/35 px-2.5 py-1 rounded-lg"
                >
                  <span>{c.icon}</span>
                  <span>{c.label}</span>
                </div>
              ))}
            </div>

            <div className="bg-slate-950/90 border border-yellow-400/50 rounded-lg px-2.5 py-1.5 text-[11px] font-black text-yellow-300 text-center">
              {card.flowArrowLabel}
            </div>
          </div>

          {/* Reward Explanation Box */}
          <div className="rounded-xl bg-emerald-950/80 border-2 border-emerald-500/70 p-3">
            <div className="text-xs font-black text-emerald-300">{card.rewardTitle}</div>
            <p className="text-[11px] font-bold text-emerald-100/90 mt-0.5">
              {card.rewardExplanation}
            </p>
          </div>

          <button
            type="button"
            onClick={onDismiss}
            className="w-full py-3 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-display font-black text-sm border-2 border-slate-950 shadow-[0_4px_0_#0f172a] cursor-pointer transition"
          >
            ¡ENTENDIDO! COLOCAR EN LA ENCIMERA
          </button>
        </div>
      </div>
    </div>
  );
};

interface SettingsModalProps {
  settings: GameSettings;
  progress: PlayerProgress;
  onUpdateSettings: (next: Partial<GameSettings>) => void;
  onImportBackup: (progress: PlayerProgress, settings?: GameSettings) => void;
  onResetDefaults: () => void;
  onResetProgressFromZero?: () => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  progress,
  onUpdateSettings,
  onImportBackup,
  onResetDefaults,
  onResetProgressFromZero,
  onClose,
}) => {
  const [confirmResetZero, setConfirmResetZero] = useState(false);
  const [backupCode, setBackupCode] = useState('');
  const [backupStatus, setBackupStatus] = useState<{
    tone: 'ok' | 'error';
    message: string;
  } | null>(null);
  const speedOptions: { value: GameSettings['gameSpeedMultiplier']; label: string }[] = [
    { value: 0.75, label: '0.75x Relajado' },
    { value: 1.0, label: '1.0x Estándar' },
    { value: 1.25, label: '1.25x Turbo' },
  ];

  const hintOptions: { value: GameSettings['smartComboHints']; label: string }[] = [
    { value: 'onboarding', label: 'Solo Tutorial' },
    { value: 'always', label: 'Siempre' },
    { value: 'off', label: 'Desactivadas' },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Ajustes del Juego y Audio"
      data-testid="settings-modal"
      className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-2.5 sm:p-4"
    >
      <div className="w-full max-w-md rounded-2xl bg-amber-950 border-4 border-amber-500 text-amber-50 shadow-2xl overflow-hidden flex flex-col max-h-[94dvh]">
        {/* Header */}
        <div className="bg-amber-900/95 border-b-2 border-amber-700 px-4 py-2.5 flex items-center justify-between gap-2 shrink-0">
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-yellow-300 leading-none">
              CONFIGURACIÓN TÁCTICA Y SONIDO
            </div>
            <h2 className="text-lg font-display font-black text-white leading-tight mt-0.5">
              ⚙️ AJUSTES DEL JUEGO
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar Ajustes"
            className="px-2.5 py-1 rounded-xl bg-amber-800 hover:bg-amber-700 text-xs font-extrabold text-white border border-amber-500/60 cursor-pointer transition"
          >
            ✕ Cerrar
          </button>
        </div>

        {/* Compact Body so "Guardar y Volver" fits without scrolling */}
        <div className="p-3 sm:p-3.5 space-y-2.5 overflow-y-auto">
          {/* 1. Audio & Volume Controls */}
          <div className="rounded-xl bg-amber-900/60 border border-amber-700/80 p-2.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-yellow-300">
                🔊 Audio y Volumen
              </h3>
              <button
                type="button"
                onClick={() => onUpdateSettings({ muted: !settings.muted })}
                className={`px-2.5 py-0.5 rounded-lg text-[11px] font-extrabold border transition cursor-pointer ${
                  settings.muted
                    ? 'bg-rose-950 border-rose-400 text-rose-200'
                    : 'bg-emerald-950 border-emerald-400 text-emerald-200'
                }`}
              >
                {settings.muted ? '🔇 Silenciado' : '🔊 Sonido Activo'}
              </button>
            </div>

            <div
              data-testid="volume-sliders-group"
              className={`space-y-1.5 transition-opacity duration-200 ${
                settings.muted ? 'opacity-35' : 'opacity-100'
              }`}
            >
              {/* Master Volume */}
              <div className="space-y-0.5">
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <label htmlFor="slider-master-vol" className="text-amber-100">
                    Volumen General
                  </label>
                  <span className="font-mono tabular-nums text-yellow-300 font-black">
                    {settings.muted ? '0%' : `${settings.masterVolume}%`}
                  </span>
                </div>
                <input
                  id="slider-master-vol"
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={settings.masterVolume}
                  onChange={(e) =>
                    onUpdateSettings({
                      masterVolume: Number(e.target.value),
                      muted: false,
                    })
                  }
                  className="w-full accent-yellow-400 cursor-pointer h-1.5 rounded-lg bg-amber-950 block"
                />
              </div>

              {/* SFX Volume */}
              <div className="space-y-0.5">
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <label htmlFor="slider-sfx-vol" className="text-amber-100">
                    Efectos FX (Disparos y Combos)
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => soundEngine.playSnapPiece(true)}
                      className="px-1.5 py-0.5 rounded bg-cyan-950 hover:bg-cyan-900 border border-cyan-400/60 text-[10px] font-black text-cyan-200 cursor-pointer leading-none"
                    >
                      Probar FX
                    </button>
                    <span className="font-mono tabular-nums text-cyan-300 font-black">
                      {settings.muted ? '0%' : `${settings.sfxVolume}%`}
                    </span>
                  </div>
                </div>
                <input
                  id="slider-sfx-vol"
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={settings.sfxVolume}
                  onChange={(e) =>
                    onUpdateSettings({
                      sfxVolume: Number(e.target.value),
                      muted: false,
                    })
                  }
                  className="w-full accent-cyan-400 cursor-pointer h-1.5 rounded-lg bg-amber-950 block"
                />
              </div>

              {/* Background Music Volume */}
              <div className="space-y-0.5">
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <label htmlFor="slider-bgm-vol" className="text-amber-100">
                    Música Adaptativa (Establecimientos)
                  </label>
                  <span className="font-mono tabular-nums text-emerald-300 font-black">
                    {settings.muted ? '0%' : `${settings.bgmVolume}%`}
                  </span>
                </div>
                <input
                  id="slider-bgm-vol"
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={settings.bgmVolume}
                  onChange={(e) =>
                    onUpdateSettings({
                      bgmVolume: Number(e.target.value),
                      muted: false,
                    })
                  }
                  className="w-full accent-emerald-400 cursor-pointer h-1.5 rounded-lg bg-amber-950 block"
                />
              </div>
            </div>
          </div>

          {/* 2. Gameplay Parameters */}
          <div className="rounded-xl bg-amber-900/60 border border-amber-700/80 p-2.5 space-y-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-yellow-300 leading-none">
              🎮 Parámetros de Jugabilidad
            </h3>

            {/* Game Speed Multiplier */}
            <div className="space-y-1">
              <div className="text-[11px] font-bold text-amber-100">
                Ritmo de Avance de las Oleadas
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {speedOptions.map((opt) => {
                  const active = settings.gameSpeedMultiplier === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => onUpdateSettings({ gameSpeedMultiplier: opt.value })}
                      className={`py-1.5 px-1.5 rounded-xl text-[11px] font-black border transition cursor-pointer ${
                        active
                          ? 'bg-yellow-400 text-slate-950 border-slate-950 shadow-[0_2px_0_#0f172a]'
                          : 'bg-amber-950/80 text-amber-200 border-amber-700 hover:bg-amber-800/60'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Smart Combo Hints Mode */}
            <div className="space-y-1">
              <div className="text-[11px] font-bold text-amber-100">
                Pistas Inteligentes de Combos en Tablero
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {hintOptions.map((opt) => {
                  const active = settings.smartComboHints === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => onUpdateSettings({ smartComboHints: opt.value })}
                      className={`py-1.5 px-1.5 rounded-xl text-[11px] font-black border transition cursor-pointer ${
                        active
                          ? 'bg-cyan-400 text-slate-950 border-slate-950 shadow-[0_2px_0_#0f172a]'
                          : 'bg-amber-950/80 text-amber-200 border-amber-700 hover:bg-amber-800/60'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 60 FPS Mobile Performance Toggle */}
            <button
              type="button"
              data-testid="toggle-prioritize-60fps"
              onClick={() =>
                onUpdateSettings({
                  prioritize60Fps: !(settings.prioritize60Fps !== false),
                })
              }
              className={`w-full p-2 rounded-xl border text-left transition cursor-pointer flex items-center justify-between gap-2 ${
                settings.prioritize60Fps !== false
                  ? 'bg-emerald-950/90 border-emerald-400 text-white'
                  : 'bg-amber-950/70 border-amber-800 text-amber-200/80'
              }`}
            >
              <div>
                <div className="text-[11px] font-black leading-tight">
                  🚀 Priorizar 60 FPS (Móvil)
                </div>
                <div className="text-[9.5px] text-amber-200/85 mt-0.5 leading-tight">
                  Limita DPR a 1.35 y usa sombras planas de contacto sin lag
                </div>
              </div>
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-black border shrink-0 ${
                  settings.prioritize60Fps !== false
                    ? 'bg-emerald-400 text-slate-950 border-slate-950'
                    : 'bg-slate-900 text-amber-300 border-amber-700'
                }`}
              >
                {settings.prioritize60Fps !== false ? 'ON' : 'OFF'}
              </span>
            </button>

            {/* Tactical Slow-Mo, Screen Shake & Haptics Toggles */}
            <div className="grid grid-cols-3 gap-1.5 pt-0.5">
              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({ tacticalSlowMo: !settings.tacticalSlowMo })
                }
                className={`p-2 rounded-xl border text-left transition cursor-pointer ${
                  settings.tacticalSlowMo
                    ? 'bg-cyan-950/90 border-cyan-400 text-white'
                    : 'bg-amber-950/70 border-amber-800 text-amber-300/70'
                }`}
              >
                <div className="text-[10px] font-black flex items-center justify-between gap-1 leading-tight">
                  <span>⏱️ Cám. Lenta</span>
                  <span className="text-cyan-300">
                    {settings.tacticalSlowMo ? 'ON' : 'OFF'}
                  </span>
                </div>
                <div className="text-[9px] text-amber-200/80 mt-0.5 leading-tight">
                  20% al mover pieza
                </div>
              </button>

              <button
                type="button"
                onClick={() => onUpdateSettings({ screenShake: !settings.screenShake })}
                className={`p-2 rounded-xl border text-left transition cursor-pointer ${
                  settings.screenShake
                    ? 'bg-cyan-950/90 border-cyan-400 text-white'
                    : 'bg-amber-950/70 border-amber-800 text-amber-300/70'
                }`}
              >
                <div className="text-[10px] font-black flex items-center justify-between gap-1 leading-tight">
                  <span>💥 Sacudida</span>
                  <span className="text-cyan-300">
                    {settings.screenShake ? 'ON' : 'OFF'}
                  </span>
                </div>
                <div className="text-[9px] text-amber-200/80 mt-0.5 leading-tight">
                  Cámara en bajas 3★
                </div>
              </button>

              <button
                type="button"
                data-testid="toggle-haptics"
                aria-label="Vibración Háptica"
                onClick={() => {
                  const nextHaptics = !settings.hapticsEnabled;
                  onUpdateSettings({ hapticsEnabled: nextHaptics });
                  if (nextHaptics) {
                    soundEngine.hapticsEnabled = true;
                    soundEngine.triggerHaptic('medium');
                  }
                }}
                className={`p-2 rounded-xl border text-left transition cursor-pointer ${
                  settings.hapticsEnabled
                    ? 'bg-cyan-950/90 border-cyan-400 text-white'
                    : 'bg-amber-950/70 border-amber-800 text-amber-300/70'
                }`}
              >
                <div className="text-[10px] font-black flex items-center justify-between gap-1 leading-tight">
                  <span>📳 Háptica</span>
                  <span className="text-cyan-300">
                    {settings.hapticsEnabled ? 'ON' : 'OFF'}
                  </span>
                </div>
                <div className="text-[9px] text-amber-200/80 mt-0.5 leading-tight">
                  Vibración táctil
                </div>
              </button>
            </div>
          </div>

          {/* 2B. Serverless Base64 Progress Backup (Export / Import via Clipboard) */}
          <div
            data-testid="backup-base64-section"
            className="rounded-xl bg-amber-900/60 border border-amber-700/80 p-2.5 space-y-2"
          >
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="backup-base64-input"
                className="text-xs font-black uppercase tracking-wider text-cyan-300"
              >
                💾 Exportar / Importar Progreso
              </label>
              <span className="text-[10px] font-mono text-amber-200/80">Base64 sin servidor</span>
            </div>

            <input
              id="backup-base64-input"
              data-testid="backup-base64-input"
              type="text"
              value={backupCode}
              onChange={(e) => {
                setBackupCode(e.target.value);
                if (backupStatus) setBackupStatus(null);
              }}
              placeholder="Pega aquí tu código CB1:... o pulsa Exportar"
              className="w-full rounded-lg bg-slate-950/90 border border-amber-700/80 px-2.5 py-1.5 text-[11px] font-mono text-amber-100 placeholder:text-amber-300/40 select-text focus:outline-none focus:border-cyan-400"
            />

            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                data-testid="export-backup-btn"
                onClick={async () => {
                  const code = exportProgressToBase64(progress, settings);
                  setBackupCode(code);
                  let copied = false;
                  try {
                    if (navigator.clipboard?.writeText) {
                      await navigator.clipboard.writeText(code);
                      copied = true;
                    }
                  } catch {
                    copied = false;
                  }
                  soundEngine.playSnapPiece(true);
                  setBackupStatus({
                    tone: 'ok',
                    message: copied
                      ? '✓ Código Base64 copiado al portapapeles.'
                      : '✓ Código generado en la caja (cópialo manualmente).',
                  });
                }}
                className="py-2 px-2 rounded-xl bg-cyan-950 hover:bg-cyan-900 text-cyan-200 border border-cyan-400/70 font-extrabold text-[11px] cursor-pointer transition"
              >
                📋 Exportar Progreso
              </button>

              <button
                type="button"
                data-testid="import-backup-btn"
                onClick={async () => {
                  let candidate = backupCode.trim();
                  if (!candidate) {
                    try {
                      if (navigator.clipboard?.readText) {
                        candidate = (await navigator.clipboard.readText()).trim();
                        if (candidate) setBackupCode(candidate);
                      }
                    } catch {
                      // Clipboard read blocked by browser/WebView; rely on manual paste
                    }
                  }
                  const res = importProgressFromBase64(candidate);
                  if (!res.ok) {
                    soundEngine.playShieldClink();
                    setBackupStatus({ tone: 'error', message: res.error });
                    return;
                  }
                  soundEngine.playStarKill(3);
                  onImportBackup(res.progress, res.settings);
                  setBackupStatus({
                    tone: 'ok',
                    message: `✓ Partida restaurada (Nv.${res.progress.currentLevel} · 🪙 ${res.progress.coins}).`,
                  });
                }}
                className="py-2 px-2 rounded-xl bg-emerald-950 hover:bg-emerald-900 text-emerald-200 border border-emerald-400/70 font-extrabold text-[11px] cursor-pointer transition"
              >
                📥 Importar Progreso
              </button>
            </div>

            {backupStatus && (
              <p
                role="status"
                data-testid="backup-status-msg"
                className={`text-[10.5px] font-bold leading-snug ${
                  backupStatus.tone === 'ok' ? 'text-emerald-300' : 'text-rose-300'
                }`}
              >
                {backupStatus.message}
              </p>
            )}
          </div>

          <MetricsPanel />

          {/* 3. Safe Progress Reset ("Empezar de 0" ONLY in Pause/Settings with 2-step confirmation) */}
          {onResetProgressFromZero && (
            <div className="rounded-xl bg-rose-950/45 border border-rose-700/60 p-2.5 space-y-1.5">
              {!confirmResetZero ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-rose-300">
                    ⚠️ Progreso Guardado
                  </span>
                  <button
                    type="button"
                    onClick={() => setConfirmResetZero(true)}
                    className="px-3 py-1 rounded-lg bg-rose-950 hover:bg-rose-900 text-rose-100 border border-rose-500/70 font-bold text-[11px] cursor-pointer transition"
                  >
                    🔄 Empezar de 0
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold text-rose-200 leading-snug">
                    ¿Seguro que quieres borrar monedas, logros y volver al Nivel 1?
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmResetZero(false)}
                      className="py-1.5 rounded-xl bg-amber-900 hover:bg-amber-800 text-amber-100 font-bold text-xs border border-amber-600 cursor-pointer transition"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      data-testid="confirm-settings-reset-zero"
                      onClick={() => {
                        setConfirmResetZero(false);
                        onResetProgressFromZero();
                        onClose();
                      }}
                      className="py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs border-2 border-slate-950 cursor-pointer transition"
                    >
                      ⚠️ Sí, Borrar Todo
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Footer Buttons */}
          <div className="flex items-center gap-2 pt-0.5">
            <button
              type="button"
              onClick={() => {
                onResetDefaults();
                soundEngine.applySettings(DEFAULT_SETTINGS);
              }}
              className="flex-1 py-2 rounded-xl bg-amber-900/80 hover:bg-amber-800 text-amber-200 font-bold text-xs border border-amber-700 cursor-pointer transition"
            >
              Restaurar por Defecto
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-display font-black text-sm border-2 border-slate-950 shadow-[0_3px_0_#0f172a] cursor-pointer transition"
            >
              Guardar y Volver
            </button>
          </div>

          <div className="pt-1 border-t border-amber-800/70 flex flex-col items-center gap-1 text-[10px] font-semibold text-amber-200/80">
            <div>
              CritFuse Mobile Games · <span className="font-mono text-yellow-300">v1.0.0-beta</span>
            </div>
            <div className="flex items-center justify-center gap-3 text-[10.5px] font-extrabold text-cyan-300">
              <a
                href="https://critfuse.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-cyan-200"
              >
                Privacidad
              </a>
              <span aria-hidden="true" className="text-amber-500/60">
                ·
              </span>
              <a
                href="https://critfuse.com/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-cyan-200"
              >
                Términos
              </a>
              <span aria-hidden="true" className="text-amber-500/60">
                ·
              </span>
              <a
                href="https://critfuse.com/support"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-cyan-200"
              >
                Soporte
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface StrategicCampaignModalProps {
  progress: PlayerProgress;
  onSelectWorld: (worldId: WorldId) => void;
  onLaunchStrategic: () => void;
  onClose: () => void;
}

export const StrategicCampaignModal: React.FC<StrategicCampaignModalProps> = ({
  progress,
  onSelectWorld,
  onLaunchStrategic,
  onClose,
}) => {
  const biome = getBiomeForLevel(progress.currentLevel);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Modo Estratégico: Campaña Táctica y Selector de Mundos"
      data-testid="strategic-campaign-modal"
      className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-5"
    >
      <div className="w-full max-w-md rounded-2xl bg-amber-950 border-4 border-cyan-400 text-amber-50 shadow-2xl overflow-hidden flex flex-col max-h-[90dvh]">
        <div className="bg-amber-900/95 border-b-2 border-amber-700 px-5 py-3.5 flex items-center justify-between gap-2 shrink-0">
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-cyan-300">
              CAMPAÑA POR NIVELES Y JEFES
            </div>
            <h2 className="text-lg sm:text-xl font-display font-black text-white leading-tight">
              🧠 MODO ESTRATÉGICO
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar Selector Estratégico"
            className="px-3 py-1.5 rounded-xl bg-amber-800 hover:bg-amber-700 text-xs font-extrabold text-white border border-amber-500/60 cursor-pointer transition"
          >
            ✕ Cerrar
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
          {/* Current Level & Establishment Summary */}
          <div className="rounded-xl bg-amber-900/60 border border-amber-700/80 p-3.5 flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-yellow-300">
                ESTABLECIMIENTO ACTUAL
              </div>
              <div className="text-base font-display font-black text-white mt-0.5">
                Nivel {progress.currentLevel} · {biome.shortName}
              </div>
              <p className="text-[11px] font-bold text-amber-200/85 mt-0.5">
                Puzles tácticos, Mini-Jefes (Nv.X5) y Grandes Jefes en 3 fases (Nv.X0).
              </p>
            </div>
            <div className="px-3 py-2 rounded-xl bg-slate-950 border-2 border-yellow-400/80 text-center shrink-0">
              <div className="text-[9px] font-black uppercase text-amber-300">MÁX</div>
              <div className="font-mono tabular-nums text-base font-black text-yellow-300">
                Nv.{progress.highestLevel}
              </div>
            </div>
          </div>

          {/* World Selector moved inside Strategic Mode to keep Title Screen uncluttered */}
          <div className="space-y-2">
            <div className="text-xs font-black uppercase tracking-wider text-cyan-300">
              🗺️ Selector de Mundos (Desbloqueo por Progreso)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(Object.keys(WORLDS_CATALOG) as WorldId[]).map((wId) => {
                const unlocked = isWorldUnlocked(wId, progress);
                const active = progress.currentWorld === wId;
                const reqLvl = WORLD_UNLOCK_LEVELS[wId];
                const worldMeta = WORLDS_CATALOG[wId];
                const baseLabel =
                  wId === 'sunny_counter'
                    ? '1. Encimera'
                    : wId === 'fridge_vault'
                    ? '2. Nevera ❄️'
                    : wId === 'iron_stoves'
                    ? '3. Fogones 🔥'
                    : '4. Obrador 🧁';

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
                      onSelectWorld(wId);
                    }}
                    className={`text-left p-3 rounded-xl border-2 transition ${
                      active
                        ? 'bg-yellow-400 text-slate-950 border-slate-950 shadow-[0_3px_0_#0f172a] cursor-pointer'
                        : unlocked
                        ? 'bg-amber-900/60 text-amber-100 border-amber-600/80 hover:bg-amber-800/70 cursor-pointer'
                        : 'bg-black/40 text-amber-400/50 border-amber-900/50 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-black">
                        {unlocked ? baseLabel : `🔒 ${baseLabel}`}
                      </span>
                      <span className="text-[10px] font-mono font-extrabold">
                        {active ? 'ACTIVO' : unlocked ? 'Elegir' : `Nv.${reqLvl}`}
                      </span>
                    </div>
                    <div
                      className={`text-[10px] font-bold mt-0.5 truncate ${
                        active ? 'text-slate-800' : 'text-amber-200/75'
                      }`}
                    >
                      {worldMeta.subtitle}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            data-testid="launch-strategic-level-btn"
            onClick={onLaunchStrategic}
            className="w-full py-3.5 rounded-2xl bg-yellow-400 hover:bg-yellow-300 active:scale-95 text-slate-950 font-display font-black text-base tracking-wide border-3 border-slate-950 shadow-[0_4px_0_#0f172a] cursor-pointer transition inline-flex items-center justify-center gap-2"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" aria-hidden="true">
              <polygon points="6,4 20,12 6,20" fill="#0f172a" />
            </svg>
            <span>¡JUGAR NIVEL {progress.currentLevel} (ESTRATÉGICO)!</span>
          </button>
        </div>
      </div>
    </div>
  );
};

interface LiveComandasOverlayProps {
  comandas: [ComandaTicket, ComandaTicket, ComandaTicket];
  timerSec: number;
  onPick: (index: number) => void;
}

export const LiveComandasOverlay: React.FC<LiveComandasOverlayProps> = ({
  comandas,
  timerSec,
  onPick,
}) => {
  const colorStyles: Record<ComandaTicket['color'], string> = {
    yellow:
      'bg-slate-950/88 border-yellow-400 text-yellow-200 hover:bg-yellow-950/90 shadow-[0_3px_0_#0f172a]',
    blue:
      'bg-slate-950/88 border-cyan-400 text-cyan-200 hover:bg-cyan-950/90 shadow-[0_3px_0_#0f172a]',
    red:
      'bg-slate-950/88 border-rose-500 text-rose-200 hover:bg-rose-950/90 shadow-[0_3px_0_#0f172a]',
    green:
      'bg-slate-950/88 border-emerald-400 text-emerald-200 hover:bg-emerald-950/90 shadow-[0_3px_0_#0f172a]',
  };

  const timerRatio = Math.max(0, Math.min(1, timerSec / COMANDA_AUTO_PICK_SECONDS));

  return (
    <div
      data-testid="live-comandas-strip"
      aria-label="Comandas al Vuelo: Elige mejora sin pausar"
      className="pointer-events-none mx-auto w-full max-w-md px-1"
    >
      <div className="grid grid-cols-3 gap-1.5">
        {comandas.map((ticket, idx) => {
          const isAutoCenter = idx === 1;
          return (
            <button
              key={ticket.id}
              type="button"
              data-testid={`comanda-ticket-${idx}`}
              onClick={(e) => {
                e.currentTarget.blur();
                onPick(idx);
              }}
              className={`pointer-events-auto relative rounded-xl border-2 px-2 py-1.5 flex flex-col items-center justify-between text-center transition active:scale-95 cursor-pointer ${
                colorStyles[ticket.color]
              } ${isAutoCenter ? 'ring-2 ring-white/80' : ''}`}
            >
              <div className="flex items-center justify-center gap-1 w-full">
                <span className="text-sm sm:text-base leading-none shrink-0">{ticket.icon}</span>
                {isAutoCenter && (
                  <span className="font-mono tabular-nums text-[9px] font-black px-1 py-0.2 rounded bg-white/15 text-white leading-none">
                    AUTO {timerSec.toFixed(1)}s
                  </span>
                )}
              </div>

              <span className="text-[10px] sm:text-[11px] font-display font-black leading-tight tracking-tight text-white mt-0.5 line-clamp-2">
                {ticket.title}
              </span>

              {isAutoCenter && (
                <svg
                  viewBox="0 0 100 6"
                  preserveAspectRatio="none"
                  className="w-full h-1 rounded-full bg-slate-800 mt-1 overflow-hidden"
                  aria-hidden="true"
                >
                  <rect
                    x="0"
                    y="0"
                    width={Math.round(timerRatio * 100)}
                    height="6"
                    fill="#38bdf8"
                  />
                </svg>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

interface ThermalReceiptModalProps {
  receipt: ThermalReceiptSummary;
  totalWalletCoins: number;
  onPlayRushAgain: () => void;
  onExitToTitle: () => void;
}

export const ThermalReceiptModal: React.FC<ThermalReceiptModalProps> = ({
  receipt,
  totalWalletCoins,
  onPlayRushAgain,
  onExitToTitle,
}) => {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Ticket Térmico de Restaurante: Resumen Supervivencia Rush"
      data-testid="thermal-receipt-modal"
      className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-black/85 p-3 sm:p-5"
    >
      <div className="w-full max-w-sm flex flex-col shadow-2xl">
        {/* Top Serrated Thermal Paper Edge */}
        <svg
          viewBox="0 0 320 12"
          preserveAspectRatio="none"
          className="w-full h-3 block"
          aria-hidden="true"
        >
          <polygon
            fill="#faf6eb"
            points="0,12 10,0 20,12 30,0 40,12 50,0 60,12 70,0 80,12 90,0 100,12 110,0 120,12 130,0 140,12 150,0 160,12 170,0 180,12 190,0 200,12 210,0 220,12 230,0 240,12 250,0 260,12 270,0 280,12 290,0 300,12 310,0 320,12"
          />
        </svg>

        {/* Thermal Paper Body */}
        <div className="bg-[#faf6eb] text-slate-950 px-5 py-4 font-mono space-y-3 border-x-2 border-stone-400">
          <div className="text-center border-b-2 border-dashed border-slate-400 pb-2.5">
            <div className="text-[10px] font-black tracking-widest uppercase text-slate-500">
              CRITFUSE MOBILE GAMES · CRITFUSE.COM
            </div>
            <div className="text-xs font-black tracking-widest uppercase text-slate-700 mt-0.5">
              CHEF BASTION BISTRÓ · RUSH
            </div>
            <h2 className="text-xl font-display font-black tracking-tight text-slate-950 mt-0.5">
              TICKET DE SERVICIO {receipt.orderNumber}
            </h2>
            <div className="text-[11px] font-bold text-slate-600 mt-0.5">
              FRENESÍ ALCANZADO: NIVEL {receipt.frenzyReached}/4
            </div>
          </div>

          {/* Hero Survival Clock */}
          <div className="rounded-xl bg-slate-950 text-yellow-300 px-4 py-2.5 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase text-amber-200/80">
                TIEMPO SOBREVIVIDO
              </div>
              <div className="text-2xl font-black tabular-nums tracking-wider">
                ⏱️ {receipt.survivedFormatted}
              </div>
            </div>
            {receipt.isNewRecord ? (
              <span className="px-2.5 py-1 rounded-lg bg-yellow-400 text-slate-950 font-sans text-[10px] font-black uppercase shadow">
                🏆 ¡NUEVO RÉCORD!
              </span>
            ) : (
              <div className="text-right">
                <div className="text-[9px] uppercase text-slate-400">PUNTOS</div>
                <div className="text-sm font-black tabular-nums text-white">
                  {receipt.totalScore}
                </div>
              </div>
            )}
          </div>

          {/* Itemized Receipt Lines */}
          <div className="space-y-1.5 text-xs border-b-2 border-dashed border-slate-400 pb-3">
            {receipt.lines.map((line, i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <div className="truncate">
                  <span className="font-black text-slate-700 mr-1.5">{line.qty}</span>
                  <span className="font-bold text-slate-900">{line.label}</span>
                </div>
                <span className="font-black tabular-nums text-emerald-800 shrink-0">
                  +{line.amountCoins} 🪙
                </span>
              </div>
            ))}
          </div>

          {/* Total & Global Wallet */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm font-black text-slate-950">
              <span>PROPINA TOTAL GANADA</span>
              <span className="tabular-nums text-emerald-700">
                +{receipt.totalCoinsEarned} 🪙
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
              <span>CAJA GLOBAL ACUMULADA</span>
              <span className="tabular-nums font-black text-slate-900">
                🪙 {totalWalletCoins}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 space-y-2 font-sans">
            <button
              type="button"
              data-start="true"
              onClick={onPlayRushAgain}
              className="w-full py-3.5 rounded-xl bg-yellow-400 hover:bg-yellow-300 active:scale-95 text-slate-950 font-display font-black text-base border-2 border-slate-950 shadow-[0_4px_0_#0f172a] cursor-pointer transition inline-flex items-center justify-center gap-2"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" aria-hidden="true">
                <polygon
                  points="13,2 4,14 11,14 9,22 20,10 13,10"
                  fill="#0f172a"
                  stroke="#ffffff"
                  strokeWidth="1.3"
                  strokeLinejoin="round"
                />
              </svg>
              <span>OTRA RONDA RUSH</span>
            </button>
            <button
              type="button"
              onClick={onExitToTitle}
              className="w-full py-2 rounded-xl bg-stone-200 hover:bg-stone-300 text-slate-800 font-extrabold text-xs border border-stone-400 cursor-pointer transition"
            >
              Volver a Portada
            </button>
          </div>
        </div>

        {/* Bottom Serrated Thermal Paper Edge */}
        <svg
          viewBox="0 0 320 12"
          preserveAspectRatio="none"
          className="w-full h-3 block"
          aria-hidden="true"
        >
          <polygon
            fill="#faf6eb"
            points="0,0 10,12 20,0 30,12 40,0 50,12 60,0 70,12 80,0 90,12 100,0 110,12 120,0 130,12 140,0 150,12 160,0 170,12 180,0 190,12 200,0 210,12 220,0 230,12 240,0 250,12 260,0 270,12 280,0 290,12 300,0 310,12 320,0"
          />
        </svg>
      </div>
    </div>
  );
};

interface KitchenUpgradesModalProps {
  progress: PlayerProgress;
  onBuyUpgrade: (upgradeId: KitchenUpgradeId) => void;
  onClose: () => void;
}

export const KitchenUpgradesModal: React.FC<KitchenUpgradesModalProps> = ({
  progress,
  onBuyUpgrade,
  onClose,
}) => {
  const levels = normalizeKitchenUpgrades(progress.kitchenUpgrades);
  const upgradeIds = Object.keys(KITCHEN_UPGRADES_CATALOG) as KitchenUpgradeId[];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Mejoras de Cocina Permanentes"
      data-testid="kitchen-upgrades-modal"
      className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-5"
    >
      <div className="w-full max-w-md rounded-2xl bg-amber-950 border-4 border-yellow-400 text-amber-50 shadow-2xl overflow-hidden flex flex-col max-h-[90dvh]">
        <div className="bg-amber-900/95 border-b-2 border-amber-700 px-4 py-3 flex items-center justify-between gap-2 shrink-0">
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-yellow-300">
              META-PROGRESIÓN DE CUENTA · 3 NIVELES
            </div>
            <h2 className="text-lg sm:text-xl font-display font-black text-white leading-tight">
              🔧 MEJORAS DE COCINA
            </h2>
          </div>
          <div className="flex items-center gap-2.5">
            <span
              data-testid="upgrades-wallet-coins"
              className="font-mono tabular-nums text-sm font-black text-yellow-300 whitespace-nowrap"
            >
              🪙 {progress.coins}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar Mejoras de Cocina"
              className="apk-touch-target px-3 py-1.5 rounded-xl bg-amber-800 hover:bg-amber-700 text-xs font-extrabold text-white border border-amber-500/60 cursor-pointer transition inline-flex items-center justify-center"
            >
              ✕ Cerrar
            </button>
          </div>
        </div>

        <div className="p-3.5 sm:p-4 space-y-2.5 overflow-y-auto pb-5">
          {upgradeIds.map((uId) => {
            const meta = KITCHEN_UPGRADES_CATALOG[uId];
            const curLvl = levels[uId];
            const isMax = curLvl === 3;
            const nextCost = curLvl === 3 ? 0 : meta.costs[curLvl];
            const canAfford = !isMax && progress.coins >= nextCost;

            return (
              <div
                key={uId}
                data-testid={`kitchen-upgrade-card-${uId}`}
                className="rounded-xl bg-amber-900/55 border border-amber-700/80 p-3 flex flex-col gap-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-base leading-none">{meta.icon}</span>
                      <h3 className="text-xs sm:text-sm font-black text-white leading-tight">
                        {meta.title}
                      </h3>
                    </div>
                    <p className="text-[11px] font-semibold text-amber-100/85 mt-0.5 leading-snug">
                      {meta.shortDesc}
                    </p>
                  </div>

                  {/* 3 Level Pips */}
                  <div
                    aria-label={`Nivel ${curLvl} de 3`}
                    data-testid={`upgrade-level-${uId}`}
                    className="flex items-center gap-1 bg-slate-950/80 px-2 py-1 rounded-lg border border-amber-700/60 shrink-0"
                  >
                    {[1, 2, 3].map((pip) => (
                      <span
                        key={pip}
                        className={`w-2.5 h-2.5 rounded-full border ${
                          pip <= curLvl
                            ? 'bg-yellow-400 border-yellow-200 shadow-[0_0_6px_rgba(250,204,21,0.75)]'
                            : 'bg-slate-800 border-slate-600'
                        }`}
                      />
                    ))}
                    <span className="font-mono tabular-nums text-[10px] font-black text-amber-200 ml-1">
                      {curLvl}/3
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-white/10">
                  <div className="text-[11px] font-bold text-cyan-300 leading-tight">
                    Actual: <span className="text-white">{meta.levelLabels[curLvl]}</span>
                    {!isMax && (
                      <span className="text-emerald-300 ml-1.5">
                        ➔ {meta.levelLabels[curLvl + 1]}
                      </span>
                    )}
                  </div>

                  {isMax ? (
                    <span className="px-2.5 py-1.5 rounded-lg bg-emerald-950/90 border border-emerald-400/70 text-[11px] font-black text-emerald-300 whitespace-nowrap shrink-0">
                      ✓ MÁX 3/3
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={!canAfford}
                      data-testid={`buy-upgrade-${uId}`}
                      onClick={() => onBuyUpgrade(uId)}
                      className={`apk-touch-target px-3 py-1.5 rounded-xl text-xs font-extrabold transition whitespace-nowrap shrink-0 inline-flex items-center justify-center ${
                        canAfford
                          ? 'bg-yellow-400 hover:bg-yellow-300 text-slate-950 border-2 border-slate-950 shadow-[0_2px_0_#0f172a] cursor-pointer'
                          : 'bg-amber-950 text-amber-500 border border-amber-800 cursor-not-allowed'
                      }`}
                    >
                      Mejorar · 🪙 {nextCost}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

type QuickGuideTab = 'weapons' | 'synergies' | 'fusions';

const QUICK_GUIDE_WEAPONS: readonly {
  icon: string;
  name: string;
  role: string;
  phrase: string;
}[] = [
  { icon: '🔫', name: 'Flus-Flus', role: 'Disparo', phrase: 'Disparo rápido frontal que moja.' },
  { icon: '🧽', name: 'Estropajo', role: 'Frena', phrase: 'Espuma que frena y divide ×5.' },
  { icon: '⚡', name: 'Aerosol UV', role: 'Rayo Par', phrase: 'Une dos iguales en fila.' },
  { icon: '🧼', name: 'Jabón 45°', role: 'Rebote 45°', phrase: 'Desvía bichos al carril vecino.' },
  { icon: '🌪️', name: 'Fregona', role: 'Empuje 360°', phrase: 'Gira mojando y empuja atrás.' },
  { icon: '📐', name: 'Escuadra 90°', role: 'Rebote 90°', phrase: 'Gira bichos laterales hacia abajo.' },
  { icon: '🛡️', name: 'Gel WC', role: 'Escudo', phrase: 'Bloquea y rebota ácido enemigo.' },
  { icon: '🧪', name: 'Lejía', role: 'Ola', phrase: 'Chorro pesado que arrasa carril.' },
];

const QUICK_GUIDE_SYNERGIES: readonly {
  icons: string;
  name: string;
  phrase: string;
}[] = [
  { icons: '🔫 ➔ 🧽', name: 'Abanico ×5', phrase: 'Flus-Flus detrás abre cinco burbujas.' },
  { icons: '⚡ ➕ ⚡', name: 'Puente UV', phrase: 'Dos en fila funden escudos.' },
  { icons: '🧼 ➔ 🌪️', name: 'Vórtice 3★', phrase: 'Jabón desvía directo a Fregona.' },
  { icons: '💧 ➕ ⚡', name: 'Arco Eléctrico', phrase: 'Plaga mojada propaga rayo UV.' },
  { icons: '❄️ ➕ ⚡', name: 'Choque Térmico', phrase: 'Frío más calor rompe corazas.' },
];

const QUICK_GUIDE_FUSIONS: readonly {
  icons: string;
  name: string;
  phrase: string;
}[] = [
  { icons: '⬆️ 1+1', name: 'Plata y Oro', phrase: 'Arrastra iguales para subir nivel.' },
  { icons: '🧼+🌪️', name: 'Vórtice Centrífugo', phrase: 'Oro + Oro atrae y tritura.' },
  { icons: '⚡+🧽', name: 'Cañón Plasma UV', phrase: 'Olas anchas perforan todo escudo.' },
  { icons: '🔫+📐', name: 'Ricochet ×4', phrase: 'Ráfaga que rebota cuatro veces.' },
  { icons: '⚡+⚡', name: 'Bobina Tesla', phrase: 'Torre autónoma de rayos encadenados.' },
  { icons: '🔫+🧼', name: 'Mortero Espuma', phrase: 'Bomba espumosa al grupo denso.' },
];

export const QuickGuideModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [tab, setTab] = useState<QuickGuideTab>('weapons');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Guía Rápida Visual"
      data-testid="quick-guide-modal"
      className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-5"
    >
      <div className="w-full max-w-md max-h-[88dvh] flex flex-col rounded-2xl bg-slate-950 border-3 border-yellow-400 text-amber-50 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800 shrink-0">
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-cyan-300">
              SIN PARRAFADAS · LECTURA AL VUELO
            </div>
            <h2 className="text-base sm:text-lg font-display font-black text-yellow-300">
              ❓ GUÍA RÁPIDA VISUAL
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar Guía Rápida"
            className="apk-touch-target px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-extrabold text-white border border-slate-600 cursor-pointer"
          >
            ✕ Cerrar
          </button>
        </div>

        <div
          role="tablist"
          aria-label="Secciones de la Guía Rápida"
          className="grid grid-cols-3 gap-1.5 p-2.5 bg-slate-900/80 border-b border-slate-800 shrink-0"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'weapons'}
            onClick={() => setTab('weapons')}
            className={`py-2 rounded-xl text-xs font-black border cursor-pointer transition ${
              tab === 'weapons'
                ? 'bg-yellow-400 text-slate-950 border-slate-950'
                : 'bg-slate-950 text-slate-200 border-slate-700'
            }`}
          >
            🔫 Armas
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'synergies'}
            onClick={() => setTab('synergies')}
            className={`py-2 rounded-xl text-xs font-black border cursor-pointer transition ${
              tab === 'synergies'
                ? 'bg-cyan-400 text-slate-950 border-slate-950'
                : 'bg-slate-950 text-slate-200 border-slate-700'
            }`}
          >
            ⚡ Sinergias
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'fusions'}
            onClick={() => setTab('fusions')}
            className={`py-2 rounded-xl text-xs font-black border cursor-pointer transition ${
              tab === 'fusions'
                ? 'bg-fuchsia-400 text-slate-950 border-slate-950'
                : 'bg-slate-950 text-slate-200 border-slate-700'
            }`}
          >
            🌀 Fusiones Rush
          </button>
        </div>

        <div className="p-3 space-y-2 overflow-y-auto">
          {tab === 'weapons' &&
            QUICK_GUIDE_WEAPONS.map((w) => (
              <div
                key={w.name}
                className="flex items-center gap-3 rounded-xl bg-slate-900/90 border border-slate-800 px-3 py-2"
              >
                <span className="text-2xl leading-none shrink-0">{w.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-display font-black text-white">{w.name}</span>
                    <span className="px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-400/60 text-[9.5px] font-black text-cyan-300">
                      {w.role}
                    </span>
                  </div>
                  <p className="text-[11px] font-bold text-amber-100/95 mt-0.5">{w.phrase}</p>
                </div>
              </div>
            ))}

          {tab === 'synergies' &&
            QUICK_GUIDE_SYNERGIES.map((s) => (
              <div
                key={s.name}
                className="flex items-center gap-3 rounded-xl bg-slate-900/90 border border-slate-800 px-3 py-2.5"
              >
                <span className="px-2 py-1 rounded-lg bg-slate-950 border border-cyan-400/50 text-sm font-black shrink-0">
                  {s.icons}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-display font-black text-cyan-300">{s.name}</div>
                  <p className="text-[11px] font-bold text-white mt-0.5">{s.phrase}</p>
                </div>
              </div>
            ))}

          {tab === 'fusions' &&
            QUICK_GUIDE_FUSIONS.map((f) => (
              <div
                key={f.name}
                className="flex items-center gap-3 rounded-xl bg-slate-900/90 border border-slate-800 px-3 py-2.5"
              >
                <span className="px-2 py-1 rounded-lg bg-slate-950 border border-yellow-400/60 text-sm font-black shrink-0">
                  {f.icons}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-display font-black text-yellow-300">{f.name}</div>
                  <p className="text-[11px] font-bold text-white mt-0.5">{f.phrase}</p>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

const METRICS_BUG_LABELS: Record<string, string> = {
  speed_ant: '🐜 Hormiga',
  cap_beetle: '🛡️ Rata blindada',
  acid_wasp: '🦟 Mosca ácida',
  shift_roach: '🪳 Cucaracha',
  king_crab: '👑 Jefe',
};

function formatSeconds(total: number): string {
  const m = Math.floor(total / 60);
  const s = Math.round(total % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Local match metrics (stored only on this device) with a copy button for beta testers. */
const MetricsPanel: React.FC = () => {
  const [store] = useState(() => loadMetrics());
  const [copied, setCopied] = useState<string | null>(null);
  const summary = summarizeMetrics(store);

  if (summary.totalMatches === 0) {
    return (
      <div className="rounded-xl bg-slate-950/60 border border-slate-700/70 p-2.5 text-[11px] text-slate-300">
        📊 Métricas: juega una partida para empezar a medir.
      </div>
    );
  }

  const rows: [string, string][] = [
    ['Partidas', `${summary.totalMatches} en ${summary.daysPlayed} día${summary.daysPlayed === 1 ? '' : 's'}`],
    ['Supervivencia', summary.rush.runs ? `${summary.rush.runs} · mejor ${formatSeconds(summary.rush.bestSeconds)} · mediana ${formatSeconds(summary.rush.medianSeconds)}` : '—'],
    ['Campaña', summary.strategic.matches ? `${Math.round(summary.strategic.winRate * 100)}% victorias · atasco Nv.${summary.strategic.hardestLevel ?? '—'}` : '—'],
    ['Bajas con combo', `${Math.round(summary.comboKillShare * 100)}%`],
    ['Más platos rompe', summary.topBreachCause ? METRICS_BUG_LABELS[summary.topBreachCause] ?? summary.topBreachCause : '—'],
  ];

  return (
    <div className="rounded-xl bg-slate-950/60 border border-slate-700/70 p-2.5 space-y-1.5" data-testid="metrics-panel">
      <div className="text-[10px] font-black uppercase tracking-wider text-cyan-300">📊 Métricas (solo en este móvil)</div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[11px]">
        {rows.map(([k, v]) => (
          <React.Fragment key={k}>
            <dt className="text-slate-400">{k}</dt>
            <dd className="text-slate-100 font-semibold text-right">{v}</dd>
          </React.Fragment>
        ))}
      </dl>
      <button
        type="button"
        data-testid="export-metrics-btn"
        onClick={async () => {
          const json = exportMetrics(store);
          try {
            await navigator.clipboard?.writeText(json);
            setCopied('✓ Métricas copiadas: pégalas en un mensaje.');
          } catch {
            setCopied('No se pudo copiar automáticamente.');
          }
        }}
        className="w-full py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-cyan-200 border border-cyan-500/60 font-bold text-[11px] cursor-pointer transition"
      >
        📊 Copiar métricas
      </button>
      {copied && <p className="text-[10.5px] font-bold text-emerald-300">{copied}</p>}
    </div>
  );
};
