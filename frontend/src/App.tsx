import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FixedSizeGrid as Grid } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { Container, TextField, Button, Typography, Card, CardContent, Box, Alert, CircularProgress, Slider, Accordion, AccordionSummary, AccordionDetails, Pagination, Skeleton } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import './App.css';
import { searchProperties, getTotalPropertiesCount, Property } from './api/propertyApi';

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
  style?: React.CSSProperties;
}

const PropertyCard: React.FC<PropertyCardProps> = ({ 
  property, 
  calculateCashflow, 
  formatCurrency, 
  formatPercent, 
  vacancyPercent, 
  capexPercent,
  style
}) => {
  const cashflow = calculateCashflow(property);
  
  return (
    <Card className="property-card" style={style}>
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
          <Typography variant="body2" color="textSecondary" gutterBottom>
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
              {property.days_on_market}
            </div>
          )}
        </Box>
        
        <div className="metrics">
          <div className="metric">
            <Typography variant="body2" color="textSecondary">Beds</Typography>
            <Typography variant="body1" fontWeight="medium">{property.bedrooms}</Typography>
          </div>
          <div className="metric">
            <Typography variant="body2" color="textSecondary">Baths</Typography>
            <Typography variant="body1" fontWeight="medium">{property.bathrooms}</Typography>
          </div>
          <div className="metric">
            <Typography variant="body2" color="textSecondary">Sq Ft</Typography>
            <Typography variant="body1" fontWeight="medium">{property.sqft.toLocaleString()}</Typography>
          </div>
        </div>
      </CardContent>
      
      <div className="property-footer">
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <div className="cashflow-header">
              <ExpandMoreIcon />
              <Typography fontWeight="medium">Cashflow Analysis</Typography>
              <Typography 
                variant="body2" 
                fontWeight="bold" 
                color={cashflow.monthlyCashflow >= 0 ? 'success.main' : 'error.main'}
                sx={{ ml: 'auto' }}
              >
                {formatCurrency(cashflow.monthlyCashflow)}/mo
              </Typography>
            </div>
          </AccordionSummary>
          <AccordionDetails>
            <div className="cashflow-analysis">
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
            </div>
          </AccordionDetails>
        </Accordion>
      </div>
    </Card>
  );
};

// Virtualized Property Grid Component
interface VirtualizedPropertyGridProps {
  properties: Property[];
  calculateCashflow: (property: Property) => Cashflow;
  formatCurrency: (amount: number) => string;
  formatPercent: (percent: number) => string;
  vacancyPercent: number;
  capexPercent: number;
}

const VirtualizedPropertyGrid: React.FC<VirtualizedPropertyGridProps> = ({
  properties,
  calculateCashflow,
  formatCurrency,
  formatPercent,
  vacancyPercent,
  capexPercent
}) => {
  // Calculate number of columns based on container width
  const getColumnCount = (width: number) => {
    if (width < 600) return 1;
    if (width < 960) return 2;
    return 3;
  };

  // Cell renderer for the grid
  const Cell = ({ columnIndex, rowIndex, style, data }: any) => {
    const { properties, columnCount } = data;
    const index = rowIndex * columnCount + columnIndex;
    
    if (index >= properties.length) {
      return null;
    }
    
    const property = properties[index];
    
    return (
      <div style={{
        ...style,
        padding: '10px',
      }}>
        <PropertyCard
          property={property}
          calculateCashflow={calculateCashflow}
          formatCurrency={formatCurrency}
          formatPercent={formatPercent}
          vacancyPercent={vacancyPercent}
          capexPercent={capexPercent}
        />
      </div>
    );
  };

  return (
    <div style={{ height: 'calc(100vh - 300px)', minHeight: '500px' }}>
      <AutoSizer>
        {({ height, width }) => {
          const columnCount = getColumnCount(width);
          const rowCount = Math.ceil(properties.length / columnCount);
          
          return (
            <Grid
              columnCount={columnCount}
              columnWidth={width / columnCount}
              height={height}
              rowCount={rowCount}
              rowHeight={550}
              width={width}
              itemData={{
                properties,
                columnCount,
                calculateCashflow,
                formatCurrency,
                formatPercent,
                vacancyPercent,
                capexPercent
              }}
            >
              {Cell}
            </Grid>
          );
        }}
      </AutoSizer>
    </div>
  );
};

