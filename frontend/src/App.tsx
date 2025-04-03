import React, { useState, useEffect, useRef } from 'react';
import { Container, TextField, Button, Typography, Card, CardContent, CardMedia, Box, Alert, CircularProgress, Slider, Accordion, AccordionSummary, AccordionDetails, Divider, Pagination, Skeleton } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import './App.css';
import { searchProperties, getTotalPropertiesCount, clearCache, Property } from './api/propertyApi';

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

function App() {
  // State variables
  const [location, setLocation] = useState('');
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(false);
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

  // Filter state - keeping these for the API but not showing in UI
  const [priceRange, setPriceRange] = useState<[number, number]>([100000, 1000000]);
  const [bedroomsFilter, setBedroomsFilter] = useState<number[]>([]);
  const [bathroomsFilter, setBathroomsFilter] = useState<number[]>([]);
  const [minRatio, setMinRatio] = useState(0.004);
  const [propertyType, setPropertyType] = useState('All');

  // Function to handle search button click
  const handleSearch = async () => {
    if (!location.trim()) {
      setError('Please enter a location');
      return;
    }
    
    setLoading(true);
    setError(null);
    setSearchPerformed(true);
    setCurrentPage(0);
    
    try {
      console.log('Starting property search for:', location);
      
      // Create filters object
      const filters = {
        priceRange,
        bedroomsFilter: bedroomsFilter.length > 0 ? bedroomsFilter : undefined,
        bathroomsFilter: bathroomsFilter.length > 0 ? bathroomsFilter : undefined,
        minRatio,
        propertyType: propertyType !== 'All' ? propertyType : undefined
      };
      
      const results = await searchProperties(location, 0, filters);
      console.log('Search results:', results);
      setProperties(results);
      
      // Get total count for pagination
      const totalCount = await getTotalPropertiesCount(location, filters);
      
      // Calculate total pages (10 properties per page)
      const pages = Math.ceil(totalCount / 10);
      
      setTotalPages(pages);
      setTotalProperties(totalCount);
      
      console.log(`Found ${totalCount} properties, ${pages} pages`);
    } catch (err) {
      console.error('Error searching properties:', err);
      setError('Error searching for properties. Please try again.');
      setProperties([]);
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
      const filters = {
        priceRange,
        bedroomsFilter: bedroomsFilter.length > 0 ? bedroomsFilter : undefined,
        bathroomsFilter: bathroomsFilter.length > 0 ? bathroomsFilter : undefined,
        minRatio,
        propertyType: propertyType !== 'All' ? propertyType : undefined
      };
      
      const results = await searchProperties(location, pageIndex, filters);
      console.log('Page results:', results);
      setProperties(results);
      setCurrentPage(pageIndex);
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

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom align="center">
        Rental Property Finder
      </Typography>
      
      <Box sx={{ mb: 4 }}>
        <TextField
          fullWidth
          label="Enter Zip Code or City"
          variant="outlined"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          sx={{ mb: 2 }}
        />
        <Button 
          variant="contained" 
          color="primary" 
          onClick={handleSearch}
          disabled={loading}
          fullWidth
        >
          {loading ? <CircularProgress size={24} color="inherit" /> : 'Search Properties'}
        </Button>
      </Box>
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      {/* Mortgage Calculator Settings */}
      <Accordion sx={{ mb: 3 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>Cashflow Calculator Settings</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography gutterBottom>Interest Rate: {interestRate}%</Typography>
          <Slider
            value={interestRate}
            onChange={(_, value) => setInterestRate(value as number)}
            min={2}
            max={10}
            step={0.1}
            valueLabelDisplay="auto"
            sx={{ mb: 3 }}
          />
          
          <Typography gutterBottom>Loan Term: {loanTerm} years</Typography>
          <Slider
            value={loanTerm}
            onChange={(_, value) => setLoanTerm(value as number)}
            min={15}
            max={30}
            step={5}
            marks
            valueLabelDisplay="auto"
            sx={{ mb: 3 }}
          />
          
          <Typography gutterBottom>Down Payment: {downPaymentPercent}%</Typography>
          <Slider
            value={downPaymentPercent}
            onChange={(_, value) => setDownPaymentPercent(value as number)}
            min={5}
            max={50}
            step={5}
            valueLabelDisplay="auto"
            sx={{ mb: 3 }}
          />
          
          <Typography gutterBottom>Property Tax & Insurance: {taxInsurancePercent}% of property value annually</Typography>
          <Slider
            value={taxInsurancePercent}
            onChange={(_, value) => setTaxInsurancePercent(value as number)}
            min={0.5}
            max={3}
            step={0.1}
            valueLabelDisplay="auto"
            sx={{ mb: 3 }}
          />
          
          <Typography gutterBottom>Vacancy: {vacancyPercent}% of rent</Typography>
          <Slider
            value={vacancyPercent}
            onChange={(_, value) => setVacancyPercent(value as number)}
            min={0}
            max={10}
            step={1}
            valueLabelDisplay="auto"
            sx={{ mb: 3 }}
          />
          
          <Typography gutterBottom>Capital Expenditures: {capexPercent}% of rent</Typography>
          <Slider
            value={capexPercent}
            onChange={(_, value) => setCapexPercent(value as number)}
            min={0}
            max={10}
            step={1}
            valueLabelDisplay="auto"
          />
        </AccordionDetails>
      </Accordion>
      
      {/* Show pagination info if we have results */}
      {searchPerformed && !loading && properties.length > 0 && totalPages > 0 && (
        <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
          Showing {properties.length} of {totalProperties} properties (Page {currentPage + 1} of {totalPages})
        </Typography>
      )}
      
      {loading ? (
        <Box display="flex" justifyContent="center" my={4}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <div className="property-grid">
            {properties.map(property => {
              const cashflow = calculateCashflow(property);
              
              return (
                <Card key={property.property_id} className="property-card">
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
            })}
          </div>
          
          {/* Simple pagination controls */}
          {totalPages > 1 && (
            <Box display="flex" justifyContent="center" mt={4} mb={4}>
              <Pagination 
                count={totalPages} 
                page={currentPage + 1} 
                onChange={handlePageChange}
                color="primary"
              />
            </Box>
          )}
        </>
      )}
      
      {searchPerformed && !loading && properties.length === 0 && !error && (
        <Alert severity="info">
          No properties found in this location. Please try another zip code or city.
        </Alert>
      )}
    </Container>
  );
}

export default App;
