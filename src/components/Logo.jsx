import React from 'react';

const Logo = ({ className = '', size = 'md' }) => {
  const sizes = {
    xs: { width: 30, height: 36, fontSize: '8px' },
    sm: { width: 40, height: 48, fontSize: '10px' },
    md: { width: 60, height: 72, fontSize: '14px' },
    lg: { width: 80, height: 96, fontSize: '18px' },
    xl: { width: 100, height: 120, fontSize: '22px' }
  };

  const { width, height, fontSize } = sizes[size] || sizes.md;

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 100 120"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="32 CBG Badge"
    >
      {/* Dark green background shield */}
      <path
        d="M10 15 C10 5, 90 5, 90 15 L90 75 C90 85, 50 110, 50 110 S10 85, 10 75 Z"
        fill="#0a3622"
        stroke="#d4af37"
        strokeWidth="3"
      />
      
      {/* Gold inner border */}
      <path
        d="M20 25 C20 18, 80 18, 80 25 L80 70 C80 78, 50 95, 50 95 S20 78, 20 70 Z"
        fill="none"
        stroke="#d4af37"
        strokeWidth="1.5"
      />
      
      {/* White crown/maple leaf symbol */}
      <g transform="translate(50, 40)">
        {/* Simplified crown */}
        <path
          d="M-15 -5 L-15 -15 L-10 -10 L-5 -20 L0 -15 L5 -20 L10 -10 L15 -15 L15 -5 Z"
          fill="white"
          stroke="white"
          strokeWidth="1"
        />
        <rect x="-15" y="-5" width="30" height="8" fill="white" />
      </g>
      
      {/* 32 text */}
      <text
        x="50"
        y="75"
        textAnchor="middle"
        fill="#d4af37"
        fontSize={fontSize}
        fontWeight="bold"
        fontFamily="Arial, sans-serif"
      >
        32
      </text>
      
      {/* CBG text */}
      <text
        x="50"
        y="92"
        textAnchor="middle"
        fill="white"
        fontSize={`${parseInt(fontSize) * 0.7}px`}
        fontWeight="bold"
        fontFamily="Arial, sans-serif"
        letterSpacing="1"
      >
        CBG
      </text>
    </svg>
  );
};

export default Logo;