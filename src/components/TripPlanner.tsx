import React, { useState } from 'react';
import { apiClient, ApiError } from '@/api/client';
import { CalendarIcon, MapIcon, CheckCircle2 } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { PlaceAutocompleteSimple as PlaceAutocomplete } from '@/components/PlaceAutocompleteSimple';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface TripPlannerProps {
  onSubmit: (tripPlan: string) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export interface TripData {
  transportMethod: string;
  departureDate: Date | undefined;
  returnDate: Date | undefined;
  departureLocation: string;
  arrivalLocation: string;
  rnqProvided: boolean;
  travelAuthority: boolean;
  purpose: string;
  additionalNotes: string;
}

export interface DistanceData {
  distance: {
    text: string;
    value: number;
  };
  duration: {
    text: string;
    value: number;
  };
  origin: string;
  destination: string;
  mode: string;
}

const transportMethods = [
  { value: 'personal-vehicle', label: 'Personal Vehicle' },
  { value: 'government-vehicle', label: 'Government Vehicle' },
  { value: 'air', label: 'Air Travel' },
  { value: 'train', label: 'Train' },
  { value: 'bus', label: 'Bus' },
  { value: 'rental', label: 'Rental Vehicle' },
  { value: 'other', label: 'Other' },
];

const INCIDENT_ALLOWANCE_STANDARD_RATE = 17.3;
const INCIDENT_ALLOWANCE_REDUCED_RATE = 13;
const INCIDENT_ALLOWANCE_STANDARD_DAYS = 30;

const currencyFormatter = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatCurrency = (value: number) => currencyFormatter.format(value);

const getTransportLabel = (transportMethod: string) =>
  transportMethods.find((t) => t.value === transportMethod)?.label || 'Not specified';

const formatKilometres = (value: number) => {
  if (!Number.isFinite(value)) {
    return '';
  }
  return Number.isInteger(value) ? `${value.toFixed(0)} km` : `${value.toFixed(1)} km`;
};

const calculateTripDurationInDays = (departure?: Date, returnDate?: Date) => {
  if (!departure || !returnDate) {
    return null;
  }

  return differenceInDays(returnDate, departure) + 1;
};

const calculateIncidentalCost = (tripDuration: number | null) => {
  if (!tripDuration || tripDuration <= 0) {
    return null;
  }

  if (tripDuration <= INCIDENT_ALLOWANCE_STANDARD_DAYS) {
    return tripDuration * INCIDENT_ALLOWANCE_STANDARD_RATE;
  }

  if (tripDuration === INCIDENT_ALLOWANCE_STANDARD_DAYS + 1) {
    return (INCIDENT_ALLOWANCE_STANDARD_DAYS + 1) * INCIDENT_ALLOWANCE_STANDARD_RATE;
  }

  const intermediateDays = tripDuration - (INCIDENT_ALLOWANCE_STANDARD_DAYS + 1);
  const standardDaysCost = INCIDENT_ALLOWANCE_STANDARD_DAYS * INCIDENT_ALLOWANCE_STANDARD_RATE;
  const reducedDaysCost = Math.max(intermediateDays, 0) * INCIDENT_ALLOWANCE_REDUCED_RATE;
  const finalDayCost = INCIDENT_ALLOWANCE_STANDARD_RATE;

  return standardDaysCost + reducedDaysCost + finalDayCost;
};

interface MealEntitlementDay {
  dayLabel: string;
  meals: string[];
}

const calculateMealEntitlements = (
  tripDuration: number | null,
  rnqProvided: boolean,
): MealEntitlementDay[] => {
  if (!tripDuration || tripDuration <= 0) {
    return [];
  }

  if (tripDuration === 1) {
    return [
      {
        dayLabel: 'Day 1 (Same-day travel)',
        meals: ['Lunch'],
      },
    ];
  }

  const entitlements: MealEntitlementDay[] = [
    {
      dayLabel: 'Day 1 (Departure)',
      meals: ['Lunch', 'Dinner'],
    },
  ];

  if (!rnqProvided && tripDuration > 2) {
    for (let day = 2; day <= tripDuration - 1; day += 1) {
      entitlements.push({
        dayLabel: `Day ${day}`,
        meals: ['Breakfast', 'Lunch', 'Dinner'],
      });
    }
  }

  entitlements.push({
    dayLabel: `Day ${tripDuration} (Return)`,
    meals: ['Breakfast', 'Lunch'],
  });

  if (rnqProvided) {
    return entitlements.filter((entry, index) => index === 0 || index === entitlements.length - 1);
  }

  return entitlements;
};

const PROVINCE_MAP: Record<string, string> = {
  ab: 'Alberta',
  alberta: 'Alberta',
  bc: 'British Columbia',
  'british columbia': 'British Columbia',
  mb: 'Manitoba',
  manitoba: 'Manitoba',
  nb: 'New Brunswick',
  'new brunswick': 'New Brunswick',
  nl: 'Newfoundland and Labrador',
  'newfoundland and labrador': 'Newfoundland and Labrador',
  nfld: 'Newfoundland and Labrador',
  'st. john\'s': 'Newfoundland and Labrador',
  ns: 'Nova Scotia',
  'nova scotia': 'Nova Scotia',
  nt: 'Northwest Territories',
  'northwest territories': 'Northwest Territories',
  'northwest territory': 'Northwest Territories',
  nu: 'Nunavut',
  nunavut: 'Nunavut',
  on: 'Ontario',
  ont: 'Ontario',
  ontario: 'Ontario',
  pe: 'Prince Edward Island',
  'prince edward island': 'Prince Edward Island',
  pei: 'Prince Edward Island',
  qc: 'Quebec',
  québec: 'Quebec',
  quebec: 'Quebec',
  sk: 'Saskatchewan',
  saskatchewan: 'Saskatchewan',
  yt: 'Yukon',
  yukon: 'Yukon',
};

const extractProvince = (location: string | undefined) => {
  if (!location) return null;

  const parts = location
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);

  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const normalized = parts[i];
    if (PROVINCE_MAP[normalized]) {
      return PROVINCE_MAP[normalized];
    }
    if (normalized.length === 2 && PROVINCE_MAP[normalized]) {
      return PROVINCE_MAP[normalized];
    }

    const tokens = normalized.split(/[\s-]+/).map((token) => token.replace(/[^a-z]/g, ''));
    for (const token of tokens) {
      if (token && PROVINCE_MAP[token]) {
        return PROVINCE_MAP[token];
      }
    }
  }

  return null;
};

