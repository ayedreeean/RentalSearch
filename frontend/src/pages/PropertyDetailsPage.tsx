import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Typography, Container, Box, CircularProgress, AppBar, Toolbar, 
  Button, Paper, IconButton, TextField, Snackbar, Tooltip, Divider,
  CssBaseline, Grid, Slider, Dialog, DialogContent, DialogTitle, DialogActions,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tabs, Tab, useMediaQuery, useTheme, Drawer, Chip,
  InputAdornment // Import InputAdornment
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon, HomeWork as HomeWorkIcon,
  BookmarkBorder as BookmarkBorderIcon, Bookmark as BookmarkIcon,
  PictureAsPdf as PdfIcon, Tune as TuneIcon, BusinessCenter as BusinessCenterIcon,
  Close as CloseIcon, Share as ShareIcon, Link as LinkIcon, ContentCopy as ContentCopyIcon,
  Save as SaveIcon, // Import SaveIcon
  Check as CheckIcon // Import CheckIcon for saved state
} from '@mui/icons-material';
import { Property, Cashflow, CashflowSettings, YearlyProjection } from '../types';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { usePDF } from 'react-to-pdf';
import { QRCodeSVG } from 'qrcode.react';
import CashflowSankeyChart from '../components/CashflowSankeyChart';
import PropertyImageGallery from '../components/PropertyImageGallery';
// Import utility functions
import { formatCurrency, formatPercent } from '../utils/formatting';
import { calculateCashflow as calculateCashflowUtil } from '../utils/calculations';
import { calculateCrunchScore } from '../utils/scoring';

// ---- Portfolio Data Structure (Define Outside Component) ----
interface PortfolioAssumptionOverrides {
    // Define fields for assumptions that can be overridden
    interestRate?: number;
    loanTerm?: number;
    downPaymentPercent?: number;
    taxInsurancePercent?: number;
    vacancyPercent?: number;
    capexPercent?: number;
    propertyManagementPercent?: number;
    rehabAmount?: number;
    rentEstimate?: number;
    yearsToProject?: number;
    rentAppreciationRate?: number;
    propertyValueIncreaseRate?: number;
}

interface PortfolioEntry {
    property: Property & { notes?: string }; // Store the property snapshot including notes
    portfolioAssumptions: PortfolioAssumptionOverrides;
    dateAdded: string;
}
// ---- End Portfolio Data Structure ----

interface PropertyDetailsPageProps {
  properties: Property[]; // Keep properties if needed for finding the specific one
  // Remove props that are now utility functions
  // calculateCashflow: (property: Property, settings: CashflowSettings) => Cashflow;
  // formatCurrency: (amount: number) => string;
  // formatPercent: (percent: number) => string;
  defaultSettings: CashflowSettings; // Keep default settings if used for initialization
  handlePriceOverrideChange: (propertyId: string, newPriceString: string) => void;
}

// --- Helper Functions (Moved Outside Component) ---
// ... calculateIRR definition ...
// ... decodePropertyFromURL definition ...

// --- Helper Components (Defined outside PropertyDetailsPage) ---

