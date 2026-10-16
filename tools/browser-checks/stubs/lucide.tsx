// Sostituto di lucide-react per le prove nel browser: poche icone, SVG semplici (le prove non guardano la forma, solo che ci siano).
import React from 'react';

type IconProps = { size?: number; className?: string; 'aria-hidden'?: boolean | 'true' | 'false' };
const icon = (d: string) => ({ size = 16, className, ...rest }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} {...rest}>
    <path d={d} />
  </svg>
);
export const Check = icon('M20 6 9 17l-5-5');
export const ChevronDown = icon('m6 9 6 6 6-6');
export const Languages = icon('M5 8l6 6M4 14l6-6 2-3M2 5h12M7 2h1M22 22l-5-10-5 10M14 18h6');
export const AlertTriangle = icon('m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3M12 9v4M12 17h.01');
export const Loader = icon('M12 2v4M16.2 7.8l2.9-2.9M18 12h4M16.2 16.2l2.9 2.9M12 18v4M4.9 19.1l2.9-2.9M2 12h4M4.9 4.9l2.9 2.9');
