import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Container, TextField, Button, Typography, Card, CardContent, Box, Alert, CircularProgress, Slider, Accordion, AccordionSummary, AccordionDetails, Skeleton, Select, MenuItem, FormControl, InputLabel, IconButton, Link, InputAdornment, Modal, Grid, Paper, Divider } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import LinkIcon from '@mui/icons-material/Link';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import HomeWorkIcon from '@mui/icons-material/HomeWork';
import './App.css';
import { searchProperties, getTotalPropertiesCount, Property, registerForPropertyUpdates } from './api/propertyApi';

// Define cashflow interface
interface Cashflow {
  monthlyMortgage: number;
  monthlyTaxInsurance: number;
  monthlyVacancy: number;
  monthlyCapex: number;
  totalMonthlyExpenses: number;
  monthlyCashflow: number;
  annualCashflow: number;
  cashOnCashReturn: number;
}

// Lazy Image component for better performance
interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
}

const LazyImage: React.FC<LazyImageProps> = ({ src, alt, className }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      { threshold: 0.1 }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div className="lazy-image-container" ref={imgRef}>
      {isInView ? (
        <>
          {!isLoaded && <Skeleton variant="rectangular" width="100%" height="100%" animation="wave" />}
          <img
            src={src}
            alt={alt}
            className={`lazy-image ${isLoaded ? 'loaded' : ''} ${className || ''}`}
            onLoad={() => setIsLoaded(true)}
            style={{ display: isLoaded ? 'block' : 'none' }}
          />
        </>
      ) : (
        <Skeleton variant="rectangular" width="100%" height="100%" animation="wave" />
      )}
    </div>
  );
};

// Property Card Component
interface PropertyCardProps {
  property: Property;
  calculateCashflow: (property: Property) => Cashflow;
  formatCurrency: (amount: number) => string;
  formatPercent: (percent: number) => string;
  vacancyPercent: number;
  capexPercent: number;
  downPaymentPercent: number;
  handleRentEstimateChange: (propertyId: string, newRentString: string) => void;
}

