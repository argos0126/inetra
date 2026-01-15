import { useRef, useState, useCallback, useEffect } from "react";
import { MapPin, Search, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export interface PlaceData {
  address: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
  zone: string;
  latitude: number;
  longitude: number;
}

interface Prediction {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

interface AddressAutocompleteProps {
  defaultValue?: string;
  onPlaceSelect: (data: PlaceData) => void;
  placeholder?: string;
}

const MIN_CHARS = 3;
const DEBOUNCE_MS = 400;

// Address input with Google Places autocomplete via backend
export const AddressAutocomplete = ({ defaultValue = "", onPlaceSelect, placeholder = "Search for an address..." }: AddressAutocompleteProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionTokenRef = useRef<string>(crypto.randomUUID());

  const [inputValue, setInputValue] = useState(defaultValue);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchMessage, setSearchMessage] = useState<string>("");

  // Search for predictions via backend
  const searchPredictions = useCallback(async (query: string) => {
    if (query.trim().length < MIN_CHARS) {
      setPredictions([]);
      setShowDropdown(false);
      setSearchMessage(query.trim().length >= 1 && query.trim().length < MIN_CHARS ? `Type ${MIN_CHARS}+ characters to search` : "");
      return;
    }

    setIsSearching(true);
    setSearchMessage("");

    try {
      const { data, error } = await supabase.functions.invoke('google-maps-places', {
        body: {
          action: 'autocomplete',
          input: query,
          sessionToken: sessionTokenRef.current,
        },
      });

      if (error) {
        console.error("Places autocomplete error:", error);
        setSearchMessage("Failed to search. Please try again.");
        setPredictions([]);
        setShowDropdown(true);
        return;
      }

      if (!data?.success) {
        setSearchMessage(data?.error || "No results found");
        setPredictions([]);
        setShowDropdown(true);
        return;
      }

      setPredictions(data.predictions || []);
      setShowDropdown(true);
      setSearchMessage(data.predictions?.length === 0 ? "No results found" : "");
    } catch (error) {
      console.error("Places search error:", error);
      setSearchMessage("Search failed. Please try again.");
      setPredictions([]);
      setShowDropdown(true);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Handle input change with debounce
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(() => {
      searchPredictions(value);
    }, DEBOUNCE_MS);
  };

  // Handle prediction selection
  const handleSelectPrediction = async (prediction: Prediction) => {
    setInputValue(prediction.description);
    setShowDropdown(false);
    setPredictions([]);
    setSearchMessage("");
    setIsSearching(true);

    try {
      const { data, error } = await supabase.functions.invoke('google-maps-places', {
        body: {
          action: 'details',
          placeId: prediction.placeId,
          sessionToken: sessionTokenRef.current,
        },
      });

      // Generate new session token for next search
      sessionTokenRef.current = crypto.randomUUID();

      if (error) {
        console.error("Place details error:", error);
        return;
      }

      if (data?.success && data?.place) {
        onPlaceSelect(data.place);
      }
    } catch (error) {
      console.error("Place details fetch error:", error);
    } finally {
      setIsSearching(false);
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const root = inputRef.current?.closest(".relative");
      if (root && !root.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => (predictions.length > 0 || searchMessage) && setShowDropdown(true)}
          placeholder={placeholder}
          className="flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-10 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
        )}
      </div>

      {showDropdown && (predictions.length > 0 || searchMessage) && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-lg">
          {predictions.length > 0 ? (
            <ul className="max-h-60 overflow-auto py-1">
              {predictions.map((prediction) => (
                <li
                  key={prediction.placeId}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelectPrediction(prediction);
                  }}
                  className="cursor-pointer px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground flex items-start gap-2"
                >
                  <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                  <div>
                    <div className="font-medium">{prediction.mainText}</div>
                    <div className="text-xs text-muted-foreground">{prediction.secondaryText}</div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-3 py-2 text-sm text-muted-foreground">{searchMessage}</div>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground mt-1">Type at least {MIN_CHARS} characters to search</p>
    </div>
  );
};

// Secure map preview component using server-side static maps
interface LocationMapPreviewProps {
  latitude?: number;
  longitude?: number;
  gpsRadius?: number;
}

export const LocationMapPreview = ({ latitude, longitude, gpsRadius = 200 }: LocationMapPreviewProps) => {
  const [mapUrl, setMapUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!latitude || !longitude) {
      setMapUrl(null);
      return;
    }

    const fetchStaticMap = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const { data, error: fnError } = await supabase.functions.invoke('google-maps-static', {
          body: {
            latitude,
            longitude,
            zoom: 15,
            width: 400,
            height: 200,
            radius: gpsRadius,
          },
        });

        if (fnError) {
          console.error("Static map error:", fnError);
          setError("Failed to load map");
          return;
        }

        // Convert blob to data URL
        if (data instanceof Blob) {
          const url = URL.createObjectURL(data);
          setMapUrl(url);
        }
      } catch (err) {
        console.error("Map fetch error:", err);
        setError("Failed to load map");
      } finally {
        setIsLoading(false);
      }
    };

    fetchStaticMap();

    // Cleanup blob URL on unmount
    return () => {
      if (mapUrl) {
        URL.revokeObjectURL(mapUrl);
      }
    };
  }, [latitude, longitude, gpsRadius]);

  if (!latitude && !longitude) {
    return null;
  }

  return (
    <div className="relative rounded-lg overflow-hidden border border-border">
      {isLoading && (
        <div className="h-[200px] w-full flex items-center justify-center bg-muted">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading map...</span>
          </div>
        </div>
      )}
      
      {error && !isLoading && (
        <div className="h-[200px] w-full flex items-center justify-center bg-muted">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <MapPin className="h-8 w-8" />
            <span className="text-sm">{error}</span>
            <span className="text-xs">
              {latitude?.toFixed(6)}, {longitude?.toFixed(6)}
            </span>
          </div>
        </div>
      )}
      
      {mapUrl && !isLoading && !error && (
        <img 
          src={mapUrl} 
          alt="Location map preview" 
          className="h-[200px] w-full object-cover"
        />
      )}
    </div>
  );
};
