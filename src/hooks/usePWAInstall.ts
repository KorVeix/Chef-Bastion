import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
}

export interface NativeRuntimeProbeInput {
  protocol?: string;
  userAgent?: string;
  referrer?: string;
  displayModeStandalone?: boolean;
  displayModeFullscreen?: boolean;
  navigatorStandalone?: boolean;
  hasCapacitorGlobal?: boolean;
  capacitorIsNative?: boolean;
  hasCordovaGlobal?: boolean;
}

/**
 * Pure detector for Capacitor, Cordova, Android/iOS native WebViews, and installed standalone PWAs.
 * When true, any "Instalar App (PWA)" prompt/button MUST be completely hidden.
 */
export function detectNativeOrStandaloneRuntime(probe: NativeRuntimeProbeInput): boolean {
  if (probe.capacitorIsNative || probe.hasCapacitorGlobal || probe.hasCordovaGlobal) {
    return true;
  }
  if (probe.displayModeStandalone || probe.displayModeFullscreen || probe.navigatorStandalone) {
    return true;
  }
  const protocol = (probe.protocol ?? '').toLowerCase();
  if (protocol === 'capacitor:' || protocol === 'ionic:' || protocol === 'file:' || protocol === 'app:') {
    return true;
  }
  const referrer = (probe.referrer ?? '').toLowerCase();
  if (referrer.startsWith('android-app://') || referrer.startsWith('ios-app://')) {
    return true;
  }
  const ua = (probe.userAgent ?? '').toLowerCase();
  // Android WebView token ("; wv)" or " wv ")
  if (/;\s*wv\)|\bwv\b/.test(ua) && /android/.test(ua)) {
    return true;
  }
  // iOS WKWebView inside native wrapper (iPhone/iPad without Safari/CriOS/FxiOS)
  if (/(iphone|ipod|ipad)/.test(ua) && !/safari|crios|fxios|edgios/.test(ua)) {
    return true;
  }
  return false;
}

function checkLiveNativeOrStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const win = window as unknown as {
    Capacitor?: CapacitorGlobal;
    cordova?: unknown;
  };
  const cap = win.Capacitor;
  const capacitorIsNative =
    typeof cap?.isNativePlatform === 'function'
      ? Boolean(cap.isNativePlatform())
      : typeof cap?.getPlatform === 'function'
      ? cap.getPlatform() !== 'web'
      : Boolean(cap);

  return detectNativeOrStandaloneRuntime({
    protocol: window.location?.protocol,
    userAgent: window.navigator?.userAgent,
    referrer: typeof document !== 'undefined' ? document.referrer : '',
    displayModeStandalone: window.matchMedia?.('(display-mode: standalone)')?.matches ?? false,
    displayModeFullscreen: window.matchMedia?.('(display-mode: fullscreen)')?.matches ?? false,
    navigatorStandalone:
      (window.navigator as unknown as { standalone?: boolean })?.standalone === true,
    hasCapacitorGlobal: Boolean(cap),
    capacitorIsNative,
    hasCordovaGlobal: Boolean(win.cordova),
  });
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isNativeOrStandalone, setIsNativeOrStandalone] = useState<boolean>(() =>
    checkLiveNativeOrStandalone()
  );
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const nativeOrStandalone = checkLiveNativeOrStandalone();
    setIsNativeOrStandalone(nativeOrStandalone);

    // Completely suppress PWA install prompts inside Capacitor, WebViews, or standalone mode
    if (nativeOrStandalone) {
      setDeferredPrompt(null);
      setIsIOS(false);
      return;
    }

    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      if (checkLiveNativeOrStandalone()) {
        setIsNativeOrStandalone(true);
        setDeferredPrompt(null);
        return;
      }
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsNativeOrStandalone(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (isNativeOrStandalone || !deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsNativeOrStandalone(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return {
    isInstallable: !isNativeOrStandalone && Boolean(deferredPrompt),
    isInstalled: isNativeOrStandalone,
    isNativeOrStandalone,
    shouldShowInstallUI: !isNativeOrStandalone && Boolean(deferredPrompt),
    isIOS: !isNativeOrStandalone && isIOS,
    install,
  };
}