const PropertyCard: React.FC<PropertyCardProps> = ({ 
  property, 
  calculateCashflow, 
  formatCurrency, 
  formatPercent, 
  vacancyPercent, 
  capexPercent,
  downPaymentPercent,
  handleRentEstimateChange
}) => {
  // --- State for editable rent estimate --- 
  const [displayRent, setDisplayRent] = useState<string>('');
  const [isRentEditing, setIsRentEditing] = useState(false);

  // Initialize display rent when property data changes
  useEffect(() => {
    setDisplayRent(formatCurrency(property.rent_estimate));
  }, [property.rent_estimate, formatCurrency]);

  // Handlers for rent input
  const handleRentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDisplayRent(e.target.value);
  };

  const handleRentBlur = () => {
    setIsRentEditing(false);
    // Call the parent handler to update the actual rent_estimate state
    handleRentEstimateChange(property.property_id, displayRent);
    // Re-format the display value (the useEffect above will also handle this)
    // setDisplayRent(formatCurrency(property.rent_estimate)); // Might cause flicker, rely on useEffect
  };

  const handleRentFocus = () => {
    setIsRentEditing(true);
    // Show raw number for editing
    setDisplayRent(String(property.rent_estimate)); 
  };
  // --- End State/Handlers ---

  const cashflow = calculateCashflow(property);
  const downPaymentAmount = property.price * (downPaymentPercent / 100);
  
  // --- Create RentCast URL --- 
  const rentCastAddress = encodeURIComponent(property.address);
  const rentCastUrl = `https://app.rentcast.io/app?address=${rentCastAddress}`;
  
  return (
    <Card className="property-card">
      <a href={property.url} target="_blank" rel="noopener noreferrer" className="property-image-container">
        <LazyImage
          src={property.thumbnail}
          alt={property.address}
        />
        <div className="property-price">
          {formatCurrency(property.price)}
        </div>
      </a>
      
      <CardContent className="property-details">
        <Typography variant="h6" component="div" gutterBottom>
          {formatCurrency(property.price)}
        </Typography>
        
        <a href={property.url} target="_blank" rel="noopener noreferrer" className="property-address">
          <Typography variant="body2" color="text.secondary">
            {property.address}
          </Typography>
        </a>
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <div>
            <Typography variant="body2" fontWeight="medium">
              Rent Est: {formatCurrency(property.rent_estimate)}
              {property.rent_source === 'zillow' && (
                <span className="rent-source">Zillow</span>
              )}
            </Typography>
            
            <div className={`ratio-chip ${property.ratio >= 0.007 ? 'ratio-good' : property.ratio >= 0.004 ? 'ratio-medium' : 'ratio-poor'}`}>
              Ratio: {formatPercent(property.ratio * 100)}
            </div>
          </div>
          
          {property.days_on_market !== null && (
            <div className="days-on-market">
              {property.days_on_market} days
            </div>
          )}
        </Box>
        
        <div className="metrics">
          <div className="metric">
            <Typography variant="body2" color="text.secondary">Beds</Typography>
            <Typography variant="body1" fontWeight="medium">{property.bedrooms}</Typography>
          </div>
          <div className="metric">
            <Typography variant="body2" color="text.secondary">Baths</Typography>
            <Typography variant="body1" fontWeight="medium">{property.bathrooms}</Typography>
          </div>
          <div className="metric">
            <Typography variant="body2" color="text.secondary">Sq Ft</Typography>
            <Typography variant="body1" fontWeight="medium">{property.sqft.toLocaleString()}</Typography>
          </div>
        </div>
      </CardContent>
      
      <div className="property-footer">
        <Accordion>
          <AccordionSummary 
            expandIcon={<ExpandMoreIcon />}
            aria-controls="cashflow-content"
            id="cashflow-header"
          >
            <div className="cashflow-header">
              <Typography fontWeight="medium">Cashflow Analysis</Typography>
              <Typography 
                variant="body2" 
                fontWeight="bold" 
                color={cashflow.monthlyCashflow >= 0 ? 'success.main' : 'error.main'}
                sx={{ ml: 'auto', mr: 1 }}
              >
                {formatCurrency(cashflow.monthlyCashflow)}/mo
              </Typography>
            </div>
          </AccordionSummary>
          <AccordionDetails>
            <div className="cashflow-analysis">
              <div className="cashflow-row">
                <Typography variant="body2">Down Payment ({downPaymentPercent}%):</Typography>
                <Typography variant="body2">{formatCurrency(downPaymentAmount)}</Typography>
              </div>
              <div className="cashflow-row">
                <Typography variant="body2">Monthly Mortgage Payment:</Typography>
                <Typography variant="body2">{formatCurrency(cashflow.monthlyMortgage)}</Typography>
              </div>
              <div className="cashflow-row">
                <Typography variant="body2">Monthly Tax & Insurance:</Typography>
                <Typography variant="body2">{formatCurrency(cashflow.monthlyTaxInsurance)}</Typography>
              </div>
              <div className="cashflow-row">
                <Typography variant="body2">Vacancy Cost ({vacancyPercent}%):</Typography>
                <Typography variant="body2">{formatCurrency(cashflow.monthlyVacancy)}</Typography>
              </div>
              <div className="cashflow-row">
                <Typography variant="body2">CapEx ({capexPercent}%):</Typography>
                <Typography variant="body2">{formatCurrency(cashflow.monthlyCapex)}</Typography>
              </div>
              
              <div className="cashflow-divider"></div>
              
              <div className="cashflow-row">
                <Typography variant="body2" fontWeight="bold">Total Monthly Expenses:</Typography>
                <Typography variant="body2" fontWeight="bold">{formatCurrency(cashflow.totalMonthlyExpenses)}</Typography>
              </div>
              
              <div className="cashflow-total">
                <div className="cashflow-row">
                  <Typography variant="body2" fontWeight="bold">Monthly Cashflow:</Typography>
                  <Typography variant="body2" fontWeight="bold" color={cashflow.monthlyCashflow >= 0 ? 'success.main' : 'error.main'}>
                    {formatCurrency(cashflow.monthlyCashflow)}
                  </Typography>
                </div>
                <div className="cashflow-row">
                  <Typography variant="body2" fontWeight="bold">Annual Cashflow:</Typography>
                  <Typography variant="body2" fontWeight="bold" color={cashflow.annualCashflow >= 0 ? 'success.main' : 'error.main'}>
                    {formatCurrency(cashflow.annualCashflow)}
                  </Typography>
                </div>
                <div className="cashflow-row">
                  <Typography variant="body2" fontWeight="bold">Cash-on-Cash Return:</Typography>
                  <Typography variant="body2" fontWeight="bold" color={cashflow.cashOnCashReturn >= 0 ? 'success.main' : 'error.main'}>
                    {formatPercent(cashflow.cashOnCashReturn)}
                  </Typography>
                </div>
              </div>
              {/* --- Add Editable Rent Estimate Row --- */}
              <div className="cashflow-row" style={{ alignItems: 'center' }}>
                <Typography variant="body2">Rent Estimate:</Typography>
                <TextField
                   variant="standard" // Use standard variant for less space
                   size="small"
                   value={isRentEditing ? displayRent : formatCurrency(property.rent_estimate)} // Show formatted or raw
                   onChange={handleRentChange}
                   onFocus={handleRentFocus}
                   onBlur={handleRentBlur}
                   InputProps={{
                     startAdornment: <InputAdornment position="start">$</InputAdornment>,
                     disableUnderline: !isRentEditing, // Hide underline when not editing
                     sx: { fontSize: '0.875rem' } // Match Typography variant="body2"
                   }}
                   sx={{ 
                     maxWidth: '100px', // Limit width
                     marginLeft: 'auto', // Push to the right
                     '& .MuiInputBase-input': { textAlign: 'right' }, // Align text right
                     ...( !isRentEditing && { border: 'none', pointerEvents: 'none' } ) // Make look like text when not editing
                    }}
                   // Optional: Add onKeyDown for Enter key submission
                   onKeyDown={(e) => {
                       if (e.key === 'Enter') {
                           (e.target as HTMLInputElement).blur(); // Trigger blur to save
                       }
                   }}
                 />
              </div>
            </div>
          </AccordionDetails>
        </Accordion>
        
        {/* Quick Links Section - Update to use SVG icons */}
        <div className="quick-links">
          <div className="quick-links-title">Quick Links</div>
          <div className="quick-links-buttons">
            <a href={property.url} target="_blank" rel="noopener noreferrer" className="quick-link">
              <img src="/zillow_icon.svg" alt="Zillow" /> Zillow Listing
            </a>
            <a href={rentCastUrl} target="_blank" rel="noopener noreferrer" className="quick-link">
              <img src="/rentcast_icon.svg" alt="RentCast" /> RentCast Analysis
            </a>
          </div>
        </div>
      </div>
    </Card>
  );
};

