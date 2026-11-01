import { useEffect, useMemo, useState } from "react";
import {
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  TextField,
} from "@mui/material";

interface LocationState {
  name: string;
}

interface LocationCountry {
  country: string;
  states?: LocationState[];
}

interface CountryOption {
  name: string;
  isOther?: boolean;
  isCustom?: boolean;
}

interface StateOption {
  name: string;
  isOther?: boolean;
  isCustom?: boolean;
}

interface Props {
  country: string;
  state: string;
  disabled?: boolean;
  onCountryChange: (value: string) => void;
  onStateChange: (value: string) => void;
}

const CUSTOM_COUNTRIES_KEY = "tensorAgritech.customCountries";
const CUSTOM_STATES_KEY = "tensorAgritech.customStates";
const LOCATION_CACHE_KEY = "tensorAgritech.countryStateData";

const sortByName = <T extends { name: string }>(items: T[]) =>
  [...items].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );

const sameName = (a: string, b: string) =>
  a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();

const readArray = (key: string): string[] => {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(value)
      ? value.filter(
          (item): item is string =>
            typeof item === "string" && item.trim().length > 0
        )
      : [];
  } catch {
    return [];
  }
};

const readStates = (): Record<string, string[]> => {
  try {
    const value = JSON.parse(
      localStorage.getItem(CUSTOM_STATES_KEY) ?? "{}"
    );

    if (!value || typeof value !== "object") return {};

    return Object.fromEntries(
      Object.entries(value).map(([country, states]) => [
        country,
        Array.isArray(states)
          ? states.filter(
              (item): item is string =>
                typeof item === "string" && item.trim().length > 0
            )
          : [],
      ])
    );
  } catch {
    return {};
  }
};

