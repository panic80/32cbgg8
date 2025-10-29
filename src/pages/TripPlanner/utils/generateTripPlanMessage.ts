import {
  buildCostEstimateSection,
  buildMileageContext,
  calculateMealEntitlements,
  calculateTripDurationInDays,
  describeTripBasics,
  formatCurrency,
} from './calculations';
import type { TripData, DistanceData } from '../types';
import { getTransportLabel } from '../constants';
import {
  INCIDENT_ALLOWANCE_REDUCED_RATE,
  INCIDENT_ALLOWANCE_STANDARD_DAYS,
  INCIDENT_ALLOWANCE_STANDARD_RATE,
} from '@/constants/travel';

export const generateTripPlanMessage = (data: TripData, distance: DistanceData | null): string => {
  const { transport, departure, returnDate } = describeTripBasics(data);
  const tripDuration = calculateTripDurationInDays(data.departureDate, data.returnDate);
  const mealEntitlements = calculateMealEntitlements(tripDuration, data.rnqProvided);
  const mileageContext = buildMileageContext(data, distance);
  const roundTripDistanceText = mileageContext.roundTripDistanceText;
  const roundTripDistanceDisplay = roundTripDistanceText ?? 'round-trip distance';
  const mileageRegionLower = mileageContext.locationLabelLower;

  let plan = `📋 **Trip Plan Request**

`;
  plan += `🚗 **Transportation:** ${transport}
`;
  plan += `📅 **Travel Dates:** ${departure} - ${returnDate}
`;

  if (tripDuration) {
    plan += `📊 **Trip Duration:** ${tripDuration} days
`;

    if (tripDuration > INCIDENT_ALLOWANCE_STANDARD_DAYS) {
      const reducedRangeEnd = tripDuration - 1;
      const hasReducedRange = reducedRangeEnd > INCIDENT_ALLOWANCE_STANDARD_DAYS;
      plan += `
⚠️ **Extended Stay Note:** This trip exceeds ${INCIDENT_ALLOWANCE_STANDARD_DAYS} days.
• Days 1-${INCIDENT_ALLOWANCE_STANDARD_DAYS}: Incidental allowance ${formatCurrency(INCIDENT_ALLOWANCE_STANDARD_RATE)}
${hasReducedRange ? `• Days ${INCIDENT_ALLOWANCE_STANDARD_DAYS + 1}-${reducedRangeEnd}: Reduced to ${formatCurrency(INCIDENT_ALLOWANCE_REDUCED_RATE)} (75%)\n` : ''}• Day ${tripDuration} (Last day - CIL): Returns to ${formatCurrency(INCIDENT_ALLOWANCE_STANDARD_RATE)}

`;
    }
  }

  plan += `🏠 **R&Q Provided:** ${data.rnqProvided ? 'Yes' : 'No'}
`;
  plan += `✅ **Travel Authority:** ${data.travelAuthority ? 'Obtained' : 'Not Obtained'}
`;
  plan += `🎯 **Purpose:** ${data.purpose || 'Not specified'}
`;

  if (data.transportMethod === 'personal-vehicle') {
    if (roundTripDistanceText) {
      plan += `🧮 **Mileage:** Use RAG to retrieve the current private-vehicle kilometric rate covering travel between ${data.departureLocation || 'departure location'} → ${data.arrivalLocation || 'arrival location'} (${mileageContext.locationLabel}). Apply it to ${roundTripDistanceDisplay} to estimate mileage cost.
`;
    } else {
      plan += `🧮 **Mileage:** Confirm round-trip distance for ${data.departureLocation || 'departure location'} → ${data.arrivalLocation || 'arrival location'} before applying the private-vehicle kilometric rate for ${mileageContext.locationLabel}.
`;
    }
  } else {
    plan += `🧮 **Mileage:** Not entitled when travelling by ${getTransportLabel(data.transportMethod)}.
`;
  }

  if (data.additionalNotes) {
    plan += `🗒️ **Additional Notes:** ${data.additionalNotes}
`;
  }

  if (distance) {
    plan += `
📍 **Travel Distance**
• Origin: ${distance.origin}
• Destination: ${distance.destination}
• Mode: ${distance.mode}
• Distance: ${distance.distance.text}
• Duration: ${distance.duration.text}
`;
  }

  const costEstimateSection = buildCostEstimateSection(data, distance, tripDuration, mealEntitlements);
  plan += costEstimateSection;

  plan += `
🔎 **Follow-Up Prompts**
• "What is the ${mileageRegionLower} POMV rate in cents per km?"
• "Show the meal per diem table for the destination (breakfast/lunch/dinner)."
`;

  return plan;
};