// Define possible sort keys
type SortableKey = keyof Pick<Property, 'price' | 'rent_estimate' | 'bedrooms' | 'bathrooms' | 'sqft' | 'days_on_market'> | 'ratio';

function App() {
  // State variables
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);
  const [isProcessingBackground, setIsProcessingBackground] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchPerformed, setSearchPerformed] = useState(false);
  
  // Mortgage calculator state
  const [interestRate, setInterestRate] = useState(7.5);
  const [loanTerm, setLoanTerm] = useState(30);
  const [downPaymentPercent, setDownPaymentPercent] = useState(20);
  const [taxInsurancePercent, setTaxInsurancePercent] = useState(1.5);
  const [vacancyPercent, setVacancyPercent] = useState(5);
  const [capexPercent, setCapexPercent] = useState(5);
  
  // Pagination state
  const [totalProperties, setTotalProperties] = useState(0);
  const [displayedProperties, setDisplayedProperties] = useState<Property[]>([]);

  // Add state for price filter
  const [minPrice, setMinPrice] = useState<number | string>('');
  const [maxPrice, setMaxPrice] = useState<number | string>('');
  // Add state for formatted display values
  const [displayMinPrice, setDisplayMinPrice] = useState<string>('');
  const [displayMaxPrice, setDisplayMaxPrice] = useState<string>('');

  // Add state for sorting
  const [sortConfig, setSortConfig] = useState<{ key: SortableKey | null, direction: 'asc' | 'desc' }>({ key: 'price', direction: 'asc' }); // Default sort by price asc

  // State for assumptions accordion
  const [isAssumptionsExpanded, setIsAssumptionsExpanded] = useState(false);

  // Ref for tracking search requests
  const currentSearchId = useRef<number>(0);

  // Add state for FAQ modal
  const [isFaqOpen, setIsFaqOpen] = useState(false);
  const [activeFaqSection, setActiveFaqSection] = useState('general');

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

  // Function to handle search button click
  const handleSearch = async () => {
    console.log('Starting search...');
    currentSearchId.current += 1;
    const searchId = currentSearchId.current;

    setSearchPerformed(true);
    setError(null);
    setDisplayedProperties([]); // Clear previous results immediately
    setLoading(true);
    setInitialLoading(true); // Indicate initial fetch is starting
    setIsProcessingBackground(false); // Reset background processing state

    try {
      // --- Prepare Filters & Prices (Relaxed Validation) ---
      let minP: number | null = null;
      let maxP: number | null = null;

      // Parse Min Price
      const parsedMin = typeof minPrice === 'number' ? minPrice : parseFloat(minPrice);
      if (!isNaN(parsedMin) && parsedMin >= 0) {
          minP = parsedMin;
          console.log('Applying Min price filter:', minP);
      } else {
          console.log('No valid Min price filter applied.');
      }
      
      // Parse Max Price
      const parsedMax = typeof maxPrice === 'number' ? maxPrice : parseFloat(maxPrice);
      if (!isNaN(parsedMax) && parsedMax > 0) {
          maxP = parsedMax;
          console.log('Applying Max price filter:', maxP);
      } else {
          console.log('No valid Max price filter applied.');
      }
      
      // --- REMOVED max >= min check --- 
      // Note: If API doesn't support min > max, it might return no results or error.
      
      // Define other filters if needed (currently none active)
      const propertyType = 'Houses'; // Example
      const minRatio = null; // Example

      // Get total properties first to determine page count
      console.log('Fetching total property count...');
      // Pass prices directly
      const totalCount = await getTotalPropertiesCount(location, minP, maxP, propertyType);
      setTotalProperties(totalCount);
      console.log('Total properties found:', totalCount);

      if (totalCount === 0) {
        setLoading(false);
        setInitialLoading(false);
        return; // Exit early if no properties match
      }

      const totalPages = Math.ceil(totalCount / 42); // Zillow API limit (approx)

      // Function to fetch and process a single page
      const fetchAndProcessPage = async (page: number) => {
        if (searchId !== currentSearchId.current) return; // Abort if new search started
        try {
          console.log(`Fetching page ${page + 1}/${totalPages}`);
          // Pass prices directly
          const results = await searchProperties(location, page, minP, maxP, propertyType, minRatio);
          if (searchId === currentSearchId.current && results.allProperties.length > 0) {
            // Append basic property data for immediate display
            setDisplayedProperties(prev => {
              // --- Add Logging for Duplicate Check --- 
              const newProps = results.allProperties.filter(np => {
                const isDuplicate = prev.some(p => p.property_id === np.property_id);
                if (isDuplicate) {
                    console.warn(`[handleSearch] Duplicate property ID detected, filtering out: ${np.property_id} - ${np.address}`);
                }
                return !isDuplicate;
              });
              if (newProps.length < results.allProperties.length) {
                   console.log(`[handleSearch] Filtered ${results.allProperties.length - newProps.length} duplicates based on ID from page results.`);
              }
              // --- End Logging --- 
              return [...prev, ...newProps];
            });
            // Indicate background processing has started (if not already)
            if (!isProcessingBackground) setIsProcessingBackground(true); 
          }
          console.log(`Completed search for page ${page + 1}`);
        } catch (pageError) {
          console.error(`Error fetching page ${page + 1}:`, pageError);
          // Potentially set an error state for this specific page or retry
        }
      };

      // Fetch all pages concurrently
      console.log(`Starting fetch for ${totalPages} pages.`);
      const pagePromises = Array.from({ length: totalPages }, (_, i) => fetchAndProcessPage(i));
      await Promise.all(pagePromises);

      console.log('All page fetches initiated.');
      setInitialLoading(false); // Initial loading complete, background processing continues
      
    } catch (err) {
      console.error('Search failed:', err);
      setError('Failed to fetch properties. Please try again.');
      setLoading(false);
      setInitialLoading(false);
      setIsProcessingBackground(false);
    } finally {
      // Note: setLoading(false) is handled by the background processor finishing
      // or if totalCount was 0 initially.
    }
  };
  
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
  const calculateCashflow = (property: Property): Cashflow => {
    const monthlyMortgage = calculateMortgage(property.price);
    const monthlyTaxInsurance = property.price * (taxInsurancePercent / 100) / 12;
    const monthlyVacancy = property.rent_estimate * (vacancyPercent / 100);
    const monthlyCapex = property.rent_estimate * (capexPercent / 100);
    
    const totalMonthlyExpenses = monthlyMortgage + monthlyTaxInsurance + monthlyVacancy + monthlyCapex;
    const monthlyCashflow = property.rent_estimate - totalMonthlyExpenses;
    const annualCashflow = monthlyCashflow * 12;
    
    const downPayment = property.price * (downPaymentPercent / 100);
    const closingCosts = property.price * 0.03; // Estimate 3% for closing costs
    const initialInvestment = downPayment + closingCosts;
    
    const cashOnCashReturn = (annualCashflow / initialInvestment) * 100;
    
    return {
      monthlyMortgage,
      monthlyTaxInsurance,
      monthlyVacancy,
      monthlyCapex,
      totalMonthlyExpenses,
      monthlyCashflow,
      annualCashflow,
      cashOnCashReturn
    };
  };
  
  // Helper function to format percentage
  const formatPercent = (percent: number): string => {
    return `${(percent).toFixed(2)}%`;
  };
  
  // Calculate if all properties are loaded
  // const allPropertiesLoaded = displayedProperties.length >= totalProperties;

  // --- Add useEffect for handling property updates ---
  // Memoize the update handler callback
  const handlePropertyUpdate = useCallback((updatedProperty: Property) => {
    console.log('[handlePropertyUpdate] Called for property:', updatedProperty?.address);
    if (!updatedProperty || !updatedProperty.property_id) {
      console.error('[handlePropertyUpdate] Received invalid property data.');
      return;
    }
    
    setDisplayedProperties(prevProperties => {
      // --- Add Check: Only update if list isn't cleared by new search --- 
      if (prevProperties.length === 0) {
        console.log('[handlePropertyUpdate] Ignoring update, list is empty (likely new search started).');
        return prevProperties; // Return unchanged state
      }
      
      // Check if property already exists
      if (prevProperties.some(p => p.property_id === updatedProperty.property_id)) {
        return prevProperties.map(p =>
          p.property_id === updatedProperty.property_id ? updatedProperty : p
        );
      } else {
        // Add the newly completed property
        const newPropertyList = [...prevProperties, updatedProperty];
        
        // --- DEBUG LOGGING START ---
        console.log(`[handlePropertyUpdate] Adding property. New count: ${newPropertyList.length}, Total expected: ${totalProperties}`);
        // --- DEBUG LOGGING END ---
        
        // Check if all properties have been processed using the latest totalProperties
        // This check now correctly signifies the end of *all* processing
        if (totalProperties > 0 && newPropertyList.length >= totalProperties) { // Use >= for safety
          console.log('All properties processed.');
          setIsProcessingBackground(false); // Turn off background indicator
        }
        return newPropertyList;
      }
    });
  }, [totalProperties]); // Add totalProperties as a dependency

  // --- Add useMemo for sorting ---
  const sortedProperties = React.useMemo(() => {
    let sortableItems = [...displayedProperties];
    if (sortConfig.key !== null) {
      sortableItems.sort((a, b) => {
        let valA: number | string | null = null;
        let valB: number | string | null = null;

        if (sortConfig.key === 'ratio') {
          valA = a.price > 0 ? a.rent_estimate / a.price : 0;
          valB = b.price > 0 ? b.rent_estimate / b.price : 0;
        } else {
          valA = a[sortConfig.key as keyof Property];
          valB = b[sortConfig.key as keyof Property];
        }
        
        // Basic comparison, assumes numbers or comparable strings
        // Handle nulls by treating them as lowest value
        valA = valA === null ? (sortConfig.direction === 'asc' ? -Infinity : Infinity) : valA;
        valB = valB === null ? (sortConfig.direction === 'asc' ? -Infinity : Infinity) : valB;

        if (valA < valB) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (valA > valB) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [displayedProperties, sortConfig]);

  // --- Effect to Register for Updates ---
  useEffect(() => {
    console.log('[Effect Register] Registering global update callback.');
    registerForPropertyUpdates(handlePropertyUpdate);

    // Cleanup function to unregister when component unmounts or callback changes
    // return () => {
    //   console.log('[Effect Register] Unregistering global update callback.');
    //   // Implement unregister logic in propertyApi if needed, currently not exposed
    //   // unregister(); 
    // };
    // }, [handlePropertyUpdate]); // Add the memoized callback as a dependency
  // }, [handlePropertyUpdate, totalProperties]); // Depend on totalProperties
  // }, [handlePropertyUpdate, totalProperties]); // Use the memoized callback
  }, [handlePropertyUpdate]); // Only depend on the stable callback

  // Add handler for rent estimate changes
  const handleRentEstimateChange = useCallback((propertyId: string, newRentString: string) => {
    const newRent = parseFloat(newRentString.replace(/[^\d.]/g, '')); // Clean and parse

    if (isNaN(newRent) || newRent < 0) {
      console.warn(`[handleRentEstimateChange] Invalid rent value entered: ${newRentString}`);
      // Optionally reset the input or show an error, for now just ignore
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
  }, []); // No dependencies needed if only using setDisplayedProperties setter form
  
  // Add FAQ handling functions
  const handleOpenFaq = () => {
    setIsFaqOpen(true);
  };
  
  const handleCloseFaq = () => {
    setIsFaqOpen(false);
  };
  
  const handleFaqSectionChange = (section: string) => {
    setActiveFaqSection(section);
  };
  
  return (
    <div className="App">
      {/* New Header */}
      <header className="app-header">
        <div className="container">
          <div className="header-content">
            <div>
              <Typography className="app-title" variant="h4" component="h1">
                <HomeWorkIcon sx={{ mr: 1, verticalAlign: 'middle', fontSize: '1.85rem' }} />
                RentalSearch
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
              >
                Help & FAQ
              </Button>
            </div>
          </div>
        </div>
      </header>
      
      <Container maxWidth="lg" sx={{ py: 3 }}>
        {/* Search Form - Modified to include price filters */}
        <div className="search-container">
          <Box component="form" onSubmit={(e) => { e.preventDefault(); handleSearch(); }} className="search-form">
            <div style={{ flex: '1', minWidth: '250px' }}>
              <TextField
                label="Enter Location (City, State, or Zip)"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                fullWidth
                variant="outlined"
                required
                className="search-input"
                placeholder="e.g. Austin, TX or 78701"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon color="action" />
                    </InputAdornment>
                  ),
                }}
              />
            </div>
            
            {/* Moved price filters here */}
            <div className="price-filter-container">
              <TextField
                label="Min Price"
                value={displayMinPrice}
                onChange={handleMinPriceChange}
                onBlur={handleMinPriceBlur}
                onFocus={handleMinPriceFocus}
                variant="outlined"
                size="medium"
                fullWidth
              />
              <TextField
                label="Max Price"
                value={displayMaxPrice}
                onChange={handleMaxPriceChange}
                onBlur={handleMaxPriceBlur}
                onFocus={handleMaxPriceFocus}
                variant="outlined"
                size="medium"
                fullWidth
              />
            </div>
            
            <Button
              type="submit"
              variant="contained"
              disabled={loading || initialLoading}
              className="search-button"
            >
              {(loading || initialLoading) ? 'Searching...' : 'Search Properties'}
            </Button>
          </Box>
        </div>
        
        {/* Filter Section - Now only for additional filters */}
        {searchPerformed && (
          <div className="filter-controls">
            <Typography variant="h6" className="filter-title">
              Additional Filters & Settings
            </Typography>
            <Box className="filter-form">
              {/* Mortgage Calculator Settings */}
              <Accordion expanded={isAssumptionsExpanded} onChange={(_, isExpanded) => setIsAssumptionsExpanded(isExpanded)}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle1" fontWeight="medium">Mortgage & Cashflow Assumptions</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                    {/* Interest Rate Slider */}
                    <Box sx={{ flexBasis: { xs: '100%', md: '45%' } }}>
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="body2" gutterBottom>
                          Interest Rate: {interestRate}%
                        </Typography>
                        <Slider
                          value={interestRate}
                          onChange={(e, newValue) => setInterestRate(newValue as number)}
                          aria-labelledby="interest-rate-slider"
                          valueLabelDisplay="auto"
                          step={0.1}
                          min={0.1}
                          max={15}
                        />
                      </Box>
                    </Box>
                    
                    {/* Loan Term Slider */}
                    <Box sx={{ flexBasis: { xs: '100%', md: '45%' } }}>
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="body2" gutterBottom>
                          Loan Term: {loanTerm} years
                        </Typography>
                        <Slider
                          value={loanTerm}
                          onChange={(e, newValue) => setLoanTerm(newValue as number)}
                          aria-labelledby="loan-term-slider"
                          valueLabelDisplay="auto"
                          step={1}
                          min={5}
                          max={40}
                        />
                      </Box>
                    </Box>
                    
                    {/* Down Payment Slider */}
                    <Box sx={{ flexBasis: { xs: '100%', md: '45%' } }}>
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="body2" gutterBottom>
                          Down Payment: {downPaymentPercent}%
                        </Typography>
                        <Slider
                          value={downPaymentPercent}
                          onChange={(e, newValue) => setDownPaymentPercent(newValue as number)}
                          aria-labelledby="down-payment-slider"
                          valueLabelDisplay="auto"
                          step={1}
                          min={0}
                          max={100}
                        />
                      </Box>
                    </Box>
                    
                    {/* Tax & Insurance Slider */}
                    <Box sx={{ flexBasis: { xs: '100%', md: '45%' } }}>
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="body2" gutterBottom>
                          Property Tax & Insurance: {taxInsurancePercent}%
                        </Typography>
                        <Slider
                          value={taxInsurancePercent}
                          onChange={(_, value) => setTaxInsurancePercent(value as number)}
                          min={0.5}
                          max={3}
                          step={0.1}
                          valueLabelDisplay="auto"
                          valueLabelFormat={(value) => `${value}%`}
                        />
                      </Box>
                    </Box>
                    
                    {/* Vacancy Slider */}
                    <Box sx={{ flexBasis: { xs: '100%', md: '45%' } }}>
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="body2" gutterBottom>
                          Vacancy: {vacancyPercent}%
                        </Typography>
                        <Slider
                          value={vacancyPercent}
                          onChange={(_, value) => setVacancyPercent(value as number)}
                          min={0}
                          max={10}
                          step={1}
                          valueLabelDisplay="auto"
                          valueLabelFormat={(value) => `${value}%`}
                        />
                      </Box>
                    </Box>
                    
                    {/* CapEx Slider */}
                    <Box sx={{ flexBasis: { xs: '100%', md: '45%' } }}>
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="body2" gutterBottom>
                          CapEx: {capexPercent}%
                        </Typography>
                        <Slider
                          value={capexPercent}
                          onChange={(_, value) => setCapexPercent(value as number)}
                          min={0}
                          max={10}
                          step={1}
                          valueLabelDisplay="auto"
                          valueLabelFormat={(value) => `${value}%`}
                        />
                      </Box>
                    </Box>
                  </Box>
                </AccordionDetails>
              </Accordion>
            </Box>
          </div>
        )}
        
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
                      setSortConfig(prev => ({ ...prev, key: newKey === '' ? null : newKey }));
                    }}
                  >
                    <MenuItem value="price">Price</MenuItem>
                    <MenuItem value="rent_estimate">Rent Estimate</MenuItem>
                    <MenuItem value="ratio">Ratio</MenuItem>
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
              {sortedProperties.map((property) => (
                <PropertyCard
                  key={property.property_id}
                  property={property}
                  calculateCashflow={calculateCashflow}
                  formatCurrency={formatCurrency}
                  formatPercent={formatPercent}
                  vacancyPercent={vacancyPercent}
                  capexPercent={capexPercent}
                  downPaymentPercent={downPaymentPercent}
                  handleRentEstimateChange={handleRentEstimateChange}
                />
              ))}
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
        
        {/* FAQ Modal - Updated for centering */}
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
                  Searching
                </div>
                <div 
                  className={`faq-nav-item ${activeFaqSection === 'filters' ? 'active' : ''}`}
                  onClick={() => handleFaqSectionChange('filters')}
                >
                  Filters
                </div>
                <div 
                  className={`faq-nav-item ${activeFaqSection === 'cashflow' ? 'active' : ''}`}
                  onClick={() => handleFaqSectionChange('cashflow')}
                >
                  Cashflow Analysis
                </div>
              </div>
              
              {/* General FAQ Section */}
              {activeFaqSection === 'general' && (
                <div>
                  <div className="faq-section">
                    <div className="faq-question">What is RentalSearch?</div>
                    <div className="faq-answer">
                      RentalSearch is a tool designed to help you find potential rental investment properties. It searches for properties on the market and analyzes their potential cash flow based on estimated rent and customizable assumptions.
                    </div>
                  </div>
                  
                  <div className="faq-section">
                    <div className="faq-question">How does RentalSearch work?</div>
                    <div className="faq-answer">
                      RentalSearch fetches property listings from real estate APIs and then calculates potential cash flow for each property based on rent estimates and your personalized investment criteria. Results are displayed as cards with expandable cashflow analysis.
                    </div>
                  </div>
                  
                  <div className="faq-section">
                    <div className="faq-question">Are the rent estimates accurate?</div>
                    <div className="faq-answer">
                      Rent estimates are sourced from market data and algorithms, but they should be considered as general guidelines. For more accurate estimates, we recommend checking the RentCast link available on each property card or consulting with a local real estate professional.
                    </div>
                  </div>
                </div>
              )}
              
              {/* Search FAQ Section */}
              {activeFaqSection === 'search' && (
                <div>
                  <div className="faq-section">
                    <div className="faq-question">How do I search for properties?</div>
                    <div className="faq-answer">
                      Enter a location in the search bar at the top of the page. You can use a city name, state, zip code, or a combination (e.g., "Austin, TX" or "78701"). Then click the "Search Properties" button to see results.
                    </div>
                  </div>
                  
                  <div className="faq-section">
                    <div className="faq-question">Why does searching take time?</div>
                    <div className="faq-answer">
                      RentalSearch processes a large amount of property data and performs calculations for each property. The search first fetches basic property data, then progressively enhances it with additional information like rent estimates, which occurs in the background.
                    </div>
                  </div>
                  
                  <div className="faq-section">
                    <div className="faq-question">How can I see more details about a property?</div>
                    <div className="faq-answer">
                      Click on the property address or image to visit the original listing. You can also expand the "Cashflow Analysis" section on each property card to see financial details. Additionally, use the "Quick Links" at the bottom of each card to access Zillow and RentCast for more information.
                    </div>
                  </div>
                </div>
              )}
              
              {/* Filters FAQ Section */}
              {activeFaqSection === 'filters' && (
                <div>
                  <div className="faq-section">
                    <div className="faq-question">How do I use the price filters?</div>
                    <div className="faq-answer">
                      After performing a search, you can use the "Min Price" and "Max Price" fields to narrow down the results. Enter the desired price range and the list will automatically update to show only properties within that range.
                    </div>
                  </div>
                  
                  <div className="faq-section">
                    <div className="faq-question">Can I sort the search results?</div>
                    <div className="faq-answer">
                      Yes, you can sort the results by various criteria including price, rent estimate, bedrooms, bathrooms, square footage, and the rent-to-price ratio. Use the sort controls to organize the properties in ascending or descending order.
                    </div>
                  </div>
                </div>
              )}
              
              {/* Cashflow FAQ Section */}
              {activeFaqSection === 'cashflow' && (
                <div>
                  <div className="faq-section">
                    <div className="faq-question">What is the cashflow analysis?</div>
                    <div className="faq-answer">
                      The cashflow analysis provides a detailed breakdown of the potential income and expenses for each property as a rental investment. It includes mortgage payments, tax and insurance costs, vacancy allowances, capital expenditure reserves, and calculates the monthly and annual cash flow as well as cash-on-cash return.
                    </div>
                  </div>
                  
                  <div className="faq-section">
                    <div className="faq-question">Can I adjust the investment assumptions?</div>
                    <div className="faq-answer">
                      Yes, you can customize the investment assumptions to match your specific situation. Adjustable parameters include interest rate, loan term, down payment percentage, tax and insurance percentage, vacancy allowance, and capital expenditure (CapEx) reserve.
                    </div>
                  </div>
                  
                  <div className="faq-section">
                    <div className="faq-question">How do I interpret the rent-to-price ratio?</div>
                    <div className="faq-answer">
                      The rent-to-price ratio is a quick way to assess a property's potential as a rental investment. It shows the monthly rent as a percentage of the purchase price. Generally, a higher ratio is better:
                      <ul>
                        <li>0.7% and above (green): Potentially strong cash flow</li>
                        <li>0.4% to 0.7% (yellow): Moderate potential</li>
                        <li>Below 0.4% (red): May be challenging to achieve positive cash flow</li>
                      </ul>
                      Remember that this is just one metric and should be considered alongside other factors like location, property condition, and growth potential.
                    </div>
                  </div>
                  
                  <div className="faq-section">
                    <div className="faq-question">Can I edit the rent estimate?</div>
                    <div className="faq-answer">
                      Yes, you can edit the rent estimate for any property by clicking on the rent estimate value in the cashflow analysis section. This allows you to input a custom rent amount if you have more accurate information about potential rental income.
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Paper>
        </Modal>
      </Container>
    </div>
  );
}

export default App;
