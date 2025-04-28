import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { CashflowSettings } from '../types';

// Define the shape of the context data
interface SettingsContextProps {
  settings: CashflowSettings;
  updateSettings: (newSettings: Partial<CashflowSettings>) => void;
}

// Create the context with a default value (can be undefined or null initially)
// We will assert non-null when using the context with a check.
const SettingsContext = createContext<SettingsContextProps | undefined>(undefined);

// Define default settings
const defaultSettings: CashflowSettings = {
  interestRate: 7.0, // Example default
  downPaymentPercent: 20, // Example default
  loanTerm: 30, // Example default
  taxInsurancePercent: 1.7, // Example default (% of price per year, combined tax + insurance: 1.2 + 0.5)
  vacancyPercent: 5, // Example default (% of rent)
  capexPercent: 5, // Example default (% of rent, using maintenance rate)
  propertyManagementPercent: 8, // Example default (% of rent)
  rehabAmount: 0, // Example default fixed amount
};

// Local storage key
const SETTINGS_STORAGE_KEY = 'rentToolFinder_globalSettings';

// Create the Provider component
interface SettingsProviderProps {
  children: ReactNode;
}

export const SettingsProvider: React.FC<SettingsProviderProps> = ({ children }) => {
  const [settings, setSettings] = useState<CashflowSettings>(() => {
    // Load settings from local storage or use defaults
    const storedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (storedSettings) {
      try {
        // Merge stored settings with defaults to ensure all keys are present
        const parsedSettings = JSON.parse(storedSettings);
        return { ...defaultSettings, ...parsedSettings };
      } catch (e) {
        console.error("Failed to parse settings from localStorage", e);
        return defaultSettings;
      }
    }
    return defaultSettings;
  });

  // Save settings to local storage whenever they change
  useEffect(() => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  // Function to update settings (merges partial updates)
  const updateSettings = (newSettings: Partial<CashflowSettings>) => {
    setSettings(prevSettings => ({ ...prevSettings, ...newSettings }));
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

// Custom hook to use the Settings context
export const useSettings = (): SettingsContextProps => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}; 