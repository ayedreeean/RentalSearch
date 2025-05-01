import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useNavigate // Add useNavigate import
} from 'react-router-dom';
import {
  Typography, Container, TextField, Button, Box, CircularProgress, 
  Paper, IconButton, Alert,
  Slider, Modal, Select, MenuItem, FormControl, InputLabel, Tooltip,
  Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Menu, Snackbar
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import BarChartIcon from '@mui/icons-material/BarChart';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import TuneIcon from '@mui/icons-material/Tune';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import CloseIcon from '@mui/icons-material/Close';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import DeleteIcon from '@mui/icons-material/Delete';
import './App.css';
import { searchProperties, getTotalPropertiesCount, registerForPropertyUpdates, searchPropertyByAddress } from './api/propertyApi';
import PropertyDetailsPage from './pages/PropertyDetailsPage';
import { CashflowSettings, Property, Cashflow } from './types';
import BookmarksPage from './pages/BookmarksPage';
// Import the Drawer component
import Drawer from '@mui/material/Drawer';
// Import the newly created PropertyCard component
import PropertyCard from './components/PropertyCard';
// Import the scoring function
import { calculateCrunchScore } from './utils/scoring';

// Define possible sort keys
type SortableKey = keyof Pick<Property, 'price' | 'rent_estimate' | 'bedrooms' | 'bathrooms' | 'sqft' | 'days_on_market'> | 'ratio' | 'cashflow' | 'crunchScore'; // Add crunchScore

// Define structure for saved searches
interface SavedSearch {
  name: string;
  location: string;
  minPrice: string | number;
  maxPrice: string | number;
  minBeds: string;
  minBaths: string;
  // Add other filters if they exist and need saving
}

function App() {
  // --- Define state variables ---
  const [location, setLocation] = useState('');
  const [minPrice, setMinPrice] = useState<string | number>('');
  const [maxPrice, setMaxPrice] = useState<string | number>('');
  const [minBeds, setMinBeds] = useState<string>('0'); // Restore state
  const [minBaths, setMinBaths] = useState<string>('0'); // Restore state
  const [displayedProperties, setDisplayedProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(false);
  const [isProcessingBackground, setIsProcessingBackground] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchPerformed, setSearchPerformed] = useState(false);
  // ... other state variables

  // Add state for assumptions drawer
  const [isAssumptionsDrawerOpen, setIsAssumptionsDrawerOpen] = useState(false);
  
  // State for FAQ modal
  const [isFaqOpen, setIsFaqOpen] = useState(false); // Restore state
  const [activeFaqSection, setActiveFaqSection] = useState<'general' | 'search' | 'filters' | 'cashflow' | 'bookmarks' | 'details'>('general'); // Restore state
  
  // New state for marketing intro panel - always show
  const [showMarketingIntro] = useState(true);
  
  // Mortgage calculator state
  const [interestRate, setInterestRate] = useState(7.5);
  const [loanTerm, setLoanTerm] = useState(30);
  const [downPaymentPercent, setDownPaymentPercent] = useState(20);
  const [taxInsurancePercent, setTaxInsurancePercent] = useState(3);
  const [vacancyPercent, setVacancyPercent] = useState(8);
  const [capexPercent, setCapexPercent] = useState(5);
  const [propertyManagementPercent, setPropertyManagementPercent] = useState(0);
  const [rehabAmount, setRehabAmount] = useState(0); // New state for initial rehab costs

  // --- State for Saved Searches ---
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [newSearchName, setNewSearchName] = useState('');
  const [loadMenuAnchorEl, setLoadMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  // --- End Saved Searches State ---
  
  // Pagination state
  const [totalProperties, setTotalProperties] = useState(0);

  // Add state for price filter
  const [displayMinPrice, setDisplayMinPrice] = useState<string>('');
  const [displayMaxPrice, setDisplayMaxPrice] = useState<string>('');

  // Add state for sorting
  const [sortConfig, setSortConfig] = useState<{ key: SortableKey | null, direction: 'asc' | 'desc' }>({ key: 'crunchScore', direction: 'desc' }); // Default sort by crunchScore desc

  // Ref for tracking search requests
  const currentSearchId = useRef<number>(0);
  
  // --- State for Price Overrides ---
  const [overridePrices, setOverridePrices] = useState<Record<string, number>>({});

  const navigate = useNavigate(); // Initialize useNavigate

  // --- Load Saved Searches from LocalStorage ---
  useEffect(() => {
    try {
      const storedSearches = localStorage.getItem('cashflowcrunch_savedSearches');
      if (storedSearches) {
        setSavedSearches(JSON.parse(storedSearches));
      }
    } catch (error) {
      console.error("Error loading saved searches from localStorage:", error);
      // Optionally clear corrupted data
      // localStorage.removeItem('cashflowcrunch_savedSearches');
    }
  }, []);

  // --- Update LocalStorage when savedSearches change ---
  useEffect(() => {
    try {
      localStorage.setItem('cashflowcrunch_savedSearches', JSON.stringify(savedSearches));
    } catch (error) {
      console.error("Error saving searches to localStorage:", error);
    }
  }, [savedSearches]);
  // --- End LocalStorage Handling ---

  // --- Helper function to format currency (Wrap in useCallback) ---
  const formatCurrency = useCallback((amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }, []); // No dependencies, stable function

  // --- Price Input Handlers (Wrap formatPriceInput in useCallback) ---
  const formatPriceInput = useCallback((value: number | string): string => {
    if (value === '' || value === null || isNaN(Number(value))) return '';
    return formatCurrency(Number(value)); // Use existing formatCurrency
  }, [formatCurrency]); // Dependency on formatCurrency

  const parsePriceInput = (displayValue: string): number | string => {
    if (!displayValue) return '';
    const num = parseFloat(displayValue.replace(/[^\d.-]/g, '')); // Remove non-numeric chars
    return isNaN(num) ? '' : num;
  };

  // Initialize display values when component mounts or raw values change externally
  useEffect(() => {
    setDisplayMinPrice(formatPriceInput(minPrice));
  }, [minPrice, formatPriceInput]); // Add formatPriceInput dependency

  useEffect(() => {
    setDisplayMaxPrice(formatPriceInput(maxPrice));
  }, [maxPrice, formatPriceInput]); // Add formatPriceInput dependency

  const handleMinPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    setDisplayMinPrice(rawValue); // Show raw input while typing
    setMinPrice(parsePriceInput(rawValue)); // Update underlying numeric state
  };

  const handleMinPriceBlur = () => {
    setDisplayMinPrice(formatPriceInput(minPrice)); // Format on blur
  };

  const handleMinPriceFocus = () => {
    // Show raw number (or empty) on focus
    setDisplayMinPrice(minPrice === '' ? '' : String(minPrice)); 
  };

  const handleMaxPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    setDisplayMaxPrice(rawValue); // Show raw input while typing
    setMaxPrice(parsePriceInput(rawValue)); // Update underlying numeric state
  };

  const handleMaxPriceBlur = () => {
    setDisplayMaxPrice(formatPriceInput(maxPrice)); // Format on blur
  };

  const handleMaxPriceFocus = () => {
    // Show raw number (or empty) on focus
    setDisplayMaxPrice(maxPrice === '' ? '' : String(maxPrice)); 
  };

  // --- Handle Price Override Change --- 
  const handlePriceOverrideChange = useCallback((propertyId: string, newPriceString: string) => {
    const newPrice = parseFloat(newPriceString.replace(/[^\d.]/g, '')); // Clean and parse

    if (isNaN(newPrice) || newPrice <= 0) {
      console.warn(`[handlePriceOverrideChange] Invalid price value entered: ${newPriceString}. Removing override if exists.`);
      // Remove override if invalid price is entered
      setOverridePrices(prev => {
        const { [propertyId]: _, ...rest } = prev;
        return rest;
      });
      return;
    }

    console.log(`[handlePriceOverrideChange] Updating overridden price for ${propertyId} to ${newPrice}`);
    setOverridePrices(prev => ({ ...prev, [propertyId]: newPrice }));
  }, []); // No dependencies needed, it only uses its arguments and setOverridePrices

  // Function to handle search button click
  const handleSearch = async () => {
    setError(null);
    if (!location.trim()) {
      setError("Please enter a search location");
      return;
    }

    setIsProcessingBackground(false);
    setLoading(true);
    setDisplayedProperties([]);
    setSearchPerformed(true);
    setTotalProperties(0);

    const searchId = currentSearchId.current + 1;
    currentSearchId.current = searchId;

    // --- Address Detection Heuristic --- 
    // Simple check: does the input contain at least one digit?
    const looksLikeAddress = /\d/.test(location.trim());

    try {
      if (looksLikeAddress) {
        // --- Specific Address Search Path --- 
        console.log(`Attempting specific address search for: ${location}`);
        const foundProperty = await searchPropertyByAddress(location);

        if (searchId !== currentSearchId.current) return; // Check if search changed

        if (foundProperty) {
          console.log("Specific address found:", foundProperty);
          // Add to displayed properties (might be useful if navigating back)
          setDisplayedProperties([foundProperty]); 
          // Navigate directly to the property details page
          navigate(`/property/${foundProperty.property_id}`);
          // No background processing needed here as we have the full details
          setIsProcessingBackground(false);
        } else {
          console.log(`Specific address not found or failed to process: ${location}`);
          setError(`Could not find details for address: ${location}`);
          setIsProcessingBackground(false);
        }
        setLoading(false); // Turn off loading after address search attempt

      } else {
        // --- General Location Search Path (Existing Logic) --- 
        console.log(`Performing general location search for: ${location}`);
        // --- Prepare Filters & Prices --- 
        let minP: number | null = null;
        let maxP: number | null = null;
        let minBd: number | null = null;
        let minBa: number | null = null;

        // Parse Min Price
        const parsedMin = typeof minPrice === 'number' ? minPrice : parseFloat(String(minPrice).replace(/[^\d.]/g, ''));
        if (!isNaN(parsedMin) && parsedMin >= 0) {
            minP = parsedMin;
            console.log('Applying Min price filter:', minP);
        }
        
        // Parse Max Price
        const parsedMax = typeof maxPrice === 'number' ? maxPrice : parseFloat(String(maxPrice).replace(/[^\d.]/g, ''));
        if (!isNaN(parsedMax) && parsedMax > 0) {
            maxP = parsedMax;
            console.log('Applying Max price filter:', maxP);
        }
        
        // Parse Bed Filters
        const parsedMinBeds = parseInt(minBeds, 10);
        if (!isNaN(parsedMinBeds) && parsedMinBeds >= 0) {
          minBd = parsedMinBeds;
        }

        // Parse Bath Filters
        const parsedMinBaths = parseFloat(minBaths);
        if (!isNaN(parsedMinBaths) && parsedMinBaths >= 0) {
          minBa = parsedMinBaths;
        }

        const propertyType = 'Houses'; // Or make this configurable

        // Get total properties first, passing the filters
        console.log('Fetching total property count with filters...');
        const totalCount = await getTotalPropertiesCount(location, minP, maxP, minBd, minBa, propertyType);
        
        if (searchId !== currentSearchId.current) return; // Check if search changed
        setTotalProperties(totalCount);
        console.log('Total properties found with filters:', totalCount);

        if (totalCount === 0) {
          setLoading(false);
          return;
        }

        const totalPages = Math.ceil(totalCount / 42); // Assuming API limit
        
        // Function to fetch and process a single page, passing filters
        const fetchAndProcessPage = async (page: number) => {
          if (searchId !== currentSearchId.current) return; // Abort if new search started
          try {
            console.log(`Fetching page ${page + 1}/${totalPages} with filters...`);
            // Pass the parsed filters (minP, maxP, minBd, minBa) to searchProperties
            const results = await searchProperties(location, page, minP, maxP, minBd, minBa, propertyType, null);
            
            if (searchId === currentSearchId.current && results.allProperties.length > 0) {
              setDisplayedProperties(prev => {
                const existingIds = new Set(prev.map(p => p.property_id));
                const newProps = results.allProperties.filter(np => !existingIds.has(np.property_id));
                return [...prev, ...newProps];
              });
              if (!isProcessingBackground) setIsProcessingBackground(true); 
            }
          } catch (error) {
            console.error(`Error fetching page ${page + 1}:`, error);
          }
        };

        // Fetch all pages concurrently
        console.log(`Starting fetch for ${totalPages} pages.`);
        const pagePromises = Array.from({ length: totalPages }, (_, i) => fetchAndProcessPage(i));
        await Promise.all(pagePromises);

        console.log('All page fetches initiated or completed.');
        // setLoading(false); // Keep loading until background processing finishes (handled by handlePropertyUpdate)
      }

    } catch (error) {
      console.error("Error during search", error);
      if (searchId === currentSearchId.current) { // Only set error if it's for the current search
        setError("Failed to search properties. Please try again later.");
        setLoading(false);
        setIsProcessingBackground(false);
      }
    } 
    // Removed final setLoading(false) here - it's handled when updates complete or specific address search finishes
  };

  // --- Saved Search Handlers ---
  const handleOpenSaveDialog = () => {
    // Pre-fill name suggestion if needed, e.g., based on location
    setNewSearchName(location ? `${location} Search` : '');
    setSaveDialogOpen(true);
  };

  const handleCloseSaveDialog = () => {
    setSaveDialogOpen(false);
    setNewSearchName(''); // Clear name input on close
  };

  const handleSaveSearch = () => {
    if (!newSearchName.trim()) {
        setSnackbarMessage('Please enter a name for the search.');
        setSnackbarOpen(true);
        return;
    }
    const newSave: SavedSearch = {
      name: newSearchName.trim(),
      location,
      minPrice,
      maxPrice,
      minBeds,
      minBaths
    };

    // Check if name already exists, overwrite if it does
    const existingIndex = savedSearches.findIndex(s => s.name === newSave.name);
    let updatedSearches;
    if (existingIndex > -1) {
        updatedSearches = [...savedSearches];
        updatedSearches[existingIndex] = newSave;
        setSnackbarMessage(`Search '${newSave.name}' updated.`);
        } else {
        updatedSearches = [...savedSearches, newSave];
        setSnackbarMessage(`Search '${newSave.name}' saved.`);
    }

    setSavedSearches(updatedSearches);
    setSnackbarOpen(true);
    handleCloseSaveDialog();
  };

  const handleOpenLoadMenu = (event: React.MouseEvent<HTMLElement>) => {
    setLoadMenuAnchorEl(event.currentTarget);
  };

  const handleCloseLoadMenu = () => {
    setLoadMenuAnchorEl(null);
  };

  const handleLoadSearch = (searchToLoad: SavedSearch) => {
    setLocation(searchToLoad.location);
    setMinPrice(searchToLoad.minPrice);
    setMaxPrice(searchToLoad.maxPrice);
    setMinBeds(searchToLoad.minBeds);
    setMinBaths(searchToLoad.minBaths);
    // Update display prices immediately
    setDisplayMinPrice(formatPriceInput(searchToLoad.minPrice));
    setDisplayMaxPrice(formatPriceInput(searchToLoad.maxPrice));

    handleCloseLoadMenu();
    setSnackbarMessage(`Loaded search: '${searchToLoad.name}'`);
    setSnackbarOpen(true);
    // Automatically trigger the search after loading
    handleSearch();
  };

  const handleDeleteSearch = (nameToDelete: string) => {
    setSavedSearches(prevSearches => prevSearches.filter(s => s.name !== nameToDelete));
    setSnackbarMessage(`Deleted search: '${nameToDelete}'`);
    setSnackbarOpen(true);
    handleCloseLoadMenu(); // Close menu after delete
  };

  const handleCloseSnackbar = (event?: React.SyntheticEvent | Event, reason?: string) => {
      if (reason === 'clickaway') {
          return;
      }
      setSnackbarOpen(false);
  };

  // --- End Saved Search Handlers ---


  // --- Mortgage Calculation and Cashflow ---
  // Function to calculate mortgage payment
  const calculateMortgage = (price: number): number => {
    const downPayment = price * (downPaymentPercent / 100);
    const loanAmount = price - downPayment;
    const monthlyRate = interestRate / 100 / 12;
    const payments = loanTerm * 12;
    
    if (monthlyRate === 0) return loanAmount / payments;
    
    const x = Math.pow(1 + monthlyRate, payments);
    return loanAmount * (monthlyRate * x) / (x - 1);
  };
  
  // Function to calculate cashflow
  // Ensure this uses the imported Property and Cashflow types
  const calculateCashflow = useCallback((property: Property): Cashflow => {
    // Use override price if it exists, otherwise use property price
    const propertyPrice = overridePrices[property.property_id] ?? property.price;
    
    // Get final rent value - use custom rent if available
    const rentEstimate = 
      property.rent_estimate;
    
    // Calculate mortgage as a monthly expense
    const monthlyMortgage = calculateMortgage(propertyPrice);
    
    // Calculate tax and insurance (monthly)
    const annualTaxInsurance = propertyPrice * (taxInsurancePercent / 100);
    const monthlyTaxInsurance = annualTaxInsurance / 12;
    
    // Calculate vacancy (monthly)
    const monthlyVacancy = rentEstimate * (vacancyPercent / 100);
    
    // Calculate capital expenditures (capex)
    const monthlyCapex = rentEstimate * (capexPercent / 100);
    
    // Calculate property management fees (if any)
    const monthlyPropertyManagement = rentEstimate * (propertyManagementPercent / 100);
    
    // Calculate total monthly expenses
    const totalMonthlyExpenses = monthlyMortgage + monthlyTaxInsurance + monthlyVacancy + monthlyCapex + monthlyPropertyManagement;
    
    // Calculate cashflow
    const monthlyCashflow = rentEstimate - totalMonthlyExpenses;
    const annualCashflow = monthlyCashflow * 12;
    
    // Calculate cash on cash return
    const downPaymentAmount = propertyPrice * (downPaymentPercent / 100);
    const totalInitialInvestment = downPaymentAmount + rehabAmount;
    const cashOnCashReturn = totalInitialInvestment > 0 ? (annualCashflow / totalInitialInvestment) * 100 : 0;
    
    return {
      monthlyMortgage,
      monthlyTaxInsurance,
      monthlyVacancy,
      monthlyCapex,
      monthlyPropertyManagement,
      totalMonthlyExpenses,
      monthlyCashflow,
      annualCashflow,
      cashOnCashReturn
    };
  }, [interestRate, loanTerm, downPaymentPercent, taxInsurancePercent, vacancyPercent, capexPercent, propertyManagementPercent, rehabAmount, overridePrices, calculateMortgage]);
  
  // Helper function to format percentage
  const formatPercent = (percent: number): string => {
    return `${(percent).toFixed(2)}%`;
  };
  
  // Default settings for PropertyDetailsPage
  const defaultSettings: CashflowSettings = {
    interestRate,
    loanTerm,
    downPaymentPercent,
    taxInsurancePercent,
    vacancyPercent,
    capexPercent,
    propertyManagementPercent,
    rehabAmount
  };

  // --- Sorting Logic ---
  // Helper function for sorting
  const sortProperties = useCallback((
    properties: Property[], 
    key: SortableKey | null, 
    direction: 'asc' | 'desc', 
    calculateCashflowFn: (p: Property) => Cashflow, 
    priceOverrides: Record<string, number>,
    settings: CashflowSettings // Add settings parameter
  ): Property[] => {
      if (!key) return properties;

      const sorted = [...properties].sort((a, b) => {
          let valA: number | string | null | undefined = null;
          let valB: number | string | null | undefined = null;
          
          const priceA = priceOverrides[a.property_id] !== undefined ? priceOverrides[a.property_id] : a.price;
          const priceB = priceOverrides[b.property_id] !== undefined ? priceOverrides[b.property_id] : b.price;
          const propertyAForCalc = { ...a, price: priceA };
          const propertyBForCalc = { ...b, price: priceB };

          if (key === 'ratio') {
            valA = priceA > 0 ? a.rent_estimate / priceA : 0;
            valB = priceB > 0 ? b.rent_estimate / priceB : 0;
          } else if (key === 'cashflow') {
              const cashflowA = calculateCashflowFn(propertyAForCalc);
              const cashflowB = calculateCashflowFn(propertyBForCalc);
              valA = cashflowA.monthlyCashflow;
              valB = cashflowB.monthlyCashflow;
          } else if (key === 'crunchScore') {
              // Use the full calculateCrunchScore utility function
              const cashflowA = calculateCashflowFn(propertyAForCalc);
              const cashflowB = calculateCashflowFn(propertyBForCalc);
              // Pass the provided settings object
              valA = calculateCrunchScore(propertyAForCalc, settings, cashflowA);
              valB = calculateCrunchScore(propertyBForCalc, settings, cashflowB);
          } else if (key === 'price') {
              valA = priceA;
              valB = priceB;
          } else {
              valA = a[key as keyof Property]; // Use original property data for other keys
              valB = b[key as keyof Property];
          }
          
          // Handle null/undefined
          if (valA === null || valA === undefined) valA = 0;
          if (valB === null || valB === undefined) valB = 0;
          
          // Sort logic with explicit type checks and casting
          if (typeof valA === 'string' && typeof valB === 'string') {
              return direction === 'asc' 
                ? (valA as string).localeCompare(valB as string) 
                : (valB as string).localeCompare(valA as string);
          } else {
              const numA = Number(valA);
              const numB = Number(valB);
              
              if (isNaN(numA) || isNaN(numB)) {
                  const safeA = isNaN(numA) ? 0 : numA;
                  const safeB = isNaN(numB) ? 0 : numB;
                  return direction === 'asc' ? safeA - safeB : safeB - safeA;
              }
              
              return direction === 'asc' ? numA - numB : numB - numA;
          }
      });
      
      return sorted;
  // Add settings dependencies to useCallback
  }, [calculateCrunchScore, calculateCashflow]); 

  // --- Add useEffect for handling property updates ---
  const handlePropertyUpdate = useCallback((updatedProperty: Property) => {
    console.log('[handlePropertyUpdate] Called for property:', updatedProperty?.address);
    if (!updatedProperty || !updatedProperty.property_id) {
      console.error('[handlePropertyUpdate] Received invalid property data.');
      return;
    }
    
    setDisplayedProperties(prevProperties => {
      // --- Add Check: Only update if list isn't cleared by new search --- 
      if (prevProperties.length === 0 && searchPerformed) { // Check searchPerformed flag
        console.log('[handlePropertyUpdate] Ignoring update, list is empty (likely new search started).');
        return prevProperties; // Return unchanged state
      }
      
      // Check if property already exists
      const exists = prevProperties.some(p => p.property_id === updatedProperty.property_id);
      if (exists) {
        // If it exists, update it in place
         console.log(`[handlePropertyUpdate] Updating existing property: ${updatedProperty.property_id}`);
        return prevProperties.map(p =>
          p.property_id === updatedProperty.property_id ? updatedProperty : p
        );
      } else {
        // Add the newly completed property
           console.log(`[handlePropertyUpdate] Adding new property: ${updatedProperty.property_id}`);
        const newPropertyList = [...prevProperties, updatedProperty];
        
          // Sort based on current config, passing current settings
          if (sortConfig.key) {
            const currentSettings: CashflowSettings = defaultSettings; // Get current settings
            return sortProperties(newPropertyList, sortConfig.key, sortConfig.direction, calculateCashflow, overridePrices, currentSettings);
          } else {
            return newPropertyList;
          }
      }
    });

    // --- Check if all properties are loaded --- 
    setDisplayedProperties(currentProperties => {
      // Add a small delay to allow state updates to settle before checking counts
       const timer = setTimeout(() => {
            if (totalProperties > 0 && currentProperties.length >= totalProperties) {
              console.log('All properties processed. Setting loading states to false.');
            setLoading(false);
              setIsProcessingBackground(false);
            } else if (currentProperties.length > 0 && !initialLoading) {
              // Only set background processing if initial loading is complete
              setIsProcessingBackground(true);
            }
       }, 100); // Short delay (e.g., 100ms)
       // Return state unchanged, we just need to trigger the check
       // Make sure to clear the timer if component unmounts or deps change
       // Although this setter form doesn't directly cause unmounts/dep changes,
       // best practice is to handle cleanup if needed, but here it might be okay.
       // For simplicity, we'll omit explicit cleanup here, but be aware in complex scenarios.
       return currentProperties; 
    });

  }, [sortConfig, totalProperties, calculateCashflow, searchPerformed, initialLoading, overridePrices, sortProperties, defaultSettings]); // Add missing dependencies

  // UseEffect to register for updates when component mounts
  useEffect(() => {
    console.log('Registering for property updates...');
    registerForPropertyUpdates(handlePropertyUpdate);

    // Optional: Return a cleanup function if needed
    // return () => {
    //   unregisterForPropertyUpdates(); // Assuming an unregister function exists
    // };
  }, [handlePropertyUpdate]);

  // --- Sorting Logic ---
  const handleSort = useCallback((key: SortableKey) => {
    setSortConfig(prevConfig => ({ 
      key, 
      direction: prevConfig.key === key 
        ? (prevConfig.direction === 'asc' ? 'desc' : 'asc')
        : 'desc' // Default to descending order when changing keys
    }));
  }, []);

  const sortedProperties = useMemo(() => {
      // Pass overridePrices and current settings to the sort function
      const currentSettings: CashflowSettings = defaultSettings; // Get current settings
      return sortProperties(displayedProperties, sortConfig.key, sortConfig.direction, calculateCashflow, overridePrices, currentSettings);
  // Update dependencies for useMemo
  }, [displayedProperties, sortConfig, calculateCashflow, overridePrices, sortProperties, defaultSettings]); 

  // --- Rent Estimate Handling ---
  const handleRentEstimateChange = useCallback((propertyId: string, newRentString: string) => {
    const newRent = parseFloat(newRentString.replace(/[^\d.]/g, '')); // Clean and parse

    if (isNaN(newRent) || newRent < 0) {
      console.warn(`[handleRentEstimateChange] Invalid rent value entered: ${newRentString}`);
      return;
    }

    console.log(`[handleRentEstimateChange] Updating rent for ${propertyId} to ${newRent}`);
    setDisplayedProperties(prev =>
      prev.map(p =>
        p.property_id === propertyId
          ? { ...p, rent_estimate: newRent } // Update the rent estimate
          : p
      )
    );
  }, []); // No dependencies needed
  
  // --- FAQ Handlers ---
  const handleOpenFaq = () => {
    setIsFaqOpen(true);
  };
  
  const handleCloseFaq = () => {
    setIsFaqOpen(false);
  };
  
  const handleFaqSectionChange = (section: string) => {
    setActiveFaqSection(section as 'general' | 'search' | 'filters' | 'cashflow' | 'bookmarks' | 'details');
  };
  
  // --- Other UI Handlers ---
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Effect to show/hide scroll-to-top button
  useEffect(() => {
    const handleScroll = () => {
      // Code to handle scroll if needed
    };
    
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Function to toggle the assumptions drawer
  const toggleAssumptionsDrawer = (open: boolean) => (
    event: React.KeyboardEvent | React.MouseEvent,
  ) => {
    if (
      event.type === 'keydown' &&
      ((event as React.KeyboardEvent).key === 'Tab' ||
        (event as React.KeyboardEvent).key === 'Shift')
    ) {
      return;
    }
    setIsAssumptionsDrawerOpen(open);
  };

  
  return (
    <div className="app-container"> 
      {/* --- Header Removed from here --- */}

      <Routes>
        <Route path="/" element={
          <>
            {/* --- Header Moved inside the root route element --- */}
            <header className="app-header">
              <div className="container">
                <div className="header-content">
                  <div>
                    <Typography 
                      className="app-title" 
                      variant="h4" 
                      component="h1"
                      sx={{ 
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        '&:hover': { opacity: 0.9 }
                      }}
                      onClick={() => window.location.href = '#/'}
                    >
                       <img src={process.env.PUBLIC_URL + '/logo-optimized.png'} alt="CashflowCrunch Logo" style={{ height: '40px', width: '40px', marginRight: '8px', verticalAlign: 'middle' }} />
                      CashflowCrunch
      </Typography>
                    <Typography className="app-subtitle" variant="subtitle1" component="p">
                      Find properties with investment potential
                    </Typography>
                  </div>
                  <div className="header-actions">
                    <Button 
                      variant="outlined" 
                      onClick={handleOpenFaq}
                      className="help-button"
                      startIcon={<HelpOutlineIcon />}
                      sx={{ mr: 2 }}
                    >
                       FAQ
                    </Button>
                    <Button 
                      variant="outlined" 
                      component="a"
                      href="#/bookmarks"
                      className="bookmarks-button"
                      startIcon={<BookmarkIcon />}
                    >
                      Bookmarks
                    </Button>
                  </div>
                </div>
              </div>
            </header>
            
            {/* --- Rest of the root route content --- */}
            <Container maxWidth="lg" sx={{ py: 3 }}>
              {/* Marketing intro section */}
              {showMarketingIntro && (
                <Paper 
                  elevation={3} 
                  sx={{ 
                    mb: 3, // Reduced bottom margin
                    borderRadius: 2, // Slightly smaller border radius
                    overflow: 'hidden',
                    position: 'relative',
                    background: '#ffffff',
                    boxShadow: '0 8px 25px rgba(79, 70, 229, 0.12)' // Adjusted shadow
                  }}
                >
                  {/* Colored stripe at the top */}
                  <Box 
                    sx={{ 
                      height: '4px', // Thinner stripe 
                      background: 'linear-gradient(90deg, #4f46e5, #6366f1, #818cf8)'
                    }} 
                  />
                  
                  {/* Main content */}
                  <Box 
                    sx={{ 
                      display: 'flex', 
                      flexDirection: { xs: 'column', md: 'row' },
                      alignItems: 'center'
                    }}
                  >
                    {/* Left side content */}                    <Box 
                      sx={{ 
                        p: { xs: 2, sm: 3 }, // Reduced padding
                        flex: '1.5',
                        position: 'relative',
                        zIndex: 1
                      }}
                    >
                      <Typography 
                        variant="h4" // Reduced from h3
                        fontWeight="bold" 
                        sx={{ 
                          mb: 1.5, // Reduced bottom margin
                          color: '#1f2937',
                          fontSize: { xs: '1.5rem', sm: '1.8rem', md: '2rem' } // Smaller font sizes
                        }}
                      >
                        Find Your Ideal
                        <Box 
                          component="span" 
                          sx={{ 
                            color: '#4f46e5',
                            display: 'block' 
                          }}
                        >
                          Investment Property
                        </Box>
                      </Typography>
                      
                      <Typography 
                        variant="body1" // Keep as body1, maybe slightly smaller line height if needed
                        sx={{ 
                          mb: 2, // Reduced bottom margin
                          color: '#4b5563',
                          lineHeight: 1.5, // Slightly reduced line height
                          maxWidth: '500px',
                          fontSize: '0.95rem' // Slightly smaller font size
                        }}
                      >
                        CashflowCrunch helps you discover and analyze potential real estate investments in seconds. 
                        Get detailed cash flow analysis and returns on investment for properties.
                      </Typography>
                      
                      <Box 
                        sx={{ 
                          display: 'flex', 
                          flexDirection: { xs: 'column', sm: 'row' },
                          gap: 1.5, // Reduced gap
                          mt: 2 // Reduced top margin
                        }}
                      >
                        {/* Removed the two feature boxes for brevity */}
                          </Box>
                        </Box>
                        
                    {/* Right side image/graphic element */}                    <Box 
                          sx={{ 
                        flex: '1',
                        position: 'relative',
                        display: { xs: 'none', md: 'flex' }, 
                        alignSelf: 'stretch',
                              alignItems: 'center', 
                              justifyContent: 'center', 
                        minHeight: '200px' 
                      }}
                    >
                      <Box
                        sx={{
                          position: 'absolute',
                          top: 0,
                          right: 0,
                          bottom: 0,
                          left: 0,
                          // Combine bolder gradient and stripe pattern
                          background: `
                            repeating-linear-gradient(45deg, rgba(255,255,255,0.08), rgba(255,255,255,0.08) 5px, transparent 5px, transparent 10px),
                            linear-gradient(135deg, rgba(79, 70, 229, 0.8) 0%, rgba(99, 102, 241, 0.8) 100%)
                          `, 
                          clipPath: 'polygon(10% 0, 100% 0, 100% 100%, 0% 100%)',
                          overflow: 'hidden'
                        }}
                      /> {/* Changed to JSX comment */}
                      
                      {/* Content stays relative on top */}
                      <Box sx={{ position: 'relative', zIndex: 1, p: 2, textAlign: 'center' }}>
                        <img src={process.env.PUBLIC_URL + '/logo-optimized.png'} alt="CashflowCrunch Logo" style={{ height: '120px', width: '120px', marginBottom: '8px' }} /> 
                        <Typography variant="h6" fontWeight="bold" gutterBottom sx={{ color: 'white' }}> {/* Changed color to white */}
                          Start Crunching! {/* Changed text */}
                          </Typography>
                      </Box>
                    </Box>
                  </Box>
                </Paper>
              )}
              
              {/* Search Controls (Moved inside Container) */}
              <Paper elevation={2} sx={{ p: { xs: 2, sm: 3 }, mb: 4, borderRadius: 2 }}>
                <Typography variant="h5" component="h2" gutterBottom fontWeight="medium">
                  Search Rental Properties
                </Typography>
                {/* Main form container - Stack vertically */}
                <Box component="form" onSubmit={(e) => { e.preventDefault(); handleSearch(); }} sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1, sm: 2 } }}> {/* Reduced gap on xs */}
                  {/* Input fields row - Allow wrapping */}
                  <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: { xs: 1, sm: 2 }, flexWrap: 'wrap' }}> {/* Reduced gap on xs */}
                     {/* Location Input - Allow grow */}
        <TextField
                      label="Location (City, State or Zip Code)"
                      variant="outlined"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
                      required
                      // Apply flex only for sm+, use width for xs
                      sx={{ width: { xs: '100%' }, flex: { sm: '1 1 300px' }, mt: { xs: 0 }, mb: { xs: 0 } }} 
                    />
                  {/* Price filters */}
                    {/* Apply flex only for sm+, use width for xs */}
                    <Box sx={{ display: 'flex', gap: 2, width: { xs: '100%' }, flex: { sm: '1 1 250px' }, mt: { xs: 0 }, mb: { xs: 0 } }}> 
                    <TextField
                      label="Min Price"
                      value={displayMinPrice}
                      onChange={handleMinPriceChange}
                      onBlur={handleMinPriceBlur}
                      onFocus={handleMinPriceFocus}
                      variant="outlined"
                      size="medium"
                          sx={{ flex: 1 }} // Equal width within this group
                    />
                    <TextField
                      label="Max Price"
                      value={displayMaxPrice}
                      onChange={handleMaxPriceChange}
                      onBlur={handleMaxPriceBlur}
                      onFocus={handleMaxPriceFocus}
                      variant="outlined"
                      size="medium"
                          sx={{ flex: 1 }} // Equal width within this group
                        />
                    </Box>
                    {/* Bed/Bath Filters */}
                    {/* Apply flex only for sm+, use width for xs */}
                    <Box sx={{ display: 'flex', gap: 2, width: { xs: '100%' }, flex: { sm: '1 1 250px' }, mt: { xs: 0 }, mb: { xs: 0 } }}> 
                      <FormControl size="medium" sx={{ minWidth: 120, flex: 1, mt: { xs: 0 }, mb: { xs: 0 } }}> {/* Remove xs margins */}
                    <InputLabel id="min-beds-label">Min Beds</InputLabel>
                    <Select
                      labelId="min-beds-label"
                      value={minBeds}
                      label="Min Beds"
                      onChange={(e) => setMinBeds(e.target.value)}
                    >
                            <MenuItem value="0"><em>Any</em></MenuItem>
                            <MenuItem value="1">1+</MenuItem>
                            <MenuItem value="2">2+</MenuItem>
                            <MenuItem value="3">3+</MenuItem>
                            <MenuItem value="4">4+</MenuItem>
                            <MenuItem value="5">5+</MenuItem>
                    </Select>
                  </FormControl>

                        <FormControl size="medium" sx={{ minWidth: 120, flex: 1, mt: { xs: 0 }, mb: { xs: 0 } }}> {/* Remove xs margins */}
                    <InputLabel id="min-baths-label">Min Baths</InputLabel>
                    <Select
                      labelId="min-baths-label"
                      value={minBaths}
                      label="Min Baths"
                      onChange={(e) => setMinBaths(e.target.value)}
                    >
                            <MenuItem value="0"><em>Any</em></MenuItem>
                            <MenuItem value="1">1+</MenuItem>
                            <MenuItem value="1.5">1.5+</MenuItem>
                            <MenuItem value="2">2+</MenuItem>
                            <MenuItem value="3">3+</MenuItem>
                            <MenuItem value="4">4+</MenuItem>
                    </Select>
                  </FormControl>
                      </Box>
                   </Box> 
                  
                  {/* Buttons row - Center align items */}
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, flexWrap: 'wrap', flexDirection: 'column', alignItems: 'center' }}>
                    {/* Main Search Button */}
        <Button 
                    type="submit"
          variant="contained" 
                      startIcon={<SearchIcon />}
                      size="large"
                      disabled={loading}
                      // Full width on xs, auto on sm+
                      sx={{ height: '56px', whiteSpace: 'nowrap', px: 3, order: 1, width: { xs: '100%', sm: 'auto' } }} // Order first now
                    >
                      {loading ? <CircularProgress size={24} color="inherit" /> : 'Crunch Properties'}
        </Button>

                    {/* Save/Load Text Buttons Below */}
                    <Box sx={{ display: 'flex', gap: 1, order: 2, mt: 1 }}> {/* Order second now, add margin top */}
                      <Tooltip title="Save current search criteria">
                        {/* Use span to allow tooltip when button is disabled */}
                        <span style={{ display: 'inline-block' }}>
                            <Button
                              variant="text"
                              onClick={handleOpenSaveDialog}
                              size="small"
                              disabled={!location}
                              aria-label="Save search"
                              sx={{ textTransform: 'none' }} // Prevent uppercase
                            >
                              Save Search
                            </Button>
                        </span>
                      </Tooltip>
                      <Tooltip title="Load saved search">
                         {/* Use span to allow tooltip when button is disabled */}
                         <span style={{ display: 'inline-block' }}>
                            <Button
                              variant="text"
                              onClick={handleOpenLoadMenu}
                              size="small"
                              disabled={savedSearches.length === 0}
                              aria-label="Load saved search"
                              sx={{ textTransform: 'none' }} // Prevent uppercase
                            >
                              Load Search
                            </Button>
                         </span>
                      </Tooltip>
      </Box>
                  </Box>
                </Box> { /* End of main form Box */ }
              </Paper>


              {/* Load Saved Search Menu */}
              <Menu
                anchorEl={loadMenuAnchorEl}
                open={Boolean(loadMenuAnchorEl)}
                onClose={handleCloseLoadMenu}
              >
                {savedSearches.length === 0 ? (
                   <MenuItem disabled>No saved searches</MenuItem>
                 ) : (
                   savedSearches.map((search) => (
                    <MenuItem
                       key={search.name}
                       onClick={() => handleLoadSearch(search)}
                       sx={{ display: 'flex', justifyContent: 'space-between', minWidth: '200px' }}
                     >
                      {search.name}
                      <Tooltip title="Delete search">
                         <IconButton
                           edge="end"
                           aria-label="delete"
                           size="small"
                           onClick={(e) => {
                             e.stopPropagation(); // Prevent menu item click
                             handleDeleteSearch(search.name);
                           }}
                           sx={{ ml: 2 }}
                         >
                           <DeleteIcon fontSize="inherit" />
                         </IconButton>
                       </Tooltip>
                     </MenuItem>
                   ))
                 )}
              </Menu>

              {/* Save Search Dialog */}
              <Dialog open={saveDialogOpen} onClose={handleCloseSaveDialog}>
                <DialogTitle>Save Search</DialogTitle>
                <DialogContent>
                  <DialogContentText sx={{ mb: 2 }}>
                    Enter a name for your current search criteria (Location, Price, Filters).
                  </DialogContentText>
                  <TextField
                    autoFocus
                    margin="dense"
                    id="search-name"
                    label="Search Name"
                    type="text"
                    fullWidth
                    variant="standard"
                    value={newSearchName}
                    onChange={(e) => setNewSearchName(e.target.value)}
                    onKeyPress={(e) => { if (e.key === 'Enter') handleSaveSearch(); }} // Allow Enter key to save
                  />
                </DialogContent>
                <DialogActions>
                  <Button onClick={handleCloseSaveDialog}>Cancel</Button>
                  <Button onClick={handleSaveSearch} variant="contained">Save</Button>
                </DialogActions>
              </Dialog>

              {/* Snackbar for feedback */}
              <Snackbar
                  open={snackbarOpen}
                  autoHideDuration={4000} // Hide after 4 seconds
                  onClose={handleCloseSnackbar}
                  message={snackbarMessage}
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
              />
              
              {/* Assumptions Tab */}
              <Tooltip title="Adjust mortgage and cashflow assumptions" placement="left">
                <div 
                  className="assumptions-tab"
                  onClick={() => setIsAssumptionsDrawerOpen(!isAssumptionsDrawerOpen)}
                  style={{
                    position: 'fixed',
                    right: isAssumptionsDrawerOpen ? 'var(--drawer-width, 300px)' : '0',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    backgroundColor: '#4f46e5',
                    color: 'white',
                    padding: '12px 8px',
                    borderRadius: '8px 0 0 8px',
                    cursor: 'pointer',
                    zIndex: 1250,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
                    transition: 'right 225ms cubic-bezier(0, 0, 0.2, 1) 0ms'
                  }}>
                  <TuneIcon />
                  <span style={{ 
                    writingMode: 'vertical-rl', 
                    textOrientation: 'mixed', 
                    transform: 'rotate(180deg)',
                    marginTop: '8px',
                    fontWeight: 'bold',
                    letterSpacing: '1px',
                    fontSize: '14px'
                  }}>Assumptions</span>
                </div>
              </Tooltip>
              
              {/* Assumptions Drawer */}
              <Drawer
                anchor="right"
                open={isAssumptionsDrawerOpen}
                onClose={() => setIsAssumptionsDrawerOpen(false)}
                className="assumptions-drawer"
                sx={{
                  '& .MuiDrawer-paper': {
                    width: '300px',
                    maxWidth: '80vw',
                    boxSizing: 'border-box',
                    padding: 2,
                    borderTopLeftRadius: 0,
                    borderBottomLeftRadius: 0,
                    overflowY: 'auto',
                  },
                  '& .MuiBackdrop-root': {
                    backgroundColor: 'rgba(0, 0, 0, 0.2)'
                  }
                }}
                // Use ref to update CSS variable with actual drawer width
                ref={(node) => {
                  if (node && isAssumptionsDrawerOpen) {
                    const drawerPaper = node.querySelector('.MuiDrawer-paper');
                    if (drawerPaper) {
                      const width = drawerPaper.getBoundingClientRect().width;
                      document.documentElement.style.setProperty('--drawer-width', `${width}px`);
                    }
                  }
                }}
                transitionDuration={225}
                SlideProps={{
                  easing: {
                    enter: 'cubic-bezier(0, 0, 0.2, 1)',
                    exit: 'cubic-bezier(0.4, 0, 0.6, 1)'
                  }
                }}
              >
                <Typography variant="h6" fontWeight="medium" gutterBottom> 
                  Mortgage & Cashflow Assumptions
            </Typography>
            
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" gutterBottom>Interest Rate: {interestRate}%</Typography>
              <Slider
                value={interestRate}
                    onChange={(e, newValue) => setInterestRate(newValue as number)}
                    aria-labelledby="interest-rate-slider"
                valueLabelDisplay="auto"
                    step={0.1}
                    min={0.1}
                    max={15}
                    sx={{ color: '#4f46e5' }}
              />
            </Box>
            
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" gutterBottom>Loan Term: {loanTerm} years</Typography>
              <Slider
                value={loanTerm}
                    onChange={(e, newValue) => setLoanTerm(newValue as number)}
                    aria-labelledby="loan-term-slider"
                valueLabelDisplay="auto"
                    step={1}
                    min={5}
                    max={40}
                    sx={{ color: '#4f46e5' }}
              />
            </Box>
            
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" gutterBottom>Down Payment: {downPaymentPercent}%</Typography>
              <Slider
                value={downPaymentPercent}
                    onChange={(e, newValue) => setDownPaymentPercent(newValue as number)}
                    aria-labelledby="down-payment-slider"
                valueLabelDisplay="auto"
                    step={1}
                    min={0}
                    max={100}
                    sx={{ color: '#4f46e5' }}
              />
            </Box>

               {/* --- Add Initial Rehab Slider --- */}
               <Box sx={{ mb: 2 }}>
                 <Typography variant="body2" gutterBottom>
                   <Tooltip title="Initial rehab costs needed before renting. This amount is added to your total investment when calculating ROI." arrow>
                     <span>Initial Rehab: {formatCurrency(rehabAmount)}</span>
                   </Tooltip>
                 </Typography>
                 <Slider 
                   value={rehabAmount} 
                   onChange={(e, value) => setRehabAmount(value as number)} 
                   min={0} 
                   max={100000} // Increased max to 100k
                   step={500} 
                   valueLabelDisplay="auto" 
                   valueLabelFormat={(value) => formatCurrency(value as number)} // Ensure value is cast to number
                   sx={{ color: '#4f46e5' }} 
                 />
               </Box>
               {/* --- End Initial Rehab Slider --- */}
            
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" gutterBottom>Property Tax & Insurance: {taxInsurancePercent}%</Typography>
              <Slider
                value={taxInsurancePercent}
                    onChange={(e, value) => setTaxInsurancePercent(value as number)}
                    min={0}
                    max={5}
                step={0.1}
                valueLabelDisplay="auto"
                valueLabelFormat={(value) => `${value}%`}
                    sx={{ color: '#4f46e5' }}
              />
            </Box>
            
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" gutterBottom>Vacancy: {vacancyPercent}%</Typography>
              <Slider
                value={vacancyPercent}
                    onChange={(e, value) => setVacancyPercent(value as number)}
                min={0}
                max={10}
                step={1}
                valueLabelDisplay="auto"
                valueLabelFormat={(value) => `${value}%`}
                    sx={{ color: '#4f46e5' }}
              />
            </Box>
            
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" gutterBottom>CapEx: {capexPercent}%</Typography>
              <Slider
                value={capexPercent}
                    onChange={(e, value) => setCapexPercent(value as number)}
                min={0}
                max={10}
                step={1}
                valueLabelDisplay="auto"
                valueLabelFormat={(value) => `${value}%`}
                    sx={{ color: '#4f46e5' }}
              />
            </Box>
                
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" gutterBottom>Property Management: {propertyManagementPercent}%</Typography>
                  <Slider
                    value={propertyManagementPercent}
                    onChange={(e, value) => setPropertyManagementPercent(value as number)}
                    min={0}
                    max={20}
                    step={1}
                    valueLabelDisplay="auto"
                    valueLabelFormat={(value) => `${value}%`}
                    sx={{ color: '#4f46e5' }}
                  />
          </Box>

              </Drawer>
              
              {/* Property Results Section */}
              {error && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {error}
                </Alert>
              )}
              
            {initialLoading ? (
              <Box className="loading-container">
                  <CircularProgress className="loading-spinner" />
                  <Typography className="loading-message">
                  Loading properties...
                </Typography>
              </Box>
              ) : searchPerformed && !loading && totalProperties === 0 ? (
                <Typography variant="body1" sx={{ p: 2, textAlign: 'center', mt: 4 }}>
                  No properties found matching your location or criteria.
                </Typography>
            ) : displayedProperties.length > 0 ? (
              <>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, mt: 4 }}>
                  <Typography variant="h6">
                      Showing {sortedProperties.length} of {totalProperties} Properties
                  </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <FormControl sx={{ m: 1, minWidth: 120 }} size="small">
                        <InputLabel id="sort-by-label">Sort By</InputLabel>
                        <Select
                          labelId="sort-by-label"
                          value={sortConfig.key || ''}
                          label="Sort By"
                          onChange={(e) => {
                            const newKey = e.target.value as SortableKey | '';
                            handleSort(newKey === '' ? 'price' : newKey); // Use handleSort, default to price if empty
                          }}
                        >
                          <MenuItem value="price">Price</MenuItem>
                          <MenuItem value="crunchScore">Crunch Score</MenuItem> {/* Added Crunch Score */} 
                          <MenuItem value="rent_estimate">Rent Estimate</MenuItem>
                          <MenuItem value="ratio">Ratio</MenuItem>
                          <MenuItem value="cashflow">Monthly Cashflow</MenuItem>
                          <MenuItem value="bedrooms">Bedrooms</MenuItem>
                          <MenuItem value="bathrooms">Bathrooms</MenuItem>
                          <MenuItem value="sqft">Sq Ft</MenuItem>
                          <MenuItem value="days_on_market">Days on Market</MenuItem>
                        </Select>
                      </FormControl>
                      <IconButton 
                        onClick={() => setSortConfig(prev => ({ ...prev, direction: prev.direction === 'asc' ? 'desc' : 'asc' }))}
                      color="primary"
                        disabled={!sortConfig.key}
                      >
                        {sortConfig.direction === 'asc' ? <ArrowUpwardIcon /> : <ArrowDownwardIcon />}
                      </IconButton>
                  </Box>
                </Box>
                
                  <div className="property-grid">
                    {sortedProperties.map((property) => {
                      // Calculate cashflow using current assumptions and potentially overridden price/rent
                      const overridePrice = overridePrices[property.property_id];
                      const propertyForCalculations = {
                        ...property,
                        price: overridePrice !== undefined ? overridePrice : property.price,
                        // Ensure rent estimate is also correctly handled if it was overridden on the card
                        // Note: PropertyCard currently manages customRent internally.
                        // If App needs to know card-level rent edits, PropertyCard needs to call handleRentEstimateChange.
                        // For now, we assume calculateCashflow passed down handles internal rent override.
                        rent_estimate: property.rent_estimate // Use the rent currently in displayedProperties
                      };
                      const cashflow = calculateCashflow(propertyForCalculations);
                      
                      // Bundle current settings for the scoring function
                      const currentSettings: CashflowSettings = {
                        interestRate,
                        loanTerm,
                        downPaymentPercent,
                        taxInsurancePercent,
                        vacancyPercent,
                        capexPercent,
                        propertyManagementPercent,
                        rehabAmount,
                      };

                      // Calculate the crunch score using potentially overridden price/rent
                      const score = calculateCrunchScore(propertyForCalculations, currentSettings, cashflow);
                      
                      return (
                      <PropertyCard
                        key={property.property_id}
                        property={property}
                        overridePrice={overridePrice} 
                  calculateCashflow={calculateCashflow}
                  formatCurrency={formatCurrency}
                  formatPercent={formatPercent}
                  vacancyPercent={vacancyPercent}
                  capexPercent={capexPercent}
                        downPaymentPercent={downPaymentPercent}
                        propertyManagementPercent={propertyManagementPercent}
                        handleRentEstimateChange={handleRentEstimateChange}
                        crunchScore={score} 
                      />
                      );
                    })}
                  </div>
                  
                  {isProcessingBackground && (
                    <Box className="loading-container" sx={{ py: 2 }}>
                      <CircularProgress size={30} className="loading-spinner" />
                      <Typography className="loading-message">
                        Loading & Processing More Properties...
                      </Typography>
                </Box>
                  )}
                </>
              ) : searchPerformed && (loading || isProcessingBackground) ? (
                <Box className="loading-container">
                  <CircularProgress size={30} className="loading-spinner" />
                  <Typography className="loading-message">
                    Loading & Processing Properties...
              </Typography>
          </Box>
              ) : null}
              
              {/* FAQ Modal */}
              <Modal
                open={isFaqOpen}
                onClose={handleCloseFaq}
                aria-labelledby="faq-modal-title"
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Paper className="faq-modal">
                  <div className="faq-header">
                    <Typography id="faq-modal-title" className="faq-title">
                      Help & Frequently Asked Questions
                    </Typography>
                    <IconButton 
                      edge="end" 
                      color="inherit" 
                      onClick={handleCloseFaq} 
                      aria-label="close"
                    >
                      <CloseIcon />
                    </IconButton>
                  </div>
                  
                  <div className="faq-content">
                    {/* FAQ Navigation */}
                    <div className="faq-nav">
                      <div 
                        className={`faq-nav-item ${activeFaqSection === 'general' ? 'active' : ''}`}
                        onClick={() => handleFaqSectionChange('general')}
                      >
                        General
                      </div>
                      <div 
                        className={`faq-nav-item ${activeFaqSection === 'search' ? 'active' : ''}`}
                        onClick={() => handleFaqSectionChange('search')}
                      >
                        Searching & Sorting
                      </div>
                      <div 
                        className={`faq-nav-item ${activeFaqSection === 'filters' ? 'active' : ''}`}
                        onClick={() => handleFaqSectionChange('filters')}
                      >
                        Filters & Assumptions
                      </div>
                      <div 
                        className={`faq-nav-item ${activeFaqSection === 'cashflow' ? 'active' : ''}`}
                        onClick={() => handleFaqSectionChange('cashflow')}
                      >
                        Cashflow & Scoring
                      </div>
                      <div 
                        className={`faq-nav-item ${activeFaqSection === 'bookmarks' ? 'active' : ''}`}
                        onClick={() => handleFaqSectionChange('bookmarks')}
                      >
                        Bookmarks
                      </div>
                      <div 
                        className={`faq-nav-item ${activeFaqSection === 'details' ? 'active' : ''}`}
                        onClick={() => handleFaqSectionChange('details')}
                      >
                        Property Details & Sharing
                      </div>
                    </div>
                    
                    {/* FAQ Content Container */} 
                    <div className="faq-sections-container">
                      {/* General FAQ Section */}
                      {activeFaqSection === 'general' && (
                        <div>
                          <div className="faq-section">
                            <div className="faq-question">What is CashflowCrunch?</div>
                            <div className="faq-answer">
                              CashflowCrunch helps you quickly find and analyze potential rental investment properties. It fetches current listings, estimates rent, and calculates potential cash flow and returns based on your customizable assumptions.
                            </div>
                          </div>
                          
                          <div className="faq-section">
                            <div className="faq-question">How does it work?</div>
                            <div className="faq-answer">
                              Enter a location and optionally refine your search with price, beds, and baths filters. CashflowCrunch searches for matching properties, fetches details, estimates rent, and calculates financial metrics like cash flow and Cash-on-Cash return using the assumptions you set in the slide-out panel. Results are displayed as property cards, sorted by default by the "Crunch Score".
                            </div>
                          </div>
                          
                          <div className="faq-section">
                            <div className="faq-question">Is the data accurate?</div>
                            <div className="faq-answer">
                              Property listing data (price, beds, baths, status) comes from real-time sources. Rent estimates are algorithmically generated based on market data but should be verified (e.g., using the provided RentCast link or local research). Financial calculations depend heavily on the accuracy of your input assumptions (interest rate, expenses, etc.). Always do your own due diligence.
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Search & Sorting FAQ Section */}
                      {activeFaqSection === 'search' && (
                        <div>
                          <div className="faq-section">
                            <div className="faq-question">How do I search for properties?</div>
                            <div className="faq-answer">
                              Enter a location (City, State, or Zip Code) in the main search bar and click "Crunch Properties". You can further refine your search using the price range, minimum beds, and minimum baths filters before searching.
                            </div>
                          </div>
                          
                          <div className="faq-section">
                            <div className="faq-question">Why does searching take time?</div>
                            <div className="faq-answer">
                              CashflowCrunch processes potentially hundreds of properties for your location. It first fetches basic details quickly, then works in the background to get rent estimates and calculate detailed financials for each property. The results update progressively as this background processing completes.
                            </div>
                          </div>
                          
                          <div className="faq-section">
                            <div className="faq-question">How can I save and load searches?</div>
                            <div className="faq-answer">
                              After entering search criteria (location, price, beds, baths), click "Save Search". Give it a name, and it will be stored in your browser. Click "Load Search" to see your saved searches, load the criteria back into the form, and automatically run the search again.
                            </div>
                          </div>

                          <div className="faq-section">
                            <div className="faq-question">How do I sort the results?</div>
                            <div className="faq-answer">
                              Use the "Sort By" dropdown menu above the property grid. You can sort by:
                              <ul>
                                <li><b>Crunch Score (Default):</b> Overall investment potential (higher is better).</li>
                                <li>Price</li>
                                <li>Rent Estimate</li>
                                <li>Ratio (Rent-to-Price)</li>
                                <li>Monthly Cashflow</li>
                                <li>Bedrooms, Bathrooms, Sq Ft</li>
                                <li>Days on Market</li>
                              </ul>
                              Click the arrow icon next to the dropdown to toggle between ascending and descending order.
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Filters & Assumptions FAQ Section */}
                      {activeFaqSection === 'filters' && (
                        <div>
                          <div className="faq-section">
                            <div className="faq-question">How do the filters work?</div>
                            <div className="faq-answer">
                              The filters (Min/Max Price, Min Beds, Min Baths) are applied *before* the search request is sent. This means the tool only fetches properties that meet these initial criteria.
                            </div>
                          </div>
                          <div className="faq-section">
                            <div className="faq-question">How do I adjust the investment assumptions?</div>
                            <div className="faq-answer">
                              Click the purple "Assumptions" tab floating on the right side of the screen (visible on the main search page and property details page). This opens a drawer where you can adjust sliders for:
                              <ul>
                                <li>Mortgage: Interest Rate, Loan Term, Down Payment %</li>
                                <li>Initial Costs: Rehab Amount (added to total investment for CoC calculation)</li>
                                <li>Operating Expenses: Property Tax & Insurance %, Vacancy %, CapEx %, Property Management %</li>
                              </ul>
                              Changes you make here instantly update the cashflow analysis and Crunch Score for all displayed properties and are used as defaults on the Property Details page.
                            </div>
                          </div>
                           <div className="faq-section">
                            <div className="faq-question">What do the expense assumptions mean?</div>
                            <div className="faq-answer">
                              <ul>
                                <li><b>Tax & Insurance %:</b> Annual property taxes and insurance expressed as a percentage of the property price.</li>
                                <li><b>Vacancy %:</b> Percentage of the estimated monthly rent set aside for potential vacancies.</li>
                                <li><b>CapEx %:</b> (Capital Expenditures) Percentage of the estimated monthly rent set aside for large, infrequent repairs and replacements (e.g., roof, HVAC).</li>
                                <li><b>Property Management %:</b> Percentage of the estimated monthly rent allocated for property management fees (if applicable).</li>
                                <li><b>Rehab Amount:</b> Estimated upfront cost for repairs/renovations needed before renting. This is added to your initial investment.</li>
                              </ul>
                              Adjust these based on your research and risk tolerance.
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Cashflow & Scoring FAQ Section */}
                      {activeFaqSection === 'cashflow' && (
                        <div>
                          <div className="faq-section">
                            <div className="faq-question">What is the cashflow analysis?</div>
                            <div className="faq-answer">
                              Found in the expandable section of each property card (and on the details page), this breaks down the estimated monthly finances:
                              <ul>
                                <li>Income: Rent Estimate (you can edit this value directly on the card)</li>
                                <li>Expenses: Calculated Mortgage (P&I), Tax & Insurance, Vacancy, CapEx, and Property Management based on your assumptions.</li>
                                <li>Results: Total Monthly Expenses, Monthly Cashflow, Annual Cashflow, and Cash-on-Cash (CoC) Return.</li>
                              </ul>
                            </div>
                          </div>
                          
                           {/* NEW CRUNCH SCORE SECTION */} 
                          <div className="faq-section">
                            <div className="faq-question">What is the "Crunch Score"?</div>
                            <div className="faq-answer">
                              The Crunch Score is a custom metric (0-100, higher is better) designed to give you a quick assessment of a property's overall investment potential based on the data available and **your current assumptions**. It considers multiple factors, including:
                              <ul>
                                <li>Cash-on-Cash Return (CoC)</li>
                                <li>Monthly Cashflow relative to Rent</li>
                                <li>Rent-to-Price Ratio</li>
                                <li>Down Payment % (slightly favors higher DP for lower risk)</li>
                                <li>Days on Market (slightly favors lower DOM)</li>
                                <li>Estimated Rehab Costs (favors lower rehab)</li>
                              </ul>
                              It provides a more holistic view than just the rent-to-price ratio alone. Remember that adjusting your assumptions in the slide-out panel will change the Crunch Score!
                            </div>
                          </div>
                          
                          <div className="faq-section">
                            <div className="faq-question">How do I interpret the Rent-to-Price Ratio?</div>
                            <div className="faq-answer">
                              While the Crunch Score is the primary ranking metric, the Rent-to-Price Ratio (monthly rent / price) is still shown in the shareable summary. It's a traditional rough indicator:
                              <ul>
                                <li>Generally, ratios above 0.7% are considered potentially good, but this varies greatly by market.</li>
                              </ul>
                              Focus on the Crunch Score and detailed cashflow analysis for a better picture.
                            </div>
                          </div>
                          
                          <div className="faq-section">
                            <div className="faq-question">Can I edit the rent estimate on the card?</div>
                            <div className="faq-answer">
                              Yes. In the expanded Cashflow Analysis section on each property card, click the pencil icon next to the Rent Estimate. You can type in your own value. This will update the cashflow calculations and Crunch Score *for that specific card only* based on your input. It does not permanently change the underlying property data.
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Bookmarks FAQ Section */}
                      {activeFaqSection === 'bookmarks' && (
                        <div>
                          <div className="faq-section">
                            <div className="faq-question">How do I save properties I'm interested in?</div>
                            <div className="faq-answer">
                              Go to a property's detailed page (by clicking the address or "Deep Dive" link on a card). On the details page, click the "Bookmark" button in the header. This saves the property, including the specific assumptions and notes you had at that moment.
                            </div>
                          </div>
                          
                          <div className="faq-section">
                            <div className="faq-question">Where can I find my bookmarked properties?</div>
                            <div className="faq-answer">
                              Click the "Bookmarks" button in the top navigation bar. This page displays all your saved properties with the analysis based on the assumptions *at the time they were bookmarked*.
                            </div>
                          </div>
                          
                          <div className="faq-section">
                            <div className="faq-question">What information is saved in a bookmark?</div>
                            <div className="faq-answer">
                              Bookmarks save a snapshot of the property and your analysis at the time of saving:
                              <ul>
                                <li>All core property details (price, address, beds, baths, etc.)</li>
                                <li>Your custom rent estimate (if edited on the details page)</li>
                                <li>The specific investment and projection assumptions used for that analysis</li>
                                <li>Any notes you added on the details page</li>
                              </ul>
                            </div>
                          </div>
                          
                          <div className="faq-section">
                            <div className="faq-question">How do I remove a property from my bookmarks?</div>
                            <div className="faq-answer">
                              From the Bookmarks page, click the "Remove" button on the property card.
                            </div>
                          </div>
                          
                          <div className="faq-section">
                            <div className="faq-question">Are my bookmarks saved if I close the browser?</div>
                            <div className="faq-answer">
                              Yes, bookmarks (and saved searches) are stored in your browser's local storage. They will persist unless you clear your browser data. They are specific to the browser and device you used.
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Property Details & Sharing Section */}
                      {activeFaqSection === 'details' && (
                        <div>
                           <div className="faq-section">
                            <div className="faq-question">What's on the Property Details Page?</div>
                            <div className="faq-answer">
                              This page offers a deep dive into a single property:
                              <ul>
                                <li>Key Info & Interactive Map</li>
                                <li>Detailed Cashflow Analysis (using assumptions adjustable via the side panel)</li>
                                <li>Long-Term Projection Chart & Table (visualizing value, equity, cashflow over 30 years based on adjustable appreciation rates)</li>
                                <li>Editable Notes Section</li>
                                <li>Buttons to Bookmark and Share</li>
                                <li>Links to Zillow and RentCast</li>
                              </ul>
                            </div>
                          </div>

                          <div className="faq-section">
                            <div className="faq-question">How does the "Copy URL" sharing feature work?</div>
                            <div className="faq-answer">
                              On the Property Details page, clicking "Copy URL" creates a unique web link containing all the property data, your *current* analysis settings (assumptions, custom rent, projections), and notes, encoded directly into the URL. Anyone opening this link will see the property analysis exactly as you configured it at that moment.
                            </div>
                          </div>

                          <div className="faq-section">
                            <div className="faq-question">How do I use the Notes section on the details page?</div>
                            <div className="faq-answer">
                              Type your observations or questions into the text box. Notes are saved automatically with Bookmarks and included in Shared URLs.
                            </div>
                          </div>

                          <div className="faq-section">
                            <div className="faq-question">What does the Long-Term Projection chart show?</div>
                            <div className="faq-answer">
                              It visualizes potential financial performance over 30 years based on the assumptions set (in the side panel or below the chart):
                              <ul>
                                <li><b>Property Value (Purple Line):</b> Growth based on 'Property Value Increase' % assumption.</li>
                                <li><b>Equity (Green Line):</b> Your ownership stake, growing via principal paydown and appreciation.</li>
                                <li><b>Annual Cashflow (Orange/Red Bars):</b> Yearly cash flow, factoring in 'Rent Appreciation' % assumption.</li>
                              </ul>
                              Hover over the chart for yearly details.
                            </div>
                          </div>
                           <div className="faq-section">
                            <div className="faq-question">How do I adjust assumptions on the details page?</div>
                            <div className="faq-answer">
                             Use the purple "Assumptions" tab on the right to open the drawer (adjusts analysis globally) or use the specific sliders below the long-term projection chart (adjusts *only* the projection assumptions: Rent Appreciation % and Property Value Increase %). Settings made here are saved with bookmarks/shared URLs.
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </Paper>
              </Modal>
    </Container>
          </> // Close the fragment for the root route element
        } />
        
        {/* Property Details Route - Restore calculateCashflow implementation */}
        <Route 
          path="/property/:propertyId" 
          element={
            <PropertyDetailsPage 
              properties={displayedProperties}
              calculateCashflow={(property, settings) => {
                  // Restore implementation
                  const calculateCashflowWithSettings = (property: Property, settings: CashflowSettings): Cashflow => {
                  const monthlyMortgage = calculateMortgageWithSettings(property.price, settings);
                  const monthlyTaxInsurance = property.price * (settings.taxInsurancePercent / 100) / 12;
                  const monthlyVacancy = property.rent_estimate * (settings.vacancyPercent / 100);
                  const monthlyCapex = property.rent_estimate * (settings.capexPercent / 100);
                  const monthlyPropertyManagement = property.rent_estimate * (settings.propertyManagementPercent / 100);
                  const totalMonthlyExpenses = monthlyMortgage + monthlyTaxInsurance + monthlyVacancy + monthlyCapex + monthlyPropertyManagement;
                  const monthlyCashflow = property.rent_estimate - totalMonthlyExpenses;
                  const annualCashflow = monthlyCashflow * 12;
                    const initialInvestment = (property.price * (settings.downPaymentPercent / 100)) + (property.price * 0.03) + settings.rehabAmount;
                    const cashOnCashReturn = initialInvestment > 0 ? (annualCashflow / initialInvestment) * 100 : 0;
                    return { monthlyMortgage, monthlyTaxInsurance, monthlyVacancy, monthlyCapex, monthlyPropertyManagement, totalMonthlyExpenses, monthlyCashflow, annualCashflow, cashOnCashReturn };
                  };
                function calculateMortgageWithSettings(price: number, settings: CashflowSettings): number {
                  const downPayment = price * (settings.downPaymentPercent / 100);
                  const loanAmount = price - downPayment;
                  const monthlyRate = settings.interestRate / 100 / 12;
                  const payments = settings.loanTerm * 12;
                  if (monthlyRate === 0) return loanAmount / payments;
                  const x = Math.pow(1 + monthlyRate, payments);
                  return loanAmount * (monthlyRate * x) / (x - 1);
                }
                  const propertyForCashflow = { ...property, rent_source: property.rent_source ?? "calculated" };
                return calculateCashflowWithSettings(propertyForCashflow, settings);
              }}
              formatCurrency={formatCurrency}
              formatPercent={formatPercent}
              defaultSettings={defaultSettings}
              handlePriceOverrideChange={handlePriceOverrideChange} 
            />
          } 
        />
        
        {/* Bookmarks Route */}
        <Route 
          path="/bookmarks" 
          element={<BookmarksPage />} 
        />
      </Routes> {/* Remove comment here */}
    </div>
  );
}

export default App;
