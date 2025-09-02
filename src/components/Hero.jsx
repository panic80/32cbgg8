import React from 'react';
import LogoImage from './LogoImage';

function Hero() {
  return (
    <div className="hero pt-20 text-center">
      <div className="flex flex-col items-center mb-6">
        <LogoImage size="xl" className="mb-6 drop-shadow-2xl" />
        <h1 className="h1 text-fluid-5xl font-bold text-balance text-[var(--text)]">
          32 CBG Policy Assistant
        </h1>
      </div>
      <p className="body-lg text-fluid-lg text-secondary max-w-2xl mx-auto text-pretty">
        Your Army in the CFA and Niagara - Get instant answers to your policy questions
      </p>
    </div>
  );
}

export default Hero;