export default function CountryStateSelector({
  country,
  state,
  disabled = false,
  onCountryChange,
  onStateChange,
}: Props) {
  const [data, setData] = useState<LocationCountry[]>([]);
  const [customCountries, setCustomCountries] = useState<string[]>(
    readArray(CUSTOM_COUNTRIES_KEY)
  );
  const [customStates, setCustomStates] =
    useState<Record<string, string[]>>(readStates);

  const [countryOther, setCountryOther] = useState(false);
  const [stateOther, setStateOther] = useState(false);
  const [otherCountry, setOtherCountry] = useState("");
  const [otherState, setOtherState] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const cached = localStorage.getItem(LOCATION_CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            setData(parsed);
            return;
          }
        }

        const response = await fetch(
          "https://countriesnow.space/api/v0.1/countries/states"
        );

        if (!response.ok) {
          throw new Error("Unable to load country/state data.");
        }

        const result = (await response.json()) as {
          error?: boolean;
          data?: LocationCountry[];
        };

        if (result.error || !Array.isArray(result.data)) {
          throw new Error("Invalid country/state data received.");
        }

        if (!cancelled) {
          setData(result.data);
          localStorage.setItem(
            LOCATION_CACHE_KEY,
            JSON.stringify(result.data)
          );
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "Failed to load countries and states."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const countries = useMemo<CountryOption[]>(() => {
    const known = data.map((item) => ({ name: item.country }));
    const custom = customCountries.map((name) => ({
      name,
      isCustom: true,
    }));

    const merged = sortByName([
      ...known,
      ...custom.filter(
        (item) =>
          !known.some((knownItem) => sameName(knownItem.name, item.name))
      ),
    ]);

    return [...merged, { name: "Other", isOther: true }];
  }, [data, customCountries]);

  const states = useMemo<StateOption[]>(() => {
    if (!country || countryOther) {
      return [{ name: "Other", isOther: true }];
    }

    const knownCountry = data.find((item) => sameName(item.country, country));
    const known = knownCountry?.states?.map((item) => ({ name: item.name })) ?? [];
    const custom = customStates[country] ?? [];

    const merged = sortByName([
      ...known,
      ...custom
        .filter(
          (name) => !known.some((item) => sameName(item.name, name))
        )
        .map((name) => ({ name, isCustom: true })),
    ]);

    return [...merged, { name: "Other", isOther: true }];
  }, [country, countryOther, customStates, data]);

  const selectedCountry = countries.find((item) => sameName(item.name, country)) ?? null;
  const selectedState = states.find((item) => sameName(item.name, state)) ?? null;

  const addCountry = () => {
    const name = otherCountry.trim();
    if (!name) return;

    const existing = countries.find(
      (item) => !item.isOther && sameName(item.name, name)
    );

    if (existing) {
      setCountryOther(false);
      setOtherCountry("");
      onCountryChange(existing.name);
      onStateChange("");
      return;
    }

    const next = [...customCountries, name];
    setCustomCountries(next);
    localStorage.setItem(CUSTOM_COUNTRIES_KEY, JSON.stringify(next));
    setCountryOther(false);
    setOtherCountry("");
    onCountryChange(name);
    onStateChange("");
  };

  const addState = () => {
    const name = otherState.trim();
    if (!name || !country) return;

    const existing = states.find(
      (item) => !item.isOther && sameName(item.name, name)
    );

    if (existing) {
      setStateOther(false);
      setOtherState("");
      onStateChange(existing.name);
      return;
    }

    const current = customStates[country] ?? [];
    const nextForCountry = current.some((item) => sameName(item, name))
      ? current
      : [...current, name];

    const next = { ...customStates, [country]: nextForCountry };
    setCustomStates(next);
    localStorage.setItem(CUSTOM_STATES_KEY, JSON.stringify(next));
    setStateOther(false);
    setOtherState("");
    onStateChange(name);
  };

  return (
    <Box>
      <Autocomplete
        fullWidth
        options={countries}
        value={selectedCountry}
        loading={loading}
        disabled={disabled || loading}
        getOptionLabel={(option) => option.name}
        isOptionEqualToValue={(a, b) =>
          sameName(a.name, b.name) && Boolean(a.isOther) === Boolean(b.isOther)
        }
        onChange={(_event, option) => {
          if (!option) {
            setCountryOther(false);
            onCountryChange("");
            onStateChange("");
            return;
          }

          if (option.isOther) {
            setCountryOther(true);
            setStateOther(false);
            onCountryChange("");
            onStateChange("");
            return;
          }

          setCountryOther(false);
          setStateOther(false);
          onCountryChange(option.name);
          onStateChange("");
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            required
            label="Country"
            placeholder="Search or select country"
            sx={{ mb: countryOther ? 1 : 2 }}
            InputProps={{
              ...params.InputProps,
              endAdornment: (
                <>
                  {loading && <CircularProgress size={20} />}
                  {params.InputProps.endAdornment}
                </>
              ),
            }}
          />
        )}
      />

      {countryOther && (
        <Box display="flex" gap={1} sx={{ mb: 2 }}>
          <TextField
            fullWidth
            required
            autoFocus
            label="Other Country"
            value={otherCountry}
            disabled={disabled}
            onChange={(event) => setOtherCountry(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addCountry();
              }
            }}
            helperText="Add it once and it will appear alphabetically in the country dropdown."
          />
          <Button
            variant="outlined"
            onClick={addCountry}
            disabled={disabled || !otherCountry.trim()}
            sx={{ minHeight: 56 }}
          >
            ADD
          </Button>
        </Box>
      )}

      <Autocomplete
        fullWidth
        options={states}
        value={selectedState}
        disabled={disabled || loading || !country}
        getOptionLabel={(option) => option.name}
        isOptionEqualToValue={(a, b) =>
          sameName(a.name, b.name) && Boolean(a.isOther) === Boolean(b.isOther)
        }
        onChange={(_event, option) => {
          if (!option) {
            setStateOther(false);
            onStateChange("");
            return;
          }

          if (option.isOther) {
            setStateOther(true);
            onStateChange("");
            return;
          }

          setStateOther(false);
          onStateChange(option.name);
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            required
            label="State"
            placeholder={country ? "Search or select state" : "Select country first"}
            sx={{ mb: stateOther ? 1 : 2 }}
          />
        )}
      />

      {stateOther && (
        <Box display="flex" gap={1} sx={{ mb: 2 }}>
          <TextField
            fullWidth
            required
            autoFocus
            label="Other State"
            value={otherState}
            disabled={disabled}
            onChange={(event) => setOtherState(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addState();
              }
            }}
            helperText="Add it once and it will appear alphabetically for this country."
          />
          <Button
            variant="outlined"
            onClick={addState}
            disabled={disabled || !otherState.trim() || !country}
            sx={{ minHeight: 56 }}
          >
            ADD
          </Button>
        </Box>
      )}

      {loadError && (
        <Box sx={{ color: "error.main", fontSize: "0.8rem", mb: 2 }}>
          {loadError} Previously saved custom locations are still available.
        </Box>
      )}
    </Box>
  );
}
