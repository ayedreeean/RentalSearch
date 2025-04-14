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
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
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

// Create AppContent component that can use hooks
function AppContent() {
  // State variables
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);
  const [isProcessingBackground, setIsProcessingBackground] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchPerformed, setSearchPerformed] = useState(false);
  
  // Changed from showMarketingIntro to expandedMarketingIntro
  const [showMarketingIntro, setShowMarketingIntro] = useState(true);
  const [expandedMarketing, setExpandedMarketing] = useState(true);
  
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
  const [activeFaqSection, setActiveFaqSection] = useState('overview');

  const [searchResultsCount, setSearchResultsCount] = useState(0);

  // Now we can use useNavigate here
  const navigate = useNavigate();
  
  // Check if user has explicitly dismissed the marketing section
  useEffect(() => {
    const hasExplicitlyDismissed = localStorage.getItem('rentalSearchMarketingDismissed');
    if (hasExplicitlyDismissed === 'true') {
      setShowMarketingIntro(false);
    } else {
      setShowMarketingIntro(true);
    }
    
    // Initialize expanded state
    const isCollapsed = localStorage.getItem('rentalSearchMarketingCollapsed');
    if (isCollapsed === 'true') {
      setExpandedMarketing(false);
    } else {
      setExpandedMarketing(true);
    }
  }, []);

  // Handler to dismiss marketing section
  const handleDismissMarketing = () => {
    setShowMarketingIntro(false);
    localStorage.setItem('rentalSearchMarketingDismissed', 'true');
  };
  
  // Add handler to toggle marketing expansion
  const handleToggleMarketing = () => {
    const newState = !expandedMarketing;
    setExpandedMarketing(newState);
    localStorage.setItem('rentalSearchMarketingCollapsed', newState ? 'false' : 'true');
  };
  
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

  // ... Rest of the component methods ...

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
  
  // Create a function that uses the settings passed in instead of the global state
  const calculateCashflowWithSettings = (property: Property, settings: CashflowSettings) => {
    const monthlyMortgage = calculateMortgageWithSettings(property.price, settings);
    const monthlyTaxInsurance = property.price * (settings.taxInsurancePercent / 100) / 12;
    const monthlyVacancy = property.rent_estimate * (settings.vacancyPercent / 100);
    const monthlyCapex = property.rent_estimate * (settings.capexPercent / 100);
    const monthlyPropertyManagement = property.rent_estimate * (settings.propertyManagementPercent / 100);
    
    const totalMonthlyExpenses = monthlyMortgage + monthlyTaxInsurance + monthlyVacancy + monthlyCapex + monthlyPropertyManagement;
    const monthlyCashflow = property.rent_estimate - totalMonthlyExpenses;
    const annualCashflow = monthlyCashflow * 12;
    
    const downPayment = property.price * (settings.downPaymentPercent / 100);
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
  
  // Helper function to calculate mortgage with specific settings
  function calculateMortgageWithSettings(price: number, settings: CashflowSettings): number {
    const downPayment = price * (settings.downPaymentPercent / 100);
    const loanAmount = price - downPayment;
    const monthlyRate = settings.interestRate / 100 / 12;
    const payments = settings.loanTerm * 12;
    
    if (monthlyRate === 0) return loanAmount / payments;
    
    const x = Math.pow(1 + monthlyRate, payments);
    return loanAmount * (monthlyRate * x) / (x - 1);
  }
  
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
              {/* Marketing intro section - make collapsible */}
              <Paper 
                elevation={0} 
                sx={{ 
                  mb: 4, 
                  p: expandedMarketing ? 3 : 2, 
                  borderRadius: 2,
                  background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                  color: 'white',
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'all 0.3s ease'
                }}
              >
                <IconButton
                  onClick={handleToggleMarketing}
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
                  {expandedMarketing ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                </IconButton>
                
                {expandedMarketing ? (
                  <>
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
                  </>
                ) : (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography variant="h6" fontWeight="bold">
                      Find Your Next Investment Property - Click to expand
                    </Typography>
                  </Box>
                )}
              </Paper>
              
              {/* Search Form - Modified to include price filters */}
              <div className="search-container">
                <Box component="form" onSubmit={(e) => { e.preventDefault(); handleSearch(); }} className="search-form">
                  <div style={{ flex: '1', minWidth: '250px' }}>
                    <TextField
                      label="Enter Location (City, State, Zip, or Full Address)"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      fullWidth
                      variant="outlined"
                      required
                      className="search-input"
                      placeholder="e.g. Austin, TX or 123 Main St, Austin, TX"
                      helperText="Search by city, zip code, or specific property address"
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchIcon color="action" />
                          </InputAdornment>
                        ),
                      }}
                    />
                  </div>
                  
                  {/* Price filters */}
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
                    className="search-button"
                  >
                    Search Properties
                  </Button>
                </Box>
              </div>
              
              {/* Floating Assumptions Button - Render only after search */}
              {searchPerformed && (
                <Fab
                  variant="extended"
                  aria-label="toggle assumptions panel"
                  onClick={() => setIsAssumptionsPanelOpen(!isAssumptionsPanelOpen)}
                  sx={{
                    position: 'fixed',
                    bottom: 16,
                    right: 16,
                    zIndex: 1250,
                    bgcolor: '#4f46e5', // Apply custom background color
                    color: 'white', // Ensure text/icon contrast
                    '&:hover': {
                      bgcolor: '#4338ca' // Slightly darker shade for hover
                    }
                  }}
                >
                  <TuneIcon sx={{ mr: 1 }} />
                  Assumptions
                </Fab>
              )}

              {/* Floating Assumptions Panel - Render only after search and when open */}
              {searchPerformed && isAssumptionsPanelOpen && (
                <Paper 
                  elevation={4} 
                  sx={{
                    position: 'fixed',
                    bottom: 72, // Position above FAB (Fab height ~56px + 16px spacing)
                    right: 16,
                    zIndex: 1200, 
                    maxWidth: '400px', 
                    maxHeight: 'calc(100vh - 90px)', 
                    overflowY: 'auto', 
                    borderRadius: 2, 
                    p: 3 // Padding directly on Paper
                  }}
                >
                  <Typography variant="h6" fontWeight="medium" gutterBottom> 
                    Mortgage & Cashflow Assumptions
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                    {/* Interest Rate Slider */}
                    <Box sx={{ flexBasis: { xs: '100%' } }}>
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
                          sx={{ color: '#4f46e5' }} // Apply custom color
                        />
                      </Box>
                    </Box>
                    {/* Loan Term Slider */}
                    <Box sx={{ flexBasis: { xs: '100%' } }}>
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
                          sx={{ color: '#4f46e5' }} // Apply custom color
                        />
                      </Box>
                    </Box>
                    {/* Down Payment Slider */}
                    <Box sx={{ flexBasis: { xs: '100%' } }}>
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
                          sx={{ color: '#4f46e5' }} // Apply custom color
                        />
                      </Box>
                    </Box>
                    {/* Tax & Insurance Slider */}
                    <Box sx={{ flexBasis: { xs: '100%' } }}>
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
                          sx={{ color: '#4f46e5' }} // Apply custom color
                        />
                      </Box>
                    </Box>
                    {/* Vacancy Slider */}
                    <Box sx={{ flexBasis: { xs: '100%' } }}>
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
                          sx={{ color: '#4f46e5' }} // Apply custom color
                        />
                      </Box>
                    </Box>
                    {/* CapEx Slider */}
                    <Box sx={{ flexBasis: { xs: '100%' } }}>
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
                          sx={{ color: '#4f46e5' }} // Apply custom color
                        />
                      </Box>
                    </Box>
                    {/* Property Management Slider */}
                    <Box sx={{ flexBasis: { xs: '100%' } }}>
                      <Box sx={{ mb: 0 }}>
                        <Typography variant="body2" gutterBottom>Property Management: {propertyManagementPercent}%</Typography>
                        <Slider
                          value={propertyManagementPercent}
                          onChange={(e, value) => setPropertyManagementPercent(value as number)}
                          min={0}
                          max={20}
                          step={1}
                          valueLabelDisplay="auto"
                          valueLabelFormat={(value) => `${value}%`}
                          sx={{ color: '#4f46e5' }} // Apply custom color
                        />
                      </Box>
                    </Box>
                  </Box>
                </Paper>
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
                    {sortedProperties.map((property) => (
                      <PropertyCard
                        key={property.property_id}
                        property={property}
                        calculateCashflow={calculateCashflowWithSettings}
                        formatCurrency={formatCurrency}
                        formatPercent={formatPercent}
                        vacancyPercent={vacancyPercent}
                        capexPercent={capexPercent}
                        downPaymentPercent={downPaymentPercent}
                        propertyManagementPercent={propertyManagementPercent}
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
                        className={`faq-nav-item ${activeFaqSection === 'overview' ? 'active' : ''}`}
                        onClick={() => handleFaqSectionChange('overview')}
                      >
                        Overview
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
                    {activeFaqSection === 'overview' && (
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
                            Enter a location in the search bar at the top of the page. You can use a city name, state, zip code, or a specific property address (e.g., "Austin, TX", "78701", or "123 Main St, Austin, TX"). For specific properties, entering the full address will give you the most accurate results. Then click the "Search Properties" button to see results.
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
          </>
        } />
        
        {/* Property Details Route */}
        <Route 
          path="/property/:propertyId" 
          element={
            <PropertyDetailsPage 
              properties={displayedProperties}
              calculateCashflow={calculateCashflowWithSettings}
              formatCurrency={formatCurrency}
              formatPercent={formatPercent}
              defaultSettings={defaultSettings}
            />
          } 
        />
        
        {/* 404 route */}
        <Route path="*" element={
          <div className="not-found">
            <Typography variant="h4" component="h1">404 - Page Not Found</Typography>
            <Typography variant="body1">The page you're looking for doesn't exist.</Typography>
            <Button 
              variant="contained" 
              onClick={() => navigate('/')} 
              sx={{ mt: 2 }}
              startIcon={<HomeIcon />}
            >
              Go Home
            </Button>
          </div>
        } />
      </Routes>
    </div>
  );
}

// Main App component that wraps the AppContent with Router
function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