// Adjust the SimpleChart component to ensure all bars are fully visible
const SimpleChart = ({ 
  data, 
  height = 300
}: { 
  data: { 
    years: number[], 
    propertyValues: number[],
    equity: number[],
    cashflow: number[]
  },
  height?: number 
}) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  
  // Add state for tracking hover position and displayed tooltip
  const [hoverInfo, setHoverInfo] = React.useState<{
    visible: boolean,
    x: number,
    y: number,
    year: number,
    propertyValue: number,
    equity: number,
    cashflow: number
  } | null>(null);
  
  // Draw chart function
  const drawChart = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Set canvas dimensions accounting for device pixel ratio
    const ratio = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    ctx.scale(ratio, ratio);
    
    const canvasWidth = canvas.offsetWidth;
    const canvasHeight = canvas.offsetHeight;
    
    // Padding - increase horizontal padding to prevent bar cutoff
    const padding = {
      top: 50,         // Increased to make room for title
      right: 110,      // Increased for secondary Y-axis labels and last bar
      bottom: 80,      // Increased for X-axis labels and legend
      left: 110        // Increased for primary Y-axis labels and first bar
    };
    
    const chartWidth = canvasWidth - padding.left - padding.right;
    const chartHeight = canvasHeight - padding.top - padding.bottom;
    
    // Calculate scales for primary Y-axis (property values & equity)
    const maxPropertyValue = Math.max(...data.propertyValues, 0); // Ensure non-negative max
    const maxEquity = Math.max(...data.equity, 0); // Ensure non-negative max
    const maxPrimaryY = Math.max(maxPropertyValue, maxEquity);
    
    // Calculate scales for secondary Y-axis (cashflow)
    const cashflowValues = data.cashflow.length > 0 ? data.cashflow : [0]; // Handle empty array
    const maxCashflow = Math.max(...cashflowValues);
    const minCashflow = Math.min(...cashflowValues);
    
    // For positive-only data, start at 0. For data with negatives, include the negative range.
    const minSecondaryY = Math.min(0, minCashflow);
    const maxSecondaryY = Math.max(0, maxCashflow);
    
    // Calculate ratios to maintain proper scale proportions (handle division by zero)
    const primaryToSecondaryRatio = maxSecondaryY !== 0 ? maxPrimaryY / maxSecondaryY : 1;
    
    // Add padding to both scales
    const primaryYPadding = maxPrimaryY * 0.1;
    const secondaryYRange = maxSecondaryY - minSecondaryY;
    const secondaryYPadding = secondaryYRange * 0.2; // More padding for cashflow scale
    
    // Determine the effective min/max for both axes, ensuring full visibility
    const effectiveMinPrimaryY = 0; // Keep primary axis starting at 0
    const effectiveMaxPrimaryY = maxPrimaryY + primaryYPadding || 100; // Default if max is 0
    
    // Adjust secondary axis min/max to ensure all data is visible
    const effectiveMinSecondaryY = minSecondaryY - (minSecondaryY < 0 ? secondaryYPadding : 0);
    let effectiveMaxSecondaryY = maxSecondaryY + secondaryYPadding;
    
    // Ensure effectiveMaxSecondaryY is not zero if min is also zero to avoid scale issues
    if (effectiveMinSecondaryY === 0 && effectiveMaxSecondaryY === 0) {
      effectiveMaxSecondaryY = 100; // Default max if all values are 0
    }
    
    // Ensure the secondary scale can represent all data points
    const adjustedMaxSecondary = Math.max(effectiveMaxSecondaryY, effectiveMaxPrimaryY / (primaryToSecondaryRatio || 1)); // Handle ratio being 0
    
    // Calculate Y scales with adjusted ranges (avoid division by zero)
    const primaryYScale = (effectiveMaxPrimaryY - effectiveMinPrimaryY) !== 0 ? chartHeight / (effectiveMaxPrimaryY - effectiveMinPrimaryY) : 1;
    const secondaryYScale = (adjustedMaxSecondary - effectiveMinSecondaryY) !== 0 ? chartHeight / (adjustedMaxSecondary - effectiveMinSecondaryY) : 1;
    
    // Calculate zero Y-coordinate position (will be the same for both axes)
    const zeroYCoordinate = canvasHeight - padding.bottom - ((0 - effectiveMinSecondaryY) * secondaryYScale);
    
    // Function to convert a primary Y value to canvas coordinate
    const getPrimaryYCoordinate = (value: number) => {
      return zeroYCoordinate - ((value - 0) * primaryYScale);
    };
    
    // Function to convert a secondary Y value to canvas coordinate
    const getSecondaryYCoordinate = (value: number) => {
      return canvasHeight - padding.bottom - ((value - effectiveMinSecondaryY) * secondaryYScale);
    };
    
    // Calculate plot area width (space available for data points)
    const plotAreaWidth = chartWidth;
    
    // Calculate X scale with proper inset (handle single data point)
    const numPoints = data.years.length;
    const xScale = numPoints > 1 ? plotAreaWidth / (numPoints - 1) : plotAreaWidth / 2; // Center if only one point
    
    // Draw background grid
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 1;
    
    // Draw horizontal grid lines for primary axis
    const primaryGridStep = Math.max(1, Math.ceil(effectiveMaxPrimaryY / 5)); // Avoid 0 step
    for (let i = 0; i <= effectiveMaxPrimaryY; i += primaryGridStep) {
      const y = getPrimaryYCoordinate(i);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(canvasWidth - padding.right, y);
      ctx.stroke();
    }
    
    // Draw primary Y-axis (left)
    ctx.strokeStyle = '#aaa';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, canvasHeight - padding.bottom);
    ctx.stroke();
    
    // Draw secondary Y-axis (right)
    ctx.beginPath();
    ctx.moveTo(canvasWidth - padding.right, padding.top);
    ctx.lineTo(canvasWidth - padding.right, canvasHeight - padding.bottom);
    ctx.stroke();
    
    // Draw X-axis
    const xAxisY = effectiveMinSecondaryY < 0 
      ? getSecondaryYCoordinate(0) 
      : canvasHeight - padding.bottom;
    
    ctx.beginPath();
    ctx.moveTo(padding.left, xAxisY);
    ctx.lineTo(canvasWidth - padding.right, xAxisY);
    ctx.stroke();
    
    // Draw primary Y-axis labels (left - property values & equity)
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#666';
    ctx.font = '10px Arial';
    
    const optimalStepCount = 5;
    let primaryStepSize = Math.max(1, Math.ceil(effectiveMaxPrimaryY / optimalStepCount)); // Avoid 0 step
    const primaryMagnitude = Math.pow(10, Math.floor(Math.log10(primaryStepSize)));
    primaryStepSize = Math.max(1, Math.ceil(primaryStepSize / primaryMagnitude) * primaryMagnitude); // Ensure step is at least 1
    
    for (let i = 0; i <= effectiveMaxPrimaryY; i += primaryStepSize) {
      if (i > effectiveMaxPrimaryY) break;
      const y = getPrimaryYCoordinate(i);
      let label;
      if (i >= 1000000) label = '$' + (i / 1000000).toFixed(1) + 'M';
      else if (i >= 1000) label = '$' + (i / 1000).toFixed(0) + 'K';
      else label = '$' + i;
      ctx.fillText(label, padding.left - 8, y);
    }
    
    // Draw secondary Y-axis labels (right - cashflow)
    ctx.textAlign = 'left';
    let secondaryStepSize = Math.max(1, (adjustedMaxSecondary - effectiveMinSecondaryY) / optimalStepCount); // Avoid 0 step
    const secondaryMagnitude = Math.pow(10, Math.floor(Math.log10(secondaryStepSize)));
    secondaryStepSize = Math.max(1, Math.ceil(secondaryStepSize / secondaryMagnitude) * secondaryMagnitude); // Ensure step is at least 1
    let secondaryLabelValue = Math.floor(effectiveMinSecondaryY / secondaryStepSize) * secondaryStepSize;
    
    while (secondaryLabelValue <= adjustedMaxSecondary) {
      const y = getSecondaryYCoordinate(secondaryLabelValue);
      let label;
      if (Math.abs(secondaryLabelValue) >= 1000) label = '$' + (secondaryLabelValue / 1000).toFixed(1) + 'K';
      else label = '$' + secondaryLabelValue;
      ctx.fillText(label, canvasWidth - padding.right + 8, y);
      if (secondaryLabelValue === 0) {
        ctx.strokeStyle = '#999';
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(canvasWidth - padding.right, y);
        ctx.stroke();
        ctx.strokeStyle = '#ccc';
      }
      secondaryLabelValue += secondaryStepSize;
    }
    
    // Draw X-axis labels
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#666';
    const yearsToShow = numPoints <= 10 ? data.years : [1, 5, 10, 15, 20, 25, 30].filter(year => year <= numPoints);
    yearsToShow.forEach(yearToShow => {
      const index = data.years.indexOf(yearToShow);
      if (index !== -1) {
        const x = padding.left + (index * xScale);
        ctx.fillText(yearToShow.toString(), x, canvasHeight - padding.bottom + 5);
        ctx.strokeStyle = '#f0f0f0';
        ctx.beginPath();
        ctx.moveTo(x, padding.top);
        ctx.lineTo(x, canvasHeight - padding.bottom);
        ctx.stroke();
      }
    });
    
    // Draw axis titles
    ctx.textAlign = 'center'; ctx.font = 'bold 11px Arial'; ctx.fillStyle = '#555';
    ctx.save(); ctx.translate(padding.left - 60, padding.top + chartHeight / 2); ctx.rotate(-Math.PI / 2); ctx.fillText('Property Value & Equity ($)', 0, 0); ctx.restore();
    ctx.save(); ctx.translate(canvasWidth - padding.right + 60, padding.top + chartHeight / 2); ctx.rotate(Math.PI / 2); ctx.fillText('Annual Cashflow ($)', 0, 0); ctx.restore();
    ctx.fillText('Year', padding.left + chartWidth / 2, canvasHeight - 10);
    
    // Draw property value line
    if (data.propertyValues.length > 1) {
      ctx.strokeStyle = '#4f46e5'; ctx.lineWidth = 2; ctx.beginPath();
      for (let i = 0; i < data.propertyValues.length; i++) {
        const x = padding.left + (i * xScale);
        const y = getPrimaryYCoordinate(data.propertyValues[i]);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    
    // Draw equity line
    if (data.equity.length > 1) {
      ctx.strokeStyle = '#10b981'; ctx.lineWidth = 2; ctx.beginPath();
      for (let i = 0; i < data.equity.length; i++) {
        const x = padding.left + (i * xScale);
        const y = getPrimaryYCoordinate(data.equity[i]);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    
    // Draw cashflow bars
    const barWidth = Math.max(2, Math.min(xScale * 0.4, 12)); // Ensure minimum width
    for (let i = 0; i < data.cashflow.length; i++) {
      let x;
      if (numPoints === 1) x = padding.left + xScale - barWidth / 2; // Center single bar
      else if (i === 0) x = padding.left;
      else if (i === numPoints - 1) x = (canvasWidth - padding.right) - barWidth;
      else x = padding.left + (i * xScale) - (barWidth / 2);
      
      const cashflowValue = data.cashflow[i];
      const zeroY = getSecondaryYCoordinate(0);
      const valueY = getSecondaryYCoordinate(cashflowValue);
      ctx.fillStyle = cashflowValue >= 0 ? '#f97316' : '#ef4444';
      if (cashflowValue >= 0) ctx.fillRect(x, valueY, barWidth, zeroY - valueY);
      else ctx.fillRect(x, zeroY, barWidth, valueY - zeroY);
    }
    
    // Draw legend
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.font = '12px Arial'; ctx.fillStyle = '#333';
    const legendItems = [{ label: 'Property Value', color: '#4f46e5' }, { label: 'Equity', color: '#10b981' }, { label: 'Annual Cashflow', color: '#f97316' }];
    const legendWidth = 150; const legendStartX = (canvasWidth - (legendItems.length * legendWidth)) / 2; const legendY = canvasHeight - 15;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'; ctx.fillRect(legendStartX - 10, legendY - 15, (legendItems.length * legendWidth) + 20, 30);
    legendItems.forEach((item, index) => {
      const x = legendStartX + (index * legendWidth);
      ctx.fillStyle = item.color; ctx.fillRect(x, legendY - 5, 15, 10);
      ctx.fillStyle = '#333'; ctx.fillText(item.label, x + 20, legendY);
    });
    
    // Draw hover line
    if (hoverInfo && hoverInfo.visible) {
      const hoverX = hoverInfo.x;
      ctx.save(); ctx.strokeStyle = 'rgba(100, 100, 100, 0.5)'; ctx.lineWidth = 1; ctx.setLineDash([5, 3]);
      ctx.beginPath(); ctx.moveTo(hoverX, padding.top); ctx.lineTo(hoverX, canvasHeight - padding.bottom); ctx.stroke(); ctx.restore();
    }
    
  }, [data, hoverInfo]);
  
  React.useEffect(() => { drawChart(); }, [drawChart]);
  
  const handleMouseMove = React.useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect(); const x = e.clientX - rect.left; const y = e.clientY - rect.top;
    const canvasWidth = canvas.offsetWidth; const canvasHeight = canvas.offsetHeight;
    const padding = { top: 50, right: 110, bottom: 80, left: 110 };
    const chartWidth = canvasWidth - padding.left - padding.right;
    const plotAreaWidth = chartWidth;
    const numPoints = data.years.length;
    const xScale = numPoints > 1 ? plotAreaWidth / (numPoints - 1) : plotAreaWidth / 2;

    if (x >= padding.left && x <= canvasWidth - padding.right && y >= padding.top && y <= canvasHeight - padding.bottom) {
      const dataIndex = numPoints === 1 ? 0 : Math.max(0, Math.min(numPoints - 1, Math.round((x - padding.left) / xScale)));
        const dataPointX = padding.left + (dataIndex * xScale);
      if (data.years[dataIndex] !== undefined) { // Check if index is valid
        setHoverInfo({
          visible: true, x: dataPointX, y: y,
          year: data.years[dataIndex], propertyValue: data.propertyValues[dataIndex],
          equity: data.equity[dataIndex], cashflow: data.cashflow[dataIndex]
        });
        return;
      }
    }
    setHoverInfo(null);
  }, [data]);
  
  const handleMouseLeave = React.useCallback(() => { setHoverInfo(null); }, []);
  
  return (
    <Box sx={{ width: '100%', height, mb: 2, position: 'relative' }}>
      <canvas 
        ref={canvasRef} 
        style={{ width: '100%', height: '100%' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />
      {hoverInfo && hoverInfo.visible && (
        <div style={{ position: 'absolute', left: `${hoverInfo.x + 10}px`, top: `${hoverInfo.y - 80}px`, backgroundColor: 'rgba(0, 0, 0, 0.7)', color: 'white', padding: '8px', borderRadius: '4px', fontSize: '12px', pointerEvents: 'none', zIndex: 1000, whiteSpace: 'nowrap' }}>
          <div>Year: {hoverInfo.year}</div>
          <div>Prop Value: {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact' }).format(hoverInfo.propertyValue)}</div>
          <div>Equity: {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact' }).format(hoverInfo.equity)}</div>
          <div>Cashflow: {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact' }).format(hoverInfo.cashflow)}</div>
        </div>
      )}
    </Box>
  );
};

// Fix for the default Leaflet marker icon issue
const useLeafletFix = () => {
  useEffect(() => {
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png',
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-violet.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    });
  }, []);
};

// Helper component to invalidate map size
const MapResizer = () => {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => { map.invalidateSize(); }, 100);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
};

// Property Map Component
const PropertyMap = ({ 
  address, 
  lat = null, 
  lng = null 
}: { 
  address: string, 
  lat: number | null, 
  lng: number | null 
}) => {
  useLeafletFix();
  const [loading, setLoading] = useState(true);
  const [coordinates, setCoordinates] = useState<[number, number] | null>(lat && lng ? [lat, lng] : null);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    if (coordinates) { setLoading(false); return; }
    const geocodeAddress = async () => {
      try {
        setLoading(true);
        const encodedAddress = encodeURIComponent(address);
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1`);
        if (!response.ok) throw new Error('Geocoding request failed');
        const data = await response.json();
        if (data && data.length > 0) {
          setCoordinates([parseFloat(data[0].lat), parseFloat(data[0].lon)]);
        } else {
          setError('Could not find this address on the map');
          setCoordinates([37.7749, -122.4194]); // Default coordinates
        }
      } catch (error) {
        console.error('Error geocoding address:', error);
        setError('Error loading map location');
        setCoordinates([37.7749, -122.4194]); // Default coordinates
      } finally {
        setLoading(false);
      }
    };
    geocodeAddress();
  }, [address, coordinates]);
  
  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: 300 }}><CircularProgress /></Box>;
  if (error || !coordinates) return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: 300, bgcolor: '#f5f5f5', borderRadius: 2 }}><Typography color="error">{error || 'Map could not be loaded'}</Typography></Box>;
  
    return (
    <Box sx={{ height: '100%', minHeight: 400, width: '100%', borderRadius: 2, overflow: 'hidden', border: '1px solid #e0e0e0' }}>
      <MapContainer center={coordinates} zoom={15} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false} {...({} as any)}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Marker position={coordinates}><Popup>{address}</Popup></Marker>
        <MapResizer />
      </MapContainer>
      </Box>
    );
};

// --- PDF Report Component (Moved Outside) ---
interface PropertyPDFReportProps {
  property: Property;
  cashflow: Cashflow;
  settings: CashflowSettings;
  customRentEstimate: number | null;
  notes: string;
  generateShareableURL: () => string;
  generateLongTermCashflow: () => YearlyProjection[]; 
  calculateIRR: (initialInvestment: number, cashFlows: number[], finalEquity?: number) => number;
  yearsToProject: number;
  rentAppreciationRate: number;
  propertyValueIncreaseRate: number;
  effectivePrice: number; 
}

// Property PDF Report Component - Use forwardRef
const PropertyPDFReport: React.ForwardRefRenderFunction<HTMLDivElement, PropertyPDFReportProps> = (
  {
    property,
    cashflow,
    settings,
    customRentEstimate,
    notes,
    generateShareableURL,
    generateLongTermCashflow,
    calculateIRR,
    yearsToProject,
    rentAppreciationRate,
    propertyValueIncreaseRate,
    effectivePrice
  },
  ref
) => {
    // Use imported formatCurrency and formatPercent inside this component
    const longTermData = generateLongTermCashflow();
    const shareableURL = generateShareableURL();
    const irr = calculateIRR(
        cashflow.totalInitialInvestment, // Now exists on cashflow object
        longTermData.map(year => year.yearlyCashflow),
        longTermData[longTermData.length - 1]?.equity // Final equity
    );

    return (
        <div ref={ref} style={{ padding: '20px', backgroundColor: 'white' }}>
            {/* Header */}
            <Box sx={{ borderBottom: '2px solid #eee', pb: 2, mb: 3 }}>
                <Typography variant="h4" gutterBottom sx={{ color: '#4f46e5' }}>CashflowCrunch Analysis</Typography>
                <Typography variant="h6">{property.address}</Typography>
                <Typography variant="body2" color="textSecondary">Report Generated: {new Date().toLocaleDateString()}</Typography>
      </Box>

            {/* Key Info & QR Code */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid size={{ xs: 12, md: 8 }}>
                    <Typography variant="h5" gutterBottom>Summary</Typography>
                    <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
              <Table size="small">
                <TableBody>
                                <TableRow><TableCell>Price</TableCell><TableCell align="right">{formatCurrency(effectivePrice)}</TableCell></TableRow>
                                <TableRow><TableCell>Rent Estimate</TableCell><TableCell align="right">{formatCurrency(customRentEstimate ?? property.rent_estimate)}</TableCell></TableRow>
                                <TableRow><TableCell>Beds / Baths / SqFt</TableCell><TableCell align="right">{`${property.bedrooms} / ${property.bathrooms} / ${property.sqft.toLocaleString()}`}</TableCell></TableRow>
                                <TableRow><TableCell>Monthly Cashflow</TableCell><TableCell align="right" sx={{ fontWeight: 'bold', color: cashflow.monthlyCashflow >= 0 ? 'success.main' : 'error.main' }}>{formatCurrency(cashflow.monthlyCashflow)}</TableCell></TableRow>
                                <TableRow><TableCell>Cash-on-Cash Return</TableCell><TableCell align="right" sx={{ fontWeight: 'bold', color: cashflow.cashOnCashReturn >= 0 ? 'success.main' : 'error.main' }}>{formatPercent(cashflow.cashOnCashReturn)}</TableCell></TableRow>
                                <TableRow><TableCell>Projected {yearsToProject}-Year IRR</TableCell><TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatPercent(irr)}</TableCell></TableRow>
                </TableBody>
              </Table>
                    </TableContainer>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }} sx={{ textAlign: 'center' }}>
                    <Typography variant="caption" display="block" gutterBottom>Scan to view live analysis:</Typography>
                    <QRCodeSVG value={shareableURL} size={128} style={{ marginBottom: '8px' }} />
                </Grid>
            </Grid>

             {/* Cashflow Breakdown */}
            <Typography variant="h5" gutterBottom sx={{ mt: 3 }}>Monthly Cashflow Breakdown</Typography>
            <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
                <Table size="small">
            <TableBody>
                        <TableRow><TableCell>Rent Income</TableCell><TableCell align="right">{formatCurrency(customRentEstimate ?? property.rent_estimate)}</TableCell></TableRow>
                        <TableRow><TableCell>Mortgage (P&I)</TableCell><TableCell align="right">({formatCurrency(cashflow.monthlyMortgage)})</TableCell></TableRow>
                        <TableRow><TableCell>Taxes & Insurance</TableCell><TableCell align="right">({formatCurrency(cashflow.monthlyTaxInsurance)})</TableCell></TableRow>
                        <TableRow><TableCell>Vacancy ({settings.vacancyPercent}%)</TableCell><TableCell align="right">({formatCurrency(cashflow.monthlyVacancy)})</TableCell></TableRow>
                        <TableRow><TableCell>CapEx ({settings.capexPercent}%)</TableCell><TableCell align="right">({formatCurrency(cashflow.monthlyCapex)})</TableCell></TableRow>
                        <TableRow><TableCell>Property Mgmt ({settings.propertyManagementPercent}%)</TableCell><TableCell align="right">({formatCurrency(cashflow.monthlyPropertyManagement)})</TableCell></TableRow>
                        <TableRow sx={{ borderTop: '1px solid #eee' }}><TableCell sx={{ fontWeight: 'bold' }}>Est. Monthly Cashflow</TableCell><TableCell align="right" sx={{ fontWeight: 'bold', color: cashflow.monthlyCashflow >= 0 ? 'success.main' : 'error.main' }}>{formatCurrency(cashflow.monthlyCashflow)}</TableCell></TableRow>
            </TableBody>
          </Table>
        </TableContainer>

            {/* Add IRR Summary Panel */}
            <Box sx={{ mt: 3, p: 2, bgcolor: '#f8f9fa', borderRadius: 2, border: '1px solid #e0e0e0' }}>
              <Typography variant="h6" gutterBottom sx={{ color: '#333', fontWeight: 'medium' }}>
                Internal Rate of Return (IRR) by Holding Period
        </Typography>
              
              <Typography variant="body2" gutterBottom sx={{ color: '#666', mb: 2 }}>
                IRR represents the annualized rate of return considering all cash flows and the final property value, accounting for the time value of money.
              </Typography>
              
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, justifyContent: 'space-between', pageBreakInside: 'avoid' as 'avoid' }}>
          {[1, 5, 10, 15, 30].map(holdingPeriod => {
                  // Calculate IRR for this holding period
            const relevantCashflows = longTermData
              .filter(data => data.year <= holdingPeriod)
              .map(data => data.yearlyCashflow);
                    
                  // Get final property value and equity for the exit scenario
            const finalYearData = longTermData.find(data => data.year === holdingPeriod);
                  const finalEquity = finalYearData ? finalYearData.equity : 0;
                  
                  // Assume sale at end of period and use equity as final value
                  // Make sure to use the totalInvestment calculated earlier
                  const irr = calculateIRR(
                    cashflow.totalInitialInvestment, // Use total investment including rehab
                    relevantCashflows,
                    finalEquity
                  );
                  
                  // Generate color based on IRR value
                  const color = irr < 0 ? '#ef4444' : 
                                irr < 8 ? '#f97316' : 
                                irr < 15 ? '#10b981' : 
                                '#4f46e5';

            return (
              <Box
                key={holdingPeriod}
                sx={{
                  flex: '1',
                        minWidth: '150px', 
                  textAlign: 'center',
                        p: 2,
                        bgcolor: 'white',
                  borderRadius: 1,
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }}
              >
                      <Typography variant="subtitle1" color="#555">
                        {holdingPeriod} Year{holdingPeriod > 1 ? 's' : ''}
                </Typography>
                      <Typography 
                        variant="h5" 
                        fontWeight="bold" 
                        sx={{ color }}
                      >
                        {irr.toFixed(2)}%
                      </Typography>
                      <Typography variant="body2" color="#777" fontSize="0.8rem">
                        {irr < 0 ? 'Poor' : 
                         irr < 8 ? 'Moderate' : 
                         irr < 15 ? 'Good' : 
                         'Excellent'}
                </Typography>
    </Box>
  );
          })}
        </Box>
              
              <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #e0e0e0' }}>
                <Typography variant="body2" color="#666">
                  <strong>Assumptions:</strong> IRR calculations include annual cash flows and assume property sale at the end of the holding period with proceeds equal to your equity. Sale costs (agent fees, closing costs, etc.) are not factored in. Initial rehab cost is included in the initial investment. {/* Added note about rehab cost */}
                </Typography>
              </Box>
            </Box>

            {/* Investment Summary Table */}
            <Typography variant="h5" gutterBottom sx={{ mt: 3 }}>Initial Investment</Typography>
            <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
                 <Table size="small">
                     <TableBody>
                         <TableRow><TableCell>Down Payment ({settings.downPaymentPercent}%)</TableCell><TableCell align="right">{formatCurrency(cashflow.downPaymentAmount)}</TableCell></TableRow>
                         <TableRow><TableCell>Est. Closing Costs (3%)</TableCell><TableCell align="right">{formatCurrency(cashflow.closingCosts)}</TableCell></TableRow>
                         <TableRow><TableCell>Rehab Costs</TableCell><TableCell align="right">{formatCurrency(settings.rehabAmount)}</TableCell></TableRow>
                         <TableRow sx={{ borderTop: '1px solid #eee' }}><TableCell sx={{ fontWeight: 'bold' }}>Total Estimated Investment</TableCell><TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(cashflow.totalInitialInvestment)}</TableCell></TableRow>
                     </TableBody>
                 </Table>
            </TableContainer>

            {/* Long Term Projections Table */}
            <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
                <Table size="small">
                    <TableBody>
                         {/* ... Table Body Rows ... */}                       
                    </TableBody>
                </Table>
            </TableContainer>

            {/* Notes */}
            {notes && (
                <Typography variant="body2" sx={{ mt: 3, color: '#666' }}>
            {notes}
          </Typography>
            )}

            {/* Footer */}
            <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid #e0e0e0' }}>
                <Typography variant="body2" color="#666">
                    <strong>Note:</strong> This report is for informational purposes only and should not be considered as professional financial advice. Always consult with a financial advisor before making investment decisions.
         </Typography>
      </Box>
        </div>
    );
};

// Use the forwarded ref component
const ForwardedPropertyPDFReport = React.forwardRef(PropertyPDFReport);

// --- Main Component --- 
const PropertyDetailsPage: React.FC<PropertyDetailsPageProps> = ({
  properties,
  defaultSettings,
  handlePriceOverrideChange
}) => {
  const { propertyId } = useParams<{ propertyId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [customRentEstimate, setCustomRentEstimate] = useState<number | null>(null);
  const [isInPortfolio, setIsInPortfolio] = useState<boolean>(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [projectionTab, setProjectionTab] = useState(0); // 0 for Chart, 1 for Table
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [notes, setNotes] = useState('');
  const [yearsToProject, setYearsToProject] = useState(30);
  const [rentAppreciationRate, setRentAppreciationRate] = useState(3);
  const [propertyValueIncreaseRate, setPropertyValueIncreaseRate] = useState(3);
  const [effectivePrice, setEffectivePrice] = useState(0); // DEPRECATED? Let's track usage. Used by PDF currently.
  const [assumptionsDrawerOpen, setAssumptionsDrawerOpen] = useState(false);
  const [portfolioSnackbarOpen, setPortfolioSnackbarOpen] = useState(false);
  const [portfolioAction, setPortfolioAction] = useState<'added' | 'removed'>('added');
  const drawerWidth = '300px';
  
  // Create local copy of settings that can be modified per property
  const [localSettings, setLocalSettings] = useState<CashflowSettings>({...defaultSettings});
  const [savedMessage, setSavedMessage] = useState('');
  
  // Share URL state
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareableURL, setShareableURL] = useState('');
  const [shareURLCopied, setShareURLCopied] = useState(false);

  // NEW: State for editable price (raw input)
  const [editablePriceString, setEditablePriceString] = useState<string>(''); // Store as string for formatting
  // NEW: State for the price used in calculations
  const [currentAnalysisPrice, setCurrentAnalysisPrice] = useState<number | null>(null);
  // NEW: State for price saving feedback
  const [priceSaveStatus, setPriceSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Define the enhanced property type for shared properties
  type SharedProperty = Property & { 
    custom_rent?: number | null;
    notes?: string;
  };

  // Add sharedPropertyData state
  const [sharedPropertyData, setSharedPropertyData] = useState<SharedProperty | null>(null);

  // Add a useEffect to scroll to top on page load
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [propertyId]); // Re-run when propertyId changes (new property is loaded)
  
  // Add a useEffect to process URL parameters for shared links
  useEffect(() => {
    // Parse URL search parameters
    const searchParams = new URLSearchParams(location.search);
    const sharedDataParam = searchParams.get('data');
    const sharedSettingsParam = searchParams.get('settings');
    
    if (sharedDataParam && sharedSettingsParam) {
      try {
        // Decode the Base64-encoded property data
        const decodedPropertyData = atob(sharedDataParam);
        const propertyData = JSON.parse(decodedPropertyData) as SharedProperty;
        
        // Decode the Base64-encoded settings data
        const decodedSettingsData = atob(sharedSettingsParam);
        const settingsData = JSON.parse(decodedSettingsData);
        
        console.log("Found shared data in URL param:", propertyData);
        console.log("Found shared settings in URL param:", settingsData);
        
        // Store the shared property data
        setSharedPropertyData(propertyData);
        
        // Update property price and custom rent if available
        if (propertyData.price) {
          setCurrentAnalysisPrice(propertyData.price);
          setEditablePriceString(formatCurrency(propertyData.price));
        }
        
        if (propertyData.custom_rent) {
          setCustomRentEstimate(propertyData.custom_rent);
        }
        
        // Update notes if available
        if (propertyData.notes) {
          setNotes(propertyData.notes);
        }
        
        // Update settings
        if (settingsData) {
          // Make sure we're maintaining the CashflowSettings type
          setLocalSettings(prevSettings => ({
            ...prevSettings,
            interestRate: settingsData.interestRate ?? prevSettings.interestRate,
            loanTerm: settingsData.loanTerm ?? prevSettings.loanTerm,
            downPaymentPercent: settingsData.downPaymentPercent ?? prevSettings.downPaymentPercent,
            taxInsurancePercent: settingsData.taxInsurancePercent ?? prevSettings.taxInsurancePercent,
            vacancyPercent: settingsData.vacancyPercent ?? prevSettings.vacancyPercent,
            capexPercent: settingsData.capexPercent ?? prevSettings.capexPercent,
            propertyManagementPercent: settingsData.propertyManagementPercent ?? prevSettings.propertyManagementPercent,
            rehabAmount: settingsData.rehabAmount ?? prevSettings.rehabAmount
          }));
          
          // Update projection settings if available
          if (settingsData.yearsToProject) setYearsToProject(settingsData.yearsToProject);
          if (settingsData.rentAppreciationRate) setRentAppreciationRate(settingsData.rentAppreciationRate);
          if (settingsData.propertyValueIncreaseRate) setPropertyValueIncreaseRate(settingsData.propertyValueIncreaseRate);
        }
      } catch (error) {
        console.error("Error processing shared data from URL:", error);
      }
    }
  }, [location.search]); // Re-run when URL search params change

  // Find the selected property
  const property = useMemo(() => {
    // First try to find the property in the properties array
    const foundProperty = properties.find(p => p.property_id === propertyId);
    
    // If not found but we have shared property data with matching ID, use that
    if (!foundProperty && sharedPropertyData && sharedPropertyData.property_id === propertyId) {
      return sharedPropertyData;
    }
    
    // Otherwise, return the found property or the first property or the shared property or null
    return foundProperty || (propertyId ? sharedPropertyData : properties[0]) || null;
  }, [properties, propertyId, sharedPropertyData]);

  // PDF Hook - MOVED AFTER property definition
  const { toPDF, targetRef: pdfTargetRef } = usePDF({
    filename: property && property.address ? `${property.address.replace(/\s+/g, '_')}_CashflowCrunch_Report.pdf` : 'CashflowCrunch-Report.pdf',
  });

  // Initialize editablePriceString and currentAnalysisPrice when property loads or changes
  useEffect(() => {
    if (property) {
      const initialPrice = property.price;
      setCurrentAnalysisPrice(initialPrice);
      setEditablePriceString(formatCurrency(initialPrice)); // Format initially (removed options)
    }
  }, [property]);

  // Check if the property is in portfolio...
  useEffect(() => {
    if (!property) return;
    
    try {
      const portfolioStr = localStorage.getItem('rentToolFinder_portfolio');
      if (portfolioStr) {
        const portfolio = JSON.parse(portfolioStr);
        const portfolioEntry = portfolio[property.property_id];
        
        if (portfolioEntry) {
          setIsInPortfolio(true);
          
          // Load custom settings from portfolio
          if (portfolioEntry.portfolioAssumptions) {
            const savedAssumptions = portfolioEntry.portfolioAssumptions;
            
            // Update local settings with saved values
            setLocalSettings(prevSettings => ({
              ...prevSettings,
              interestRate: savedAssumptions.interestRate ?? defaultSettings.interestRate,
              loanTerm: savedAssumptions.loanTerm ?? defaultSettings.loanTerm,
              downPaymentPercent: savedAssumptions.downPaymentPercent ?? defaultSettings.downPaymentPercent,
              taxInsurancePercent: savedAssumptions.taxInsurancePercent ?? defaultSettings.taxInsurancePercent,
              vacancyPercent: savedAssumptions.vacancyPercent ?? defaultSettings.vacancyPercent,
              capexPercent: savedAssumptions.capexPercent ?? defaultSettings.capexPercent,
              propertyManagementPercent: savedAssumptions.propertyManagementPercent ?? defaultSettings.propertyManagementPercent,
              rehabAmount: savedAssumptions.rehabAmount ?? defaultSettings.rehabAmount
            }));
            
            // Load price from portfolio if different - This needs refinement based on handleSavePrice logic
            // const savedPrice = portfolioEntry.property.price;
            // if (savedPrice !== undefined && savedPrice !== currentAnalysisPrice) {
            //   setCurrentAnalysisPrice(savedPrice);
            //   setEditablePriceString(formatCurrency(savedPrice, { minimumFractionDigits: 0, maximumFractionDigits: 0 }));
            // }
            
            // Update other settings if they exist
            if (savedAssumptions.rentEstimate) setCustomRentEstimate(savedAssumptions.rentEstimate);
            if (savedAssumptions.yearsToProject) setYearsToProject(savedAssumptions.yearsToProject);
            if (savedAssumptions.rentAppreciationRate) setRentAppreciationRate(savedAssumptions.rentAppreciationRate);
            if (savedAssumptions.propertyValueIncreaseRate) setPropertyValueIncreaseRate(savedAssumptions.propertyValueIncreaseRate);
            
            // Load notes if any
            if (portfolioEntry.property.notes) {
              setNotes(portfolioEntry.property.notes);
            }
          }
        } else {
          setIsInPortfolio(false);
          // Reset to default settings if not in portfolio
          setLocalSettings({...defaultSettings});
          }
        }
      } catch (error) {
      console.error('Error checking portfolio status:', error);
    }
  }, [property, defaultSettings]);

  // Generic handler for slider changes
  const handleSettingChange = (settingKey: keyof CashflowSettings) => (_: Event | React.SyntheticEvent, newValue: number | number[]) => {
    const value = typeof newValue === 'number' ? newValue : newValue[0];
    setLocalSettings(prev => ({
      ...prev,
      [settingKey]: value
    }));
  };

  // NEW: Handler to save the edited price
  const handleSavePrice = useCallback(() => {
    if (!property) return;

    const parsedPrice = parseFloat(editablePriceString.replace(/[^\d.-]/g, ''));
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      // Handle invalid input if necessary (e.g., show error)
      console.error("Invalid price entered");
      return;
    }

    setPriceSaveStatus('saving');
    setCurrentAnalysisPrice(parsedPrice); // Update the price used for analysis

    // Update portfolio if the property is already saved
    if (isInPortfolio) {
      try {
        const portfolioStr = localStorage.getItem('rentToolFinder_portfolio');
        const portfolio = portfolioStr ? JSON.parse(portfolioStr) : {};
        if (portfolio[property.property_id]) {
          portfolio[property.property_id].property.price = parsedPrice; // Update the price in the snapshot
          localStorage.setItem('rentToolFinder_portfolio', JSON.stringify(portfolio));
        }
      } catch (error) {
        console.error('Error updating price in portfolio:', error);
        // Optionally revert price or show error to user
      }
    }

    // Provide feedback
    setTimeout(() => {
      setPriceSaveStatus('saved');
      setTimeout(() => setPriceSaveStatus('idle'), 2000); // Reset after 2 seconds
    }, 300); // Simulate save time

  }, [editablePriceString, property, isInPortfolio]);

  // Save current settings to portfolio
  const saveSettingsToPortfolio = () => {
    if (!property || currentAnalysisPrice === null) return; // Check currentAnalysisPrice

    try {
      // Get current portfolio
      const portfolioStr = localStorage.getItem('rentToolFinder_portfolio');
      const portfolio = portfolioStr ? JSON.parse(portfolioStr) : {};
      
      // Create or update portfolio entry
      const portfolioEntry: PortfolioEntry = portfolio[property.property_id] || {
        property: { ...property, notes },
        portfolioAssumptions: {},
        dateAdded: new Date().toISOString()
      };
      
      // Update property snapshot price when saving settings
      portfolioEntry.property.price = currentAnalysisPrice;
      
      // Update with current settings
      portfolioEntry.portfolioAssumptions = {
        interestRate: localSettings.interestRate,
        loanTerm: localSettings.loanTerm,
        downPaymentPercent: localSettings.downPaymentPercent,
        taxInsurancePercent: localSettings.taxInsurancePercent,
        vacancyPercent: localSettings.vacancyPercent,
        capexPercent: localSettings.capexPercent,
        propertyManagementPercent: localSettings.propertyManagementPercent,
        rehabAmount: localSettings.rehabAmount,
        rentEstimate: customRentEstimate ?? property.rent_estimate,
        yearsToProject,
        rentAppreciationRate,
        propertyValueIncreaseRate
      };
      
      // Update notes
      portfolioEntry.property.notes = notes;
      
      // Save back to portfolio
      portfolio[property.property_id] = portfolioEntry;
      // Log the object before stringifying to debug potential issues
      console.log('Attempting to save portfolio object:', JSON.stringify(portfolio, null, 2)); // Use pretty print for readability
      localStorage.setItem('rentToolFinder_portfolio', JSON.stringify(portfolio));
      
      // Show saved message
      setSavedMessage('Settings saved to this property!');
      setTimeout(() => setSavedMessage(''), 3000);
      
      // Update portfolio status
      setIsInPortfolio(true);
      } catch (error) {
      console.error('Error saving settings to portfolio:', error);
    }
  };

  // Portfolio handlers
  const togglePortfolio = () => {
    if (!property || currentAnalysisPrice === null) return; // Check currentAnalysisPrice

    try {
      const portfolioData = localStorage.getItem('rentToolFinder_portfolio');
      // Log the raw data fetched from localStorage
      console.log('Raw data from localStorage:', portfolioData);
      const portfolio: Record<string, PortfolioEntry> = portfolioData ? JSON.parse(portfolioData) : {};

      const propertyId = property.property_id;

      if (portfolio[propertyId]) {
        // Remove property from portfolio
        delete portfolio[propertyId];
        // Log the object before stringifying
        console.log('Attempting to save portfolio object (removal):', JSON.stringify(portfolio, null, 2)); 
        localStorage.setItem('rentToolFinder_portfolio', JSON.stringify(portfolio));
        setIsInPortfolio(false);
        setPortfolioAction('removed');
    } else {
        // Add property to portfolio
        // Create a clean, serializable snapshot of essential data
        const propertySnapshot: Property & { notes?: string } = {
          // --- Fields from Property type ---
          property_id: property.property_id,
          address: property.address,
          // city: property.city, // Does not exist
          // state: property.state, // Does not exist
          // zipcode: property.zipcode, // Does not exist
          latitude: property.latitude,
          longitude: property.longitude,
          price: currentAnalysisPrice, // USE currentAnalysisPrice
          // original_price: property.original_price, // Does not exist
          bedrooms: property.bedrooms, // Correct field name
          bathrooms: property.bathrooms, // Correct field name
          sqft: property.sqft,
          // lot_size: property.lot_size, // Does not exist
          // year_built: property.year_built, // Does not exist
          // property_type: property.property_type, // Does not exist
          // description: property.description, // Does not exist
          url: property.url, // Correct field name
          thumbnail: property.thumbnail, // Correct field name
          photo_url: property.photo_url, // Use this if available
          // mls_id: property.mls_id, // Does not exist
          // status: property.status, // Does not exist
          days_on_market: property.days_on_market,
          // broker_name: property.broker_name, // Does not exist
          rent_estimate: customRentEstimate ?? property.rent_estimate, // Use custom rent if set
          ratio: property.ratio, // Include ratio if needed for portfolio display
          rent_source: property.rent_source,
          notes: notes, // Include user notes
        };

        const portfolioEntry: PortfolioEntry = {
          property: propertySnapshot, // Use the clean snapshot
          portfolioAssumptions: { // Store the *current* settings used on this page
            interestRate: localSettings.interestRate,
            loanTerm: localSettings.loanTerm,
            downPaymentPercent: localSettings.downPaymentPercent,
            taxInsurancePercent: localSettings.taxInsurancePercent,
            vacancyPercent: localSettings.vacancyPercent,
            capexPercent: localSettings.capexPercent,
            propertyManagementPercent: localSettings.propertyManagementPercent,
            rehabAmount: localSettings.rehabAmount,
            rentEstimate: customRentEstimate ?? property.rent_estimate, // Redundant but explicit
            // Store long-term projection settings as well
            yearsToProject: yearsToProject,
            rentAppreciationRate: rentAppreciationRate,
            propertyValueIncreaseRate: propertyValueIncreaseRate,
          },
          dateAdded: new Date().toISOString()
        };

        portfolio[propertyId] = portfolioEntry;
        // Log the object before stringifying to debug potential issues
        console.log('Attempting to save portfolio object:', JSON.stringify(portfolio, null, 2)); // Use pretty print for readability
        localStorage.setItem('rentToolFinder_portfolio', JSON.stringify(portfolio));
        setIsInPortfolio(true);
        setPortfolioAction('added');
      }

      setPortfolioSnackbarOpen(true);
    } catch (error) {
      console.error('Error updating portfolio:', error);
    }
  };
  
  const handleCloseSnackbar = () => {
    setPortfolioSnackbarOpen(false);
  };

  // Calculate IRR function
  const calculateIRR = useCallback((initialInvestment: number, cashFlows: number[], finalEquity: number = 0): number => {
    // Add final equity to the last cash flow
    const allCashFlows = [...cashFlows];
    if (allCashFlows.length > 0) {
      allCashFlows[allCashFlows.length - 1] += finalEquity;
    }
    
    // Add initial investment as negative cash flow at year 0
    allCashFlows.unshift(-initialInvestment);
    
    // IRR calculation using Newton-Raphson method
    const maxIterations = 1000;
    const precision = 0.000001;
    
    let guess = 0.1; // Initial guess at 10% return
    
    // Guard against invalid inputs
    if (allCashFlows.length <= 1) return 0;
    if (allCashFlows[0] >= 0) return 0; // Initial investment must be negative
    
    for (let i = 0; i < maxIterations; i++) {
      let npv = 0;
      let derivativeNpv = 0;
      
      for (let j = 0; j < allCashFlows.length; j++) {
        const factor = Math.pow(1 + guess, j);
        npv += allCashFlows[j] / factor;
        if (j > 0) { // Skip the derivative calculation for the initial investment
          derivativeNpv -= j * allCashFlows[j] / (factor * (1 + guess));
        }
      }
      
      // Avoid division by zero
      if (Math.abs(derivativeNpv) < precision) break;
      
      const newGuess = guess - npv / derivativeNpv;
      
      // Check for convergence
      if (Math.abs(newGuess - guess) < precision) {
        guess = newGuess;
        break;
      }
      
      guess = newGuess;
      
      // Check if the result is diverging
      if (guess < -1) return 0; // Return 0 as IRR if calculation is not converging
    }
    
    // Convert to percentage
    return guess * 100;
  }, []);
  
  // Calculate cashflow from property and settings
  const cashflow = useMemo(() => {
    if (!property || currentAnalysisPrice === null) return null; // Use currentAnalysisPrice
    
    const propertyWithCustoms = {
      ...property,
      price: currentAnalysisPrice, // Use currentAnalysisPrice
      rent_estimate: customRentEstimate ?? property.rent_estimate
    };
    
    return calculateCashflowUtil(propertyWithCustoms, localSettings);
  }, [property, localSettings, customRentEstimate, currentAnalysisPrice]); // DEPEND ON currentAnalysisPrice
  
  // Update effective price (handled by separate useEffect now)
  // useEffect(() => { ... });
  
  // Generate long-term cashflow projections
  const generateLongTermCashflow = useCallback(() => {
    if (!property || !cashflow || currentAnalysisPrice === null) return []; // Use currentAnalysisPrice
    
    const result: YearlyProjection[] = [];
    // Use currentAnalysisPrice for calculations
    const priceToUse = currentAnalysisPrice; 
    const downPaymentAmount = priceToUse * (localSettings.downPaymentPercent / 100); // Recalculate DP based on price
    const loanAmount = priceToUse - downPaymentAmount;
    const monthlyRate = localSettings.interestRate / 100 / 12;
    const loanTermMonths = localSettings.loanTerm * 12;
    
    // Initialize lastYearEquity with the down payment amount
    let lastYearEquity = downPaymentAmount;
    
    for (let year = 1; year <= yearsToProject; year++) {
      // Calculate property value growth based on currentAnalysisPrice
      const propertyValue = priceToUse * Math.pow(1 + propertyValueIncreaseRate / 100, year);
      
      // Use custom rent estimate if available
      const monthlyRent = customRentEstimate ?? property.rent_estimate;
      const annualRent = monthlyRent * 12 * Math.pow(1 + rentAppreciationRate / 100, year);
      
      // Calculate remaining loan balance after 'year' years
      let remainingBalance = 0;
      if (loanAmount > 0) {
        if (monthlyRate === 0) {
          // For 0% interest loans, it's straight-line amortization
          const monthsPaid = Math.min(year * 12, loanTermMonths);
          remainingBalance = loanAmount * (1 - monthsPaid / loanTermMonths);
        } else {
          // For normal amortizing loans
          const monthsPaid = Math.min(year * 12, loanTermMonths);
          const monthsRemaining = loanTermMonths - monthsPaid;
          if (monthsRemaining <= 0) {
            remainingBalance = 0;
          } else {
            // Standard amortization formula
            const monthlyPayment = cashflow.monthlyMortgage;
            remainingBalance = (monthlyPayment / monthlyRate) * (1 - 1 / Math.pow(1 + monthlyRate, monthsRemaining));
          }
        }
      }
      
      // Ensure remaining balance doesn't go below zero
      remainingBalance = Math.max(0, remainingBalance);
      
      // Calculate equity
      const equity = propertyValue - remainingBalance;
      const equityGrowth = equity - lastYearEquity;
      lastYearEquity = equity;
      
      // Calculate expenses for the year (scaling with inflation for non-mortgage expenses)
      const yearlyMortgage = cashflow.monthlyMortgage * 12;
      const yearlyNonMortgageExpenses = 
        (cashflow.monthlyTaxInsurance + cashflow.monthlyVacancy + 
         cashflow.monthlyCapex + cashflow.monthlyPropertyManagement) * 12 * 
        Math.pow(1 + rentAppreciationRate / 100, year); // Assume expenses grow with rent
      
      const yearlyExpenses = yearlyMortgage + yearlyNonMortgageExpenses;
      const yearlyCashflow = annualRent - yearlyExpenses;
      
      // Calculate ROI metrics
      const roi = yearlyCashflow / cashflow.totalInitialInvestment * 100;
      const roiWithEquity = (yearlyCashflow + equityGrowth) / cashflow.totalInitialInvestment * 100;
      
      result.push({
        year,
        propertyValue,
        annualRent,
        yearlyExpenses,
        yearlyCashflow,
        equity,
        equityGrowth,
        roi,
        roiWithEquity
      });
    }
    
    return result;
  }, [property, cashflow, localSettings, yearsToProject, rentAppreciationRate, propertyValueIncreaseRate, customRentEstimate, currentAnalysisPrice]); // DEPEND ON currentAnalysisPrice
  
  // Generate shareable URL
  const generateShareableURL = useCallback(() => {
    if (!property || currentAnalysisPrice === null) return window.location.href; // Use currentAnalysisPrice
    
    // Fix: Include the property ID in the path
    const baseUrl = window.location.origin + "/#/property/" + property.property_id;    
    const searchParams = new URLSearchParams();
    
    // Use the SharedProperty type to ensure consistent typing
    const propertyData: SharedProperty = {
      ...property,
      price: currentAnalysisPrice, // Include currentAnalysisPrice
      custom_rent: customRentEstimate,
      notes: notes,
    };
    const encodedProperty = btoa(JSON.stringify(propertyData));
    searchParams.set('data', encodedProperty);
    
    const settingsData = {
      ...localSettings,
      yearsToProject,
      rentAppreciationRate,
      propertyValueIncreaseRate
    };
    const encodedSettings = btoa(JSON.stringify(settingsData));
    searchParams.set('settings', encodedSettings);
    
    return `${baseUrl}?${searchParams.toString()}`;
  }, [property, currentAnalysisPrice, customRentEstimate, notes, localSettings, yearsToProject, rentAppreciationRate, propertyValueIncreaseRate]); // DEPEND ON currentAnalysisPrice
  
  // Modal handlers
  const handleOpenPdfModal = () => setShowPdfModal(true);
  const handleClosePdfModal = () => setShowPdfModal(false);
  const handleOpenShareModal = () => {
    setShareableURL(generateShareableURL());
    setShareURLCopied(false);
    setShowShareModal(true);
  };
  const handleCloseShareModal = () => setShowShareModal(false);
  const handleCopyShareURL = () => {
    navigator.clipboard.writeText(shareableURL)
      .then(() => {
        setShareURLCopied(true);
        setTimeout(() => setShareURLCopied(false), 3000);
      })
      .catch(err => console.error('Failed to copy URL:', err));
  };
  const handleDownloadPDF = () => toPDF();
  
  // Use longTermData variable name correctly
  const longTermData = useMemo(() => generateLongTermCashflow(), [generateLongTermCashflow]);

  // Recalculate IRR in a useMemo - DEPEND ON currentAnalysisPrice
  const irrData = useMemo(() => {
    // Ensure cashflow (which depends on currentAnalysisPrice) is calculated first
    if (!cashflow || !longTermData || longTermData.length === 0 || currentAnalysisPrice === null) return {}; // Use currentAnalysisPrice
    const holdingPeriods = [1, 5, 10, 15, 30];
    const results: Record<number, number> = {};
    holdingPeriods.forEach(holdingPeriod => {
      const relevantCashflows = longTermData
          .filter(data => data.year <= holdingPeriod)
          .map(data => data.yearlyCashflow);
      const finalYearData = longTermData.find(data => data.year === holdingPeriod);
      const finalEquity = finalYearData ? finalYearData.equity : 0;
      // Use cashflow.totalInitialInvestment
      results[holdingPeriod] = calculateIRR(cashflow.totalInitialInvestment, relevantCashflows, finalEquity);
    });
    return results;
  }, [cashflow, longTermData, calculateIRR, currentAnalysisPrice]); // DEPEND ON currentAnalysisPrice

  // Drawer handlers
  const toggleDrawer = (open: boolean) => (
    event?: React.KeyboardEvent | React.MouseEvent,
  ) => {
    if (
      event && 
      event.type === 'keydown' &&
      ((event as React.KeyboardEvent).key === 'Tab' ||
        (event as React.KeyboardEvent).key === 'Shift')
    ) {
      return;
    }
    setAssumptionsDrawerOpen(open);
  };
  
  // Handler for closing drawer via backdrop/escape key
  const handleDrawerClose = () => {
    setAssumptionsDrawerOpen(false);
  };
  
  // If property not found
  if (!property) {
    return (
      <Container maxWidth="md" sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress sx={{ mb: 3 }} />
          <Typography variant="h5">Loading property details...</Typography>
      </Container>
    );
  }
  
  // --- Render --- 
  return (
    <>
      <CssBaseline />
      <AppBar position="sticky" elevation={0} sx={{ bgcolor: '#6366f1', color: 'white' }}>
        <Toolbar>
          <IconButton edge="start" color="inherit" aria-label="back" onClick={() => navigate(-1)} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <Box sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }} onClick={() => navigate('/')}>
            <HomeWorkIcon sx={{ mr: 1, color: 'white' }} />
            <Typography variant="h6" color="inherit" noWrap sx={{ flexGrow: 1 }}>
              CashflowCrunch
            </Typography>
              </Box>
          <Box sx={{ flexGrow: 1 }} />
          <IconButton color="inherit" onClick={handleOpenShareModal} sx={{ mr: 1 }}>
            <ShareIcon />
          </IconButton>
          <IconButton color="inherit" onClick={handleOpenPdfModal} sx={{ mr: 1 }}>
            <PdfIcon />
          </IconButton>
          <IconButton color="inherit" aria-label="Portfolio" onClick={() => navigate('/portfolio')} sx={{ mr: 1 }}>
            <BusinessCenterIcon />
          </IconButton>
        </Toolbar>
      </AppBar>
      
      {/* --- Assumptions Tab --- */}
      <Tooltip title="Adjust assumptions" placement="left">
            <div 
              className="assumptions-tab"
          onClick={() => setAssumptionsDrawerOpen(prevState => !prevState)} 
              style={{
                position: 'fixed',
            right: assumptionsDrawerOpen ? `var(--drawer-width, ${drawerWidth})` : '0px',
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
            boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
                transition: 'right 225ms cubic-bezier(0, 0, 0.2, 1) 0ms'
          }}>
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
      </Tooltip>
            
            {/* Assumptions Drawer */}
            <Drawer
              anchor="right"
        open={assumptionsDrawerOpen}
        onClose={handleDrawerClose}
        className="assumptions-drawer"
              sx={{
                '& .MuiDrawer-paper': {
            width: drawerWidth,
            maxWidth: '80vw',
                  boxSizing: 'border-box',
                  padding: 3,
                  borderTopLeftRadius: 0,
                  borderBottomLeftRadius: 0,
            overflowY: 'auto',
                },
                '& .MuiBackdrop-root': {
                  backgroundColor: 'rgba(0, 0, 0, 0.2)'
                }
              }}
              transitionDuration={225}
              SlideProps={{
                easing: {
                  enter: 'cubic-bezier(0, 0, 0.2, 1)',
                  exit: 'cubic-bezier(0.4, 0, 0.6, 1)'
                }
              }}
            >
        {/* Header with close button */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" fontWeight="medium">
            Analysis Assumptions
              </Typography>
          <IconButton onClick={() => setAssumptionsDrawerOpen(false)} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
        
        {/* Saved message */}
        {savedMessage && (
          <Box 
            sx={{ 
              bgcolor: 'success.light', 
              color: 'success.contrastText', 
              p: 1, 
              borderRadius: 1,
              mb: 2,
              display: 'flex',
              justifyContent: 'center'
            }}
          >
            <Typography variant="body2">{savedMessage}</Typography>
          </Box>
        )}
        
        {/* Mortgage Assumptions */}
        <Typography variant="subtitle1" fontWeight="medium" sx={{ mb: 2 }}>
          Mortgage Assumptions
        </Typography>
        
        <Box sx={{ mb: 3 }}>
                <Typography variant="body2" gutterBottom>
            Interest Rate: {localSettings.interestRate}%
                </Typography>
          <Slider
            value={localSettings.interestRate}
            onChange={handleSettingChange('interestRate')}
            min={2}
            max={12}
            step={0.25}
            valueLabelDisplay="auto"
            valueLabelFormat={(value) => `${value}%`}
            sx={{ color: '#4f46e5' }}
          />
              </Box>
              
        <Box sx={{ mb: 3 }}>
                <Typography variant="body2" gutterBottom>
            Loan Term: {localSettings.loanTerm} years
                </Typography>
          <Slider
            value={localSettings.loanTerm}
            onChange={handleSettingChange('loanTerm')}
            min={5}
            max={40}
            step={5}
            valueLabelDisplay="auto"
            valueLabelFormat={(value) => `${value} yrs`}
            sx={{ color: '#4f46e5' }}
          />
              </Box>
              
        <Box sx={{ mb: 3 }}>
                <Typography variant="body2" gutterBottom>
            Down Payment: {localSettings.downPaymentPercent}%
                </Typography>
          <Slider
            value={localSettings.downPaymentPercent}
            onChange={handleSettingChange('downPaymentPercent')}
            min={0}
            max={100}
            step={5}
            valueLabelDisplay="auto"
            valueLabelFormat={(value) => `${value}%`}
            sx={{ color: '#4f46e5' }}
          />
              </Box>
              
        <Box sx={{ mb: 3 }}>
                <Typography variant="body2" gutterBottom>
            Rehab Amount: {formatCurrency(localSettings.rehabAmount)}
                </Typography>
                <Slider 
            value={localSettings.rehabAmount}
                  onChange={handleSettingChange('rehabAmount')} 
                  min={0} 
            max={50000}
            step={1000}
                  valueLabelDisplay="auto" 
            valueLabelFormat={(value) => formatCurrency(value as number)}
                  sx={{ color: '#4f46e5' }} 
                />
              </Box>
        
        <Typography variant="subtitle1" fontWeight="medium" sx={{ mt: 4, mb: 2 }}>
          Expense Assumptions
        </Typography>
        
        <Box sx={{ mb: 3 }}>
                <Typography variant="body2" gutterBottom>
            Property Tax & Insurance: {localSettings.taxInsurancePercent}%
                </Typography>
          <Slider
            value={localSettings.taxInsurancePercent}
            onChange={handleSettingChange('taxInsurancePercent')}
            min={0}
            max={5}
            step={0.1}
            valueLabelDisplay="auto"
            valueLabelFormat={(value) => `${value}%`}
            sx={{ color: '#4f46e5' }}
          />
              </Box>
              
        <Box sx={{ mb: 3 }}>
                <Typography variant="body2" gutterBottom>
            Vacancy: {localSettings.vacancyPercent}%
                </Typography>
          <Slider
            value={localSettings.vacancyPercent}
            onChange={handleSettingChange('vacancyPercent')}
            min={0}
            max={15}
            step={1}
            valueLabelDisplay="auto"
            valueLabelFormat={(value) => `${value}%`}
            sx={{ color: '#4f46e5' }}
          />
              </Box>
              
        <Box sx={{ mb: 3 }}>
                <Typography variant="body2" gutterBottom>
            CapEx: {localSettings.capexPercent}%
                </Typography>
          <Slider
            value={localSettings.capexPercent}
            onChange={handleSettingChange('capexPercent')}
            min={0}
            max={15}
            step={1}
            valueLabelDisplay="auto"
            valueLabelFormat={(value) => `${value}%`}
            sx={{ color: '#4f46e5' }}
          />
              </Box>
              
        <Box sx={{ mb: 3 }}>
                <Typography variant="body2" gutterBottom>
            Property Management: {localSettings.propertyManagementPercent}%
                </Typography>
          <Slider
            value={localSettings.propertyManagementPercent}
            onChange={handleSettingChange('propertyManagementPercent')}
            min={0}
            max={20}
            step={1}
            valueLabelDisplay="auto"
            valueLabelFormat={(value) => `${value}%`}
            sx={{ color: '#4f46e5' }}
          />
              </Box>
              
        <Divider sx={{ my: 2 }} />
        
        <Typography variant="subtitle1" fontWeight="medium" sx={{ mt: 4, mb: 2 }}>
          Property-Specific Settings
              </Typography>
              
        <Box sx={{ mb: 3 }}>
                <Typography variant="body2" gutterBottom>
            Custom Rent Estimate: {formatCurrency(customRentEstimate ?? property.rent_estimate)}
          </Typography>
          <Slider
            value={customRentEstimate ?? property.rent_estimate}
            onChange={(_, value) => setCustomRentEstimate(value as number)}
            min={Math.max(property.rent_estimate * 0.5, 100)}
            max={property.rent_estimate * 2}
            step={50}
            valueLabelDisplay="auto"
            valueLabelFormat={(value) => formatCurrency(value as number)}
            sx={{ color: '#4f46e5' }}
          />
        </Box>
        
        <Typography variant="subtitle1" fontWeight="medium" sx={{ mt: 4, mb: 2 }}>
          Projection Settings
        </Typography>
        
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" gutterBottom>
            Long-Term Projection Years: {yearsToProject}
          </Typography>
          <Slider
            value={yearsToProject}
            onChange={(_, value) => setYearsToProject(value as number)}
            min={1}
            max={30}
            step={1}
            valueLabelDisplay="auto"
            sx={{ color: '#4f46e5' }}
          />
        </Box>
        
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" gutterBottom>
            Annual Rent Appreciation: {rentAppreciationRate}%
                </Typography>
                <Slider 
                  value={rentAppreciationRate} 
            onChange={(_, value) => setRentAppreciationRate(value as number)}
                  min={0} 
            max={5}
            step={0.5}
                  valueLabelDisplay="auto" 
                  valueLabelFormat={(value) => `${value}%`}
                  sx={{ color: '#4f46e5' }}
                />
              </Box>
              
        <Box sx={{ mb: 3 }}>
                <Typography variant="body2" gutterBottom>
            Annual Property Value Growth: {propertyValueIncreaseRate}%
                </Typography>
                <Slider 
                  value={propertyValueIncreaseRate} 
            onChange={(_, value) => setPropertyValueIncreaseRate(value as number)}
                  min={0} 
            max={5}
            step={0.5}
                  valueLabelDisplay="auto" 
                  valueLabelFormat={(value) => `${value}%`}
                  sx={{ color: '#4f46e5' }}
                />
              </Box>
        
        <Button 
          variant="contained" 
          color="primary" 
                fullWidth
          onClick={saveSettingsToPortfolio}
                sx={{
            mt: 2,
            height: '48px',
            fontWeight: 'bold',
            boxShadow: 2,
            bgcolor: '#4f46e5',
            '&:hover': {
              bgcolor: '#4338ca',
            }
          }}
        >
          Save Settings to Property
        </Button>
            </Drawer>
      
      <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 } }}>
        {/* Property Header */}
        <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: 2, border: '1px solid #e0e0e0' }}>
          <Typography variant="h4" gutterBottom>{property.address}</Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant="body1">
                {property.bedrooms} Beds • {property.bathrooms} Baths • {property.sqft.toLocaleString()} sqft
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                {/* Price Display - Make it an Input */}
            <TextField
                  label="Purchase Price"
                  value={editablePriceString} // Controlled by editablePriceString
                  onChange={(e) => {
                    const val = e.target.value;
                    // Basic filtering to allow only numbers and currency symbols for display
                    // Formatting will happen more robustly on blur or save if needed
                    setEditablePriceString(val);
                    // Maybe add validation/formatting on blur later
                  }}
                  onBlur={(e) => {
                    // Reformat on blur
                    const parsed = parseFloat(e.target.value.replace(/[^\d.-]/g, ''));
                    if (!isNaN(parsed)) {
                      setEditablePriceString(formatCurrency(parsed)); // Removed options
                    } else {
                       // Optionally revert to last known good value if invalid
                       setEditablePriceString(formatCurrency(currentAnalysisPrice ?? 0)); // Removed options
                    }
                  }}
                  variant="outlined" // Change variant
                  size="small" // Add size prop
                sx={{
                    mt: 1,
                    '& .MuiInputBase-input': {
                      fontSize: '1.5rem',
                      fontWeight: 'medium',
                      color: 'primary.main'
                    },
                    // Make room for save button
                    // width: 'calc(100% - 50px)', // REMOVE explicit width
                    // mr: 1 // REMOVE margin right
                  }}
                />
                {/* Save Price Button */}
                <Tooltip title="Save this price to update analysis and portfolio entry" arrow>
                  <span> {/* Span needed for disabled button tooltip */}
                  <IconButton
                    onClick={handleSavePrice}
                    color="primary"
                    size="small"
                    disabled={priceSaveStatus !== 'idle' || currentAnalysisPrice === parseFloat(editablePriceString.replace(/[^\d.-]/g, ''))} // Disable if saving or price hasn't changed
                    sx={{ mt: 2.5 }} // Align with text field baseline
                  >
                    {priceSaveStatus === 'saved' ? <CheckIcon fontSize="inherit" sx={{ color: 'success.main' }} /> : <SaveIcon fontSize="inherit" />}
                  </IconButton>
                  </span>
                </Tooltip>

                {/* Crunch Score - DEPENDS ON currentAnalysisPrice via cashflow */}
                {cashflow && (
                  <Tooltip title="Overall investment potential (0-100) based on cash flow, rent/price ratio, and your assumptions (higher is better)" arrow>
                    <Box>
                      {(() => {
                        // Recalculate score based on currentAnalysisPrice
                        const propertyForScore = { ...property, price: currentAnalysisPrice ?? property.price };
                        const score = calculateCrunchScore(propertyForScore, localSettings, cashflow);
                        const scoreClass = score >= 65 ? 'good' : (score >= 45 ? 'medium' : 'poor');
                        return (
                          <Chip
                            label={`CrunchScore: ${score}`}
                            size="small"
                            sx={{
                              fontWeight: 'bold',
                              bgcolor: scoreClass === 'good' ? '#4caf50' : (scoreClass === 'medium' ? '#ff9800' : '#f44336'),
                              color: 'white',
                              '& .MuiChip-label': {
                                px: 1
                              }
                            }}
                          />
                        );
                      })()}
          </Box>
                  </Tooltip>
                )}
        </Box>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }} sx={{ textAlign: { xs: 'left', sm: 'right' } }}>
              <Button
                variant="contained"
                color="primary"
                startIcon={<BusinessCenterIcon />}
                onClick={togglePortfolio}
                sx={{ mt: { xs: 1, sm: 0 } }}
              >
                {isInPortfolio ? 'In Portfolio' : 'Add to Portfolio'}
              </Button>
            </Grid>
          </Grid>
        </Paper>
        
        {/* Grid layout for gallery and map */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          {/* Left column - Property Image Gallery */}
          <Grid size={{ xs: 12, md: 6, lg: 7 }}>
            <Box sx={{ 
              height: { xs: 'auto', md: 500 }, 
              display: 'flex', 
              flexDirection: 'column',
              overflow: 'hidden'
            }}>
              {/* Use propertyId from URL as fallback for zpid */}
              {(property.zpid || propertyId) ? (
                <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <Typography variant="h5" gutterBottom>Property Images</Typography>
                  <Box sx={{ flexGrow: 1, overflow: 'hidden', maxHeight: { md: 450 } }}>
                    <PropertyImageGallery 
                      zpid={String(property.zpid || propertyId)} 
                      fallbackImage={property.thumbnail || 'https://via.placeholder.com/800x500?text=No+Property+Image+Available'} 
                    />
                  </Box>
                </Box>
              ) : (
                <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <Typography variant="h5" gutterBottom>Property Image</Typography>
                  <Box sx={{ 
                    flexGrow: 1, 
                    backgroundImage: `url(${property.thumbnail || 'https://via.placeholder.com/800x500?text=No+Property+Image+Available'})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    borderRadius: 1,
                    minHeight: { xs: 300, md: 450 }
                  }} />
                </Box>
              )}
            </Box>
          </Grid>
          
          {/* Right column - Property Map */}
          <Grid size={{ xs: 12, md: 6, lg: 5 }}>
            <Box sx={{ 
              height: { xs: 'auto', md: 500 },
              display: 'flex',
              flexDirection: 'column'
            }}>
              <Typography variant="h5" gutterBottom>Property Location</Typography>
              <Box sx={{ 
                flexGrow: 1, 
                height: { xs: 300, md: 450 }, 
                borderRadius: 1, 
                overflow: 'hidden'
              }}>
                <PropertyMap 
                  address={property.address} 
                  lat={property.latitude || null} 
                  lng={property.longitude || null} 
                />
              </Box>
            </Box>
          </Grid>
        </Grid>

        {/* Sankey Chart for Cashflow Visualization */}
        {cashflow && (
          <Box sx={{ my: 4 }}>
            <Typography variant="h5" gutterBottom>Cashflow Visualization</Typography>
            <Paper sx={{ p: 2, borderRadius: 2, minHeight: '300px' }}>
              <CashflowSankeyChart
                data={{
                  rentalIncome: customRentEstimate ?? property.rent_estimate,
                  mortgage: cashflow.monthlyMortgage,
                  taxInsurance: cashflow.monthlyTaxInsurance,
                  vacancy: cashflow.monthlyVacancy,
                  capex: cashflow.monthlyCapex,
                  propertyManagement: cashflow.monthlyPropertyManagement,
                  monthlyCashflow: cashflow.monthlyCashflow
                }}
                formatCurrency={formatCurrency}
              />
          </Paper>
              </Box>
        )}
        
        {/* Cashflow Breakdown */}
        <Grid container spacing={3} sx={{ mt: 1 }}>
          <Grid size={{ xs: 12, md: 7 }}>
            <Typography variant="h5" gutterBottom>Monthly Cashflow Breakdown</Typography>
            <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Category</TableCell>
                    <TableCell align="right">Monthly</TableCell>
                    <TableCell align="right">Annual</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow>
                    <TableCell>Rental Income</TableCell>
                    <TableCell align="right">{formatCurrency(customRentEstimate ?? property.rent_estimate)}</TableCell>
                    <TableCell align="right">{formatCurrency((customRentEstimate ?? property.rent_estimate) * 12)}</TableCell>
                  </TableRow>
                  {cashflow && (
                    <>
                      <TableRow>
                        <TableCell>Mortgage (P&I)</TableCell>
                        <TableCell align="right">-{formatCurrency(cashflow.monthlyMortgage)}</TableCell>
                        <TableCell align="right">-{formatCurrency(cashflow.monthlyMortgage * 12)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Property Tax & Insurance ({localSettings.taxInsurancePercent}%)</TableCell>
                        <TableCell align="right">-{formatCurrency(cashflow.monthlyTaxInsurance)}</TableCell>
                        <TableCell align="right">-{formatCurrency(cashflow.monthlyTaxInsurance * 12)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Vacancy ({localSettings.vacancyPercent}%)</TableCell>
                        <TableCell align="right">-{formatCurrency(cashflow.monthlyVacancy)}</TableCell>
                        <TableCell align="right">-{formatCurrency(cashflow.monthlyVacancy * 12)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Capital Expenditures ({localSettings.capexPercent}%)</TableCell>
                        <TableCell align="right">-{formatCurrency(cashflow.monthlyCapex)}</TableCell>
                        <TableCell align="right">-{formatCurrency(cashflow.monthlyCapex * 12)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Property Management ({localSettings.propertyManagementPercent}%)</TableCell>
                        <TableCell align="right">-{formatCurrency(cashflow.monthlyPropertyManagement)}</TableCell>
                        <TableCell align="right">-{formatCurrency(cashflow.monthlyPropertyManagement * 12)}</TableCell>
                      </TableRow>
                      <TableRow sx={{ '& td': { fontWeight: 'bold', borderTop: '2px solid #e0e0e0' } }}>
                        <TableCell>Total Cashflow</TableCell>
                        <TableCell 
                          align="right"
                          sx={{ 
                            color: cashflow.monthlyCashflow >= 0 ? 'success.main' : 'error.main',
                            fontSize: '1.1rem'
                          }}
                        >
                          {formatCurrency(cashflow.monthlyCashflow)}
                        </TableCell>
                        <TableCell 
                          align="right"
                          sx={{ 
                            color: cashflow.monthlyCashflow >= 0 ? 'success.main' : 'error.main',
                            fontSize: '1.1rem'
                          }}
                        >
                          {formatCurrency(cashflow.monthlyCashflow * 12)}
                        </TableCell>
                      </TableRow>
                      <TableRow sx={{ '& td': { fontWeight: 'bold' } }}>
                        <TableCell>Cash on Cash Return</TableCell>
                        <TableCell 
                          align="right"
                          sx={{ 
                            color: cashflow.cashOnCashReturn >= 0 ? 'success.main' : 'error.main',
                            fontSize: '1.1rem'
                          }}
                        >
                          {formatPercent(cashflow.cashOnCashReturn)}
                        </TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    </>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Grid>
          
          <Grid size={{ xs: 12, md: 5 }}>
            <Typography variant="h5" gutterBottom>Initial Investment</Typography>
            <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
              <Table>
                <TableBody>
                  <TableRow>
                    <TableCell>Purchase Price</TableCell>
                    {/* Display currentAnalysisPrice */}
                    <TableCell align="right">{currentAnalysisPrice !== null ? formatCurrency(currentAnalysisPrice) : 'Loading...'}</TableCell>
                  </TableRow>
                  {cashflow && (
                    <>
                      {/* DP, Closing Costs, Rehab, Total - these depend on cashflow state variable */}
                      <TableRow><TableCell>Down Payment ({localSettings.downPaymentPercent}%)</TableCell><TableCell align="right">{formatCurrency(cashflow.downPaymentAmount)}</TableCell></TableRow>
                      <TableRow><TableCell>Closing Costs (3%)</TableCell><TableCell align="right">{formatCurrency(cashflow.closingCosts)}</TableCell></TableRow>
                      <TableRow><TableCell>Rehab Budget</TableCell><TableCell align="right">{formatCurrency(localSettings.rehabAmount)}</TableCell></TableRow>
                      <TableRow sx={{ '& td': { fontWeight: 'bold', borderTop: '2px solid #e0e0e0' } }}><TableCell sx={{ fontWeight: 'bold' }}>Total Estimated Investment</TableCell><TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(cashflow.totalInitialInvestment)}</TableCell></TableRow>
                    </>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            
            <Typography variant="h5" gutterBottom sx={{ mt: 3 }}>Financing</Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableBody>
                  <TableRow>
                    <TableCell>Loan Amount</TableCell>
                    <TableCell align="right">{formatCurrency(property.price * (1 - defaultSettings.downPaymentPercent / 100))}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Interest Rate</TableCell>
                    <TableCell align="right">{formatPercent(defaultSettings.interestRate)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Loan Term</TableCell>
                    <TableCell align="right">{defaultSettings.loanTerm} years</TableCell>
                  </TableRow>
                  {cashflow && (
                    <TableRow>
                      <TableCell>Monthly Principal & Interest</TableCell>
                      <TableCell align="right">{formatCurrency(cashflow.monthlyMortgage)}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Grid>
        </Grid>
        
        {/* IRR Summary Panel - Reference irrData */}
        <Box sx={{ mt: 3, p: 2, bgcolor: '#f8f9fa', borderRadius: 2, border: '1px solid #e0e0e0' }}>
           <Typography variant="h6" gutterBottom>Projected IRR (Internal Rate of Return)</Typography>
           <Grid container spacing={1}>
               {Object.entries(irrData).map(([period, irrValue]) => (
                   <Grid size={{ xs: 6, sm: 4, md: 2.4 }} key={period}>
                       <Typography variant="body2" align="center">{period} Year Hold</Typography>
                       <Typography variant="h6" align="center" fontWeight="bold">{formatPercent(irrValue)}</Typography>
                   </Grid>
               ))}
            </Grid>
        </Box>

        {/* Long-term Projections */}
        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>Long-term Projections</Typography>
          
          <Paper sx={{ p: 2, mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 2 }}>
              <Typography variant="body1" sx={{ mr: 2 }}>
                Projection Period: <strong>{yearsToProject} years</strong>
          </Typography>
          
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Typography variant="body2" sx={{ mr: 1 }}>
                  Rent Appreciation:
          </Typography>
                <Box sx={{ width: 150 }}>
                  <Slider
                    value={rentAppreciationRate}
                    min={0}
                    max={5}
                    step={0.5}
                    onChange={(_, value) => setRentAppreciationRate(value as number)}
                    valueLabelDisplay="auto"
                    valueLabelFormat={(value) => `${value}%`}
                  />
                </Box>
              </Box>
              
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Typography variant="body2" sx={{ mr: 1 }}>
                  Property Value Growth:
                </Typography>
                <Box sx={{ width: 150 }}>
                  <Slider
                    value={propertyValueIncreaseRate}
                    min={0}
                    max={5}
                    step={0.5}
                    onChange={(_, value) => setPropertyValueIncreaseRate(value as number)}
                    valueLabelDisplay="auto"
                    valueLabelFormat={(value) => `${value}%`}
                  />
                </Box>
              </Box>
            </Box>
            
            {/* Render the SimpleChart component */}
            {longTermData.length > 0 && (
              <SimpleChart
                data={{
                  years: longTermData.map(data => data.year),
                  propertyValues: longTermData.map(data => data.propertyValue),
                  equity: longTermData.map(data => data.equity),
                  cashflow: longTermData.map(data => data.yearlyCashflow)
                }}
                height={400}
              />
            )}
            
            {/* Projection Tabs */}
            <Box sx={{ mt: 3, borderBottom: 1, borderColor: 'divider' }}>
              <Tabs 
                value={projectionTab} 
                onChange={(_, newValue) => setProjectionTab(newValue)}
                aria-label="projection tabs"
              >
                <Tab label="Chart" />
                <Tab label="Table" />
              </Tabs>
            </Box>
            
            {/* Projection Table (only shown when table tab is selected) */}
            {projectionTab === 1 && (
              <TableContainer component={Paper} variant="outlined" sx={{ mt: 2, maxHeight: 500, overflow: 'auto' }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow sx={{ backgroundColor: 'primary.light' }}>
                      <TableCell sx={{ fontWeight: 'bold' }}>Year</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Property Value</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Annual Rent</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Annual Expenses</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Annual Cashflow</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Equity</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Equity Growth</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Cash on Cash ROI</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Total ROI (w/ Equity)</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Cumulative Cashflow</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {longTermData.map((yearData, index) => {
                      // Calculate annual expenses
                      const annualExpenses = yearData.annualRent - yearData.yearlyCashflow;
                      
                      // Calculate equity growth if possible
                      const equityGrowth = index > 0 
                        ? yearData.equity - longTermData[index-1].equity 
                        : yearData.equity - (cashflow?.downPaymentAmount || 0);
                        
                      // Calculate cumulative cashflow
                      const cumulativeCashflow = longTermData
                        .slice(0, index + 1)
                        .reduce((sum, data) => sum + data.yearlyCashflow, 0);
              
              return (
                        <TableRow 
                          key={yearData.year}
                  sx={{ 
                            '&:nth-of-type(odd)': { backgroundColor: 'rgba(0, 0, 0, 0.02)' },
                            '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)' }
                          }}
                        >
                          <TableCell><strong>{yearData.year}</strong></TableCell>
                          <TableCell align="right">{formatCurrency(yearData.propertyValue)}</TableCell>
                          <TableCell align="right">{formatCurrency(yearData.annualRent)}</TableCell>
                          <TableCell align="right">{formatCurrency(annualExpenses)}</TableCell>
                          <TableCell align="right" sx={{ color: yearData.yearlyCashflow >= 0 ? 'success.main' : 'error.main' }}>
                            {formatCurrency(yearData.yearlyCashflow)}
                          </TableCell>
                          <TableCell align="right">{formatCurrency(yearData.equity)}</TableCell>
                          <TableCell align="right">{formatCurrency(equityGrowth)}</TableCell>
                          <TableCell align="right">{formatPercent(yearData.roi)}</TableCell>
                          <TableCell align="right">{formatPercent(yearData.roiWithEquity)}</TableCell>
                          <TableCell align="right" sx={{ color: cumulativeCashflow >= 0 ? 'success.main' : 'error.main' }}>
                            {formatCurrency(cumulativeCashflow)}
                          </TableCell>
                        </TableRow>
              );
            })}
                    
                    {/* Summary row */}
                    {longTermData.length > 0 && (
                      <TableRow sx={{ backgroundColor: 'primary.light' }}>
                        <TableCell colSpan={4} sx={{ fontWeight: 'bold' }}>
                          {yearsToProject} Year Summary
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                          {formatCurrency(longTermData.reduce((sum, data) => sum + data.yearlyCashflow, 0))}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                          {formatCurrency(longTermData[longTermData.length - 1]?.equity || 0)}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                          {formatCurrency(
                            (longTermData[longTermData.length - 1]?.equity || 0) - (cashflow?.downPaymentAmount || 0)
                          )}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }} colSpan={3}>
                          Total Return: {formatPercent(
                            ((longTermData.reduce((sum, data) => sum + data.yearlyCashflow, 0) + 
                            (longTermData[longTermData.length - 1]?.equity || 0) - (cashflow?.downPaymentAmount || 0)) /
                            (cashflow?.totalInitialInvestment || 1)) * 100
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                
                <Box sx={{ p: 2, backgroundColor: 'rgba(0, 0, 0, 0.02)' }}>
                  <Typography variant="caption" color="text.secondary">
                    <strong>Note:</strong> These projections assume consistent rent appreciation of {rentAppreciationRate}% and 
                    property value growth of {propertyValueIncreaseRate}% annually. Actual results may vary based on market conditions.
            </Typography>
          </Box>
              </TableContainer>
            )}
          </Paper>
        </Box>
        
        {/* Notes Section */}
        <Paper sx={{ p: 3, mt: 3 }}>
          <Typography variant="h5" gutterBottom>Property Notes</Typography>
          <TextField
            label="Your notes about this property"
            multiline
            rows={4}
            variant="outlined"
        fullWidth
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add your thoughts, observations, or questions about this property..."
          />
        </Paper>
      </Container>

      {/* Portfolio Snackbar */}
      <Snackbar
        open={portfolioSnackbarOpen}
        autoHideDuration={3000}
        onClose={handleCloseSnackbar}
        message={portfolioAction === 'added' ? 'Property added to portfolio' : 'Property removed from portfolio'}
      />

      {/* PDF Modal - Use Forwarded component and correct ref */}
      <Dialog open={showPdfModal} onClose={handleClosePdfModal} maxWidth="md" fullWidth>
        <DialogTitle>PDF Report Preview</DialogTitle>
        <DialogContent dividers>
            {property && cashflow && currentAnalysisPrice !== null && (
            <ForwardedPropertyPDFReport 
                ref={pdfTargetRef} // Pass the ref here
                property={property}
                cashflow={cashflow}
                settings={defaultSettings} 
                customRentEstimate={customRentEstimate}
                notes={notes}
                generateShareableURL={generateShareableURL}
                generateLongTermCashflow={generateLongTermCashflow}
                calculateIRR={calculateIRR} 
                yearsToProject={yearsToProject}
                rentAppreciationRate={rentAppreciationRate}
                propertyValueIncreaseRate={propertyValueIncreaseRate}
                effectivePrice={currentAnalysisPrice} // Pass currentAnalysisPrice to PDF
              />
            )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClosePdfModal}>Close</Button>
          <Button onClick={handleDownloadPDF} variant="contained" startIcon={<PdfIcon />}>Download PDF</Button>
        </DialogActions>
      </Dialog>

      {/* Share Modal */}
      <Dialog open={showShareModal} onClose={handleCloseShareModal} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center">
            <ShareIcon sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6">Share Property Analysis</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, textAlign: 'center' }}>
              Share this link to show this property with your current analysis assumptions and notes.
            </Typography>
            
            <Box sx={{ 
              display: 'flex', 
              width: '100%', 
              mb: 3, 
              alignItems: 'center', 
              bgcolor: 'grey.100', 
              p: 1, 
              borderRadius: 1 
            }}>
              <Box sx={{ flexGrow: 1, overflow: 'hidden', mr: 1 }}>
                <Typography variant="body2" noWrap>
                  {shareableURL}
                </Typography>
              </Box>
          <Button 
                startIcon={<ContentCopyIcon />} 
                onClick={handleCopyShareURL} 
            variant="contained" 
                color={shareURLCopied ? "success" : "primary"}
                size="small"
          >
                {shareURLCopied ? "Copied!" : "Copy"}
          </Button>
            </Box>
            
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Scan QR Code
            </Typography>
            <Box sx={{ p: 2, bgcolor: 'white', borderRadius: 1, border: '1px solid #eee' }}>
              <QRCodeSVG value={shareableURL} size={150} />
            </Box>
          </Box>
          
          <Divider sx={{ my: 2 }} />
          
          <Typography variant="subtitle2" color="text.secondary">
            This analysis includes:
          </Typography>
          <Box component="ul" sx={{ pl: 2 }}>
            <Typography variant="body2" component="li">
              {/* Reference currentAnalysisPrice here too if desired, or keep original */}
              Property details with analysis price of {property && currentAnalysisPrice !== null ? formatCurrency(currentAnalysisPrice) : '...'}
            </Typography>
            <Typography variant="body2" component="li">
              Custom rent estimate: {formatCurrency(customRentEstimate ?? (property?.rent_estimate || 0))}
            </Typography>
            <Typography variant="body2" component="li">
              Your financing and expense assumptions
            </Typography>
            <Typography variant="body2" component="li">
              {notes ? "Your property notes" : "No notes added"}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseShareModal}>Close</Button>
        </DialogActions>
      </Dialog>
    </> // Close the main fragment
  ); // Close the return statement
}; // Close the component function

export default PropertyDetailsPage; 