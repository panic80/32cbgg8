import { useEffect, useState } from 'react';

export const useDisclaimer = () => {
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  useEffect(() => {
    // Get or initialize visit count
    const visitCountStr = localStorage.getItem('cf-travel-bot-visit-count');
    const visitCount = visitCountStr ? parseInt(visitCountStr, 10) : 0;
    const newVisitCount = visitCount + 1;

    // Store updated visit count
    localStorage.setItem('cf-travel-bot-visit-count', newVisitCount.toString());

    // Show disclaimer every 3 visits
    if (newVisitCount % 3 === 1) {
      setShowDisclaimer(true);
    }
  }, []);

  return { showDisclaimer, setShowDisclaimer };
};
