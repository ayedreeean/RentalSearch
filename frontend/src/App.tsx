import React, { useState, useEffect, useCallback, useRef } from 'react';
import { HashRouter as Router, Route, Routes, useNavigate } from 'react-router-dom';
import {
  Typography, Container, TextField, Button, Box, CircularProgress, 
  Paper, InputAdornment, IconButton, Alert,
  Slider, Card, CardContent, Accordion, AccordionSummary, AccordionDetails, Skeleton, Divider, Fab, Modal, Select, MenuItem, FormControl, InputLabel
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import HomeIcon from '@mui/icons-material/Home';
import BarChartIcon from '@mui/icons-material/BarChart';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import EditIcon from '@mui/icons-material/Edit';
import HomeWorkIcon from '@mui/icons-material/HomeWork';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import EmailIcon from '@mui/icons-material/Email';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import TuneIcon from '@mui/icons-material/Tune';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import CloseIcon from '@mui/icons-material/Close';
import ShareIcon from '@mui/icons-material/Share';
import './App.css';
import { searchProperties, getTotalPropertiesCount, Property, registerForPropertyUpdates } from './api/propertyApi';
import PropertyDetailsPage from './pages/PropertyDetailsPage';
import { CashflowSettings } from './types';

// Define cashflow interface
interface Cashflow {
  monthlyMortgage: number;
  monthlyTaxInsurance: number;
  monthlyVacancy: number;
  monthlyCapex: number;
  monthlyPropertyManagement: number;
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
  propertyManagementPercent: number;
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
  propertyManagementPercent,
  handleRentEstimateChange
}) => {
  // --- State for editable rent estimate --- 
  const [displayRent, setDisplayRent] = useState<string>('');
  const [isRentEditing, setIsRentEditing] = useState(false);
  // Add a separate state to track custom rent for cashflow calculation
  const [customRentEstimate, setCustomRentEstimate] = useState<number | null>(null);
  
  // Share modal state
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [copySuccess, setCopySuccess] = useState('');
  
  // Deep dive modal state
  const [isDeepDiveOpen, setIsDeepDiveOpen] = useState(false);

  // Initialize display rent when property data changes
  useEffect(() => {
    // Use custom value or property value for display
    const rentToDisplay = customRentEstimate !== null ? customRentEstimate : property.rent_estimate;
    setDisplayRent(formatCurrency(rentToDisplay));
  }, [property.rent_estimate, customRentEstimate, formatCurrency]);

  // Handlers for rent input
  const handleRentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDisplayRent(e.target.value);
  };

  const handleRentBlur = () => {
    setIsRentEditing(false);
    // Parse the rent value
    const newRent = parseFloat(displayRent.replace(/[^\d.]/g, ''));
    
    if (!isNaN(newRent) && newRent >= 0) {
      // Only update our local custom rent value - don't call the parent handler
      setCustomRentEstimate(newRent);
    } else {
      // If invalid, revert to the current value
      const currentRent = customRentEstimate !== null ? customRentEstimate : property.rent_estimate;
      setDisplayRent(formatCurrency(currentRent));
    }
  };

  const handleRentFocus = () => {
    setIsRentEditing(true);
    // Show raw number for editing
    const currentRent = customRentEstimate !== null ? customRentEstimate : property.rent_estimate;
    setDisplayRent(String(currentRent)); 
  };
  // --- End State/Handlers ---

  // Create a modified property object for cashflow calculations
  const propertyForCashflow = {
    ...property,
    rent_estimate: customRentEstimate !== null ? customRentEstimate : property.rent_estimate,
    rent_source: property.rent_source ?? "calculated", // Default to 'calculated' if undefined
  };

  // Calculate cashflow using potentially modified rent value
  const cashflow = calculateCashflow(propertyForCashflow);
  const downPaymentAmount = property.price * (downPaymentPercent / 100);
  
  // --- Create RentCast URL --- 
  const rentCastAddress = encodeURIComponent(property.address);
  const rentCastUrl = `https://app.rentcast.io/app?address=${rentCastAddress}`;
  
  // Handler for opening and closing share modal
  const handleOpenShareModal = () => setIsShareModalOpen(true);
  const handleCloseShareModal = () => {
    setIsShareModalOpen(false);
    setCopySuccess(''); // Reset copy success message
  };

  // Add navigation
  const navigate = useNavigate();
  
  // Update the deep dive handler to navigate to the details page
  const handleOpenDeepDive = (e: React.MouseEvent) => {
    e.preventDefault(); // Keep preventDefault
    navigate(`/property/${property.property_id}`);
  };
  
  const handleCloseDeepDive = () => {
    setIsDeepDiveOpen(false);
  };

  // Create a copyable summary of the property with cashflow details
  const generatePropertySummary = () => {
    const rentValue = customRentEstimate !== null ? customRentEstimate : property.rent_estimate;
    
    return `🏠 Property Investment Analysis 🏠

ADDRESS: ${property.address}
PRICE: ${formatCurrency(property.price)}
RENT ESTIMATE: ${formatCurrency(rentValue)}
RENT-TO-PRICE RATIO: ${formatPercent(property.ratio * 100)}

📊 PROPERTY DETAILS:
• ${property.bedrooms} beds, ${property.bathrooms} baths
• ${property.sqft.toLocaleString()} sq. ft.
${property.days_on_market !== null ? `• Days on market: ${property.days_on_market}` : ''}

💰 CASHFLOW ANALYSIS (Monthly):
• Down payment (${downPaymentPercent}%): ${formatCurrency(property.price * (downPaymentPercent / 100))}
• Mortgage payment: ${formatCurrency(cashflow.monthlyMortgage)}
• Property Tax & Insurance: ${formatCurrency(cashflow.monthlyTaxInsurance)}
• Vacancy (${vacancyPercent}%): ${formatCurrency(cashflow.monthlyVacancy)}
• CapEx (${capexPercent}%): ${formatCurrency(cashflow.monthlyCapex)}
• Property Management (${propertyManagementPercent}%): ${formatCurrency(cashflow.monthlyPropertyManagement)}
• Total Monthly Expenses: ${formatCurrency(cashflow.totalMonthlyExpenses)}
• Monthly Cashflow: ${formatCurrency(cashflow.monthlyCashflow)}
• Annual Cashflow: ${formatCurrency(cashflow.annualCashflow)}
• Cash-on-Cash Return: ${formatPercent(cashflow.cashOnCashReturn)}

🔗 ZILLOW LISTING: ${property.url}
🔗 RENTCAST ANALYSIS: ${rentCastUrl}

Generated with RentalSearch - https://ayedreeean.github.io/RentalSearch/
`;
  };

  // Copy to clipboard handler
  const handleCopyToClipboard = async () => {
    const summary = generatePropertySummary();
    
    try {
      await navigator.clipboard.writeText(summary);
      setCopySuccess('Copied to clipboard!');
      setTimeout(() => setCopySuccess(''), 3000); // Clear message after 3 seconds
    } catch (err) {
      setCopySuccess('Failed to copy! Try selecting and copying the text manually.');
    }
  };

  // Email share handler
  const handleEmailShare = () => {
    const summary = encodeURIComponent(generatePropertySummary());
    const subject = encodeURIComponent(`Property Investment Analysis: ${property.address}`);
    window.open(`mailto:?subject=${subject}&body=${summary}`);
    handleCloseShareModal();
  };
  
  return (
    <Card className="property-card">
      <a href="#" onClick={handleOpenDeepDive} className="property-image-container">
        <LazyImage
          src={property.thumbnail}
          alt={property.address}
        />
        <div className="property-price">
          {formatCurrency(property.price)}
        </div>
      </a>
      
      <CardContent className="property-details">
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Typography variant="h6" component="div" className="price-ratio-container" gutterBottom>
          {formatCurrency(property.price)}
            <span className={`ratio-chip ${property.ratio >= 0.007 ? 'ratio-good' : property.ratio >= 0.004 ? 'ratio-medium' : 'ratio-poor'}`}>
              Ratio: {formatPercent(property.ratio * 100)}
            </span>
            {property.days_on_market !== null && (
              <span className="days-on-market ratio-chip">
                {property.days_on_market} days
              </span>
            )}
        </Typography>
        </Box>
        
        <a href="#" onClick={handleOpenDeepDive} className="property-address">
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
            </div>
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
              {/* --- Editable Rent Estimate Row at the top --- */}
              <div className="cashflow-row" style={{ alignItems: 'center' }}>
                <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center' }}>
                  Rent Estimate:
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', marginLeft: 'auto' }}>
                  <TextField
                     variant="standard" // Use standard variant for less space
                     size="small"
                     value={isRentEditing ? displayRent : formatCurrency(customRentEstimate !== null ? customRentEstimate : property.rent_estimate)} // Show formatted or raw
                     onChange={handleRentChange}
                     onFocus={handleRentFocus}
                     onBlur={handleRentBlur}
                     InputProps={{
                       // Remove the dollar sign startAdornment
                       disableUnderline: !isRentEditing, // Hide underline when not editing
                       sx: { fontSize: '0.875rem' } // Match Typography variant="body2"
                     }}
                     sx={{ 
                       maxWidth: '100px', // Limit width
                       '& .MuiInputBase-input': { textAlign: 'right' }, // Align text right
                       cursor: 'pointer',
                       ...(isRentEditing 
                         ? { '& .MuiInputBase-root': { borderBottom: '1px solid rgba(0, 0, 0, 0.42)' } }
                         : { })
                     }}
                     // Optional: Add onKeyDown for Enter key submission
                     onKeyDown={(e) => {
                         if (e.key === 'Enter') {
                             (e.target as HTMLInputElement).blur(); // Trigger blur to save
                         }
                     }}
                   />
                   <EditIcon sx={{ fontSize: 14, ml: 0.5, color: '#6b7280', opacity: 0.7, cursor: 'pointer' }} />
                </Box>
              </div>

              <div className="cashflow-row">
                <Typography variant="body2">Down Payment:</Typography>
                <Typography variant="body2">{formatCurrency(downPaymentAmount)}</Typography>
              </div>
              <div className="cashflow-row">
                <Typography variant="body2">Monthly Mortgage Payment:</Typography>
                <Typography variant="body2">{formatCurrency(cashflow.monthlyMortgage)}</Typography>
              </div>
              <div className="cashflow-row">
                <Typography variant="body2">Property Tax & Insurance:</Typography>
                <Typography variant="body2">{formatCurrency(cashflow.monthlyTaxInsurance)}</Typography>
              </div>
              <div className="cashflow-row">
                <Typography variant="body2">Vacancy:</Typography>
                <Typography variant="body2">{formatCurrency(cashflow.monthlyVacancy)}</Typography>
              </div>
              <div className="cashflow-row">
                <Typography variant="body2">CapEx:</Typography>
                <Typography variant="body2">{formatCurrency(cashflow.monthlyCapex)}</Typography>
              </div>
              <div className="cashflow-row">
                <Typography variant="body2">Property Management:</Typography>
                <Typography variant="body2">{formatCurrency(cashflow.monthlyPropertyManagement)}</Typography>
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
        
        {/* Quick Links Section - Updated for consistent styling */}
        <div className="quick-links">
          <div className="quick-links-title">Quick Links</div>
          <div className="quick-links-buttons">
            <a href={property.url} target="_blank" rel="noopener noreferrer" className="quick-link">
              <HomeIcon sx={{ fontSize: 16, mr: 0.5, color: '#0D6EFD' }} /> Zillow
            </a>
            <a href={rentCastUrl} target="_blank" rel="noopener noreferrer" className="quick-link">
              <BarChartIcon sx={{ fontSize: 16, mr: 0.5, color: '#6366F1' }} /> RentCast
            </a>
            <a 
              href="#" // Add valid href for accessibility
              onClick={(e) => { 
                e.preventDefault();
                navigate(`/property/${property.property_id}`);
              }} 
              className="quick-link"
            >
              <HomeWorkIcon sx={{ fontSize: 16, mr: 0.5, color: '#4F46E5' }} /> Deep Dive
            </a>
      </div>
        </div>
      </div>
      
      {/* Share Modal */}
      <Modal
        open={isShareModalOpen}
        onClose={handleCloseShareModal}
        aria-labelledby="share-modal-title"
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Paper 
          sx={{ 
            width: '90%', 
            maxWidth: 600, 
            maxHeight: '90vh',
            overflowY: 'auto',
            p: 3, 
            outline: 'none',
            borderRadius: 2,
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography id="share-modal-title" variant="h6" component="h2">
              Share Property Analysis
            </Typography>
            <IconButton 
              edge="end" 
              color="inherit" 
              onClick={handleCloseShareModal} 
              aria-label="close"
            >
              <CloseIcon />
            </IconButton>
          </Box>

          <Divider sx={{ mb: 2 }} />
          
          {/* Share options */}
          <Box sx={{ mb: 3, display: 'flex', gap: 2 }}>
            <Button 
              variant="contained" 
              startIcon={<ContentCopyIcon />} 
              onClick={handleCopyToClipboard}
              sx={{ flex: '1' }}
            >
              Copy to Clipboard
            </Button>
            <Button 
              variant="outlined" 
              startIcon={<EmailIcon />} 
              onClick={handleEmailShare}
              sx={{ flex: '1' }}
            >
              Email
            </Button>
          </Box>
          
          {copySuccess && (
            <Alert severity="success" sx={{ mb: 2 }}>
              {copySuccess}
            </Alert>
          )}
          
          {/* Preview of what will be shared */}
          <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', mb: 1 }}>
            Preview:
          </Typography>
          
          <Paper 
            variant="outlined" 
            sx={{ 
              p: 2, 
              backgroundColor: '#f8f9fa',
              borderRadius: 1,
              fontFamily: 'monospace',
              whiteSpace: 'pre-wrap',
              fontSize: '0.8rem',
              wordBreak: 'break-word',
              maxHeight: '50vh',
              overflowY: 'auto'
            }}
          >
            {generatePropertySummary()}
          </Paper>
        </Paper>
      </Modal>
      
      {/* Deep Dive Modal */}
      <Modal
        open={isDeepDiveOpen}
        onClose={handleCloseDeepDive}
        aria-labelledby="deep-dive-title"
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Paper 
          sx={{ 
            width: '95%', 
            maxWidth: 900, 
            height: '90vh',
            maxHeight: '90vh',
            overflowY: 'auto',
            p: 3, 
            outline: 'none',
            borderRadius: 2,
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography id="deep-dive-title" variant="h5" component="h2">
              {property.address}
            </Typography>
            <IconButton 
              edge="end" 
              color="inherit" 
              onClick={handleCloseDeepDive} 
              aria-label="close"
            >
              <CloseIcon />
            </IconButton>
          </Box>

          <Divider sx={{ mb: 3 }} />
          
          {/* Property Image and Key Details */}
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3, mb: 4 }}>
            <Box sx={{ flex: '1', maxWidth: { xs: '100%', md: '50%' } }}>
              <img 
                src={property.thumbnail} 
                alt={property.address}
                style={{ 
                  width: '100%', 
                  borderRadius: '0.5rem',
                  maxHeight: '300px',
                  objectFit: 'cover'
                }}
              />
              
              <Box sx={{ mt: 2 }}>
                <Typography variant="h6" gutterBottom>Key Details</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
                  <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#f8f9fa' }}>
                    <Typography variant="body2" color="text.secondary">Price</Typography>
                    <Typography variant="h6">{formatCurrency(property.price)}</Typography>
                  </Paper>
                  <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#f8f9fa' }}>
                    <Typography variant="body2" color="text.secondary">Rent Estimate</Typography>
                    <Typography variant="h6">{formatCurrency(customRentEstimate !== null ? customRentEstimate : property.rent_estimate)}</Typography>
                  </Paper>
                  <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#f8f9fa' }}>
                    <Typography variant="body2" color="text.secondary">Ratio</Typography>
                    <Typography variant="h6" color={property.ratio >= 0.007 ? 'success.main' : property.ratio >= 0.004 ? 'warning.main' : 'error.main'}>
                      {formatPercent(property.ratio * 100)}
                    </Typography>
                  </Paper>
                  <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#f8f9fa' }}>
                    <Typography variant="body2" color="text.secondary">Cash-on-Cash Return</Typography>
                    <Typography variant="h6" color={cashflow.cashOnCashReturn >= 0 ? 'success.main' : 'error.main'}>
                      {formatPercent(cashflow.cashOnCashReturn)}
                    </Typography>
                  </Paper>
                </Box>
              </Box>
              
              <Box sx={{ mt: 3 }}>
                <Typography variant="h6" gutterBottom>Property Details</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
                  <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#f8f9fa' }}>
                    <Typography variant="body2" color="text.secondary">Beds</Typography>
                    <Typography variant="h6">{property.bedrooms}</Typography>
                  </Paper>
                  <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#f8f9fa' }}>
                    <Typography variant="body2" color="text.secondary">Baths</Typography>
                    <Typography variant="h6">{property.bathrooms}</Typography>
                  </Paper>
                  <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#f8f9fa' }}>
                    <Typography variant="body2" color="text.secondary">Sq Ft</Typography>
                    <Typography variant="h6">{property.sqft.toLocaleString()}</Typography>
                  </Paper>
                </Box>
              </Box>
              
              <Box sx={{ mt: 3 }}>
                <Typography variant="h6" gutterBottom>External Links</Typography>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button 
                    variant="outlined" 
                    startIcon={<HomeIcon />} 
                    fullWidth
                    href={property.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View on Zillow
                  </Button>
                  <Button 
                    variant="outlined" 
                    startIcon={<BarChartIcon />} 
                    fullWidth
                    href={rentCastUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Rentcast Analysis
                  </Button>
                </Box>
              </Box>
            </Box>
            
            {/* Cashflow Analysis Section */}
            <Box sx={{ flex: '1', maxWidth: { xs: '100%', md: '50%' } }}>
              <Typography variant="h6" gutterBottom>
                Cashflow Analysis 
                <Typography 
                  component="span" 
                  variant="h6" 
                  color={cashflow.monthlyCashflow >= 0 ? 'success.main' : 'error.main'}
                  sx={{ ml: 1 }}
                >
                  ({formatCurrency(cashflow.monthlyCashflow)}/mo)
                </Typography>
              </Typography>
              
              {/* Rent Estimate Field */}
              <Paper sx={{ mb: 3, p: 2, bgcolor: '#f8f9fa' }}>
                <Typography variant="subtitle2" gutterBottom>Customize Your Analysis</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Typography variant="body2" sx={{ mr: 2 }}>Rent Estimate:</Typography>
                  <TextField
                    variant="outlined" 
                    size="small"
                    value={isRentEditing ? displayRent : formatCurrency(customRentEstimate !== null ? customRentEstimate : property.rent_estimate)}
                    onChange={handleRentChange}
                    onFocus={handleRentFocus}
                    onBlur={handleRentBlur}
                    sx={{ maxWidth: '150px' }}
                    InputProps={{
                      endAdornment: <EditIcon sx={{ fontSize: 16, color: '#6b7280', opacity: 0.7 }} />,
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        (e.target as HTMLInputElement).blur();
                      }
                    }}
                  />
                </Box>
              </Paper>
              
              <Box sx={{ bgcolor: '#f9f9f9', p: 2, borderRadius: 2, mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom fontWeight="bold">Monthly Income</Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2">Rental Income:</Typography>
                  <Typography variant="body2" fontWeight="medium">
                    {formatCurrency(customRentEstimate !== null ? customRentEstimate : property.rent_estimate)}
                  </Typography>
                </Box>
              </Box>
              
              <Box sx={{ bgcolor: '#f9f9f9', p: 2, borderRadius: 2, mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom fontWeight="bold">Monthly Expenses</Typography>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2">Mortgage Payment:</Typography>
                  <Typography variant="body2">{formatCurrency(cashflow.monthlyMortgage)}</Typography>
                </Box>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2">Property Tax & Insurance:</Typography>
                  <Typography variant="body2">{formatCurrency(cashflow.monthlyTaxInsurance)}</Typography>
                </Box>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2">Vacancy:</Typography>
                  <Typography variant="body2">{formatCurrency(cashflow.monthlyVacancy)}</Typography>
                </Box>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2">CapEx:</Typography>
                  <Typography variant="body2">{formatCurrency(cashflow.monthlyCapex)}</Typography>
                </Box>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2">Property Management:</Typography>
                  <Typography variant="body2">{formatCurrency(cashflow.monthlyPropertyManagement)}</Typography>
                </Box>
                
                <Divider sx={{ my: 1 }} />
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2" fontWeight="bold">Total Monthly Expenses:</Typography>
                  <Typography variant="body2" fontWeight="bold">{formatCurrency(cashflow.totalMonthlyExpenses)}</Typography>
                </Box>
              </Box>
              
              <Box sx={{ bgcolor: '#f0f7ff', p: 2, borderRadius: 2, mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom fontWeight="bold">Investment Returns</Typography>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2">Down Payment:</Typography>
                  <Typography variant="body2">{formatCurrency(downPaymentAmount)}</Typography>
                </Box>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2">Closing Costs (est. 3%):</Typography>
                  <Typography variant="body2">{formatCurrency(property.price * 0.03)}</Typography>
                </Box>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2">Total Investment:</Typography>
                  <Typography variant="body2">{formatCurrency(downPaymentAmount + property.price * 0.03)}</Typography>
                </Box>
                
                <Divider sx={{ my: 1 }} />
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2" fontWeight="bold">Monthly Cashflow:</Typography>
                  <Typography variant="body2" fontWeight="bold" color={cashflow.monthlyCashflow >= 0 ? 'success.main' : 'error.main'}>
                    {formatCurrency(cashflow.monthlyCashflow)}
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2" fontWeight="bold">Annual Cashflow:</Typography>
                  <Typography variant="body2" fontWeight="bold" color={cashflow.annualCashflow >= 0 ? 'success.main' : 'error.main'}>
                    {formatCurrency(cashflow.annualCashflow)}
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2" fontWeight="bold">Cash-on-Cash Return:</Typography>
                  <Typography variant="body2" fontWeight="bold" color={cashflow.cashOnCashReturn >= 0 ? 'success.main' : 'error.main'}>
                    {formatPercent(cashflow.cashOnCashReturn)}
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Box>
          
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
            <Button 
              variant="contained" 
              startIcon={<ShareIcon />} 
              onClick={handleOpenShareModal}
              sx={{ mx: 1 }}
            >
              Share Analysis
            </Button>
            <Button 
              variant="outlined" 
              onClick={handleCloseDeepDive}
              sx={{ mx: 1 }}
            >
              Close
            </Button>
          </Box>
        </Paper>
      </Modal>
    </Card>
  );
};

// Define possible sort keys
type SortableKey = keyof Pick<Property, 'price' | 'rent_estimate' | 'bedrooms' | 'bathrooms' | 'sqft' | 'days_on_market'> | 'ratio' | 'cashflow';

function App() {
  // State variables
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);
  const [isProcessingBackground, setIsProcessingBackground] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchPerformed, setSearchPerformed] = useState(false);
  
  // New state for marketing intro panel
  const [showMarketingIntro, setShowMarketingIntro] = useState(true);
  
  // Mortgage calculator state
  const [interestRate, setInterestRate] = useState(7.5);
  const [loanTerm, setLoanTerm] = useState(30);
  const [downPaymentPercent, setDownPaymentPercent] = useState(20);
  const [taxInsurancePercent, setTaxInsurancePercent] = useState(3);
  const [vacancyPercent, setVacancyPercent] = useState(8);
  const [capexPercent, setCapexPercent] = useState(5);
  const [propertyManagementPercent, setPropertyManagementPercent] = useState(0);
  
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
  const [isAssumptionsPanelOpen, setIsAssumptionsPanelOpen] = useState(false); // Add state for panel visibility

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
    const monthlyPropertyManagement = property.rent_estimate * (propertyManagementPercent / 100);
    
    const totalMonthlyExpenses = monthlyMortgage + monthlyTaxInsurance + monthlyVacancy + monthlyCapex + monthlyPropertyManagement;
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
      monthlyPropertyManagement,
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
        } else if (sortConfig.key === 'cashflow') {
          // Calculate cashflow for both properties for comparison
          const cashflowA = calculateCashflow(a).monthlyCashflow;
          const cashflowB = calculateCashflow(b).monthlyCashflow;
          valA = cashflowA;
          valB = cashflowB;
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
  }, [displayedProperties, sortConfig, calculateCashflow, interestRate, loanTerm, downPaymentPercent, taxInsurancePercent, vacancyPercent, capexPercent, propertyManagementPercent]);

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
  
  // Define the default settings for calculator
  const defaultSettings: CashflowSettings = {
    interestRate,
    loanTerm,
    downPaymentPercent,
    taxInsurancePercent,
    vacancyPercent,
    capexPercent,
    propertyManagementPercent
  };
  
  // Check if this is the user's first visit
  useEffect(() => {
    const hasVisitedBefore = localStorage.getItem('rentalSearchHasVisited');
    if (hasVisitedBefore) {
      setShowMarketingIntro(false);
    } else {
      localStorage.setItem('rentalSearchHasVisited', 'true');
    }
  }, []);

  // Handler to dismiss marketing section
  const handleDismissMarketing = () => {
    setShowMarketingIntro(false);
  };
  
  return (
    <div className="App">
      <Routes>
        <Route path="/" element={
          <>
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
              {/* Marketing intro section */}
              {showMarketingIntro && (
                <Paper 
                  elevation={0} 
                  sx={{ 
                    mb: 4, 
                    p: 3, 
                    borderRadius: 2,
                    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                    color: 'white',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  <IconButton
                    onClick={handleDismissMarketing}
                    size="small"
                    sx={{
                      position: 'absolute',
                      right: 8,
                      top: 8,
                      color: 'white',
                      bgcolor: 'rgba(255,255,255,0.2)',
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' }
                    }}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                  
                  <Typography variant="h4" fontWeight="bold" gutterBottom>
                    Find Your Next Investment Property
                  </Typography>
                  
                  <Typography variant="body1" sx={{ mb: 2, maxWidth: 800 }}>
                    RentalSearch helps you discover and analyze potential real estate investments in seconds. 
                    Get detailed cash flow analysis, long-term equity projections, and returns on investment 
                    for properties in any location.
                  </Typography>
                  
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', my: 1 }}>
                      <Box sx={{ width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(255,255,255,0.2)', mr: 1.5 }}>
                        <SearchIcon sx={{ color: 'white' }} />
                      </Box>
                      <Box>
                        <Typography variant="subtitle1" fontWeight="bold">Fast Property Search</Typography>
                        <Typography variant="body2">Find properties with cashflow potential in any area</Typography>
                      </Box>
                    </Box>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', my: 1 }}>
                      <Box sx={{ width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(255,255,255,0.2)', mr: 1.5 }}>
                        <BarChartIcon sx={{ color: 'white' }} />
                      </Box>
                      <Box>
                        <Typography variant="subtitle1" fontWeight="bold">Detailed Analysis</Typography>
                        <Typography variant="body2">Get comprehensive financial projections for each property</Typography>
                      </Box>
                    </Box>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', my: 1 }}>
                      <Box sx={{ width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(255,255,255,0.2)', mr: 1.5 }}>
                        <ShareIcon sx={{ color: 'white' }} />
                      </Box>
                      <Box>
                        <Typography variant="subtitle1" fontWeight="bold">Easy Sharing</Typography>
                        <Typography variant="body2">Share property analysis with partners or clients via URL</Typography>
                      </Box>
                    </Box>
                  </Box>
                </Paper>
              )}
              
              {/* Search Form - Modified to include price filters */}
              <div className="search-container">
                {/* ... existing search form ... */}
              </div>
            </Container>
          </>
        } />
      </Routes>
    </div>
  );
}

export default App;
