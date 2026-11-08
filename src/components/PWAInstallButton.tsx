import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showModal, setShowModal] = useState(false);

  if (isInstalled) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (isInstallable) {
            install();
          } else {
            setShowModal(true);
          }
        }}
        className="pointer-events-auto flex items-center gap-2 rounded-xl bg-amber-950/90 border border-amber-500/50 px-3.5 py-2 text-xs font-bold text-amber-200 hover:bg-amber-900 transition whitespace-nowrap shrink-0"
      >
        <svg className="w-4 h-4 text-amber-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        <span>{isIOS ? 'Instalar en iPhone' : 'Instalar App (PWA)'}</span>
      </button>

      {showModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Instalar Chef Bastion en tu Smartphone"
          className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
        >
          <div className="w-full max-w-sm rounded-2xl bg-amber-950 border-2 border-amber-500 p-6 text-amber-50 shadow-2xl">
            <h3 className="text-lg font-extrabold text-amber-300">
              Instalar CHEF BASTION Fullscreen
            </h3>
            <p className="mt-2 text-sm text-amber-100/90 leading-relaxed">
              {isIOS ? (
                <>
                  1. Toca el botón <strong>Compartir</strong> en la barra de Safari.<br />
                  2. Selecciona <strong>Añadir a pantalla de inicio</strong> para jugar a pantalla completa y 100% offline.
                </>
              ) : (
                <>
                  Abre el menú de tu navegador (<strong>⋮</strong>) y pulsa <strong>Instalar aplicación</strong> o <strong>Añadir a pantalla de inicio</strong> para jugar en modo nativo fullscreen.
                </>
              )}
            </p>
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="mt-5 w-full rounded-xl bg-amber-500 py-2.5 text-sm font-extrabold text-amber-950 hover:bg-amber-400 transition"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
};
