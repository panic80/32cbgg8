import React from 'react';
import logoImg from '../assets/logo.png';

const LogoImage = ({ className = '', size = 'md' }) => {
  const sizes = {
    xs: { width: 40, height: 48 },
    sm: { width: 60, height: 72 },
    md: { width: 100, height: 120 },
    lg: { width: 150, height: 180 },
    xl: { width: 200, height: 240 }
  };

  const { width, height } = sizes[size] || sizes.md;

  return (
    <img
      src={logoImg}
      alt="32 CBG Badge"
      width={width}
      height={height}
      className={className}
      style={{ objectFit: 'contain' }}
    />
  );
};

export default LogoImage;