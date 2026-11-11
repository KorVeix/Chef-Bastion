import React, { useState } from 'react';
import { soundEngine } from '../game/audio';
import {
  ACHIEVEMENTS_CATALOG,
  ARMORS_CATALOG,
  DEFAULT_SETTINGS,
  HATS_CATALOG,
  SPECIAL_WEAPONS_CATALOG,
} from '../game/rules';
import {
  ArmorId,
  BugType,
  ComicPopEvent,
  FloatingComboEvent,
  GameSettings,
  HatId,
  PlayerProgress,
  SpecialWeaponId,
  TacticalOnboardingCardData,
} from '../game/types';

function getHorizontalAnchorClass(xPct: number): string {
  if (xPct < 30) return 'left-[24%]';
  if (xPct < 50) return 'left-[40%]';
  if (xPct < 68) return 'left-[60%]';
  return 'left-[76%]';
}

function getVerticalAnchorClass(yPct: number): string {
  if (yPct < 32) return 'top-[28%]';
  if (yPct < 42) return 'top-[36%]';
  if (yPct < 52) return 'top-[45%]';
  return 'top-[54%]';
}

export const FloatingComboLayer: React.FC<{ combos: FloatingComboEvent[] }> = ({ combos }) => {
  if (combos.length === 0) return null;

  const badgeColors: Record<FloatingComboEvent['color'], string> = {
    yellow: 'bg-yellow-400 text-slate-950 border-slate-950',
    cyan: 'bg-cyan-400 text-slate-950 border-slate-950',
    orange: 'bg-orange-500 text-white border-slate-950',
    pink: 'bg-pink-400 text-slate-950 border-slate-950',
    green: 'bg-lime-400 text-slate-950 border-slate-950',
  };

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-0 z-30 overflow-hidden"
    >
      {combos.map((item) => (
        <div
          key={item.id}
          data-testid="floating-combo-toast"
          className={`fixed ${getHorizontalAnchorClass(item.xPct)} ${getVerticalAnchorClass(
            item.yPct
          )} animate-combo-float`}
        >
          <div
            className={`border-[3px] px-3.5 py-1.5 rounded-2xl shadow-[0_4px_0_#0f172a] whitespace-nowrap ${badgeColors[item.color]}`}
          >
            <div className="flex items-center justify-center gap-1.5">
              <span className="font-display font-black italic text-base sm:text-lg uppercase tracking-tight leading-none drop-shadow-[0_1px_0_rgba(255,255,255,0.4)]">
                {item.label}
              </span>
            </div>
            <div className="text-[11px] font-black uppercase tracking-tight text-center leading-tight mt-0.5 opacity-95">
              {item.detail}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export const ComicPopBanner: React.FC<{ pop: ComicPopEvent | null }> = ({ pop }) => {
  if (!pop) return null;

  if (pop.id.startsWith('shield-block')) {
    return (
      <div
        aria-live="polite"
        className="pointer-events-none fixed left-2 top-24 z-40 max-w-[175px]"
      >
        <div className="bg-[#fef9e7] text-slate-950 border-[3px] border-slate-950 px-2.5 py-2 rounded-xl shadow-[0_4px_0_#0f172a]">
          <div className="flex items-center gap-1.5">
            <svg viewBox="0 0 24 24" className="w-6 h-6 shrink-0" aria-hidden="true">
              <path
                d="M12 2 L20 5.5 V11.5 C20 16.8 16.5 20.8 12 22 C7.5 20.8 4 16.8 4 11.5 V5.5 Z"
                fill="#3b82f6"
                stroke="#0f172a"
                strokeWidth="2.2"
              />
              <path
                d="M12 4.2 V19.8 C15.2 18.7 17.8 15.5 17.8 11.5 V6.8 Z"
                fill="#60a5fa"
              />
            </svg>
            <div className="text-xs font-black uppercase leading-none tracking-tight text-slate-950">
              ¡BLINDADO!
              <br />0 DAÑO
            </div>
          </div>
          <p className="text-[10px] font-bold leading-tight text-slate-800 mt-1">
            Une 2 ⚡ Aerosoles UV en paralelo o usa Jabón para abrir su escudo
          </p>
        </div>
      </div>
    );
  }

  const bgMap: Record<ComicPopEvent['color'], string> = {
    yellow: 'bg-yellow-400 text-slate-950 border-slate-950',
    cyan: 'bg-cyan-400 text-slate-950 border-slate-950',
    orange: 'bg-orange-500 text-white border-slate-950',
    pink: 'bg-pink-400 text-slate-950 border-slate-950',
    green: 'bg-lime-400 text-slate-950 border-slate-950',
  };

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-20 z-40 flex justify-center px-4"
    >
      <div
        className={`transform -rotate-1 border-3 px-4 py-1.5 rounded-2xl shadow-[4px_4px_0px_#0f172a] transition-transform duration-150 ${bgMap[pop.color]}`}
      >
        <div className="flex items-center gap-2 justify-center">
          {pop.stars && (
            <span className="text-lg font-black tracking-tighter">
              {'★'.repeat(pop.stars)}
            </span>
          )}
          <span className="text-xl sm:text-2xl font-black italic tracking-tight uppercase">
            {pop.title}
          </span>
        </div>
        <p className="text-xs font-extrabold text-center mt-0.5 opacity-95">
          {pop.subtitle}
        </p>
      </div>
    </div>
  );
};

interface CodexModalProps {
  progress: PlayerProgress;
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
  onClose,
  onBuyAchievement,
}) => {
  const [activePage, setActivePage] = useState<'all' | BugType>('all');
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

        <div className="overflow-y-auto p-4 space-y-3">
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
  onClose: () => void;
  onEquipHat: (hat: HatId) => void;
  onEquipArmor: (armor: ArmorId) => void;
  onEquipSpecial: (spec: SpecialWeaponId) => void;
}

export const ChefWardrobeModal: React.FC<WardrobeModalProps> = ({
  progress,
  onClose,
  onEquipHat,
  onEquipArmor,
  onEquipSpecial,
}) => {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Armería y Vestuario 3D del Chef Bastion"
      className="pointer-events-auto fixed inset-0 z-50 flex flex-col justify-between bg-gradient-to-b from-transparent via-black/25 to-black/90 p-2.5 sm:p-5"
    >
      {/* Top Live 3D Preview Window Header (Leaves the upper 40% clear so the 3D Chef is visible live!) */}
      <div className="flex items-center justify-between max-w-xl w-full mx-auto pt-1">
        <div className="bg-amber-950/90 border-2 border-yellow-400/80 px-3 py-1.5 rounded-xl shadow-lg">
          <span className="text-[11px] sm:text-xs font-extrabold text-yellow-300 tracking-wide">
            👨‍🍳 VISTA 3D EN VIVO · PULSA EQUIPAR PARA PROBAR
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar Vestuario"
          className="rounded-xl bg-amber-900 border-2 border-amber-400 hover:bg-amber-800 px-3.5 py-1.5 text-xs font-black text-white shadow-lg"
        >
          ✕ Cerrar
        </button>
      </div>

      {/* Bottom Sheet Drawer (60% height) so the 3D Chef above is never covered */}
      <div className="w-full max-w-xl mx-auto max-h-[58dvh] flex flex-col rounded-2xl bg-amber-950/95 border-2 border-amber-500/90 text-amber-50 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-amber-800/80 bg-amber-900/70">
          <div>
            <h2 className="text-sm sm:text-base font-black text-amber-300">
              VESTUARIO 3D Y ARMAS ÉLITE DEL CHEF
            </h2>
          </div>
          <span className="text-[11px] font-bold text-cyan-300">
            {HATS_CATALOG[progress.equippedHat].name}
          </span>
        </div>

        <div className="overflow-y-auto p-3.5 space-y-4">
          {/* Gorros / Pelos */}
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-amber-300 mb-2">
              1. Gorros y Cascos Sanitarios (3D)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {(Object.keys(HATS_CATALOG) as HatId[]).map((hId) => {
                const h = HATS_CATALOG[hId];
                const unlocked = progress.unlockedHats.includes(hId);
                const active = progress.equippedHat === hId;
                return (
                  <button
                    key={hId}
                    type="button"
                    disabled={!unlocked}
                    onClick={() => onEquipHat(hId)}
                    className={`text-left p-3 rounded-xl border transition ${
                      active
                        ? 'bg-cyan-950 border-cyan-400'
                        : unlocked
                        ? 'bg-amber-900/50 border-amber-700 hover:border-amber-400'
                        : 'bg-black/40 border-amber-900/50 opacity-60 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-white">{h.name}</span>
                      <span className="text-xs font-bold text-cyan-300">
                        {active ? 'EQUIPADO' : unlocked ? 'Equipar' : '🔒 Logro'}
                      </span>
                    </div>
                    <p className="text-xs text-amber-200/80 mt-1">{h.bonus}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Armaduras */}
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-amber-300 mb-2">
              2. Trajes y Armaduras de Cocina (3D)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {(Object.keys(ARMORS_CATALOG) as ArmorId[]).map((aId) => {
                const a = ARMORS_CATALOG[aId];
                const unlocked = progress.unlockedArmors.includes(aId);
                const active = progress.equippedArmor === aId;
                return (
                  <button
                    key={aId}
                    type="button"
                    disabled={!unlocked}
                    onClick={() => onEquipArmor(aId)}
                    className={`text-left p-3 rounded-xl border transition ${
                      active
                        ? 'bg-cyan-950 border-cyan-400'
                        : unlocked
                        ? 'bg-amber-900/50 border-amber-700 hover:border-amber-400'
                        : 'bg-black/40 border-amber-900/50 opacity-60 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-white">{a.name}</span>
                      <span className="text-xs font-bold text-cyan-300">
                        {active ? '✓' : unlocked ? 'Usar' : '🔒'}
                      </span>
                    </div>
                    <p className="text-xs text-amber-200/80 mt-1">{a.bonus}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Armas Especiales (Ultimate) */}
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-amber-300 mb-2">
              3. Arma Especial Ultimate (Manómetro 100%)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {(Object.keys(SPECIAL_WEAPONS_CATALOG) as SpecialWeaponId[]).map((sId) => {
                const s = SPECIAL_WEAPONS_CATALOG[sId];
                const unlocked = progress.unlockedSpecials.includes(sId);
                const active = progress.equippedSpecial === sId;
                return (
                  <button
                    key={sId}
                    type="button"
                    disabled={!unlocked}
                    onClick={() => onEquipSpecial(sId)}
                    className={`text-left p-3 rounded-xl border transition ${
                      active
                        ? 'bg-cyan-950 border-cyan-400'
                        : unlocked
                        ? 'bg-amber-900/50 border-amber-700 hover:border-amber-400'
                        : 'bg-black/40 border-amber-900/50 opacity-60 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-white">
                        {s.icon} {s.name}
                      </span>
                      <span className="text-xs font-bold text-cyan-300">
                        {active ? '✓' : unlocked ? 'Usar' : '🔒'}
                      </span>
                    </div>
                    <p className="text-xs text-amber-200/80 mt-1">{s.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>
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
  onUpdateSettings: (next: Partial<GameSettings>) => void;
  onResetDefaults: () => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  onUpdateSettings,
  onResetDefaults,
  onClose,
}) => {
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
      className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-5"
    >
      <div className="w-full max-w-md rounded-2xl bg-amber-950 border-4 border-amber-500 text-amber-50 shadow-2xl overflow-hidden flex flex-col max-h-[90dvh]">
        {/* Header */}
        <div className="bg-amber-900/95 border-b-2 border-amber-700 px-5 py-3.5 flex items-center justify-between gap-2 shrink-0">
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-yellow-300">
              CONFIGURACIÓN TÁCTICA Y SONIDO
            </div>
            <h2 className="text-xl font-display font-black text-white leading-tight">
              ⚙️ AJUSTES DEL JUEGO
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar Ajustes"
            className="px-3 py-1.5 rounded-xl bg-amber-800 hover:bg-amber-700 text-xs font-extrabold text-white border border-amber-500/60 cursor-pointer transition"
          >
            ✕ Cerrar
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
          {/* 1. Audio & Volume Controls */}
          <div className="rounded-xl bg-amber-900/60 border border-amber-700/80 p-3.5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-yellow-300">
                🔊 Audio y Volumen
              </h3>
              <button
                type="button"
                onClick={() => onUpdateSettings({ muted: !settings.muted })}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold border transition cursor-pointer ${
                  settings.muted
                    ? 'bg-rose-950 border-rose-400 text-rose-200'
                    : 'bg-emerald-950 border-emerald-400 text-emerald-200'
                }`}
              >
                {settings.muted ? '🔇 Silenciado' : '🔊 Sonido Activo'}
              </button>
            </div>

            {/* Master Volume */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs font-bold">
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
                className="w-full accent-yellow-400 cursor-pointer h-2 rounded-lg bg-amber-950"
              />
            </div>

            {/* SFX Volume */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs font-bold">
                <label htmlFor="slider-sfx-vol" className="text-amber-100">
                  Efectos FX (Disparos y Combos)
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => soundEngine.playSnapPiece(true)}
                    className="px-2 py-0.5 rounded bg-cyan-950 hover:bg-cyan-900 border border-cyan-400/60 text-[10px] font-black text-cyan-200 cursor-pointer"
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
                className="w-full accent-cyan-400 cursor-pointer h-2 rounded-lg bg-amber-950"
              />
            </div>

            {/* Background Music Volume */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs font-bold">
                <label htmlFor="slider-bgm-vol" className="text-amber-100">
                  Música de Fondo (Cambia cada 10 Nv.)
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
                className="w-full accent-emerald-400 cursor-pointer h-2 rounded-lg bg-amber-950"
              />
            </div>
          </div>

          {/* 2. Gameplay Parameters */}
          <div className="rounded-xl bg-amber-900/60 border border-amber-700/80 p-3.5 space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-yellow-300">
              🎮 Parámetros de Jugabilidad
            </h3>

            {/* Game Speed Multiplier */}
            <div className="space-y-1.5">
              <div className="text-xs font-bold text-amber-100">
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
                      className={`py-2 px-2 rounded-xl text-[11px] font-black border transition cursor-pointer ${
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
            <div className="space-y-1.5">
              <div className="text-xs font-bold text-amber-100">
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
                      className={`py-2 px-2 rounded-xl text-[11px] font-black border transition cursor-pointer ${
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

            {/* Tactical Slow-Mo Toggle & Screen Shake Toggle */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({ tacticalSlowMo: !settings.tacticalSlowMo })
                }
                className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                  settings.tacticalSlowMo
                    ? 'bg-cyan-950/90 border-cyan-400 text-white'
                    : 'bg-amber-950/70 border-amber-800 text-amber-300/70'
                }`}
              >
                <div className="text-[11px] font-black flex items-center justify-between">
                  <span>⏱️ Cámara Lenta al Mover</span>
                  <span className="text-cyan-300">
                    {settings.tacticalSlowMo ? 'ON' : 'OFF'}
                  </span>
                </div>
                <div className="text-[10px] text-amber-200/80 mt-0.5">
                  Ralentiza al 20% al recolocar piezas en combate
                </div>
              </button>

              <button
                type="button"
                onClick={() => onUpdateSettings({ screenShake: !settings.screenShake })}
                className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                  settings.screenShake
                    ? 'bg-cyan-950/90 border-cyan-400 text-white'
                    : 'bg-amber-950/70 border-amber-800 text-amber-300/70'
                }`}
              >
                <div className="text-[11px] font-black flex items-center justify-between">
                  <span>💥 Vibración de Cámara</span>
                  <span className="text-cyan-300">
                    {settings.screenShake ? 'ON' : 'OFF'}
                  </span>
                </div>
                <div className="text-[10px] text-amber-200/80 mt-0.5">
                  Sacudida en bajas 3★ y ataques Ultimate
                </div>
              </button>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => {
                onResetDefaults();
                soundEngine.applySettings(DEFAULT_SETTINGS);
              }}
              className="flex-1 py-2.5 rounded-xl bg-amber-900/80 hover:bg-amber-800 text-amber-200 font-bold text-xs border border-amber-700 cursor-pointer transition"
            >
              Restaurar por Defecto
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-display font-black text-sm border-2 border-slate-950 shadow-[0_3px_0_#0f172a] cursor-pointer transition"
            >
              Guardar y Volver
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};