// Cache for storing paginated results
interface PageCache {
  [key: string]: {
    allProperties: Property[];
    completeProperties: Property[];
    timestamp: number;
  }
}

function App() {
  // State variables
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);
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
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalProperties, setTotalProperties] = useState(0);
  const [displayedProperties, setDisplayedProperties] = useState<Property[]>([]);
  const [pageSize] = useState(10); // Fixed page size of 10 properties

  // Filter state - keeping these for the API but not showing in UI
  const [priceRange, setPriceRange] = useState<[number, number]>([100000, 1000000]);
  const [bedroomsFilter, setBedroomsFilter] = useState<number[]>([]);
  const [bathroomsFilter, setBathroomsFilter] = useState<number[]>([]);
  const [minRatio, setMinRatio] = useState(0.004);
  const [propertyType, setPropertyType] = useState('All');
  
  // State for tracking complete properties (with rent estimates)
  const [completeProperties, setCompleteProperties] = useState<Property[]>([]);
  const [hasInitialBatch, setHasInitialBatch] = useState(false);
  
  // Page cache for faster navigation
  const pageCache = useRef<PageCache>({});
  const prefetchingPage = useRef<number | null>(null);
  
  // Current search parameters for prefetching
  const currentSearchParams = useRef({
    location: '',
    filters: {}
  });

  // Function to create filters object
  const createFilters = useCallback(() => {
    return {
      priceRange,
      bedroomsFilter: bedroomsFilter.length > 0 ? bedroomsFilter : undefined,
      bathroomsFilter: bathroomsFilter.length > 0 ? bathroomsFilter : undefined,
      minRatio,
      propertyType: propertyType !== 'All' ? propertyType : undefined
    };
  }, [priceRange, bedroomsFilter, bathroomsFilter, minRatio, propertyType]);

  // Function to get cache key for a page
  const getPageCacheKey = useCallback((loc: string, page: number, filters: any) => {
    return `${loc}_${page}_${JSON.stringify(filters)}`;
  }, []);

  // Function to prefetch next page
  const prefetchNextPage = useCallback(async (loc: string, currentPageIndex: number, filters: any) => {
    // Don't prefetch if we're on the last page
    if (currentPageIndex >= totalPages - 1) return;
    
    const nextPageIndex = currentPageIndex + 1;
    const cacheKey = getPageCacheKey(loc, nextPageIndex, filters);
    
    // Check if page is already in cache
    if (pageCache.current[cacheKey]) return;
    
    // Check if we're already prefetching this page
    if (prefetchingPage.current === nextPageIndex) return;
    
    prefetchingPage.current = nextPageIndex;
    
    try {
      console.log(`Prefetching page ${nextPageIndex + 1} in background`);
      const results = await searchProperties(loc, nextPageIndex, filters, false);
      
      // Store in cache
      pageCache.current[cacheKey] = {
        allProperties: results.allProperties,
        completeProperties: results.completeProperties,
        timestamp: Date.now()
      };
      
      console.log(`Page ${nextPageIndex + 1} prefetched and cached`);
    } catch (error) {
      console.error(`Error prefetching page ${nextPageIndex + 1}:`, error);
    } finally {
      prefetchingPage.current = null;
    }
  }, [getPageCacheKey, totalPages]);

  // Function to handle search button click
  const handleSearch = async () => {
    if (!location.trim()) {
      setError('Please enter a location');
      return;
    }
    
    setLoading(true);
    setInitialLoading(true);
    setError(null);
    setSearchPerformed(true);
    setCurrentPage(0);
    setHasInitialBatch(false);
    setCompleteProperties([]);
    setDisplayedProperties([]);
    
    try {
      console.log('Starting property search for:', location);
      
      // Create filters object
      const filters = createFilters();
      
      // Update current search parameters for prefetching
      currentSearchParams.current = {
        location,
        filters
      };
      
      // Get total count for pagination
      const totalCount = await getTotalPropertiesCount(location, filters);
      
      // Calculate total pages (10 properties per page)
      const pages = Math.ceil(totalCount / pageSize);
      
      setTotalPages(pages);
      setTotalProperties(totalCount);
      
      console.log(`Found ${totalCount} properties, ${pages} pages`);
      
      // Search for properties with prioritized loading
      const results = await searchProperties(location, 0, filters, true);
      console.log('Search results:', results);
      
      // Set complete properties (with rent estimates)
      setCompleteProperties(results.completeProperties);
      
      // Only display the first 10 properties (or fewer if there are less than 10)
      const displayCount = Math.min(pageSize, results.completeProperties.length);
      setDisplayedProperties(results.completeProperties.slice(0, displayCount));
      
      // Check if we have at least 10 complete properties or all properties are complete
      if (results.completeProperties.length >= 10 || 
          results.completeProperties.length === results.allProperties.length) {
        setHasInitialBatch(true);
        setInitialLoading(false);
      }
      
      // Cache the first page results
      const cacheKey = getPageCacheKey(location, 0, filters);
      pageCache.current[cacheKey] = {
        allProperties: results.allProperties,
        completeProperties: results.completeProperties,
        timestamp: Date.now()
      };
      
      // Start prefetching the next page
      prefetchNextPage(location, 0, filters);
      
    } catch (err) {
      console.error('Error searching properties:', err);
      setError('Error searching for properties. Please try again.');
      setDisplayedProperties([]);
      setCompleteProperties([]);
      setInitialLoading(false);
    } finally {
      setLoading(false);
    }
  };
  
  // Function to handle page change
  const handlePageChange = async (event: React.ChangeEvent<unknown>, value: number) => {
    const pageIndex = value - 1; // Convert from 1-based to 0-based
    
    setLoading(true);
    setError(null);
    
    try {
      console.log(`Changing to page ${value} (index ${pageIndex})`);
      
      // Create filters object
      const filters = createFilters();
      
      // Check if page is in cache
      const cacheKey = getPageCacheKey(location, pageIndex, filters);
      const cachedPage = pageCache.current[cacheKey];
      
      if (cachedPage) {
        console.log(`Using cached data for page ${value}`);
        
        // Use cached data
        setCompleteProperties(cachedPage.completeProperties);
        setDisplayedProperties(cachedPage.completeProperties.slice(0, pageSize));
        setCurrentPage(pageIndex);
        setLoading(false);
        
        // Start prefetching the next page
        prefetchNextPage(location, pageIndex, filters);
        return;
      }
      
      // If not in cache, fetch from API
      console.log(`Fetching page ${value} from API`);
      
      // Search for properties
      const results = await searchProperties(location, pageIndex, filters, false);
      console.log('Page results:', results);
      
      // Set complete properties (with rent estimates)
      setCompleteProperties(results.completeProperties);
      
      // Only display the first 10 properties (or fewer if there are less than 10)
      const displayCount = Math.min(pageSize, results.completeProperties.length);
      setDisplayedProperties(results.completeProperties.slice(0, displayCount));
      
      setCurrentPage(pageIndex);
      
      // Cache the page results
      pageCache.current[cacheKey] = {
        allProperties: results.allProperties,
        completeProperties: results.completeProperties,
        timestamp: Date.now()
      };
      
      // Start prefetching the next page
      prefetchNextPage(location, pageIndex, filters);
      
    } catch (err) {
      console.error('Error fetching page:', err);
      setError('Error loading properties. Please try again.');
    } finally {
      setLoading(false);
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
  
  // Helper function to format currency
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };
  
  // Helper function to format percentage
  const formatPercent = (percent: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'percent',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    }).format(percent / 100);
  };
  
  // Clean up expired cache entries periodically
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      const expirationTime = 30 * 60 * 1000; // 30 minutes
      
      Object.keys(pageCache.current).forEach(key => {
        if (now - pageCache.current[key].timestamp > expirationTime) {
          delete pageCache.current[key];
        }
      });
    }, 5 * 60 * 1000); // Run every 5 minutes
    
    return () => clearInterval(cleanupInterval);
  }, []);
  
  return (
    <Container maxWidth="lg" className="app-container">
      <Typography variant="h4" component="h1" gutterBottom align="center" className="app-title">
        Rental Property Search
      </Typography>
      
      <Box className="search-container">
        <TextField
          label="Enter Location (City, State, or Zip)"
          variant="outlined"
          fullWidth
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              handleSearch();
            }
          }}
        />
        <Button 
          variant="contained" 
          color="primary" 
          onClick={handleSearch}
          disabled={loading}
          className="search-button"
        >
          {loading ? <CircularProgress size={24} color="inherit" /> : 'Search'}
        </Button>
      </Box>
      
      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
      
      {searchPerformed && (
        <Box className="results-container">
          <Box className="mortgage-calculator">
            <Typography variant="h6" gutterBottom>
              Mortgage Calculator
            </Typography>
            
            <Box className="slider-container">
              <Typography variant="body2">
                Interest Rate: {interestRate}%
              </Typography>
              <Slider
                value={interestRate}
                onChange={(_, value) => setInterestRate(value as number)}
                min={2}
                max={10}
                step={0.1}
                valueLabelDisplay="auto"
                valueLabelFormat={(value) => `${value}%`}
              />
            </Box>
            
            <Box className="slider-container">
              <Typography variant="body2">
                Loan Term: {loanTerm} years
              </Typography>
              <Slider
                value={loanTerm}
                onChange={(_, value) => setLoanTerm(value as number)}
                min={15}
                max={30}
                step={5}
                marks
                valueLabelDisplay="auto"
                valueLabelFormat={(value) => `${value} years`}
              />
            </Box>
            
            <Box className="slider-container">
              <Typography variant="body2">
                Down Payment: {downPaymentPercent}%
              </Typography>
              <Slider
                value={downPaymentPercent}
                onChange={(_, value) => setDownPaymentPercent(value as number)}
                min={5}
                max={30}
                step={5}
                marks
                valueLabelDisplay="auto"
                valueLabelFormat={(value) => `${value}%`}
              />
            </Box>
            
            <Box className="slider-container">
              <Typography variant="body2">
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
            
            <Box className="slider-container">
              <Typography variant="body2">
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
            
            <Box className="slider-container">
              <Typography variant="body2">
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
          
          <Box className="properties-container">
            {initialLoading ? (
              <Box className="loading-container">
                <CircularProgress />
                <Typography variant="body1" sx={{ mt: 2 }}>
                  Loading properties...
                </Typography>
              </Box>
            ) : displayedProperties.length > 0 ? (
              <>
                <Box className="properties-header">
                  <Typography variant="h6">
                    {totalProperties} Properties Found
                  </Typography>
                  
                  <Box className="pagination-container">
                    <Pagination 
                      count={totalPages} 
                      page={currentPage + 1} 
                      onChange={handlePageChange}
                      color="primary"
                      disabled={loading}
                    />
                  </Box>
                </Box>
                
                <VirtualizedPropertyGrid
                  properties={displayedProperties}
                  calculateCashflow={calculateCashflow}
                  formatCurrency={formatCurrency}
                  formatPercent={formatPercent}
                  vacancyPercent={vacancyPercent}
                  capexPercent={capexPercent}
                />
                
                <Box className="pagination-container" sx={{ mt: 2 }}>
                  <Pagination 
                    count={totalPages} 
                    page={currentPage + 1} 
                    onChange={handlePageChange}
                    color="primary"
                    disabled={loading}
                  />
                </Box>
              </>
            ) : (
              <Typography variant="body1">
                No properties found matching your criteria.
              </Typography>
            )}
          </Box>
        </Box>
      )}
    </Container>
  );
}

export default App;