interface MileageContext {
  locationLabel: string;
  locationLabelLower: string;
  distanceText: string | null;
  roundTripDistanceText: string | null;
  distanceKm: number | null;
  roundTripKm: number | null;
}

const buildMileageContext = (data: TripData, distance: DistanceData | null): MileageContext => {
  const departureProvince = extractProvince(data.departureLocation);
  const destinationProvince = extractProvince(data.arrivalLocation);
  const locationLabel = departureProvince || destinationProvince || 'departure region';
  const distanceValue = distance?.distance.value;
  const distanceKm = typeof distanceValue === 'number' ? distanceValue / 1000 : null;
  const roundTripKm = distanceKm !== null ? distanceKm * 2 : null;
  const distanceText = distance?.distance.text ?? null;
  const roundTripDistanceText = roundTripKm !== null
    ? formatKilometres(roundTripKm)
    : distanceText
      ? `2 × ${distanceText}`
      : null;

  return {
    locationLabel,
    locationLabelLower: locationLabel.toLowerCase(),
    distanceText,
    roundTripDistanceText,
    distanceKm,
    roundTripKm,
  };
};

const buildCostEstimateSection = (
  data: TripData,
  distance: DistanceData | null,
  tripDuration: number | null,
  mealEntitlements: MealEntitlementDay[],
) => {
  const incidentalCost = calculateIncidentalCost(tripDuration);

  const lines: string[] = [];
  const costRows: Array<{ label: string; value: string }> = [];
  const internalNotes: string[] = [];

  if (incidentalCost !== null) {
    const durationLabel = tripDuration === 1 ? '1 day' : `${tripDuration} days`;
    lines.push(`• Incidentals (${durationLabel}): ${formatCurrency(incidentalCost)}`);
    costRows.push({
      label: `Incidentals (${durationLabel})`,
      value: formatCurrency(incidentalCost),
    });
  } else {
    costRows.push({
      label: 'Incidentals',
      value: 'No entitlement calculated',
    });
  }

  if (mealEntitlements.length) {
    const mealSummary = mealEntitlements
      .map((entry) => `${entry.dayLabel}: ${entry.meals.join(', ')}`)
      .join('; ');
    const rnqMessage = data.rnqProvided ? ' (travel days only — R&Q provided)' : '';
    lines.push(
      `• Meals: ${mealSummary}${rnqMessage}. Retrieve destination meal per diems (breakfast/lunch/dinner) and multiply accordingly.`,
    );
    costRows.push({
      label: 'Meals',
      value: `${mealSummary}${data.rnqProvided ? ' (travel days only)' : ''}`,
    });
    internalNotes.push('Lookup current meal per diem table for the destination and calculate eligible meals.');
  } else {
    lines.push(
      '• Meals: Not entitled based on travel timing and provided R&Q coverage.',
    );
    costRows.push({
      label: 'Meals',
      value: 'No entitlement (timing/R&Q).',
    });
  }

  const departureLocation = data.departureLocation || 'departure location';
  const arrivalLocation = data.arrivalLocation || 'arrival location';
  const routeDescription = `${departureLocation} → ${arrivalLocation}`;
  const transportLabel = getTransportLabel(data.transportMethod);
  const mileageContext = buildMileageContext(data, distance);
  const {
    locationLabel,
    locationLabelLower,
    distanceText,
    roundTripDistanceText,
  } = mileageContext;
  const roundTripDisplay = roundTripDistanceText ?? 'round-trip distance';

  if (data.transportMethod === 'personal-vehicle') {
    if (distance?.distance.text && distance.distance.value) {
      lines.push(
        `• Mileage: Retrieve the current private-vehicle kilometric rate for ${locationLabel} (cents per kilometre) and apply it to ${distanceText} each way (${roundTripDisplay} total) to determine the mileage cost.`,
      );
      costRows.push({
        label: 'Mileage',
        value: `${roundTripDisplay} × current ${locationLabel} POMV rate`,
      });
      internalNotes.push(
        `Query the policy for the ${locationLabel} private-vehicle kilometric rate and multiply it by ${roundTripDisplay} (round trip), converting to dollars if the rate is quoted in cents per kilometre.`,
      );
      internalNotes.push(
        `Explicit retrieval hint: "${locationLabelLower} private vehicle kilometric rate" (express in cents per kilometre).`,
      );
    } else {
      lines.push(
        `• Mileage: Await confirmed distance for ${routeDescription} and then apply the current ${locationLabel} POMV rate (cents per kilometre) to both legs of travel.`,
      );
      costRows.push({
        label: 'Mileage',
        value: 'Awaiting confirmed distance for round-trip POMV calculation',
      });
      internalNotes.push(
        `Fetch the ${locationLabel} private-vehicle kilometric rate once the travel distance is confirmed, then multiply by the full round-trip distance (convert units as required).`,
      );
    }
  } else {
    lines.push(`• Mileage: Not entitled when travelling by ${transportLabel}.`);
    costRows.push({
      label: 'Mileage',
      value: `Not entitled (${transportLabel} is Crown-provided transport).`,
    });
  }

  if (!lines.length) {
    return '';
  }

  let section = `
💵 **Estimated Costs:**
${lines.join('\n')}
`;

  section += `**Please combine the RAG-derived kilometric mileage cost with the incidentals above to present the total trip estimate.**
`;

  if (costRows.length) {
    const tableRows = costRows.map((row) => `| ${row.label} | ${row.value} |`).join('\n');
    section += `
| Component | Estimated Cost / Notes |
| --- | --- |
${tableRows}
`;
  }

  if (internalNotes.length) {
    const noteLines = internalNotes.map((note) => `- ${note}`).join('\n');
    section += `
<details>
<summary>Internal calculation notes</summary>
${noteLines}
</details>
`;
  }

  return section;
};

