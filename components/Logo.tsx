
import React from 'react';

interface LogoProps {
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ className = 'w-8 h-8' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" className={`${className} text-gray-900`} aria-hidden="true" focusable="false">
    <g style={{ fill: 'currentColor', stroke: 'currentColor', strokeWidth: 6, strokeLinejoin: 'round' }} transform="translate(18.9, -18.2)">
      <path d="M 76.7 159.5 L 386 163.6 C 420.5 169.5 415.3 224.4 391.2 227.7 C 391.2 227.7 287 225.8 78.5 221.9 C 81.4 222.2 135.4 195.6 76.7 159.5 Z" />
      <path d="M 96.8 242.3 L 387.5 247.5 C 410.1 250 408.1 288.3 392.1 289.7 C 392.1 289.7 293.5 287 96.2 281.6 C 101.9 279.8 131.1 260.3 96.8 242.3 Z" />
      <path d="M 50.5 299.1 L 393.8 308.9 C 424.3 314.1 424.1 366.6 403.6 369 C 403.6 369 286.1 368.8 51 368.4 C 57.5 369.2 102.6 332.8 50.5 299.1 Z" />
    </g>
  </svg>
);

export default Logo;
