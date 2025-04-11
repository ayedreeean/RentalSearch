import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { 
  Typography, 
  Box,
  Paper, 
  Button, 
  Slider,
  TextField,
  Divider,
  IconButton,
  Alert,
  Container,
  AppBar,
  Toolbar,
  Fab,
  CssBaseline
} from '@mui/material';
import HomeWorkIcon from '@mui/icons-material/HomeWork';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import HomeIcon from '@mui/icons-material/Home';
import BarChartIcon from '@mui/icons-material/BarChart';
import EditIcon from '@mui/icons-material/Edit';
import ShareIcon from '@mui/icons-material/Share';
import EmailIcon from '@mui/icons-material/Email';
import TuneIcon from '@mui/icons-material/Tune';
import { Property, Cashflow, CashflowSettings } from '../types';

interface PropertyDetailsPageProps {
  properties: Property[];
  calculateCashflow: (property: Property, settings: CashflowSettings) => Cashflow;
  formatCurrency: (amount: number) => string;
  formatPercent: (percent: number) => string;
  defaultSettings: CashflowSettings;
}

const PropertyDetailsPage: React.FC<PropertyDetailsPageProps> = ({
  properties,
  calculateCashflow,
  formatCurrency,
  formatPercent,
  defaultSettings
}) => {
  // Get property ID from URL parameters
  const { propertyId } = useParams<{ propertyId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Local state for property data
  const [property, setProperty] = useState<Property | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Local state for settings (copied from props, but editable)
  const [settings, setSettings] = useState<CashflowSettings>(defaultSettings);
  
  // Custom rent estimate state
  const [customRentEstimate, setCustomRentEstimate] = useState<number | null>(null);
  const [displayRent, setDisplayRent] = useState<string>('');
  const [isRentEditing, setIsRentEditing] = useState(false);
  
  // Share state
  const [copySuccess, setCopySuccess] = useState('');
  
  // Add state for floating panel
  const [isAssumptionsPanelOpen, setIsAssumptionsPanelOpen] = useState(false);
  
  // Load property data
  useEffect(() => {
    if (!propertyId) {
      setError('Invalid property ID');
      setLoading(false);
      return;
    }
    
    const foundProperty = properties.find(p => p.property_id === propertyId);
    if (!foundProperty) {
      setError('Property not found');
      setLoading(false);
      return;
    }
    
    setProperty(foundProperty);
    setLoading(false);
    
    // Initialize custom rent to property's rent estimate
    if (foundProperty.rent_estimate) {
      setCustomRentEstimate(foundProperty.rent_estimate);
      setDisplayRent(formatCurrency(foundProperty.rent_estimate));
    }
  }, [propertyId, properties, formatCurrency]);
  
  // Update page title when property loads
  useEffect(() => {
    if (property) {
      document.title = `${property.address} | RentalSearch`;
    } else {
      document.title = 'Property Details | RentalSearch';
    }
    
    return () => {
      document.title = 'RentalSearch';
    };
  }, [property]);

  // Handle URL query parameters for settings
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    
    // Check if there are settings in the URL
    const ir = searchParams.get('ir'); // interest rate
    const lt = searchParams.get('lt'); // loan term
    const dp = searchParams.get('dp'); // down payment
    const ti = searchParams.get('ti'); // tax insurance
    const vc = searchParams.get('vc'); // vacancy
    const cx = searchParams.get('cx'); // capex
    const pm = searchParams.get('pm'); // property management
    const re = searchParams.get('re'); // custom rent estimate
    
    // Update settings if values exist in URL
    const newSettings = {...defaultSettings};
    let updated = false;
    
    if (ir) { 
      const val = parseFloat(ir);
      if (!isNaN(val) && val >= 0.1 && val <= 15) {
        newSettings.interestRate = val;
        updated = true;
      }
    }
    
    if (lt) {
      const val = parseInt(lt, 10);
      if (!isNaN(val) && val >= 5 && val <= 40) {
        newSettings.loanTerm = val;
        updated = true;
      }
    }
    
    if (dp) {
      const val = parseInt(dp, 10);
      if (!isNaN(val) && val >= 0 && val <= 100) {
        newSettings.downPaymentPercent = val;
        updated = true;
      }
    }
    
    if (ti) {
      const val = parseFloat(ti);
      if (!isNaN(val) && val >= 0 && val <= 5) {
        newSettings.taxInsurancePercent = val;
        updated = true;
      }
    }
    
    if (vc) {
      const val = parseInt(vc, 10);
      if (!isNaN(val) && val >= 0 && val <= 10) {
        newSettings.vacancyPercent = val;
        updated = true;
      }
    }
    
    if (cx) {
      const val = parseInt(cx, 10);
      if (!isNaN(val) && val >= 0 && val <= 10) {
        newSettings.capexPercent = val;
        updated = true;
      }
    }
    
    if (pm) {
      const val = parseInt(pm, 10);
      if (!isNaN(val) && val >= 0 && val <= 20) {
        newSettings.propertyManagementPercent = val;
        updated = true;
      }
    }
    
    if (updated) {
      setSettings(newSettings);
    }
    
    // Check for custom rent estimate
    if (re && property) {
      const val = parseFloat(re);
      if (!isNaN(val) && val > 0) {
        setCustomRentEstimate(val);
        setDisplayRent(formatCurrency(val));
      }
    }
  }, [location.search, defaultSettings, property, formatCurrency]);

  // Handlers for rent input
  const handleRentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDisplayRent(e.target.value);
  };

  const handleRentBlur = () => {
    setIsRentEditing(false);
    // Parse the rent value
    const newRent = parseFloat(displayRent.replace(/[^\d.]/g, ''));
    
    if (!isNaN(newRent) && newRent >= 0) {
      setCustomRentEstimate(newRent);
      
      // Update URL to include the custom rent
      updateUrlWithSettings({ re: newRent });
    } else {
      // If invalid, revert to the current value
      const currentRent = customRentEstimate !== null ? customRentEstimate : property?.rent_estimate || 0;
      setDisplayRent(formatCurrency(currentRent));
    }
  };

  const handleRentFocus = () => {
    setIsRentEditing(true);
    // Show raw number for editing
    const currentRent = customRentEstimate !== null ? customRentEstimate : property?.rent_estimate || 0;
    setDisplayRent(String(currentRent)); 
  };
  
  // Navigate back to search results
  const handleBackToSearch = () => {
    navigate('/');
  };
  
  // Create a modified property object for cashflow calculations
  const propertyForCashflow = property ? {
    ...property,
    // Use the custom rent estimate for cashflow calculations if it exists
    rent_estimate: customRentEstimate !== null ? customRentEstimate : property.rent_estimate
  } : undefined;
  
  // Calculate cashflow using current settings
  const cashflow = propertyForCashflow ? calculateCashflow(propertyForCashflow, settings) : null;
  
  // Create RentCast URL
  const rentCastUrl = property ? `https://app.rentcast.io/app?address=${encodeURIComponent(property.address)}` : '#';
  
  // Update URL with settings for shareable link
  const updateUrlWithSettings = (changedParams: Record<string, any>) => {
    const searchParams = new URLSearchParams(location.search);
    
    // Update or add changed parameters
    Object.entries(changedParams).forEach(([key, value]) => {
      searchParams.set(key, String(value));
    });
    
    // Generate the URL with new search parameters
    const newUrl = `${location.pathname}?${searchParams.toString()}`;
    
    // Update URL without reloading the page
    window.history.replaceState({}, '', newUrl);
  };
  
  // Handle settings changes
  const handleSettingChange = (setting: keyof CashflowSettings) => (event: Event, newValue: number | number[]) => {
    const value = typeof newValue === 'number' ? newValue : newValue[0];
    
    setSettings(prev => ({
      ...prev,
      [setting]: value
    }));
    
    // Create parameter key from setting name
    const paramMap: Record<keyof CashflowSettings, string> = {
      interestRate: 'ir',
      loanTerm: 'lt',
      downPaymentPercent: 'dp',
      taxInsurancePercent: 'ti',
      vacancyPercent: 'vc',
      capexPercent: 'cx',
      propertyManagementPercent: 'pm'
    };
    
    // Update URL with new setting
    updateUrlWithSettings({ [paramMap[setting]]: value });
  };
  
  // Copy to clipboard handler
  const generatePropertySummary = () => {
    if (!property || !cashflow) return '';
    
    const rentValue = customRentEstimate !== null ? customRentEstimate : property.rent_estimate;
    const downPaymentAmount = property.price * (settings.downPaymentPercent / 100);
    
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
• Down payment (${settings.downPaymentPercent}%): ${formatCurrency(property.price * (settings.downPaymentPercent / 100))}
• Mortgage payment: ${formatCurrency(cashflow.monthlyMortgage)}
• Property Tax & Insurance: ${formatCurrency(cashflow.monthlyTaxInsurance)}
• Vacancy (${settings.vacancyPercent}%): ${formatCurrency(cashflow.monthlyVacancy)}
• CapEx (${settings.capexPercent}%): ${formatCurrency(cashflow.monthlyCapex)}
• Property Management (${settings.propertyManagementPercent}%): ${formatCurrency(cashflow.monthlyPropertyManagement)}
• Total Monthly Expenses: ${formatCurrency(cashflow.totalMonthlyExpenses)}
• Monthly Cashflow: ${formatCurrency(cashflow.monthlyCashflow)}
• Annual Cashflow: ${formatCurrency(cashflow.annualCashflow)}
• Cash-on-Cash Return: ${formatPercent(cashflow.cashOnCashReturn)}

🔗 ZILLOW LISTING: ${property.url}
🔗 RENTCAST ANALYSIS: ${rentCastUrl}

See full analysis: ${window.location.href}

Generated with RentalSearch - https://ayedreeean.github.io/RentalSearch/
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

  // Email share handler
  const handleEmailShare = () => {
    const summary = encodeURIComponent(generatePropertySummary());
    const subject = encodeURIComponent(`Property Investment Analysis: ${property?.address}`);
    window.open(`mailto:?subject=${subject}&body=${summary}`);
  };
  
  // Display loading state
  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h5">Loading property details...</Typography>
        </Box>
      </Container>
    );
  }
  
  // Display error state
  if (error || !property || !cashflow) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h5" color="error" gutterBottom>
            {error || 'Property data not available'}
          </Typography>
          <Button 
            variant="contained" 
            startIcon={<ArrowBackIcon />}
            onClick={handleBackToSearch}
            sx={{ mt: 2 }}
          >
            Back to Search
          </Button>
        </Box>
      </Container>
    );
  }
  
  // Calculate values for display
  const downPaymentAmount = property.price * (settings.downPaymentPercent / 100);
  
  return (
    <>
      <CssBaseline />
      <AppBar position="sticky" color="default" elevation={0} sx={{ borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
        <Toolbar>
          <IconButton 
            edge="start" 
            color="inherit" 
            aria-label="back" 
            onClick={handleBackToSearch}
            sx={{ mr: 2 }}
          >
            <ArrowBackIcon />
          </IconButton>
          <HomeWorkIcon sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="h6" color="inherit" noWrap sx={{ flexGrow: 1 }}>
            RentalSearch
          </Typography>
          <Button 
            variant="outlined" 
            startIcon={<ShareIcon />}
            onClick={handleCopyToClipboard}
            sx={{ mr: 1 }}
          >
            Copy Analysis
          </Button>
          <Button 
            variant="outlined"
            startIcon={<EmailIcon />}
            onClick={handleEmailShare}
          >
            Email
          </Button>
        </Toolbar>
      </AppBar>
      
      <Container maxWidth="lg" sx={{ py: 4 }}>
        {/* Success message for clipboard copy */}
        {copySuccess && (
          <Alert severity="success" sx={{ mb: 3 }}>
            {copySuccess}
          </Alert>
        )}
        
        {/* Property Header */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            {property.address}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', mb: 2 }}>
            <Typography variant="h5" component="div" fontWeight="bold">
              {formatCurrency(property.price)}
            </Typography>
            <span className={`ratio-chip ${property.ratio >= 0.007 ? 'ratio-good' : property.ratio >= 0.004 ? 'ratio-medium' : 'ratio-poor'}`}>
              Ratio: {formatPercent(property.ratio * 100)}
            </span>
            {property.days_on_market !== null && (
              <span className="days-on-market ratio-chip">
                {property.days_on_market} days on market
              </span>
            )}
          </Box>
        </Box>
        
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 4 }}>
          {/* Left column: Property image and details */}
          <Box sx={{ flex: '1', maxWidth: { xs: '100%', md: '40%' } }}>
            <Box>
              <img 
                src={property.thumbnail} 
                alt={property.address}
                style={{ 
                  width: '100%', 
                  borderRadius: '0.5rem',
                  maxHeight: '350px',
                  objectFit: 'cover'
                }}
              />
            </Box>
            
            <Paper sx={{ mt: 3, p: 3, borderRadius: 2 }}>
              <Typography variant="h6" gutterBottom>Property Details</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">Beds</Typography>
                  <Typography variant="h6">{property.bedrooms}</Typography>
                </Box>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">Baths</Typography>
                  <Typography variant="h6">{property.bathrooms}</Typography>
                </Box>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">Sq Ft</Typography>
                  <Typography variant="h6">{property.sqft.toLocaleString()}</Typography>
                </Box>
              </Box>
              
              <Divider sx={{ my: 2 }} />
              
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
            </Paper>
          </Box>
          
          {/* Right column: Cashflow Analysis & Settings */}
          <Box sx={{ flex: '1', maxWidth: { xs: '100%', md: '60%' } }}>
            {/* Cashflow Header */}
            <Paper sx={{ p: 3, borderRadius: 2, mb: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h5">Cashflow Analysis</Typography>
                <Typography 
                  variant="h5" 
                  fontWeight="bold" 
                  color={cashflow.monthlyCashflow >= 0 ? 'success.main' : 'error.main'}
                >
                  {formatCurrency(cashflow.monthlyCashflow)}/mo
                </Typography>
              </Box>
              
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <Typography variant="body1" sx={{ mr: 2 }}>Rent Estimate:</Typography>
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
              
              <Divider sx={{ my: 2 }} />
              
              <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ bgcolor: '#f9f9f9', p: 2, borderRadius: 2 }}>
                    <Typography variant="subtitle2" gutterBottom fontWeight="bold">Monthly Income</Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="body2">Rental Income:</Typography>
                      <Typography variant="body2" fontWeight="medium">
                        {formatCurrency(customRentEstimate !== null ? customRentEstimate : property.rent_estimate)}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
                
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ bgcolor: '#f0f7ff', p: 2, borderRadius: 2 }}>
                    <Typography variant="subtitle2" gutterBottom fontWeight="bold">Annual Returns</Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="body2">Annual Cashflow:</Typography>
                      <Typography variant="body2" fontWeight="bold" color={cashflow.annualCashflow >= 0 ? 'success.main' : 'error.main'}>
                        {formatCurrency(cashflow.annualCashflow)}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="body2">Cash-on-Cash Return:</Typography>
                      <Typography variant="body2" fontWeight="bold" color={cashflow.cashOnCashReturn >= 0 ? 'success.main' : 'error.main'}>
                        {formatPercent(cashflow.cashOnCashReturn)}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              </Box>
              
              <Box sx={{ bgcolor: '#f9f9f9', p: 2, borderRadius: 2, mt: 2 }}>
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
              
              <Box sx={{ bgcolor: '#f0f7ff', p: 2, borderRadius: 2, mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom fontWeight="bold">Investment Details</Typography>
                
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
              </Box>
            </Paper>
            
            {/* Floating Assumptions Button */}
            <Fab
              variant="extended"
              aria-label="toggle assumptions panel"
              onClick={() => setIsAssumptionsPanelOpen(!isAssumptionsPanelOpen)}
              sx={{
                position: 'fixed',
                bottom: 16,
                right: 16,
                zIndex: 1250,
                bgcolor: '#4f46e5',
                color: 'white',
                '&:hover': {
                  bgcolor: '#4338ca'
                } 
              }}
            >
              <TuneIcon sx={{ mr: 1 }} />
              Assumptions
            </Fab>

            {/* Floating Assumptions Panel */}
            {isAssumptionsPanelOpen && (
              <Paper 
                elevation={4} 
                sx={{
                  position: 'fixed',
                  bottom: 72,
                  right: 16,
                  zIndex: 1200, 
                  maxWidth: '400px', 
                  maxHeight: 'calc(100vh - 90px)', 
                  overflowY: 'auto', 
                  borderRadius: 2, 
                  p: 3
                }}
              >
                <Typography variant="h6" fontWeight="medium" gutterBottom> 
                  Customize Assumptions
                </Typography>
                {/* Sliders use settings state and handleSettingChange */}
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" gutterBottom>Interest Rate: {settings.interestRate}%</Typography>
                  <Slider value={settings.interestRate} onChange={handleSettingChange('interestRate')} aria-labelledby="interest-rate-slider" valueLabelDisplay="auto" step={0.1} min={0.1} max={15} sx={{ color: '#4f46e5' }} />
                </Box>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" gutterBottom>Loan Term: {settings.loanTerm} years</Typography>
                  <Slider value={settings.loanTerm} onChange={handleSettingChange('loanTerm')} aria-labelledby="loan-term-slider" valueLabelDisplay="auto" step={1} min={5} max={40} sx={{ color: '#4f46e5' }} />
                </Box>
                <Box sx={{ mb: 2 }}>
                   <Typography variant="body2" gutterBottom>Down Payment: {settings.downPaymentPercent}%</Typography>
                   <Slider value={settings.downPaymentPercent} onChange={handleSettingChange('downPaymentPercent')} aria-labelledby="down-payment-slider" valueLabelDisplay="auto" step={1} min={0} max={100} sx={{ color: '#4f46e5' }} />
                </Box>
                <Box sx={{ mb: 2 }}>
                   <Typography variant="body2" gutterBottom>Property Tax & Insurance: {settings.taxInsurancePercent}%</Typography>
                   <Slider value={settings.taxInsurancePercent} onChange={handleSettingChange('taxInsurancePercent')} min={0} max={5} step={0.1} valueLabelDisplay="auto" valueLabelFormat={(value) => `${value}%`} sx={{ color: '#4f46e5' }} />
                </Box>
                <Box sx={{ mb: 2 }}>
                   <Typography variant="body2" gutterBottom>Vacancy: {settings.vacancyPercent}%</Typography>
                   <Slider value={settings.vacancyPercent} onChange={handleSettingChange('vacancyPercent')} min={0} max={10} step={1} valueLabelDisplay="auto" valueLabelFormat={(value) => `${value}%`} sx={{ color: '#4f46e5' }} />
                </Box>
                <Box sx={{ mb: 2 }}>
                   <Typography variant="body2" gutterBottom>CapEx: {settings.capexPercent}%</Typography>
                   <Slider value={settings.capexPercent} onChange={handleSettingChange('capexPercent')} min={0} max={10} step={1} valueLabelDisplay="auto" valueLabelFormat={(value) => `${value}%`} sx={{ color: '#4f46e5' }} />
                </Box>
                <Box sx={{ mb: 0 }}>
                   <Typography variant="body2" gutterBottom>Property Management: {settings.propertyManagementPercent}%</Typography>
                   <Slider value={settings.propertyManagementPercent} onChange={handleSettingChange('propertyManagementPercent')} min={0} max={20} step={1} valueLabelDisplay="auto" valueLabelFormat={(value) => `${value}%`} sx={{ color: '#4f46e5' }} />
                </Box>
              </Paper>
            )}
          </Box>
        </Box>
      </Container>
    </>
  );
};

export default PropertyDetailsPage; 