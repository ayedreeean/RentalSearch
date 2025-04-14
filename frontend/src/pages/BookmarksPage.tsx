import React, { useState, useEffect } from 'react';
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
  List,
  ListItem,
  ListItemText,
  CircularProgress
} from '@mui/material';
import { 
  ArrowBack as ArrowBackIcon, 
  HomeWork as HomeWorkIcon,
  Delete as DeleteIcon,
  Home as HomeIcon,
  BarChart as BarChartIcon
} from '@mui/icons-material';
import { Property, Cashflow } from '../types';

interface BookmarkEntry {
  url: string;
  property: Property;
  date: string;
}

const BookmarksPage: React.FC = () => {
  const navigate = useNavigate();
  const [bookmarks, setBookmarks] = useState<Record<string, BookmarkEntry>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Format currency
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };
  
  // Format percent
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
  
  // Calculate simplified cashflow for card display
  const calculateSimpleCashflow = (property: Property): { monthlyCashflow: number, cashOnCashReturn: number } => {
    // Simplified version of calculateCashflow
    // Use conservative default values
    const interestRate = 7.5; // 7.5%
    const loanTerm = 30; // 30 years
    const downPaymentPercent = 20; // 20%
    const taxInsurancePercent = 3; // 3%
    const vacancyPercent = 8; // 8%
    const capexPercent = 5; // 5%
    const propertyManagementPercent = 0; // 0%
    
    // Calculate monthly mortgage payment
    const downPayment = property.price * (downPaymentPercent / 100);
    const loanAmount = property.price - downPayment;
    const monthlyRate = interestRate / 100 / 12;
    const payments = loanTerm * 12;
    
    let monthlyMortgage = 0;
    if (monthlyRate === 0) {
      monthlyMortgage = loanAmount / payments;
    } else {
      const x = Math.pow(1 + monthlyRate, payments);
      monthlyMortgage = loanAmount * (monthlyRate * x) / (x - 1);
    }
    
    // Calculate expenses
    const monthlyTaxInsurance = property.price * (taxInsurancePercent / 100) / 12;
    const monthlyVacancy = property.rent_estimate * (vacancyPercent / 100);
    const monthlyCapex = property.rent_estimate * (capexPercent / 100);
    const monthlyPropertyManagement = property.rent_estimate * (propertyManagementPercent / 100);
    
    const totalMonthlyExpenses = monthlyMortgage + monthlyTaxInsurance + monthlyVacancy + monthlyCapex + monthlyPropertyManagement;
    const monthlyCashflow = property.rent_estimate - totalMonthlyExpenses;
    const annualCashflow = monthlyCashflow * 12;
    
    const initialInvestment = downPayment + (property.price * 0.03); // Down payment + 3% closing costs
    const cashOnCashReturn = (annualCashflow / initialInvestment) * 100;
    
    return { monthlyCashflow, cashOnCashReturn };
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
          <HomeWorkIcon sx={{ mr: 1, color: 'white' }} />
          <Typography variant="h6" color="inherit" noWrap sx={{ flexGrow: 1 }}>
            RentalSearch - Bookmarks
          </Typography>
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
              sx={{ mt: 2 }}
            >
              Search Properties
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
                const { property, url, date } = entry;
                const { monthlyCashflow, cashOnCashReturn } = calculateSimpleCashflow(property);
                
                // Format bookmark date
                const bookmarkDate = new Date(date);
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
                        sx={{ height: 200, objectFit: 'cover' }}
                        image={property.thumbnail || 'https://via.placeholder.com/300x200?text=No+Image'}
                        alt={property.address}
                      />
                      
                      <CardContent sx={{ flexGrow: 1 }}>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                          Bookmarked on {formattedDate}
                        </Typography>
                        
                        <Typography variant="h6" component="h2" gutterBottom>
                          {formatCurrency(property.price)}
                        </Typography>
                        
                        <Typography variant="body2" color="text.secondary" paragraph>
                          {property.address}
                        </Typography>
                        
                        <Box sx={{ display: 'flex', mb: 1 }}>
                          <Chip 
                            label={`${property.bedrooms} beds`}
                            size="small"
                            sx={{ mr: 1 }}
                          />
                          <Chip 
                            label={`${property.bathrooms} baths`}
                            size="small" 
                            sx={{ mr: 1 }}
                          />
                          <Chip 
                            label={`${property.sqft.toLocaleString()} sqft`}
                            size="small"
                          />
                        </Box>
                        
                        <Divider sx={{ my: 1 }} />
                        
                        <Box sx={{ display: 'flex', flexWrap: 'wrap' }}>
                          <Box sx={{ width: '50%', mb: 1 }}>
                            <Typography variant="body2" color="text.secondary">Rent Est.</Typography>
                            <Typography variant="subtitle1">{formatCurrency(property.rent_estimate)}</Typography>
                          </Box>
                          <Box sx={{ width: '50%', mb: 1 }}>
                            <Typography variant="body2" color="text.secondary">Monthly CF</Typography>
                            <Typography 
                              variant="subtitle1" 
                              color={monthlyCashflow >= 0 ? 'success.main' : 'error.main'}
                            >
                              {formatCurrency(monthlyCashflow)}
                            </Typography>
                          </Box>
                          <Box sx={{ width: '50%', mb: 1 }}>
                            <Typography variant="body2" color="text.secondary">Rent-to-Price</Typography>
                            <Typography variant="subtitle1">{formatPercent(property.ratio)}</Typography>
                          </Box>
                          <Box sx={{ width: '50%', mb: 1 }}>
                            <Typography variant="body2" color="text.secondary">CoC Return</Typography>
                            <Typography 
                              variant="subtitle1"
                              color={cashOnCashReturn >= 0 ? 'success.main' : 'error.main'}
                            >
                              {formatPercent(cashOnCashReturn)}
                            </Typography>
                          </Box>
                        </Box>
                      </CardContent>
                      
                      <CardActions sx={{ p: 2, pt: 0 }}>
                        <Button 
                          size="small" 
                          variant="outlined"
                          startIcon={<HomeIcon />}
                          href={property.url}
                          target="_blank"
                          sx={{ mr: 1, flexGrow: 1 }}
                        >
                          Zillow
                        </Button>
                        
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<BarChartIcon />}
                          href={`https://www.rentcast.io/address/${encodeURIComponent(property.address)}`}
                          target="_blank"
                          sx={{ flexGrow: 1 }}
                        >
                          Rentcast
                        </Button>
                      </CardActions>
                      
                      <Divider />
                      
                      <CardActions sx={{ justifyContent: 'space-between', p: 2 }}>
                        <Button
                          size="small"
                          variant="outlined"
                          color="error"
                          startIcon={<DeleteIcon />}
                          onClick={() => handleRemoveBookmark(id)}
                        >
                          Remove
                        </Button>
                        
                        <Button
                          size="small"
                          variant="contained"
                          color="primary"
                          onClick={() => handleViewPropertyDetails(url)}
                        >
                          View Details
                        </Button>
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