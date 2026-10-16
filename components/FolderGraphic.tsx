import React from 'react';

interface FolderGraphicProps {
  bodyClassName: string;
  tabClassName: string;
  className?: string;
}

const FolderGraphic: React.FC<FolderGraphicProps> = ({ bodyClassName, tabClassName, className }) => {
  return (
    <svg viewBox="0 0 200 200" className={`w-full h-full ${className}`} aria-hidden="true">
      {/* Back Part / Tab - Darker Color */}
      <path
        d="M20,20 C11.716,20 5,26.716 5,35 v140 c0,8.284 6.716,15 15,15 h160 c8.284,0 15,-6.716 15,-15 V75 c0,-8.284 -6.716,-15 -15,-15 H105 l-15,-40 H20 z"
        className={tabClassName}
      />
      {/* Front Part - Lighter Color */}
      <path
        d="M20,40 C11.716,40 5,46.716 5,55 v120 c0,8.284 6.716,15 15,15 h160 c8.284,0 15,-6.716 15,-15 V55 c0,-8.284 -6.716,-15 -15,-15 H20 z"
        className={bodyClassName}
      />
    </svg>
  );
};

export default FolderGraphic;