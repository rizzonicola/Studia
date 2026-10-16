import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { ArrowLeft } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';

interface BackToHomeDropZoneProps {
  side: 'left' | 'right';
}

const BackToHomeDropZone: React.FC<BackToHomeDropZoneProps> = ({ side }) => {
  const { t } = useI18n();
  const { setNodeRef, isOver } = useDroppable({
    id: `back-to-home-dropzone-${side}`, // FIX: Unique ID for each side
  });

  const sideClasses = side === 'left' ? 'left-0' : 'right-0';
  const baseBg = 'bg-black/55 backdrop-blur-sm';
  const overBg = 'bg-accent/90';

  return (
    <div
      ref={setNodeRef}
      role="presentation"
      title={t('items.backHome')}
      className={`fixed top-0 h-full w-16 md:w-28 z-50 flex items-center justify-center transition-colors duration-200 ${sideClasses}`}
    >
      <div className={`absolute inset-0 transition-colors ${isOver ? overBg : baseBg}`}></div>
      <div className={`relative flex flex-col items-center px-2 text-center ${isOver ? 'text-accent-fg' : 'text-white'}`}>
        <ArrowLeft size={32} className={`transition-transform duration-200 ${isOver ? 'scale-125' : ''} ${side === 'right' ? 'rotate-180' : ''}`} />
        {/* Con il mouse c'è spazio per dire cosa succede rilasciando qui */}
        <span className="hidden md:block mt-3 text-xs font-medium leading-snug">{t('items.backHome')}</span>
      </div>
    </div>
  );
};

export default BackToHomeDropZone;