export const generateTripPlanMessage = (data: TripData, distance: DistanceData | null): string => {
  const transport = getTransportLabel(data.transportMethod);
  const departure = data.departureDate
    ? format(data.departureDate, 'MMMM dd, yyyy')
    : 'Not specified';
  const returnDate = data.returnDate ? format(data.returnDate, 'MMMM dd, yyyy') : 'Not specified';
  const tripDuration = calculateTripDurationInDays(data.departureDate, data.returnDate);
  const mealEntitlements = calculateMealEntitlements(tripDuration, data.rnqProvided);
  const mileageContext = buildMileageContext(data, distance);
  const mileageRegion = mileageContext.locationLabel;
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

    if (tripDuration > 30) {
      const reducedRangeEnd = tripDuration - 1;
      const hasReducedRange = reducedRangeEnd > 30;
      plan += `
⚠️ **Extended Stay Note:** This trip exceeds 30 days.
• Days 1-30: Incidental allowance \$17.30/day
${hasReducedRange ? `• Days 31-${reducedRangeEnd}: Reduced to \$13.00/day (75%)\n` : ''}• Day ${tripDuration} (Last day - CIL): Returns to \$17.30/day

`;
    }
  }

  plan += `🏠 **R&Q Provided:** ${data.rnqProvided ? 'Yes' : 'No'}
`;
  plan += `✅ **Travel Authority:** ${data.travelAuthority ? 'Obtained' : 'Not Obtained'}
`;
  plan += `🎯 **Purpose:** ${data.purpose || 'Not specified'}
`;
  plan += `📍 **Route:** ${data.departureLocation || 'Not specified'} → ${data.arrivalLocation || 'Not specified'}
`;

  if (distance) {
    plan += `📏 **Distance:** ${distance.distance.text}
`;
    plan += `⏱️ **Estimated Travel Time:** ${distance.duration.text}
`;
    if (roundTripDistanceText) {
      plan += `🔁 **Round-Trip Distance:** ${roundTripDistanceText}
`;
    }
  }

  if (mealEntitlements.length) {
    const mealLines = mealEntitlements
      .map((entry) => `• ${entry.dayLabel}: ${entry.meals.join(', ')}`)
      .join('\n');
    const rnqLabel = data.rnqProvided ? ' (travel days only — R&Q provided)' : '';
    plan += `
🍽️ **Meals (Assuming depart 12:00 & return 15:00):**${rnqLabel}
${mealLines}
`;
  } else {
    plan += `
🍽️ **Meals:** No meal entitlement based on the assumed departure/return times and R&Q coverage.
`;
  }

  if (data.additionalNotes) {
    plan += `
**Additional Details:** ${data.additionalNotes}`;
  }

  const costSection = buildCostEstimateSection(data, distance, tripDuration, mealEntitlements);
  if (costSection) {
    plan += `
${costSection}`;
  }

  plan += `
🔍 **Required Retrieval Tasks:**
• Determine the current private-vehicle kilometric rate for ${mileageRegion} and apply it to the full round-trip distance (${roundTripDistanceDisplay}); convert the result to dollars if the rate is expressed in cents per kilometre.
• Retrieve the applicable meal per diem rates (breakfast, lunch, dinner) for the destination and apply them to the eligible meals determined by the 12:00 departure / 15:00 return assumption.
• If the exact mileage rate is not immediately present, explicitly query for "${mileageRegionLower} private vehicle kilometric rate" and use the value retrieved from policy tables.
• Confirm the total trip estimate by combining incidentals, the round-trip mileage calculation, and the meal totals derived from those rates.
`;

  return plan;
};

