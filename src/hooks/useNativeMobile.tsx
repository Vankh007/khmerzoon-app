import { useMemo } from 'react';
import { Capacitor } from '@capacitor/core';

/**
 * Hook to detect if running as a native mobile app (Capacitor)
 * and which platform we're on
 */
export function useNativeMobile() {
  return useMemo(() => {
    const isNative = Capacitor.isNativePlatform();
    const platform = Capacitor.getPlatform();
    
    return {
      isNative,
      platform,
      isAndroid: isNative && platform === 'android',
      isIOS: isNative && platform === 'ios',
      isWeb: !isNative || platform === 'web',
    };
  }, []);
}

/**
 * Static helpers for use outside of React components
 */
export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

export function isAndroidNative(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

export function isIOSNative(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
}

export function getNativePlatform(): 'android' | 'ios' | 'web' {
  if (!Capacitor.isNativePlatform()) return 'web';
  const platform = Capacitor.getPlatform();
  if (platform === 'android') return 'android';
  if (platform === 'ios') return 'ios';
  return 'web';
}
