import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface PlaceAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
  required?: boolean;
  countryRestriction?: string;
}

interface Prediction {
  description: string;
  place_id: string;
  structured_formatting?: {
    main_text: string;
    secondary_text: string;
  };
}

export const PlaceAutocompleteSimple: React.FC<PlaceAutocompleteProps> = ({
  value,
  onChange,
  placeholder = "Enter a location",
  className,
  disabled = false,
  id,
  name,
  required = false,
  countryRestriction = 'ca',
}) => {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [sessionToken] = useState(() => 
    Math.random().toString(36).substring(2) + Date.now().toString(36)
  );
  
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  // Fetch predictions from our server proxy
  const fetchPredictions = useCallback(async (input: string) => {
    if (!input || input.length < 2) {
      setPredictions([]);
      return;
    }

    setIsLoading(true);
    
    try {
      const params = new URLSearchParams({
        input,
        sessiontoken: sessionToken,
        components: `country:${countryRestriction}`
      });

      const response = await fetch(`/api/maps/autocomplete?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch predictions');
      }

      const data = await response.json();
      
      if (data.predictions) {
        setPredictions(data.predictions);
        setShowDropdown(true);
      }
    } catch (error) {
      console.error('Error fetching predictions:', error);
      setPredictions([]);
    } finally {
      setIsLoading(false);
    }
  }, [sessionToken, countryRestriction]);

  // Debounced input handler
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    
    // Clear existing timeout
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    // Set new timeout
    debounceRef.current = setTimeout(() => {
      fetchPredictions(newValue);
    }, 300);
  };

  // Handle prediction selection
  const selectPrediction = async (prediction: Prediction) => {
    try {
      // Fetch full place details
      const params = new URLSearchParams({
        place_id: prediction.place_id,
        sessiontoken: sessionToken
      });

      const response = await fetch(`/api/maps/place-details?${params}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.result?.formatted_address) {
          onChange(data.result.formatted_address);
        } else {
          onChange(prediction.description);
        }
      } else {
        // Fallback to prediction description
        onChange(prediction.description);
      }
    } catch (error) {
      console.error('Error fetching place details:', error);
      onChange(prediction.description);
    }
    
    setPredictions([]);
    setShowDropdown(false);
    setSelectedIndex(-1);
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || predictions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < predictions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < predictions.length) {
          selectPrediction(predictions[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowDropdown(false);
        setSelectedIndex(-1);
        break;
    }
  };

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <div className="relative">
      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => predictions.length > 0 && setShowDropdown(true)}
          placeholder={placeholder}
          className={className}
          disabled={disabled}
          id={id}
          name={name}
          required={required}
          autoComplete="off"
        />
        {isLoading && (
          <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>
      
      {showDropdown && predictions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 mt-1 w-full rounded-md border bg-white dark:bg-gray-800 shadow-lg"
        >
          <ul className="max-h-60 overflow-auto py-1">
            {predictions.map((prediction, index) => (
              <li
                key={prediction.place_id}
                className={cn(
                  "cursor-pointer px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700",
                  selectedIndex === index && "bg-gray-100 dark:bg-gray-700"
                )}
                onClick={() => selectPrediction(prediction)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                {prediction.structured_formatting ? (
                  <div>
                    <div className="font-medium text-gray-900 dark:text-gray-100">
                      {prediction.structured_formatting.main_text}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      {prediction.structured_formatting.secondary_text}
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-900 dark:text-gray-100">{prediction.description}</div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};