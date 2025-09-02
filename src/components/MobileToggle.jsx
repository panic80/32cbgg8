import React from 'react';

    function MobileToggle({ isMobile }) {
          if (!isMobile) return null;
    
          return (
            <button className="mobile-toggle">
              Open Menu
            </button>
          );
        }

    export default MobileToggle;
