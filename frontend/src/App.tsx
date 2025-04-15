import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { HashRouter as Router, Route, Routes, useNavigate, Link } from 'react-router-dom';
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
import BookmarkIcon from '@mui/icons-material/Bookmark';
import './App.css';
import { searchProperties, getTotalPropertiesCount, Property, registerForPropertyUpdates } from './api/propertyApi';
import PropertyDetailsPage from './pages/PropertyDetailsPage';
import { CashflowSettings } from './types';
import BookmarksPage from './pages/BookmarksPage';
// Import the Drawer component
import Drawer from '@mui/material/Drawer';

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
  // --- Define state variables ---
  const [location, setLocation] = useState('');
  const [minPrice, setMinPrice] = useState<string | number>('');
  const [maxPrice, setMaxPrice] = useState<string | number>('');
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
  const [isFaqOpen, setIsFaqOpen] = useState(false);
  const [activeFaqSection, setActiveFaqSection] = useState<'general' | 'search' | 'filters' | 'cashflow' | 'bookmarks'>('general');
  
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
  
  // Pagination state
  const [totalProperties, setTotalProperties] = useState(0);

  // Add state for price filter
  const [displayMinPrice, setDisplayMinPrice] = useState<string>('');
  const [displayMaxPrice, setDisplayMaxPrice] = useState<string>('');

  // Add state for sorting
  const [sortConfig, setSortConfig] = useState<{ key: SortableKey | null, direction: 'asc' | 'desc' }>({ key: 'price', direction: 'asc' }); // Default sort by price asc

  // State for assumptions accordion
  const [isAssumptionsPanelOpen, setIsAssumptionsPanelOpen] = useState(false); // Add state for panel visibility

  // Ref for tracking search requests
  const currentSearchId = useRef<number>(0);

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
        // Scroll to results area
        setTimeout(() => {
          const resultsElement = document.querySelector('.property-grid') || document.querySelector('.loading-container');
          if (resultsElement) {
            resultsElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 100);
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
      
      // Scroll to results area when initial data loads
      setTimeout(() => {
        const resultsElement = document.querySelector('.property-grid') || document.querySelector('.loading-container');
        if (resultsElement) {
          resultsElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
      
    } catch (err) {
      console.error('Search failed:', err);
      setError('Failed to fetch properties. Please try again.');
        setLoading(false);
      setInitialLoading(false);
      setIsProcessingBackground(false);
      
      // Scroll to error message
      setTimeout(() => {
        const errorElement = document.querySelector('.MuiAlert-root');
        if (errorElement) {
          errorElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
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
    setActiveFaqSection(section as 'general' | 'search' | 'filters' | 'cashflow' | 'bookmarks');
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
  
  // Handler to dismiss marketing section - REMOVED
  // const handleDismissMarketing = () => {
  //   setShowMarketingIntro(false);
  // };
  
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
                      sx={{ mr: 2 }}
                    >
                      Help & FAQ
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
            
            <Container maxWidth="lg" sx={{ py: 3 }}>
              {/* Marketing intro section */}
              {showMarketingIntro && (
                <Paper 
                  elevation={3} 
                  sx={{ 
                    mb: 4, 
                    borderRadius: 3,
                    overflow: 'hidden',
                    position: 'relative',
                    background: '#ffffff',
                    boxShadow: '0 10px 30px rgba(79, 70, 229, 0.15)'
                  }}
                >
                  {/* Colored stripe at the top */}
                  <Box 
                    sx={{ 
                      height: '5px', 
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
                    {/* Left side content */}
                    <Box 
                      sx={{ 
                        p: 4, 
                        flex: '1.5',
                        position: 'relative',
                        zIndex: 1
                      }}
                    >
                      <Typography 
                        variant="h3" 
                        fontWeight="bold" 
                        sx={{ 
                          mb: 2, 
                          color: '#1f2937',
                          fontSize: { xs: '1.75rem', sm: '2.25rem', md: '2.5rem' }
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
                        variant="body1" 
                        sx={{ 
                          mb: 3, 
                          color: '#4b5563',
                          lineHeight: 1.6,
                          maxWidth: '500px'
                        }}
                      >
                        RentalSearch helps you discover and analyze potential real estate investments in seconds. 
                        Get detailed cash flow analysis, long-term equity projections, and returns on investment 
                        for properties in any location.
                      </Typography>
                      
                      <Box 
                        sx={{ 
                          display: 'flex', 
                          flexDirection: { xs: 'column', sm: 'row' },
                          gap: 2,
                          mt: 3
                        }}
                      >
                        <Box 
                          sx={{ 
                            display: 'flex', 
                            alignItems: 'flex-start', 
                            p: 2,
                            borderRadius: 2,
                            background: 'rgba(79, 70, 229, 0.05)',
                            border: '1px solid rgba(79, 70, 229, 0.1)'
                          }}
                        >
                          <Box 
                            sx={{ 
                              width: 40, 
                              height: 40, 
                              borderRadius: 2,
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center', 
                              bgcolor: '#4f46e5', 
                              mr: 2,
                              flexShrink: 0
                            }}
                          >
                            <SearchIcon sx={{ color: 'white' }} />
                          </Box>
                          <Box>
                            <Typography variant="subtitle1" fontWeight="600" color="#1f2937">
                              Find Properties Fast
                            </Typography>
                            <Typography variant="body2" color="#6b7280">
                              Discover properties with high cash flow potential in minutes
                            </Typography>
                          </Box>
                        </Box>
                        
                        <Box 
                          sx={{ 
                            display: 'flex', 
                            alignItems: 'flex-start', 
                            p: 2,
                            borderRadius: 2,
                            background: 'rgba(79, 70, 229, 0.05)',
                            border: '1px solid rgba(79, 70, 229, 0.1)'
                          }}
                        >
                          <Box 
                            sx={{ 
                              width: 40, 
                              height: 40, 
                              borderRadius: 2,
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center', 
                              bgcolor: '#4f46e5', 
                              mr: 2,
                              flexShrink: 0
                            }}
                          >
                            <BarChartIcon sx={{ color: 'white' }} />
                          </Box>
                          <Box>
                            <Typography variant="subtitle1" fontWeight="600" color="#1f2937">
                              Detailed Analytics
                            </Typography>
                            <Typography variant="body2" color="#6b7280">
                              Get comprehensive financial projections for each property
                            </Typography>
                          </Box>
                        </Box>
                      </Box>
                    </Box>
                    
                    {/* Right side image/graphic element */}
                    <Box 
                      sx={{ 
                        flex: '1',
                        position: 'relative',
                        display: { xs: 'none', md: 'block' },
                        alignSelf: 'stretch'
                      }}
                    >
                      <Box
                        sx={{
                          position: 'absolute',
                          top: 0,
                          right: 0,
                          bottom: 0,
                          left: 0,
                          background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.8) 0%, rgba(99, 102, 241, 0.8) 100%)',
                          clipPath: 'polygon(10% 0, 100% 0, 100% 100%, 0% 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden'
                        }}
                      >
                        <Box
                          sx={{
                            position: 'absolute',
                            width: '140%',
                            height: '140%',
                            opacity: 0.15,
                            background: 'repeating-linear-gradient(45deg, #ffffff, #ffffff 10px, transparent 10px, transparent 20px)'
                          }}
                        />
                        
                        <Box sx={{ position: 'relative', zIndex: 1, p: 4, color: 'white', textAlign: 'center' }}>
                          <HomeWorkIcon sx={{ fontSize: '4rem', mb: 2 }} />
                          <Typography variant="h5" fontWeight="bold" gutterBottom>
                            Start Your Search
                          </Typography>
                          <Typography variant="body2" sx={{ maxWidth: '250px', mx: 'auto' }}>
                            Enter a location below to find investment opportunities
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                  </Box>
                </Paper>
              )}
              
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
              
              {/* Assumptions Tab */}
              <div 
                className="assumptions-tab"
                onClick={() => setIsAssumptionsDrawerOpen(!isAssumptionsDrawerOpen)}
                style={{
                  position: 'fixed',
                  right: 0,
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
                  boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
                  transition: 'all 0.3s ease'
                }}
              >
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
              
              {/* Assumptions Drawer */}
              <Drawer
                anchor="right"
                open={isAssumptionsDrawerOpen}
                onClose={() => setIsAssumptionsDrawerOpen(false)}
                sx={{
                  '& .MuiDrawer-paper': {
                    width: '350px',
                    maxWidth: '90vw',
                    boxSizing: 'border-box',
                    padding: 3,
                  },
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
                  calculateCashflow={calculateCashflow}
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
                      <div 
                        className={`faq-nav-item ${activeFaqSection === 'bookmarks' ? 'active' : ''}`}
                        onClick={() => handleFaqSectionChange('bookmarks')}
                      >
                        Bookmarks
                      </div>
                    </div>
                    
                    {/* FAQ Content Container - Wrap all FAQ sections in a single container */}
                    <div className="faq-sections-container">
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
                      
                      {/* Bookmarks FAQ Section */}
                      {activeFaqSection === 'bookmarks' && (
                        <div>
                          <div className="faq-section">
                            <div className="faq-question">How do I save properties I'm interested in?</div>
                            <div className="faq-answer">
                              When viewing a property's detailed page, click the "Bookmark" button in the header. This will save the property, including all your custom settings and notes, for later reference. You'll see the button change to "Bookmarked" to confirm the property has been saved.
                            </div>
                          </div>
                          
                          <div className="faq-section">
                            <div className="faq-question">Where can I find my bookmarked properties?</div>
                            <div className="faq-answer">
                              Click the "Bookmarks" button in the top navigation bar from any page of the application. This will take you to your bookmarks page where you can see all saved properties displayed in a card layout similar to the search results.
                            </div>
                          </div>
                          
                          <div className="faq-section">
                            <div className="faq-question">What information is saved in a bookmark?</div>
                            <div className="faq-answer">
                              Bookmarks save the complete property data along with any customizations you've made, including:
                              <ul>
                                <li>All property details (price, address, bedrooms, etc.)</li>
                                <li>Your custom rent estimate (if you modified it)</li>
                                <li>Your investment assumption settings (interest rate, down payment, etc.)</li>
                                <li>Custom projection settings for long-term analysis</li>
                              </ul>
                              This ensures that when you revisit a bookmarked property, you'll see it exactly as you left it.
                            </div>
                          </div>
                          
                          <div className="faq-section">
                            <div className="faq-question">How do I remove a property from my bookmarks?</div>
                            <div className="faq-answer">
                              There are two ways to remove a bookmark:
                              <ol>
                                <li>From the bookmarks page, click the "Remove" button on the property card you wish to delete.</li>
                                <li>From the property details page, click the "Bookmarked" button to toggle it off and remove the bookmark.</li>
                              </ol>
                            </div>
                          </div>
                          
                          <div className="faq-section">
                            <div className="faq-question">Are my bookmarks saved if I close the browser?</div>
                            <div className="faq-answer">
                              Yes, bookmarks are stored in your browser's local storage, which means they'll persist even when you close the browser or shut down your computer. However, they are specific to the device and browser you're using. If you switch devices or browsers, you won't see the same bookmarks.
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
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
              calculateCashflow={(property, settings) => {
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
                
                const propertyForCashflow = {
                  ...property,
                  rent_source: property.rent_source ?? "calculated", // Default to 'calculated' if undefined
                };
                return calculateCashflowWithSettings(propertyForCashflow, settings);
              }}
              formatCurrency={formatCurrency}
              formatPercent={formatPercent}
              defaultSettings={defaultSettings}
            />
          } 
        />
        
        {/* Bookmarks Route */}
        <Route 
          path="/bookmarks" 
          element={<BookmarksPage />} 
        />
      </Routes>
    </div>
  );
}

export default App;
