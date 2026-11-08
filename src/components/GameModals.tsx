import React from 'react';
import {
  ACHIEVEMENTS_CATALOG,
  ARMORS_CATALOG,
  HATS_CATALOG,
  SPECIAL_WEAPONS_CATALOG,
} from '../game/rules';
import {
  ArmorId,
  ComicPopEvent,
  FloatingComboEvent,
  HatId,
  PlayerProgress,
  SpecialWeaponId,
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
            Une 2 Aerosoles UV en paralelo o usa Jabón para abrir su escudo
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
      className="pointer-events-none fixed inset-x-0 top-24 z-40 flex justify-center px-4"
    >
      <div
        className={`transform -rotate-2 border-4 px-5 py-2.5 rounded-2xl shadow-[5px_5px_0px_#0f172a] transition-transform duration-150 ${bgMap[pop.color]}`}
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

export const AchievementsCodexModal: React.FC<CodexModalProps> = ({
  progress,
  onClose,
  onBuyAchievement,
}) => {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Álbum de Plagas 3 Estrellas y Tienda de Desbloqueo"
      className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-6"
    >
      <div className="w-full max-w-xl max-h-[88dvh] flex flex-col rounded-2xl bg-amber-950 border-2 border-amber-500/80 text-amber-50 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-amber-800/80 bg-amber-900/60">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-amber-300 tracking-tight">
              ÁLBUM 3★ Y DESBLOQUEO ANTI-ESTANCAMIENTO
            </h2>
            <p className="text-xs text-amber-200/80 mt-0.5">
              Ejecuta la receta con iconos en partida o desbloquea el premio al instante
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono tabular-nums text-sm font-extrabold text-yellow-300">
              🪙 {progress.coins}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar Álbum"
              className="rounded-xl bg-amber-800 hover:bg-amber-700 px-3 py-1.5 text-xs font-extrabold text-amber-100"
            >
              Cerrar
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-4 space-y-3">
          {ACHIEVEMENTS_CATALOG.map((ach) => {
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
                          ? 'bg-yellow-400 text-slate-950 hover:bg-yellow-300 shadow'
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
