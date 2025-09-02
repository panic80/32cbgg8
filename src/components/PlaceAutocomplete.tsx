import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface PlaceAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelect?: (place: google.maps.places.PlaceResult) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
  required?: boolean;
  countryRestriction?: string | string[];
  types?: string[];
  bounds?: google.maps.LatLngBounds | google.maps.LatLngBoundsLiteral;
}

// Type declaration for the new PlaceAutocompleteElement
declare global {
  interface Window {
    google: typeof google & {
      maps: typeof google.maps & {
        places: typeof google.maps.places & {
          PlaceAutocompleteElement?: any;
        };
      };
    };
  }
}

// Load Google Maps script dynamically
const loadGoogleMapsScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    if (window.google?.maps?.places?.PlaceAutocompleteElement) {
      resolve();
      return;
    }

    // Check if script is already being loaded
    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve());
      existingScript.addEventListener('error', () => reject(new Error('Failed to load Google Maps')));
      return;
    }

    // Create and load script with loading=async
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&libraries=places&loading=async`;
    script.async = true;
    script.defer = true;
    
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Maps'));
    document.head.appendChild(script);
  });
};

export const PlaceAutocomplete: React.FC<PlaceAutocompleteProps> = ({
  value,
  onChange,
  onPlaceSelect,
  placeholder = "Enter a location",
  className,
  disabled = false,
  id,
  name,
  required = false,
  countryRestriction = 'ca', // Default to Canada
  types,
  bounds,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteElementRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize autocomplete
  const initializeAutocomplete = useCallback(async () => {
    try {
      await loadGoogleMapsScript();

      if (!containerRef.current || autocompleteElementRef.current) return;

      // Check if PlaceAutocompleteElement is available
      const PlaceAutocompleteElement = window.google?.maps?.places?.PlaceAutocompleteElement;
      
      if (!PlaceAutocompleteElement) {
        // Fallback to legacy Autocomplete if new API is not available
        if (!inputRef.current || !window.google?.maps?.places?.Autocomplete) {
          throw new Error('Google Places API not available');
        }

        const options: google.maps.places.AutocompleteOptions = {
          fields: ['formatted_address', 'geometry', 'place_id', 'name', 'address_components'],
          strictBounds: false,
        };

        // Set country restrictions
        if (countryRestriction) {
          const countries = Array.isArray(countryRestriction) ? countryRestriction : [countryRestriction];
          options.componentRestrictions = { country: countries };
        }

        // Set types if provided
        if (types) {
          options.types = types;
        }

        // Set bounds if provided
        if (bounds) {
          options.bounds = bounds;
        }

        // Create legacy autocomplete instance
        const autocomplete = new google.maps.places.Autocomplete(inputRef.current, options);
        autocompleteElementRef.current = autocomplete;

        // Handle place selection
        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          
          if (place.formatted_address) {
            onChange(place.formatted_address);
            onPlaceSelect?.(place);
          }
        });
      } else {
        // Use new PlaceAutocompleteElement
        const placeAutocomplete = new PlaceAutocompleteElement({
          componentRestrictions: countryRestriction ? { country: Array.isArray(countryRestriction) ? countryRestriction : [countryRestriction] } : undefined,
          types: types || undefined,
          locationBias: bounds || undefined,
        });

        autocompleteElementRef.current = placeAutocomplete;

        // Handle place selection
        placeAutocomplete.addEventListener('gmp-placeselect', async (event: any) => {
          const place = event.place;
          
          if (place) {
            // Fetch full place details
            await place.fetchFields({
              fields: ['displayName', 'formattedAddress', 'location', 'addressComponents'],
            });
            
            const address = place.formattedAddress || place.displayName || '';
            onChange(address);
            
            // Convert to legacy format for compatibility
            const legacyPlace: google.maps.places.PlaceResult = {
              formatted_address: address,
              name: place.displayName,
              place_id: place.id,
              geometry: place.location ? {
                location: place.location,
                viewport: undefined as any,
              } : undefined as any,
              address_components: place.addressComponents,
            };
            
            onPlaceSelect?.(legacyPlace);
          }
        });

        // Replace the input with the custom element
        containerRef.current.appendChild(placeAutocomplete);
        
        // Hide the original input
        if (inputRef.current) {
          inputRef.current.style.display = 'none';
        }
      }

      setIsLoading(false);
    } catch (err) {
      console.error('Failed to initialize Google Places Autocomplete:', err);
      setError('Location search unavailable');
      setIsLoading(false);
    }
  }, [countryRestriction, types, bounds, onChange, onPlaceSelect]);

  useEffect(() => {
    initializeAutocomplete();

    return () => {
      // Cleanup
      if (autocompleteElementRef.current) {
        if (typeof autocompleteElementRef.current.removeAllListeners === 'function') {
          autocompleteElementRef.current.removeAllListeners();
        } else if (window.google?.maps?.event) {
          google.maps.event.clearInstanceListeners(autocompleteElementRef.current);
        }
      }
    };
  }, [initializeAutocomplete]);

  // Handle manual input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  if (error) {
    return (
      <Input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
        placeholder={placeholder}
        className={cn(className, "text-red-500")}
        disabled={disabled}
        id={id}
        name={name}
        required={required}
        title={error}
      />
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <Input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
        placeholder={isLoading ? "Loading..." : placeholder}
        className={className}
        disabled={disabled || isLoading}
        id={id}
        name={name}
        required={required}
        autoComplete="off"
      />
      {isLoading && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          Loading...
        </div>
      )}
    </div>
  );
};