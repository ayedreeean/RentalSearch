import React, { useState, useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { 
  Container, 
  Box, 
  Typography, 
  AppBar, 
  Toolbar, 
  IconButton, 
  Button, 
  CssBaseline,
  Card,
  CardContent,
  CardMedia,
  CardActions,
  Chip,
  Paper,
  Divider,
  Alert,
  CircularProgress
} from '@mui/material';
import { 
  ArrowBack as ArrowBackIcon, 
  HomeWork as HomeWorkIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { Property, Cashflow } from '../types';

// Define the CustomProperty interface locally for bookmarks
interface CustomProperty extends Property {
  notes?: string;
  customPrice?: number;
  customRent?: number;
}

interface BookmarkEntry {
  url: string;
  property: CustomProperty; // Use CustomProperty here
  date: string;
}

const BookmarksPage: React.FC = () => {
  const navigate = useNavigate();
  const [bookmarks, setBookmarks] = useState<Record<string, BookmarkEntry>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Format currency (Keep local function)
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
    }).format(amount);
  };
  
  // Format percent (Keep local function)
  const formatPercent = (percent: number): string => {
    return `${percent.toFixed(1)}%`;
  };
  
  // Load bookmarks from localStorage
  useEffect(() => {
    try {
      const bookmarksStr = localStorage.getItem('rentToolFinder_bookmarks');
      const loadedBookmarks = bookmarksStr ? JSON.parse(bookmarksStr) : {};
      setBookmarks(loadedBookmarks);
    } catch (e) {
      console.error('Error loading bookmarks:', e);
      setError('Failed to load bookmarks. Please try refreshing the page.');
    } finally {
      setLoading(false);
    }
  }, []);
  
  // Handle remove bookmark
  const handleRemoveBookmark = (propertyId: string) => {
    const updatedBookmarks = { ...bookmarks };
    delete updatedBookmarks[propertyId];
    
    setBookmarks(updatedBookmarks);
    localStorage.setItem('rentToolFinder_bookmarks', JSON.stringify(updatedBookmarks));
  };
  
  // Handle back to home
  const handleBackToHome = () => {
    navigate('/');
  };
  
  // Handle view property details
  const handleViewPropertyDetails = (url: string) => {
    // The URL is the full shareable URL with all settings
    window.location.href = url;
  };
  
  // Function to extract parameters from URL
  const extractParamsFromUrl = (url: string): {
    customRent?: number;
    interestRate?: number;
    loanTerm?: number;
    downPaymentPercent?: number;
    taxInsurancePercent?: number;
    vacancyPercent?: number;
    capexPercent?: number;
    propertyManagementPercent?: number;
    customPrice?: number;
  } => {
    try {
      const urlObj = new URL(url);
      
      // Handle both formats:
      // 1. Regular URL parameters in the search part
      // 2. Parameters after hash fragment (common with HashRouter in React)
      let params: URLSearchParams;
      
      if (urlObj.hash && urlObj.hash.includes('?')) {
        // Format: /CashflowCrunch/#/property/123?re=2000&ir=7.5
        const hashParts = urlObj.hash.split('?');
        if (hashParts.length > 1) {
          params = new URLSearchParams(hashParts[1]);
        } else {
          params = new URLSearchParams(urlObj.search);
        }
      } else {
        // Regular format: /property/123?re=2000&ir=7.5
        params = new URLSearchParams(urlObj.search);
      }
      
      return {
        customRent: params.has('re') ? parseFloat(params.get('re')!) : undefined,
        interestRate: params.has('ir') ? parseFloat(params.get('ir')!) : undefined,
        loanTerm: params.has('lt') ? parseInt(params.get('lt')!, 10) : undefined,
        downPaymentPercent: params.has('dp') ? parseFloat(params.get('dp')!) : undefined,
        taxInsurancePercent: params.has('ti') ? parseFloat(params.get('ti')!) : undefined,
        vacancyPercent: params.has('vc') ? parseInt(params.get('vc')!, 10) : undefined,
        capexPercent: params.has('cx') ? parseInt(params.get('cx')!, 10) : undefined,
        propertyManagementPercent: params.has('pm') ? parseInt(params.get('pm')!, 10) : undefined,
        customPrice: params.has('pr') ? parseFloat(params.get('pr')!) : undefined
      };
    } catch (error) {
      console.error('Error parsing URL parameters:', error);
      return {};
    }
  };
  
  // Calculate simplified cashflow for card display
  const calculateSimpleCashflow = (property: CustomProperty, url: string): { 
    monthlyCashflow: number, 
    cashOnCashReturn: number, 
    effectiveRent: number,
    effectivePrice: number // Add effective price
  } => {
    // Extract parameters from URL
    const params = extractParamsFromUrl(url);
    
    // Use URL parameters if available, otherwise use default values or property values
    const interestRate = params.interestRate ?? 7.5; // 7.5%
    const loanTerm = params.loanTerm ?? 30; // 30 years
    const downPaymentPercent = params.downPaymentPercent ?? 20; // 20%
    const taxInsurancePercent = params.taxInsurancePercent ?? 3; // 3%
    const vacancyPercent = params.vacancyPercent ?? 8; // 8%
    const capexPercent = params.capexPercent ?? 5; // 5%
    const propertyManagementPercent = params.propertyManagementPercent ?? 0; // 0%
    
    // Use custom rent from URL if available, otherwise from saved property
    const effectiveRent = params.customRent ?? property.customRent ?? property.rent_estimate;
    // Use custom price from URL/saved property if available
    const effectivePrice = params.customPrice ?? property.customPrice ?? property.price;
    
    // Calculate monthly mortgage payment using effectivePrice
    const downPayment = effectivePrice * (downPaymentPercent / 100);
    const loanAmount = effectivePrice - downPayment;
    const monthlyRate = interestRate / 100 / 12;
    const payments = loanTerm * 12;
    
    let monthlyMortgage = 0;
    if (monthlyRate === 0) {
      monthlyMortgage = loanAmount / payments;
    } else {
      const x = Math.pow(1 + monthlyRate, payments);
      monthlyMortgage = loanAmount * (monthlyRate * x) / (x - 1);
    }
    
    // Calculate expenses using effectivePrice and effectiveRent
    const monthlyTaxInsurance = effectivePrice * (taxInsurancePercent / 100) / 12;
    const monthlyVacancy = effectiveRent * (vacancyPercent / 100);
    const monthlyCapex = effectiveRent * (capexPercent / 100);
    const monthlyPropertyManagement = effectiveRent * (propertyManagementPercent / 100);
    
    const totalMonthlyExpenses = monthlyMortgage + monthlyTaxInsurance + monthlyVacancy + monthlyCapex + monthlyPropertyManagement;
    const monthlyCashflow = effectiveRent - totalMonthlyExpenses;
    const annualCashflow = monthlyCashflow * 12;
    
    // Calculate initial investment using effectivePrice
    const initialInvestment = downPayment + (effectivePrice * 0.03); // Down payment + 3% closing costs
    const cashOnCashReturn = (initialInvestment > 0 ? annualCashflow / initialInvestment : 0) * 100; // Check for zero investment
    
    return { monthlyCashflow, cashOnCashReturn, effectiveRent, effectivePrice };
  };

  return (
    <>
      <CssBaseline />
      <AppBar position="sticky" elevation={0} sx={{ bgcolor: '#6366f1', color: 'white' }}>
        <Toolbar>
          <IconButton 
            edge="start" 
            color="inherit" 
            aria-label="back" 
            onClick={handleBackToHome}
            sx={{ mr: 2 }}
          >
            <ArrowBackIcon />
          </IconButton>
          <Box 
            sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              cursor: 'pointer',
              '&:hover': { opacity: 0.9 }
            }} 
            onClick={handleBackToHome}
          >
            <HomeWorkIcon sx={{ mr: 1, color: 'white' }} />
            <Typography variant="h6" color="inherit" noWrap sx={{ flexGrow: 1 }}>
              CashflowCrunch - Bookmarks
            </Typography>
          </Box>
        </Toolbar>
      </AppBar>
      
      <Container maxWidth="lg" sx={{ py: 4 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>
        ) : Object.keys(bookmarks).length === 0 ? (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h5" gutterBottom>No Bookmarked Properties</Typography>
            <Typography variant="body1" paragraph>
              You haven't bookmarked any properties yet. Browse properties and use the bookmark button to save them here.
            </Typography>
            <Button
              variant="contained"
              color="primary"
              onClick={handleBackToHome}
              sx={{
                marginTop: 2,
                width: '100%',
                height: '56px',
                borderRadius: '28px',
              }}
            >
              Crunch Properties
            </Button>
          </Paper>
        ) : (
          <>
            <Box sx={{ mb: 4 }}>
              <Typography variant="h4" gutterBottom>Your Bookmarked Properties</Typography>
              <Typography variant="body1">
                You have {Object.keys(bookmarks).length} bookmarked properties. Click on a property to view its details.
              </Typography>
            </Box>
            
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              {Object.entries(bookmarks).map(([id, entry]) => {
                // Calculate simple cashflow based on stored URL/property data
                const { monthlyCashflow, cashOnCashReturn, effectiveRent, effectivePrice } = calculateSimpleCashflow(entry.property, entry.url);
                const property = entry.property; // Use entry.property for clarity
                
                // Determine display price (custom or original)
                const displayPrice = effectivePrice;
                const displayRent = effectiveRent;
                const displayRatio = displayPrice > 0 ? displayRent / displayPrice : 0;
                
                // Format bookmark date
                const bookmarkDate = new Date(entry.date);
                const formattedDate = bookmarkDate.toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric'
                });
                
                return (
                  <Box 
                    key={id} 
                    sx={{ 
                      width: { xs: '100%', sm: 'calc(50% - 16px)', md: 'calc(33.333% - 16px)' },
                      minWidth: { xs: '100%', sm: '300px' }
                    }}
                  >
                    <Card 
                      elevation={2}
                      sx={{ 
                        height: '100%', 
                        display: 'flex', 
                        flexDirection: 'column',
                        transition: 'all 0.2s ease-in-out',
                        '&:hover': {
                          transform: 'translateY(-5px)',
                          boxShadow: 6
                        }
                      }}
                    >
                      <CardMedia
                        component="img"
                        height="180"
                        image={property.thumbnail || './placeholder-house.png'} // Use placeholder
                        alt={property.address}
                        sx={{ objectFit: 'cover' }}
                      />
                      
                      <CardContent sx={{ flexGrow: 1, pb: 1 }}>
                        <Typography variant="h6" component="div" sx={{ mb: 0.5 }}>
                          {formatCurrency(displayPrice)} {/* Display effective price */}
                          {property.customPrice && <Chip label="Overridden Price" size="small" sx={{ ml: 1, fontSize: '0.65rem', height: '18px' }} color="warning" variant="outlined" />}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          {property.address}
                        </Typography>
                        <Divider sx={{ my: 1 }} />
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', my: 1 }}>
                          <Typography variant="body2">Rent Est:</Typography>
                          <Typography variant="body2">{formatCurrency(displayRent)} {/* Display effective rent */}
                            {property.customRent && <Chip label="Edited Rent" size="small" sx={{ ml: 1, fontSize: '0.65rem', height: '18px' }} color="info" variant="outlined" />}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', my: 1 }}>
                          <Typography variant="body2">Ratio:</Typography>
                          <Typography variant="body2">{formatPercent(displayRatio * 100)}</Typography> {/* Display calculated ratio */}
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', my: 1 }}>
                          <Typography variant="body2">Cashflow/mo:</Typography>
                          <Typography variant="body2" fontWeight="bold" color={monthlyCashflow >= 0 ? 'success.main' : 'error.main'}>
                            {formatCurrency(monthlyCashflow)}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', my: 1 }}>
                          <Typography variant="body2">CoC Return:</Typography>
                          <Typography variant="body2" fontWeight="bold" color={cashOnCashReturn >= 0 ? 'success.main' : 'error.main'}>
                            {formatPercent(cashOnCashReturn)}
                          </Typography>
                        </Box>
                      </CardContent>
                      
                      <CardActions sx={{ justifyContent: 'space-between' }}>
                        <Button 
                          size="small" 
                          color="primary" 
                          onClick={() => handleViewPropertyDetails(entry.url)}
                        >
                          View Details
                        </Button>
                        
                        <CardActions>
                          <Button 
                          size="small" 
                          color="error" 
                            startIcon={<DeleteIcon />} 
                          onClick={() => handleRemoveBookmark(id)}
                            sx={{ width: '100%', justifyContent: 'center' }}
                        >
                            Remove Bookmark
                          </Button>
                        </CardActions>
                      </CardActions>
                    </Card>
                  </Box>
                );
              })}
            </Box>
          </>
        )}
      </Container>
    </>
  );
};

export default BookmarksPage;
