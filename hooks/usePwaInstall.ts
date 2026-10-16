import { useSyncExternalStore } from 'react';
import { getInstallSnapshot, isIosDevice, promptInstall, subscribeInstall } from '../pwa';

/**
 * Stato dell'installazione dell'app (PWA) per il pulsante «Installa app» in Impostazioni.
 *  - canInstall: il browser (Chrome, Edge, Samsung Internet...) offre l'installazione e `install()` mostra la sua finestra;
 *  - installed:  l'app sta girando installata, oppure è stata appena installata;
 *  - isIos:      Safari su iPhone/iPad non ha una finestra di installazione: si mostrano le istruzioni (menu Condividi).
 */
export function usePwaInstall() {
  const { canInstall, installed } = useSyncExternalStore(subscribeInstall, getInstallSnapshot, getInstallSnapshot);
  return { canInstall, installed, isIos: isIosDevice(), install: promptInstall };
}
