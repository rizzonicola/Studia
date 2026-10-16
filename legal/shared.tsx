import React from 'react';
import { LEGAL_LAST_UPDATED_ISO } from '../config/appConfig';

/** Link esterno nei testi legali. */
export const A: React.FC<{ href: string; children: React.ReactNode }> = ({ href, children }) => (
  <a href={href} target="_blank" rel="noopener noreferrer">
    {children}
  </a>
);

/** Data di ultimo aggiornamento formattata con Intl nella lingua del documento. */
export const legalDate = (locale: string): string =>
  new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(new Date(`${LEGAL_LAST_UPDATED_ISO}T12:00:00`));