export const TripPlanner: React.FC<TripPlannerProps> = ({
  onSubmit,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}) => {
  const [internalOpen, setInternalOpen] = useState(false);

  // Use controlled props if provided, otherwise use internal state
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = controlledOnOpenChange || setInternalOpen;
  const [distanceData, setDistanceData] = useState<DistanceData | null>(null);
  const [isLoadingDistance, setIsLoadingDistance] = useState(false);
  const [distanceError, setDistanceError] = useState<string | null>(null);
  const [tripData, setTripData] = useState<TripData>({
    transportMethod: '',
    departureDate: undefined,
    returnDate: undefined,
    departureLocation: '',
    arrivalLocation: '',
    rnqProvided: true,
    travelAuthority: false,
    purpose: '',
    additionalNotes: '',
  });

  // Fetch distance data when locations change
  const fetchDistance = async (origin: string, destination: string) => {
    if (!origin || !destination) {
      setDistanceData(null);
      return;
    }

    setIsLoadingDistance(true);
    setDistanceError(null);

    try {
      const transportModeMap: { [key: string]: string } = {
        'personal-vehicle': 'driving',
        'government-vehicle': 'driving',
        air: 'driving', // Will show driving distance to airport
        train: 'transit',
        bus: 'transit',
        rental: 'driving',
        other: 'driving',
      };

      const mode = transportModeMap[tripData.transportMethod] || 'driving';

      const data = await apiClient.postJson<DistanceData>(
        '/api/maps/distance',
        {
          origin,
          destination,
          mode,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
      setDistanceData(data);
    } catch (error) {
      console.error('Error fetching distance:', error);
      if (error instanceof ApiError) {
        const message =
          typeof (error.data as any)?.error === 'string'
            ? (error.data as any).error
            : error.statusText || error.message;
        setDistanceError(message || 'Failed to calculate distance');
      } else if (error instanceof Error) {
        setDistanceError(error.message);
      } else {
        setDistanceError('Failed to calculate distance');
      }
      setDistanceData(null);
    } finally {
      setIsLoadingDistance(false);
    }
  };

  // Debounce distance fetching
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (tripData.departureLocation && tripData.arrivalLocation) {
        fetchDistance(tripData.departureLocation, tripData.arrivalLocation);
      }
    }, 1000); // Wait 1 second after user stops typing

    return () => clearTimeout(timer);
  }, [tripData.departureLocation, tripData.arrivalLocation, tripData.transportMethod]);

  const handleSubmit = () => {
    // Generate formatted trip plan
    const tripPlan = generateTripPlanMessage(tripData, distanceData);
    onSubmit(tripPlan);

    // Reset form and close sheet
    setTripData({
      transportMethod: '',
      departureDate: undefined,
      returnDate: undefined,
      departureLocation: '',
      arrivalLocation: '',
      rnqProvided: true,
      travelAuthority: false,
      purpose: '',
      additionalNotes: '',
    });
    setDistanceData(null);
    setDistanceError(null);
    setOpen(false);
  };

  const isFormValid = () => {
    return (
      tripData.transportMethod &&
      tripData.departureDate &&
      tripData.returnDate &&
      tripData.departureLocation &&
      tripData.arrivalLocation &&
      tripData.purpose
    );
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {controlledOpen === undefined && (
        <SheetTrigger
          className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-[var(--background-secondary)] text-[var(--text)] h-10 w-10"
          title="Trip Planner (Beta)"
        >
          <MapIcon size={18} />
        </SheetTrigger>
      )}
      <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Trip Planner (Beta)</SheetTitle>
          <SheetDescription>
            Fill in your travel details to generate a formatted trip plan for your chat.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Transport Method */}
          <div className="space-y-2">
            <Label htmlFor="transport">Method of Transport *</Label>
            <Select
              value={tripData.transportMethod}
              onValueChange={(value) => setTripData({ ...tripData, transportMethod: value })}
            >
              <SelectTrigger id="transport">
                <SelectValue placeholder="Select transport method" />
              </SelectTrigger>
              <SelectContent>
                {transportMethods.map((method) => (
                  <SelectItem key={method.value} value={method.value}>
                    {method.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Travel Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Departure Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !tripData.departureDate && 'text-muted-foreground',
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {tripData.departureDate ? (
                      format(tripData.departureDate, 'PPP')
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={tripData.departureDate}
                    onSelect={(date) => setTripData({ ...tripData, departureDate: date })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Assuming departure at 12:00 hrs
              </p>
            </div>

            <div className="space-y-2">
              <Label>Return Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !tripData.returnDate && 'text-muted-foreground',
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {tripData.returnDate ? (
                      format(tripData.returnDate, 'PPP')
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={tripData.returnDate}
                    onSelect={(date) => setTripData({ ...tripData, returnDate: date })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Assuming departure at 15:00 hrs
              </p>
            </div>
          </div>

          {/* Locations */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="departure-location">Departure Location *</Label>
              <PlaceAutocomplete
                id="departure-location"
                placeholder="e.g., CFB Toronto, Toronto, ON"
                value={tripData.departureLocation}
                onChange={(value) => setTripData({ ...tripData, departureLocation: value })}
                countryRestriction="ca"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="arrival-location">Arrival Location *</Label>
              <PlaceAutocomplete
                id="arrival-location"
                placeholder="e.g., CFB Ottawa, Ottawa, ON"
                value={tripData.arrivalLocation}
                onChange={(value) => setTripData({ ...tripData, arrivalLocation: value })}
                countryRestriction="ca"
              />
            </div>

            {/* Distance Information */}
            {(isLoadingDistance || distanceData || distanceError) && (
              <div className="mt-4 p-3 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)]">
                {isLoadingDistance && (
                  <div className="flex items-center text-sm text-[var(--text-secondary)]">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[var(--text)] mr-2"></div>
                    Calculating distance...
                  </div>
                )}

                {distanceData && !isLoadingDistance && (
                  <div className="space-y-1">
                    <div className="flex items-center text-sm">
                      <span className="font-medium">Distance:</span>
                      <span className="ml-2">{distanceData.distance.text}</span>
                    </div>
                    <div className="flex items-center text-sm">
                      <span className="font-medium">Travel Time:</span>
                      <span className="ml-2">{distanceData.duration.text}</span>
                    </div>
                  </div>
                )}

                {distanceError && !isLoadingDistance && (
                  <div className="text-sm text-red-500">⚠️ {distanceError}</div>
                )}
              </div>
            )}
          </div>

          {/* Checkboxes */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox id="rnq" disabled checked={true} />
              <Label
                htmlFor="rnq"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Rations & Quarters (R&Q) Provided
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="authority"
                checked={tripData.travelAuthority}
                onCheckedChange={(checked) =>
                  setTripData({ ...tripData, travelAuthority: !!checked })
                }
              />
              <Label
                htmlFor="authority"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Travel Authority Obtained
              </Label>
            </div>
          </div>

          {/* Purpose of Travel */}
          <div className="space-y-2">
            <Label htmlFor="purpose">Purpose of Travel *</Label>
            <Textarea
              id="purpose"
              placeholder="e.g., Annual training conference, Medical appointment, etc."
              value={tripData.purpose}
              onChange={(e) => setTripData({ ...tripData, purpose: e.target.value })}
              rows={3}
            />
          </div>

          {/* Additional Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Additional Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Any additional details or requirements..."
              value={tripData.additionalNotes}
              onChange={(e) => setTripData({ ...tripData, additionalNotes: e.target.value })}
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!isFormValid()}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Generate Trip Plan
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
