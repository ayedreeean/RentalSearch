import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Typography, Box, Skeleton,
  Paper, TextField, Card, CardContent, Accordion, AccordionSummary, AccordionDetails, Modal, Button, IconButton, Divider, Alert,
  Tooltip, Chip
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Edit as EditIcon,
  Home as HomeIcon,
  BarChart as BarChartIcon,
  HomeWork as HomeWorkIcon,
  ContentCopy as ContentCopyIcon,
  Email as EmailIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { Property, Cashflow } from '../types'; // Assuming types.ts is in ../

// Lazy Image component (Copied from App.tsx as it's only used here for now)
interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
}

const LazyImage: React.FC<LazyImageProps> = ({ src, alt, className }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = React.useRef<HTMLImageElement>(null);

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

// Property Card Component Props
interface PropertyCardProps {
  property: Property;
  overridePrice?: number; // Optional override price
  calculateCashflow: (property: Property) => Cashflow;
  formatCurrency: (amount: number) => string;
  formatPercent: (percent: number) => string;
  vacancyPercent: number;
  capexPercent: number;
  downPaymentPercent: number;
  propertyManagementPercent: number;
  handleRentEstimateChange: (propertyId: string, newRentString: string) => void;
  crunchScore: number;
}

const PropertyCard: React.FC<PropertyCardProps> = ({
  property,
  overridePrice, // Destructure overridePrice
  calculateCashflow, 
  formatCurrency,
  formatPercent,
  vacancyPercent,
  capexPercent,
  downPaymentPercent,
  propertyManagementPercent,
  handleRentEstimateChange,
  crunchScore // Destructure crunchScore
}) => {
  // --- State for editable rent estimate --- 
  const [displayRent, setDisplayRent] = useState<string>('');
  const [isRentEditing, setIsRentEditing] = useState(false);
  const [customRentEstimate, setCustomRentEstimate] = useState<number | null>(null);
  
  // Share modal state
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [copySuccess, setCopySuccess] = useState('');
  
  // Navigation
  const navigate = useNavigate();

  // Initialize display rent when property data or override changes
  useEffect(() => {
    const rentToDisplay = customRentEstimate !== null ? customRentEstimate : property.rent_estimate;
    setDisplayRent(formatCurrency(rentToDisplay));
  }, [property.rent_estimate, customRentEstimate, formatCurrency]);

  // Handlers for rent input
  const handleRentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDisplayRent(e.target.value);
  };

  const handleRentBlur = () => {
    setIsRentEditing(false);
    const newRent = parseFloat(displayRent.replace(/[^\d.]/g, ''));
    if (!isNaN(newRent) && newRent >= 0) {
      setCustomRentEstimate(newRent);
      // Call parent handler to update state in App.tsx IF NEEDED
      // handleRentEstimateChange(property.property_id, String(newRent));
      // NOTE: Currently, handleRentEstimateChange is NOT passed down or used.
      // If you want the App state to reflect card-level rent edits,
      // you need to pass down and call this handler.
      // For now, rent edits *only* affect the cashflow calculation *within this card*.
    } else {
      const currentRent = customRentEstimate !== null ? customRentEstimate : property.rent_estimate;
      setDisplayRent(formatCurrency(currentRent));
    }
  };

  const handleRentFocus = () => {
    setIsRentEditing(true);
    const currentRent = customRentEstimate !== null ? customRentEstimate : property.rent_estimate;
    setDisplayRent(String(currentRent)); 
  };

  // Use overridePrice if available, otherwise property.price
  const currentPrice = overridePrice !== undefined ? overridePrice : property.price;
  
  // Calculate cashflow and other derived values based on currentPrice
  const propertyForCashflow = {
    ...property,
    price: currentPrice,
    rent_estimate: customRentEstimate !== null ? customRentEstimate : property.rent_estimate,
    rent_source: property.rent_source ?? "calculated",
  };
  const cashflow = calculateCashflow(propertyForCashflow);
  const downPaymentAmount = currentPrice * (downPaymentPercent / 100);
  const rentCastAddress = encodeURIComponent(property.address);
  const rentCastUrl = `https://app.rentcast.io/app?address=${rentCastAddress}`;
  
  const handleCloseShareModal = () => {
    setIsShareModalOpen(false);
    setCopySuccess('');
  };

  const handleOpenDeepDive = (e: React.MouseEvent) => {
    e.preventDefault();
    navigate(`/property/${property.property_id}`);
  };
  
  // Generate summary using the potentially modified price and rent
  const generatePropertySummary = () => {
    const priceValue = currentPrice; // Already determined above
    const rentValue = customRentEstimate !== null ? customRentEstimate : property.rent_estimate;
    const ratio = priceValue > 0 ? rentValue / priceValue : 0;

    return `🏠 Property Investment Analysis 🏠

ADDRESS: ${property.address}
PRICE: ${formatCurrency(priceValue)} ${overridePrice !== undefined ? '(Overridden)' : ''}
RENT ESTIMATE: ${formatCurrency(rentValue)} ${customRentEstimate !== null ? '(Edited)' : ''}
CRUNCH SCORE: ${crunchScore} (Based on displayed values)
RENT-TO-PRICE RATIO: ${formatPercent(ratio * 100)}

📊 PROPERTY DETAILS:
• ${property.bedrooms} beds, ${property.bathrooms} baths
• ${property.sqft.toLocaleString()} sq. ft.
${property.days_on_market !== null ? `• Days on market: ${property.days_on_market}` : ''}

💰 CASHFLOW ANALYSIS (Monthly - based on Price: ${formatCurrency(priceValue)}, Rent: ${formatCurrency(rentValue)}):
• Down payment (${downPaymentPercent}%): ${formatCurrency(downPaymentAmount)}
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

Generated with CashflowCrunch - https://ayedreeean.github.io/CashflowCrunch/
`;
  };

  const handleCopyToClipboard = async () => {
    const summary = generatePropertySummary();
    try {
      await navigator.clipboard.writeText(summary);
      setCopySuccess('Copied to clipboard!');
      setTimeout(() => setCopySuccess(''), 3000); 
    } catch (err) {
      setCopySuccess('Failed to copy! Try selecting and copying the text manually.');
    }
  };

  const handleEmailShare = () => {
    const summary = encodeURIComponent(generatePropertySummary());
    const subject = encodeURIComponent(`Property Investment Analysis: ${property.address}`);
    window.open(`mailto:?subject=${subject}&body=${summary}`);
    handleCloseShareModal();
  };

  // --- Define Crunch Score CSS class based on score --- 
  const getCrunchScoreClass = (score: number): string => {
    if (score >= 65) return 'good';
    if (score >= 45) return 'medium';
    return 'poor';
  };
  const crunchScoreClass = getCrunchScoreClass(crunchScore);
  
  // --- Tooltip Text --- 
  const crunchScoreTooltip = "Overall investment potential (0-100) based on cash flow, rent/price ratio, and your assumptions (higher is better).";
  
  return (
    <Card className="property-card">
      <button 
        onClick={handleOpenDeepDive} 
        className="property-image-container"
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', width: '100%', textAlign: 'left' }}
      >
        <LazyImage
          src={property.thumbnail}
          alt={property.address}
        />
      </button>
      
      <CardContent className="property-details" onClick={(e) => e.stopPropagation()}>
        <div className="property-title" onClick={(e) => e.stopPropagation()}>
          <Typography variant="subtitle1" sx={{ fontWeight: 'medium', lineHeight: 1.3, mb: 0.5 }}>
            {property.address}
          </Typography>
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
              {formatCurrency(currentPrice)}
            </Typography>
            
            <Tooltip title={crunchScoreTooltip} arrow>
              <Box>
                <Chip
                  label={`CrunchScore: ${crunchScore}`}
                  size="small"
                  sx={{
                    fontWeight: 'bold',
                    bgcolor: crunchScoreClass === 'good' ? '#4caf50' : (crunchScoreClass === 'medium' ? '#ff9800' : '#f44336'),
                    color: 'white',
                    '& .MuiChip-label': {
                      px: 1,
                    }
                  }}
                />
              </Box>
            </Tooltip>
        </Box>
        </div>
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <div>
            <Typography variant="body2" fontWeight="medium">
              Rent Est: {formatCurrency(property.rent_estimate)}
              {property.rent_source === 'zillow' && (
                <span className="rent-source">via Zillow</span>
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
        <Accordion onClick={(e) => e.stopPropagation()}>
          <AccordionSummary 
            expandIcon={<ExpandMoreIcon />}
            aria-controls="cashflow-content"
            id="cashflow-header"
            onClick={(e) => e.stopPropagation()}
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
          <AccordionDetails onClick={(e) => e.stopPropagation()}>
            <div className="cashflow-analysis">
              <div className="cashflow-row" style={{ alignItems: 'center' }}>
                <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center' }}>
                  Rent Estimate:
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', marginLeft: 'auto' }}>
                  <TextField
                     variant="standard"
                     size="small"
                     value={isRentEditing ? displayRent : formatCurrency(customRentEstimate !== null ? customRentEstimate : property.rent_estimate)}
                     onChange={handleRentChange}
                     onFocus={handleRentFocus}
                     onBlur={handleRentBlur}
                     InputProps={{
                       disableUnderline: !isRentEditing,
                       sx: { fontSize: '0.875rem' }
                     }}
                     sx={{ 
                       maxWidth: '100px',
                       '& .MuiInputBase-input': { textAlign: 'right' },
                       cursor: 'pointer',
                       ...(isRentEditing 
                         ? { '& .MuiInputBase-root': { borderBottom: '1px solid rgba(0, 0, 0, 0.42)' } }
                         : { })
                     }}
                     onKeyDown={(e) => {
                         if (e.key === 'Enter') {
                             (e.target as HTMLInputElement).blur();
                         }
                     }}
                   />
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
        
        <div className="quick-links">
          <div className="quick-links-title">Quick Links</div>
          <div className="quick-links-buttons">
            <a href={property.url} target="_blank" rel="noopener noreferrer" className="quick-link">
              <HomeIcon sx={{ fontSize: 16, mr: 0.5, color: '#0D6EFD' }} /> Zillow
            </a>
            <a href={rentCastUrl} target="_blank" rel="noopener noreferrer" className="quick-link">
              <BarChartIcon sx={{ fontSize: 16, mr: 0.5, color: '#6366F1' }} /> RentCast
            </a>
            <button 
              onClick={handleOpenDeepDive} 
              className="quick-link"
              style={{ 
                border: 'none', 
                padding: '4px 8px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                fontFamily: 'inherit'
              }}
            >
              <HomeWorkIcon sx={{ fontSize: 16, mr: 0.5, color: '#4F46E5' }} /> Deep Dive
            </button>
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
    </Card>
  );
};

export default PropertyCard;
