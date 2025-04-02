import React, { useState } from 'react';
import {
  Container, Typography, TextField, Button, Card, CardContent, CardMedia,
  Accordion, AccordionSummary, AccordionDetails, Divider, Chip,
  CircularProgress, Alert
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Property, searchPropertiesByLocation } from './api/propertyApi';
import './App.css';

function App() {
  const [location, setLocation] = useState('');
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchPerformed, setSearchPerformed] = useState(false);
  
  // Financial inputs with default values
  const [mortgageRate, setMortgageRate] = useState(6.5);
  const [downPaymentPercent, setDownPaymentPercent] = useState(20);
  const [taxInsurancePercent, setTaxInsurancePercent] = useState(1.5);
  const [vacancyPercent, setVacancyPercent] = useState(8);
  const [capexPercent, setCapexPercent] = useState(5);
  
  // Financial inputs accordion state
  const [financialInputsOpen, setFinancialInputsOpen] = useState(false);
  
  const handleSearch = async () => {
    if (!location.trim()) {
      setError('Please enter a zip code or city name (e.g., "90210" or "Allen, TX")');
      return;
    }
    
    setLoading(true);
    setError('');
    setProperties([]);
    setSearchPerformed(true);
    
    try {
      const results = await searchPropertiesByLocation(location);
      setProperties(results);
      if (results.length === 0) {
        setError('No properties found in this location. Please try another zip code or city.');
      }
    } catch (err) {
      console.error('Error searching properties:', err);
      setError('Error fetching properties. Please try a different location or try again later.');
    } finally {
      setLoading(false);
    }
  };
  
  const calculateMortgagePayment = (price: number, downPaymentPercent: number, interestRate: number, years: number = 30) => {
    const principal = price * (1 - downPaymentPercent / 100);
    const monthlyRate = interestRate / 100 / 12;
    const numberOfPayments = years * 12;
    
    if (monthlyRate === 0) return principal / numberOfPayments;
    
    const monthlyPayment = principal * (monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) / (Math.pow(1 + monthlyRate, numberOfPayments) - 1);
    return monthlyPayment;
  };
  
  const calculateCashflow = (property: Property) => {
    // Calculate monthly mortgage payment
    const monthlyMortgage = calculateMortgagePayment(property.price, downPaymentPercent, mortgageRate);
    
    // Calculate monthly tax and insurance
    const monthlyTaxInsurance = (property.price * (taxInsurancePercent / 100)) / 12;
    
    // Calculate vacancy cost
    const monthlyVacancy = property.rent_estimate * (vacancyPercent / 100);
    
    // Calculate capital expenditure
    const monthlyCapex = property.rent_estimate * (capexPercent / 100);
    
    // Calculate total monthly expenses
    const totalMonthlyExpenses = monthlyMortgage + monthlyTaxInsurance + monthlyVacancy + monthlyCapex;
    
    // Calculate monthly cashflow
    const monthlyCashflow = property.rent_estimate - totalMonthlyExpenses;
    
    // Calculate annual cashflow
    const annualCashflow = monthlyCashflow * 12;
    
    // Calculate cash on cash return
    const initialInvestment = property.price * (downPaymentPercent / 100);
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
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };
  
  const formatPercent = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value / 100);
  };
  
  const renderRentSourceChip = (source: 'zillow' | 'calculated') => {
    if (source === 'zillow') {
      return <Chip size="small" label="Zillow Estimate" color="primary" className="source-chip" />;
    } else {
      return <Chip size="small" label="Calculated (0.7%)" color="secondary" className="source-chip" />;
    }
  };
  
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom align="center">
        Rental Property Finder
      </Typography>
      
      <Accordion expanded={financialInputsOpen} onChange={() => setFinancialInputsOpen(!financialInputsOpen)} sx={{ mb: 3 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">Financial Inputs</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <div className="grid-container">
            <div className="grid-item grid-xs-6 grid-sm-4">
              <TextField
                label="Mortgage Rate (%)"
                type="number"
                value={mortgageRate}
                onChange={(e) => setMortgageRate(parseFloat(e.target.value) || 0)}
                fullWidth
                margin="normal"
                inputProps={{ step: 0.1, min: 0 }}
              />
            </div>
            <div className="grid-item grid-xs-6 grid-sm-4">
              <TextField
                label="Down Payment (%)"
                type="number"
                value={downPaymentPercent}
                onChange={(e) => setDownPaymentPercent(parseFloat(e.target.value) || 0)}
                fullWidth
                margin="normal"
                inputProps={{ step: 1, min: 0, max: 100 }}
              />
            </div>
            <div className="grid-item grid-xs-6 grid-sm-4">
              <TextField
                label="Tax & Insurance (%)"
                type="number"
                value={taxInsurancePercent}
                onChange={(e) => setTaxInsurancePercent(parseFloat(e.target.value) || 0)}
                fullWidth
                margin="normal"
                inputProps={{ step: 0.1, min: 0 }}
              />
            </div>
            <div className="grid-item grid-xs-6 grid-sm-4">
              <TextField
                label="Vacancy (%)"
                type="number"
                value={vacancyPercent}
                onChange={(e) => setVacancyPercent(parseFloat(e.target.value) || 0)}
                fullWidth
                margin="normal"
                inputProps={{ step: 1, min: 0, max: 100 }}
              />
            </div>
            <div className="grid-item grid-xs-6 grid-sm-4">
              <TextField
                label="CapEx (%)"
                type="number"
                value={capexPercent}
                onChange={(e) => setCapexPercent(parseFloat(e.target.value) || 0)}
                fullWidth
                margin="normal"
                inputProps={{ step: 1, min: 0, max: 100 }}
              />
            </div>
          </div>
        </AccordionDetails>
      </Accordion>
      
      <Card sx={{ mb: 4, p: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Enter Location
          </Typography>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <TextField
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              fullWidth
              placeholder="Zip code or city (e.g., 90210 or Allen, TX)"
              error={!!error}
              disabled={loading}
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
              sx={{ ml: 2, minWidth: '120px', height: '56px' }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Search'}
            </Button>
          </div>
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
          {loading && (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <CircularProgress />
              <Typography variant="body2" sx={{ mt: 2 }}>
                Searching for properties and calculating rent estimates...
                <br />
                This may take up to 30 seconds due to API rate limits.
              </Typography>
            </div>
          )}
        </CardContent>
      </Card>
      
      {searchPerformed && !loading && properties.length > 0 && (
        <>
          <Typography variant="h5" gutterBottom>
            Properties in {location} (Ranked by Rent-to-Price Ratio)
          </Typography>
          <div className="property-list">
            {properties.map((property) => {
              const cashflow = calculateCashflow(property);
              return (
                <Card key={property.property_id} className="property-card">
                  <CardContent className="property-card-content">
                    <CardMedia
                      component="img"
                      image={property.thumbnail}
                      alt={property.address}
                      className="property-image"
                      sx={{ height: 200, objectFit: 'cover' }}
                    />
                    <div className="property-details" style={{ padding: '0 16px' }}>
                      <Typography variant="h6" component="a" href={property.url} target="_blank" rel="noopener noreferrer">
                        {property.address}
                      </Typography>
                      
                      <div className="property-metrics">
                        <div className="metric">
                          <Typography variant="body2" color="textSecondary">Price</Typography>
                          <Typography variant="body1">{formatCurrency(property.price)}</Typography>
                        </div>
                        <div className="metric">
                          <Typography variant="body2" color="textSecondary">Rent Estimate</Typography>
                          <Typography variant="body1">
                            {formatCurrency(property.rent_estimate)}
                            {renderRentSourceChip(property.rent_source)}
                          </Typography>
                        </div>
                        <div className="metric">
                          <Typography variant="body2" color="textSecondary">Ratio</Typography>
                          <Typography variant="body1" className="ratio-highlight">
                            {formatPercent(property.ratio * 100)}
                          </Typography>
                        </div>
                      </div>
                      
                      <Divider sx={{ my: 1 }} />
                      
                      <div className="property-metrics">
                        <div className="metric">
                          <Typography variant="body2" color="textSecondary">Beds</Typography>
                          <Typography variant="body1">{property.bedrooms}</Typography>
                        </div>
                        <div className="metric">
                          <Typography variant="body2" color="textSecondary">Baths</Typography>
                          <Typography variant="body1">{property.bathrooms}</Typography>
                        </div>
                        <div className="metric">
                          <Typography variant="body2" color="textSecondary">Sq Ft</Typography>
                          <Typography variant="body1">{property.sqft.toLocaleString()}</Typography>
                        </div>
                      </div>
                      
                      {property.days_on_market !== null && (
                        <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                          Days on market: {property.days_on_market}
                        </Typography>
                      )}
                    </div>
                  </CardContent>
                  
                  <Accordion>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography>Cashflow Analysis</Typography>
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
                        <Divider sx={{ my: 1 }} />
                        <div className="cashflow-row">
                          <Typography variant="body2" fontWeight="bold">Total Monthly Expenses:</Typography>
                          <Typography variant="body2" fontWeight="bold">{formatCurrency(cashflow.totalMonthlyExpenses)}</Typography>
                        </div>
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
                    </AccordionDetails>
                  </Accordion>
                </Card>
              );
            })}
          </div>
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
