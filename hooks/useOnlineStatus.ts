import { useSyncExternalStore } from 'react';

const subscribe = (onChange: () => void): (() => void) => {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
};

/** Vero se il browser dice di essere online (eventi "online"/"offline"). Non garantisce che Internet funzioni davvero, ma "offline" è affidabile. */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
}
