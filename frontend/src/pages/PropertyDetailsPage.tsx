import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate, useLocation, Link as RouterLink } from 'react-router-dom';
import {
  Typography, Container, Box, CircularProgress, AppBar, Toolbar, 
  Button, Paper, Divider, IconButton, TextField, Alert, Tooltip, 
  CssBaseline, Grid, InputAdornment, Slider, Link as MuiLink,
  Tabs, Tab, useMediaQuery, useTheme, Card, CardContent, Dialog, DialogContent, DialogTitle, DialogActions,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Snackbar
} from '@mui/material';
import { styled } from '@mui/material/styles';
import {
  BarChart as BarChartIcon, Home as HomeIcon, ArrowBack as ArrowBackIcon,
  Share as ShareIcon, Link as LinkIcon,
  Info as InfoIcon, Edit as EditIcon, 
  Email as EmailIcon, ExpandMore as ExpandMoreIcon, Bookmark as BookmarkIcon, BookmarkBorder as BookmarkBorderIcon,
  PictureAsPdf as PdfIcon, Tune as TuneIcon // Add TuneIcon import
} from '@mui/icons-material';
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip, Legend, Line, Bar, ComposedChart, ReferenceLine } from 'recharts';
import { Property, Cashflow, CashflowSettings, YearlyProjection } from '../types'; // Import YearlyProjection
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { usePDF } from 'react-to-pdf';
import { QRCodeSVG } from 'qrcode.react';
import HomeWorkIcon from '@mui/icons-material/HomeWork'; // Ensure this is imported if used
import Drawer from '@mui/material/Drawer';
import CashflowSankeyChart from '../components/CashflowSankeyChart';
import { calculateCrunchScore } from '../utils/scoring'; // Moved import higher

interface PropertyDetailsPageProps {
  properties: Property[];
  calculateCashflow: (property: Property, settings: CashflowSettings) => Cashflow;
  formatCurrency: (amount: number) => string;
  formatPercent: (percent: number) => string;
  defaultSettings: CashflowSettings;
  // Add the override handler prop
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
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
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
  
  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}><CircularProgress /></Box>;
  if (error || !coordinates) return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300, bgcolor: '#f5f5f5', borderRadius: 2 }}><Typography color="error">{error || 'Map could not be loaded'}</Typography></Box>;
  
    return (
    <Box sx={{ height: 400, width: '100%', borderRadius: 2, overflow: 'hidden', border: '1px solid #e0e0e0', mb: 3 }}>
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
  generateLongTermCashflow: () => YearlyProjection[]; // Pass the function itself
  formatCurrency: (amount: number) => string;
  formatPercent: (percent: number) => string;
  calculateIRR: (initialInvestment: number, cashFlows: number[], finalEquity?: number) => number;
  yearsToProject: number;
  rentAppreciationRate: number;
  propertyValueIncreaseRate: number;
  effectivePrice: number; // Pass effective price for consistency
}

const PropertyPDFReport = React.forwardRef<HTMLDivElement, PropertyPDFReportProps>((
  {
    property,
    cashflow,
    settings,
    customRentEstimate,
    notes,
    generateShareableURL,
    generateLongTermCashflow, // Receive the function
    formatCurrency,
    formatPercent,
    calculateIRR, // Receive the function
    yearsToProject,
    rentAppreciationRate,
    propertyValueIncreaseRate,
    effectivePrice
  },
  ref
) => {
  // No need for the early return here, parent component handles it
  // if (!property || !cashflow) return null;

  const rentValue = customRentEstimate !== null ? customRentEstimate : property.rent_estimate;
  const downPaymentAmount = effectivePrice * (settings.downPaymentPercent / 100); // Use effectivePrice
  const shareableURL = generateShareableURL(); // Call the passed function
  const longTermData = generateLongTermCashflow(); // Call the passed function
  const closingCosts = effectivePrice * 0.03; // Use effectivePrice
  const initialInvestment = downPaymentAmount
                           + closingCosts
                           + settings.rehabAmount;

  const longTermChartData = {
    years: longTermData.map(d => d.year),
    propertyValues: longTermData.map(d => d.propertyValue),
    equity: longTermData.map(d => d.equity),
    cashflow: longTermData.map(d => d.yearlyCashflow)
  };

  const sankeyData = {
    rentalIncome: rentValue,
    mortgage: cashflow.monthlyMortgage,
    taxInsurance: cashflow.monthlyTaxInsurance,
    vacancy: cashflow.monthlyVacancy,
    capex: cashflow.monthlyCapex,
    propertyManagement: cashflow.monthlyPropertyManagement,
    monthlyCashflow: cashflow.monthlyCashflow
  };

  const sectionStyle = { p: 2, mb: 2, border: '1px solid #eee', borderRadius: 1, pageBreakInside: 'avoid' as 'avoid' };
  const headingStyle = { fontWeight: 'bold', fontSize: '12pt', color: '#333', mb: 1.5 };
  const subHeadingStyle = { fontWeight: 'bold', fontSize: '10pt', color: '#555', mb: 1 };
  const bodyStyle = { fontSize: '10pt', mb: 0.5 };
  const tableCellStyle = { fontSize: '9pt', py: 0.5, borderBottom: '1px solid #eee' };
  const tableHeaderCellStyle = { ...tableCellStyle, fontWeight: 'bold', bgcolor: '#f8f8f8' };

    return (
    <Box
      ref={ref}
      sx={{
        backgroundColor: 'white',
        color: 'black',
        fontFamily: 'Arial, sans-serif',
        fontSize: '10pt',
        width: '8.5in', // Standard letter width
        padding: '0.5in' // Margins via padding
      }}
    >
      {/* Report Header */}
      <Box sx={{ mb: 2, borderBottom: '1px solid #ccc', pb: 1 }}>
        <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#4f46e5' }}>
          Investment Property Analysis
        </Typography>
        <Typography variant="h6" sx={{ color: '#333' }}>
          {property.address}
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
          <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
            List Price: {formatCurrency(effectivePrice)} {/* Use effectivePrice */}
          </Typography>
          <Typography variant="body2" sx={{ color: '#6b7280' }}>
            Generated: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Typography>
      </Box>
      </Box>

      {/* Property & Assumptions Section */}
      <Paper elevation={0} sx={sectionStyle}>
        <Typography sx={headingStyle}>Property & Assumptions</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Box sx={{ flex: '1 1 50%', pageBreakInside: 'avoid' as 'avoid' }}>
            {property.thumbnail && (
              <Box sx={{ mb: 2 }}>
                <img
                  src={property.thumbnail}
                  alt={property.address}
                  style={{
      width: '100%', 
                    maxHeight: '200px',
                    objectFit: 'cover',
                    borderRadius: '4px',
                    border: '1px solid #eee'
                  }}
                />
              </Box>
            )}
            <Typography sx={subHeadingStyle}>Property Details</Typography>
            <Typography sx={bodyStyle}>Beds/Baths: {property.bedrooms} / {property.bathrooms}</Typography>
            <Typography sx={bodyStyle}>Sq Ft: {property.sqft.toLocaleString()}</Typography>
            <Typography sx={bodyStyle}>Est. Rent: {formatCurrency(rentValue)}</Typography>
            {/* Ratio based on effective price */}
            <Typography sx={bodyStyle}>Ratio: {formatPercent((rentValue * 12 / effectivePrice) * 100)}</Typography>
            {property.days_on_market !== null && (
               <Typography sx={bodyStyle}>Days on Market: {property.days_on_market}</Typography>
            )}
          </Box>
          <Box sx={{ flex: '1 1 50%', pageBreakInside: 'avoid' as 'avoid' }}>
            <Typography sx={subHeadingStyle}>Key Assumptions</Typography>
            <Typography sx={bodyStyle}>Interest Rate: {settings.interestRate}%</Typography>
            <Typography sx={bodyStyle}>Loan Term: {settings.loanTerm} years</Typography>
            <Typography sx={bodyStyle}>Down Payment: {settings.downPaymentPercent}% ({formatCurrency(downPaymentAmount)})</Typography>
            <Typography sx={bodyStyle}>Tax/Insurance: {settings.taxInsurancePercent}%</Typography>
            <Typography sx={bodyStyle}>Vacancy: {settings.vacancyPercent}%</Typography>
            <Typography sx={bodyStyle}>CapEx: {settings.capexPercent}%</Typography>
            <Typography sx={bodyStyle}>Management: {settings.propertyManagementPercent}%</Typography>
            <Typography sx={bodyStyle}>Initial Rehab: {formatCurrency(settings.rehabAmount)}</Typography>
          </Box>
        </Box>
      </Paper>

      {/* Monthly Cashflow & Investment */}
      <Paper elevation={0} sx={sectionStyle}>
         <Typography sx={headingStyle}>Monthly Cashflow & Initial Investment</Typography>
         <Box sx={{ display: 'flex', gap: 3 }}>
           <Box sx={{ flex: '1 1 50%', pageBreakInside: 'avoid' as 'avoid' }}>
              <Typography sx={subHeadingStyle}>Income & Expenses</Typography>
              <Table size="small" sx={{ mb: 1.5 }}>
                <TableBody>
                  <TableRow sx={{ pageBreakInside: 'avoid' as 'avoid' }}>
                    <TableCell sx={tableCellStyle}>Rental Income:</TableCell>
                    <TableCell sx={{...tableCellStyle, textAlign: 'right'}}>{formatCurrency(rentValue)}</TableCell>
                  </TableRow>
                  <TableRow sx={{ pageBreakInside: 'avoid' as 'avoid' }}>
                    <TableCell sx={tableCellStyle}>Mortgage (P&I):</TableCell>
                    <TableCell sx={{...tableCellStyle, textAlign: 'right'}}>-{formatCurrency(cashflow.monthlyMortgage)}</TableCell>
                  </TableRow>
                   <TableRow sx={{ pageBreakInside: 'avoid' as 'avoid' }}>
                    <TableCell sx={tableCellStyle}>Tax/Insurance:</TableCell>
                    <TableCell sx={{...tableCellStyle, textAlign: 'right'}}>-{formatCurrency(cashflow.monthlyTaxInsurance)}</TableCell>
                  </TableRow>
                   <TableRow sx={{ pageBreakInside: 'avoid' as 'avoid' }}>
                    <TableCell sx={tableCellStyle}>Vacancy ({settings.vacancyPercent}%):</TableCell>
                    <TableCell sx={{...tableCellStyle, textAlign: 'right'}}>-{formatCurrency(cashflow.monthlyVacancy)}</TableCell>
                  </TableRow>
                   <TableRow sx={{ pageBreakInside: 'avoid' as 'avoid' }}>
                    <TableCell sx={tableCellStyle}>CapEx ({settings.capexPercent}%):</TableCell>
                    <TableCell sx={{...tableCellStyle, textAlign: 'right'}}>-{formatCurrency(cashflow.monthlyCapex)}</TableCell>
                  </TableRow>
                   <TableRow sx={{ pageBreakInside: 'avoid' as 'avoid' }}>
                    <TableCell sx={tableCellStyle}>Management ({settings.propertyManagementPercent}%):</TableCell>
                    <TableCell sx={{...tableCellStyle, textAlign: 'right'}}>-{formatCurrency(cashflow.monthlyPropertyManagement)}</TableCell>
                  </TableRow>
                   <TableRow sx={{ pageBreakInside: 'avoid' as 'avoid', bgcolor: '#f8f8f8' }}>
                    <TableCell sx={{...tableCellStyle, fontWeight: 'bold'}}>Monthly Cashflow:</TableCell>
                    <TableCell sx={{...tableCellStyle, textAlign: 'right', fontWeight: 'bold', color: cashflow.monthlyCashflow >= 0 ? '#047857' : '#dc2626'}}>
                      {formatCurrency(cashflow.monthlyCashflow)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
           </Box>
           <Box sx={{ flex: '1 1 50%', pageBreakInside: 'avoid' as 'avoid' }}>
              <Typography sx={subHeadingStyle}>Investment & Yr 1 Return</Typography>
              <Table size="small">
                <TableBody>
                  <TableRow sx={{ pageBreakInside: 'avoid' as 'avoid' }}>
                    <TableCell sx={tableCellStyle}>Down Payment:</TableCell>
                    <TableCell sx={{...tableCellStyle, textAlign: 'right'}}>{formatCurrency(downPaymentAmount)}</TableCell>
                  </TableRow>
                  <TableRow sx={{ pageBreakInside: 'avoid' as 'avoid' }}>
                    <TableCell sx={tableCellStyle}>Initial Rehab:</TableCell>
                    <TableCell sx={{...tableCellStyle, textAlign: 'right'}}>{formatCurrency(settings.rehabAmount)}</TableCell>
                  </TableRow>
                  <TableRow sx={{ pageBreakInside: 'avoid' as 'avoid' }}>
                    <TableCell sx={tableCellStyle}>Closing Costs (est. 3%):</TableCell>
                    <TableCell sx={{...tableCellStyle, textAlign: 'right'}}>{formatCurrency(closingCosts)}</TableCell>
                  </TableRow>
                  <TableRow sx={{ pageBreakInside: 'avoid' as 'avoid', bgcolor: '#f0f7ff' }}>
                    <TableCell sx={{...tableCellStyle, fontWeight: 'bold'}}>Total Investment:</TableCell>
                    <TableCell sx={{...tableCellStyle, textAlign: 'right', fontWeight: 'bold'}}>{formatCurrency(initialInvestment)}</TableCell>
                  </TableRow>
                   <TableRow sx={{ pageBreakInside: 'avoid' as 'avoid' }}>
                    <TableCell sx={tableCellStyle}>Annual Cashflow:</TableCell>
                    <TableCell sx={{...tableCellStyle, textAlign: 'right', color: cashflow.annualCashflow >= 0 ? '#047857' : '#dc2626'}}>
                      {formatCurrency(cashflow.annualCashflow)}
                    </TableCell>
                  </TableRow>
                  <TableRow sx={{ pageBreakInside: 'avoid' as 'avoid' }}>
                    <TableCell sx={{...tableCellStyle, fontWeight: 'bold'}}>Cash-on-Cash Return:</TableCell>
                    <TableCell sx={{...tableCellStyle, textAlign: 'right', fontWeight: 'bold', color: cashflow.cashOnCashReturn >= 0 ? '#047857' : '#dc2626'}}>
                       {formatPercent(cashflow.cashOnCashReturn)}
                     </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
           </Box>
         </Box>
      </Paper>

      {/* Long-Term Chart Visualization */}
      <Paper elevation={0} sx={{...sectionStyle, pageBreakBefore: 'always'}}>
        <Typography sx={headingStyle}>Projection: Value, Equity & Cashflow ({yearsToProject} Years)</Typography>
        <Typography sx={bodyStyle}>
          Assumes {rentAppreciationRate}% rent appreciation & {propertyValueIncreaseRate}% value increase annually.
        </Typography>
        <Box sx={{ height: 260, mt: 1.5, pageBreakInside: 'avoid' as 'avoid' }}>
          <SimpleChart data={longTermChartData} height={260} />
        </Box>
      </Paper>

      {/* Monthly Cashflow Sankey Chart */}
      <Paper elevation={0} sx={sectionStyle}>
        <Typography sx={headingStyle}>Monthly Cashflow Breakdown</Typography>
        <Box sx={{ height: 525, pageBreakInside: 'avoid' as 'avoid' }}>
          <CashflowSankeyChart
            data={sankeyData}
            formatCurrency={formatCurrency}
          />
        </Box>
      </Paper>

      {/* Long-term Analysis Table */}
      <Paper elevation={0} sx={{...sectionStyle, pageBreakBefore: 'always'}}>
        <Typography sx={headingStyle}>Yearly Projection Highlights</Typography>
        <TableContainer sx={{ maxHeight: '350px', pageBreakInside: 'avoid' as 'avoid' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={tableHeaderCellStyle}>Year</TableCell>
                <TableCell sx={tableHeaderCellStyle} align="right">Prop. Value</TableCell>
                <TableCell sx={tableHeaderCellStyle} align="right">Equity</TableCell>
                <TableCell sx={tableHeaderCellStyle} align="right">Ann. Rent</TableCell>
                <TableCell sx={tableHeaderCellStyle} align="right">Ann. Cashflow</TableCell>
                <TableCell sx={tableHeaderCellStyle} align="right">ROI (Cash)</TableCell>
                <TableCell sx={tableHeaderCellStyle} align="right">ROI (Total)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {longTermData
                .filter(data => [1, 5, 10, 15, 20, 25, 30].includes(data.year))
                .map((data) => (
                <TableRow key={data.year} sx={{ pageBreakInside: 'avoid' as 'avoid' }}>
                  <TableCell sx={tableCellStyle}>{data.year}</TableCell>
                  <TableCell sx={tableCellStyle} align="right">{formatCurrency(data.propertyValue)}</TableCell>
                  <TableCell sx={tableCellStyle} align="right">{formatCurrency(data.equity)}</TableCell>
                  <TableCell sx={tableCellStyle} align="right">{formatCurrency(data.annualRent)}</TableCell>
                  <TableCell sx={{ ...tableCellStyle, color: data.yearlyCashflow >= 0 ? '#047857' : '#dc2626' }} align="right">
                    {formatCurrency(data.yearlyCashflow)}
                  </TableCell>
                  <TableCell sx={{ ...tableCellStyle, color: data.roi >= 0 ? '#047857' : '#dc2626' }} align="right">
                    {formatPercent(data.roi)}
                  </TableCell>
                  <TableCell sx={{ ...tableCellStyle, color: data.roiWithEquity >= 0 ? '#047857' : '#dc2626' }} align="right">
                    {formatPercent(data.roiWithEquity)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* IRR Summary Panel */}
      <Paper elevation={0} sx={sectionStyle}>
        <Typography sx={headingStyle}>Internal Rate of Return (IRR) by Holding Period</Typography>
        <Typography sx={{...bodyStyle, color: '#6b7280', mb: 1.5}}>
          Annualized return considering cash flows and equity growth upon sale.
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '0.2in', justifyContent: 'space-between', pageBreakInside: 'avoid' as 'avoid' }}>
          {[1, 5, 10, 15, 30].map(holdingPeriod => {
            const relevantCashflows = longTermData
              .filter(data => data.year <= holdingPeriod)
              .map(data => data.yearlyCashflow);
            const finalYearData = longTermData.find(data => data.year === holdingPeriod);
            const finalEquityValue = finalYearData ? finalYearData.equity : 0;
            // Ensure the result of calculateIRR is assigned to 'irr'
            const irr = calculateIRR(initialInvestment, relevantCashflows, finalEquityValue);
            const color = irr < 0 ? '#ef4444' : irr < 8 ? '#f97316' : irr < 15 ? '#10b981' : '#4f46e5';

            return (
              <Box
                key={holdingPeriod}
                sx={{
                  flex: '1',
                  minWidth: '80px',
                  textAlign: 'center',
                  p: 1,
                  bgcolor: '#fafafa',
                  borderRadius: 1,
                  border: '1px solid #eee'
                }}
              >
                <Typography sx={{ color: '#555', fontWeight: 'bold', fontSize: '9pt' }}>
                  {holdingPeriod} Yr
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 'bold', color, fontSize: '11pt' }}>
                  {irr.toFixed(1)}%
                </Typography>
    </Box>
  );
          })}
        </Box>
      </Paper>

      {/* Notes Section */}
      {notes && notes.trim() !== '' && (
        <Paper elevation={0} sx={{...sectionStyle, pageBreakBefore: 'auto', pageBreakInside: 'avoid' as 'avoid'}}>
          <Typography sx={headingStyle}>Notes</Typography>
          <Typography sx={{...bodyStyle, whiteSpace: 'pre-line'}}>
            {notes}
          </Typography>
        </Paper>
      )}

      {/* Footer with QR Code */}
      <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid #ccc', textAlign: 'center' }}>
         <QRCodeSVG value={shareableURL} size={70} />
         <Typography variant="body2" sx={{ color: '#6b7280', mt: 0.5, fontSize: '8pt' }}>
           Scan QR code for live analysis: cashflowcrunch.com
         </Typography>
      </Box>
    </Box>
  );
});

// --- Main Property Details Page Component ---
interface PropertyDetailsPageProps {
  properties: Property[];
  calculateCashflow: (property: Property, settings: CashflowSettings) => Cashflow;
  formatCurrency: (amount: number) => string;
  formatPercent: (percent: number) => string;
  defaultSettings: CashflowSettings;
  handlePriceOverrideChange: (propertyId: string, newPriceString: string) => void;
  // Add calculateIRR here if it's defined in App.tsx and needed globally
  // calculateIRR: (initialInvestment: number, cashFlows: number[], finalEquity?: number) => number;
}

const PropertyDetailsPage: React.FC<PropertyDetailsPageProps> = ({
  properties,
  calculateCashflow,
  formatCurrency,
  formatPercent,
  defaultSettings,
  handlePriceOverrideChange // Add handlePriceOverrideChange here
}) => {
  // Get property ID from URL parameters
  const { propertyId } = useParams<{ propertyId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));
  
  // --- State Hooks (Moved to top) ---
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customRentEstimate, setCustomRentEstimate] = useState<number | null>(null);
  const [displayRent, setDisplayRent] = useState<string>('');
  const [isRentEditing, setIsRentEditing] = useState(false);
  const [userEditedRent, setUserEditedRent] = useState(false);
  const [settings, setSettings] = useState<CashflowSettings>(defaultSettings);
  const [rentAppreciationRate, setRentAppreciationRate] = useState<number>(3);  
  const [propertyValueIncreaseRate, setPropertyValueIncreaseRate] = useState<number>(3);
  const [yearsToProject, setYearsToProject] = useState<number>(30); // Default 30 years
  const [showTextPreview, setShowTextPreview] = useState(false);
  const [copySuccess, setCopySuccess] = useState('');
  const [notes, setNotes] = useState('');
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [isAssumptionsDrawerOpen, setIsAssumptionsDrawerOpen] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [isPriceEditing, setIsPriceEditing] = useState(false);
  const [displayPrice, setDisplayPrice] = useState('');
  const [overridePrice, setOverridePrice] = useState<number | undefined>(undefined);
  
  // Calculate effective price, prioritizing override
  const effectivePrice = useMemo(() => {
    return overridePrice !== undefined ? overridePrice : (property?.price ?? 0);
  }, [overridePrice, property?.price]);
  
  // PDF generation
  const pdfRef = useRef<HTMLDivElement>(null);
  const { toPDF, targetRef } = usePDF({
    // Conditionally generate filename only if property exists
    filename: property && property.address ? `${property.address.replace(/\s+/g, '_')}_analysis.pdf` : 'property_analysis.pdf',
  });
  
  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  
  // Load property data
  useEffect(() => {
    if (!propertyId) {
      setError('Invalid property ID');
      setLoading(false);
      return;
    }
    
    // First, check if there's encoded property data in the URL
    const searchParams = new URLSearchParams(location.search);
    const encodedData = searchParams.get('d') || searchParams.get('data'); // Support both 'd' (new) and 'data' (old)
    const customRentParam = searchParams.get('re');
    const hasCustomRent = customRentParam !== null;
    
    let loadedFromSearch = false; // Flag to track if loaded from search results
    
    if (encodedData) {
      try {
        const decodedProperty = decodePropertyFromURL(encodedData);
        if (decodedProperty) {
          setProperty(decodedProperty);
          // Set notes if present in decoded data
          if (decodedProperty.notes) {
            setNotes(decodedProperty.notes);
          }
          setLoading(false);
          
          // Initialize custom rent if available
          if (decodedProperty.rent_estimate) {
            if (!customRentEstimate) {
              setCustomRentEstimate(decodedProperty.rent_estimate);
              setDisplayRent(formatCurrency(decodedProperty.rent_estimate));
            }
          }
          return; // Exit early if loaded from URL data
        }
      } catch (error) {
        console.error('Error loading property from URL data:', error);
      }
    }
    
    // If not loaded from URL data, try finding in properties array (search results)
    const foundProperty = properties.find(p => p.property_id === propertyId);
    
    if (foundProperty) {
      setProperty(foundProperty);
      setLoading(false);
      loadedFromSearch = true; // Mark as loaded from search
      
      // Initialize custom rent if available and not set by URL param
      if (foundProperty.rent_estimate && !hasCustomRent && !customRentEstimate) {
        setCustomRentEstimate(foundProperty.rent_estimate);
        setDisplayRent(formatCurrency(foundProperty.rent_estimate));
      }
      
      // Set notes from property object if they exist (e.g., previously bookmarked/saved)
      if (foundProperty.notes) {
          setNotes(foundProperty.notes);
      }
      // AUTO-EXPAND assumptions drawer if loaded from search
      // setIsAssumptionsDrawerOpen(true); <-- Remove this
      
      return; // Exit early if loaded from search results
    }
    
    // If not found in properties, try localStorage (likely a bookmark)
    try {
      const savedPropertiesStr = localStorage.getItem('rentToolFinder_properties');
      if (savedPropertiesStr) {
        const savedProperties = JSON.parse(savedPropertiesStr);
        const savedProperty = savedProperties[propertyId];
        
        if (savedProperty) {
          setProperty(savedProperty);
          setLoading(false);
          
          // Initialize custom rent if available and not set by URL param
          if (savedProperty.rent_estimate && !hasCustomRent && !customRentEstimate) {
            setCustomRentEstimate(savedProperty.rent_estimate);
            setDisplayRent(formatCurrency(savedProperty.rent_estimate));
          }
          
          // Set notes from saved property
          if (savedProperty.notes) {
            setNotes(savedProperty.notes);
          }
          
          return; // Exit early if loaded from localStorage
        }
      }
    } catch (error) {
      console.error('Error loading property from localStorage:', error);
    }
    
    // If property not found anywhere, set error
    setError('Property not found');
    setLoading(false);
    
  }, [propertyId, properties, formatCurrency, location.search]); // Dependencies remain the same
  
  // Update page title and load settings from localStorage
  useEffect(() => {
    if (property) {
      document.title = `${property.address} | CashflowCrunch`;
      
      // Check if there are saved settings for this property in localStorage
      try {
        const savedSettingsStr = localStorage.getItem('rentToolFinder_settings');
        if (savedSettingsStr) {
          const savedSettings = JSON.parse(savedSettingsStr);
          
          // If we have saved settings for this property, use them
          if (savedSettings[property.property_id]) {
            // Check if we have cashflow settings saved
            const propertySettings = savedSettings[property.property_id];
            
            // Only apply settings if not already applied from URL
            const urlParams = new URLSearchParams(location.search);
            const hasSettingsInUrl = urlParams.has('ir') || urlParams.has('lt') || 
                                    urlParams.has('dp') || urlParams.has('ti') || 
                                    urlParams.has('vc') || urlParams.has('cx') || 
                                    urlParams.has('pm') || urlParams.has('rh'); // Added rh check
            
            // Apply saved cashflow settings if valid and no URL settings
            if (!hasSettingsInUrl) {
              // Update cashflow settings
              const hasValidSettings = propertySettings.interestRate !== undefined && 
                                      propertySettings.loanTerm !== undefined &&
                                      propertySettings.downPaymentPercent !== undefined;
                                      // No need to check rehabAmount explicitly, it's handled by spread
              
              if (hasValidSettings) {
                setSettings(prev => ({
                  ...prev,
                  ...propertySettings // Spread saved settings, including rehabAmount if present
                }));
              }
            }
            
            // Check for projection settings
            const hasProjectionSettingsInUrl = urlParams.has('ra') || urlParams.has('pvi');
            
            if (!hasProjectionSettingsInUrl && propertySettings.projectionSettings) {
              // Apply saved projection settings
              const projSettings = propertySettings.projectionSettings;
              
              if (projSettings.rentAppreciationRate !== undefined) {
                setRentAppreciationRate(projSettings.rentAppreciationRate);
              }
              
              if (projSettings.propertyValueIncreaseRate !== undefined) {
                setPropertyValueIncreaseRate(projSettings.propertyValueIncreaseRate);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error loading settings from localStorage:', error);
      }
    } else {
      document.title = 'Property Details | CashflowCrunch';
    }
    
    return () => {
      document.title = 'CashflowCrunch';
    };
  }, [property, location.search]);

  // Handle URL query parameters for settings (including notes if passed directly)
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
    const rh = searchParams.get('rh'); // rehab amount - Added
    
    // Update settings if values exist in URL
    const newSettings = {...settings}; // Start with current settings to preserve any already set
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
    
    // Handle rehab amount parameter
    if (rh) {
      const val = parseFloat(rh);
      // Updated max rehab amount range
      if (!isNaN(val) && val >= 0 && val <= 100000) { // Increased max to 100k
        newSettings.rehabAmount = val;
        updated = true;
      }
    }
    
    if (updated) {
      setSettings(newSettings);
    }
    
    // Check for custom rent estimate - Only set this on initial load and if user hasn't edited
    // Only update from URL if the user hasn't manually edited the rent
    if (re && property && !userEditedRent) {
      const val = parseFloat(re);
      if (!isNaN(val) && val > 0) {
        setCustomRentEstimate(val);
        setDisplayRent(formatCurrency(val));
      }
    }

    // Check for notes param (nt) - this might override notes loaded from 'data' if both exist
    const notesParam = searchParams.get('nt');
    if (notesParam) {
        // Check if notes were already set by the main loading effect
        // Only update if the param value is different or notes are currently empty
        const decodedNotes = decodeURIComponent(notesParam);
        if (decodedNotes !== notes) {
            setNotes(decodedNotes);
        }
    }
  }, [location.search, defaultSettings, property, formatCurrency, userEditedRent, notes, customRentEstimate]); // Added customRentEstimate
  
  // Add useEffect for long-term projection settings from URL
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    
    // Check if there are long-term projection settings in the URL
    const ra = searchParams.get('ra'); // rent appreciation
    const pvi = searchParams.get('pvi'); // property value increase
    
    // Update settings if values exist in URL
    if (ra) {
      const val = parseFloat(ra);
      if (!isNaN(val) && val >= 0 && val <= 10) {
        setRentAppreciationRate(val);
      }
    }
    
    if (pvi) {
      const val = parseFloat(pvi);
      if (!isNaN(val) && val >= 0 && val <= 10) {
        setPropertyValueIncreaseRate(val);
      }
    }
  }, [location.search]);

  // Handlers for rent input
  const handleRentChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Remove currency formatting for editing
    const numericValue = parseFloat(value.replace(/[^0-9.]/g, ''));
    
    if (!isNaN(numericValue)) {
      setCustomRentEstimate(numericValue);
      // During editing, show the raw value for easier editing
      setDisplayRent(value);
      // Flag that user has edited the rent
      setUserEditedRent(true);
    } else {
      setDisplayRent(value === '$' ? '' : value);
    }
  }, [property]);

  const handleRentBlur = () => {
    setIsRentEditing(false);
    
    // When focus is lost, format the value properly
    if (customRentEstimate) {
      setDisplayRent(formatCurrency(customRentEstimate));
      
      // Update URL with new rent estimate
      const currentUrl = new URL(window.location.href);
      const searchParams = new URLSearchParams(currentUrl.search);
      searchParams.set('re', customRentEstimate.toString());
      
      const newUrl = `${currentUrl.pathname}?${searchParams.toString()}${currentUrl.hash}`;
      window.history.replaceState({}, '', newUrl);
      
      // If this is a bookmarked or shared property, update the localStorage version too
      if (property) {
        // Get existing saved properties
        try {
          const savedPropertiesStr = localStorage.getItem('rentToolFinder_properties');
          const savedProperties = savedPropertiesStr ? JSON.parse(savedPropertiesStr) : {};
          
          // If this property is in localStorage, update its rent value
          if (savedProperties[property.property_id]) {
            savedProperties[property.property_id] = {
              ...savedProperties[property.property_id],
              rent_estimate: customRentEstimate
            };
            localStorage.setItem('rentToolFinder_properties', JSON.stringify(savedProperties));
          }
        } catch (error) {
          console.error('Error updating property in localStorage:', error);
        }
      }
    } else {
      // If input is cleared, revert to the original rent
      if (property) {
        const originalRent = property.rent_estimate || 0;
        setCustomRentEstimate(originalRent);
        setDisplayRent(formatCurrency(originalRent));
      }
    }
  };

  const handleRentFocus = () => {
    setIsRentEditing(true);
    
    // When focused, show numeric value without currency formatting
    if (customRentEstimate) {
      setDisplayRent(customRentEstimate.toString());
    } else {
      setDisplayRent('');
    }
  };
  
  // --- Price Input Handlers ---
  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDisplayPrice(e.target.value); // Allow raw input while typing
  };

  // Initialize displayPrice when property loads or overridePrice changes
  useEffect(() => {
    if (property) {
        setDisplayPrice(formatCurrency(effectivePrice));
    }
  }, [property, effectivePrice, formatCurrency]);

  const handlePriceBlur = () => {
    setIsPriceEditing(false);
    const currentPrice = overridePrice !== undefined ? overridePrice : (property?.price ?? 0);
    const newPrice = parseFloat(displayPrice.replace(/[^\d.]/g, ''));

    if (!isNaN(newPrice) && newPrice > 0 && newPrice !== currentPrice) {
      console.log(`[PropertyDetails] Setting override price to: ${newPrice}`);
      setOverridePrice(newPrice);
      // Call the prop handler passed down from App.tsx to update the global state
      if (property && handlePriceOverrideChange) {
        handlePriceOverrideChange(property.property_id, String(newPrice));
      }
      // Update display (useEffect based on overridePrice will also handle this, but set it here too for immediate feedback)
      // Display Price is now handled by the useEffect hook based on effectivePrice
      // setDisplayPrice(formatCurrency(newPrice));
    } else {
      // Revert to formatted current price if input is invalid or unchanged
      console.log("[PropertyDetails] Invalid price or no change, reverting display.");
      // Display Price is now handled by the useEffect hook based on effectivePrice
      // setDisplayPrice(formatCurrency(currentPrice));
    }
  };

  const handlePriceFocus = () => {
    setIsPriceEditing(true);
    // Show raw number when editing
    const currentPrice = overridePrice !== undefined ? overridePrice : (property?.price ?? 0);
    setDisplayPrice(String(currentPrice));
  };
  
  // Navigate back to search results
  const handleBackToSearch = () => {
    navigate('/');
  };
  
  // Add handler for notes change
  const handleNotesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setNotes(event.target.value);
    // Consider adding logic here to save notes to localStorage if the property is bookmarked
    // For now, saving happens primarily during bookmarking/sharing actions.
  };
  
  // Create a modified property object for cashflow calculations
  const propertyForCashflow = useMemo(() => (property ? {
    ...property,
    // Use the effective price for cashflow calculations
    price: effectivePrice,
    // Use the custom rent estimate for cashflow calculations if it exists
    rent_estimate: customRentEstimate !== null ? customRentEstimate : property.rent_estimate
  } : undefined), [property, effectivePrice, customRentEstimate]);
  
  // Calculate cashflow using current settings and effective price
  const cashflow = useMemo(() => {
    return propertyForCashflow ? calculateCashflow(propertyForCashflow, settings) : null;
  // Add overridePrice and effectivePrice to dependencies
  }, [propertyForCashflow, settings, calculateCashflow, overridePrice, effectivePrice]);
  
  // --- Calculate Crunch Score (Moved Higher) ---
  const crunchScore = useMemo(() => {
    // Remove effectivePrice from this call as the function doesn't expect it
    return property && cashflow ? calculateCrunchScore(property, settings, cashflow) : 0;
  }, [property, cashflow, settings, calculateCashflow]); // Removed effectivePrice dependency

  // --- Define Crunch Score CSS class based on score (Moved Higher) ---
  const getCrunchScoreClass = (score: number): string => {
    if (score >= 65) return 'crunch-score-good';
    if (score >= 45) return 'crunch-score-medium';
    return 'crunch-score-poor';
  };
  const crunchScoreClass = getCrunchScoreClass(crunchScore);

  // --- Tooltip Text (Moved Higher) ---
  const crunchScoreTooltip = "Overall investment potential (0-100) based on cash flow, rent/price ratio, and your assumptions (higher is better).";
  
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
      propertyManagementPercent: 'pm',
      rehabAmount: 'rh' // Added rehab amount mapping
    };
    
    // Update URL with new setting
    updateUrlWithSettings({ [paramMap[setting]]: value });
    
    // If this is a bookmarked property, update settings in localStorage
    if (property) {
      saveSettingsToLocalStorage(property.property_id, setting, value);
    }
  };

  // Add function to save cashflow settings to localStorage
  const saveSettingsToLocalStorage = (propertyId: string, setting?: keyof CashflowSettings, value?: number) => {
    try {
      // Get existing saved settings
      const savedSettingsStr = localStorage.getItem('rentToolFinder_settings');
      const savedSettings = savedSettingsStr ? JSON.parse(savedSettingsStr) : {};
      
      // Initialize settings for this property if they don't exist
      if (!savedSettings[propertyId]) {
        savedSettings[propertyId] = { ...settings };
      }
      
      // Update specific setting if provided
      if (setting && value !== undefined) {
        savedSettings[propertyId][setting] = value;
      } else {
        // Otherwise update all settings (including rehabAmount)
        savedSettings[propertyId] = { ...settings };
      }
      
      // Save projection settings too
      if (!savedSettings[propertyId].projectionSettings) {
        savedSettings[propertyId].projectionSettings = {};
      }
      
      savedSettings[propertyId].projectionSettings = {
        rentAppreciationRate,
        propertyValueIncreaseRate,
        yearsToProject
      };
      
      // Save back to localStorage
      localStorage.setItem('rentToolFinder_settings', JSON.stringify(savedSettings));
    } catch (error) {
      console.error('Error saving settings to localStorage:', error);
    }
  };
  
  // Copy to clipboard handler
  const handleCopyToClipboard = async () => {
    const summary = generatePropertySummary();
    
    // Save the current property to localStorage to enable shared links to work
    if (property) {
      savePropertyToLocalStorage(property, notes);
      // Also save current settings
      saveSettingsToLocalStorage(property.property_id);
    }
    
    try {
      await navigator.clipboard.writeText(summary);
      setCopySuccess('Copied to clipboard!');
      setTimeout(() => setCopySuccess(''), 3000);
    } catch (err) {
      setCopySuccess('Failed to copy! Try selecting and copying the text manually.');
    }
  };

  // Email share handler
  // const handleEmailShare = () => { ... }; // Comment out or delete
  
  // Add new function to save property to localStorage
  const savePropertyToLocalStorage = (prop: Property, currentNotes: string) => {
    try {
      // Get existing saved properties
      const savedPropertiesStr = localStorage.getItem('rentToolFinder_properties');
      const savedProperties = savedPropertiesStr ? JSON.parse(savedPropertiesStr) : {};
      
      // Add or update this property, including notes
      savedProperties[prop.property_id] = {
        ...prop,
        notes: currentNotes // Add notes here
      };
      
      // Save back to localStorage
      localStorage.setItem('rentToolFinder_properties', JSON.stringify(savedProperties));
    } catch (error) {
      console.error('Error saving property to localStorage:', error);
    }
  };
  
  // Add handler for rent appreciation rate change
  const handleRentAppreciationChange = (_event: Event, newValue: number | number[]) => {
    const value = newValue as number;
    setRentAppreciationRate(value);
    
    // Update URL
    updateUrlWithSettings({ 'ra': value });
    
    // Save to localStorage if this is a bookmarked property
    if (property) {
      try {
        const savedSettingsStr = localStorage.getItem('rentToolFinder_settings');
        const savedSettings = savedSettingsStr ? JSON.parse(savedSettingsStr) : {};
        
        // Initialize settings for this property if they don't exist
        if (!savedSettings[property.property_id]) {
          savedSettings[property.property_id] = { 
            ...settings,
            projectionSettings: {
              rentAppreciationRate: value,
              propertyValueIncreaseRate,
              yearsToProject
            }
          };
        } else if (!savedSettings[property.property_id].projectionSettings) {
          savedSettings[property.property_id].projectionSettings = {
            rentAppreciationRate: value,
            propertyValueIncreaseRate,
            yearsToProject
          };
        } else {
          savedSettings[property.property_id].projectionSettings.rentAppreciationRate = value;
        }
        
        localStorage.setItem('rentToolFinder_settings', JSON.stringify(savedSettings));
      } catch (error) {
        console.error('Error saving rent appreciation setting to localStorage:', error);
      }
    }
  };
  
  // Add handler for property value increase rate change
  const handlePropertyValueIncreaseChange = (_event: Event, newValue: number | number[]) => {
    const value = newValue as number;
    setPropertyValueIncreaseRate(value);
    
    // Update URL
    updateUrlWithSettings({ 'pvi': value });
    
    // Save to localStorage if this is a bookmarked property
    if (property) {
      try {
        const savedSettingsStr = localStorage.getItem('rentToolFinder_settings');
        const savedSettings = savedSettingsStr ? JSON.parse(savedSettingsStr) : {};
        
        // Initialize settings for this property if they don't exist
        if (!savedSettings[property.property_id]) {
          savedSettings[property.property_id] = { 
            ...settings,
            projectionSettings: {
              rentAppreciationRate,
              propertyValueIncreaseRate: value,
              yearsToProject
            }
          };
        } else if (!savedSettings[property.property_id].projectionSettings) {
          savedSettings[property.property_id].projectionSettings = {
            rentAppreciationRate,
            propertyValueIncreaseRate: value,
            yearsToProject
          };
        } else {
          savedSettings[property.property_id].projectionSettings.propertyValueIncreaseRate = value;
        }
        
        localStorage.setItem('rentToolFinder_settings', JSON.stringify(savedSettings));
      } catch (error) {
        console.error('Error saving property value increase setting to localStorage:', error);
      }
    }
  };
  
  // Add handler for years to project change
  // const handleYearsToProjectChange = (_event: Event, newValue: number | number[]) => { ... }; // Comment out or delete
  
  // Function to generate long-term cashflow projections
  const generateLongTermCashflow = useCallback((): YearlyProjection[] => {
    // Needs to check for property/cashflow existence *inside* because it might be called
    // before the early return check conceptually (though practically it won't be used until after)
    if (!property || !cashflow) return [];
    
    const years: YearlyProjection[] = [];
    // Get the initial monthly rent
    const initialMonthlyRent = customRentEstimate !== null ? customRentEstimate : property.rent_estimate;
    // Calculate initial annual rent
    const initialAnnualRent = initialMonthlyRent * 12;
    // Use effectivePrice for starting property value
    let propertyValue = effectivePrice;
    
    // Calculate initial equity based on effectivePrice
    let equity = effectivePrice * (settings.downPaymentPercent / 100);
    
    // Calculate loan details based on effectivePrice
    const loanAmount = effectivePrice - equity;
    const monthlyInterestRate = settings.interestRate / 100 / 12;
    const totalPayments = settings.loanTerm * 12;
    
    // Calculate remaining principal as of start
    let remainingPrincipal = loanAmount;
    
    // Initialize previous year equity
    let previousYearEquity = equity;
    
    for (let i = 1; i <= yearsToProject; i++) {
      // Calculate rent with appreciation compounding properly from initial value
      const yearRent = initialAnnualRent * Math.pow(1 + rentAppreciationRate / 100, i - 1);
      
      // Increase property value with appreciation (compounding)
      propertyValue = effectivePrice * Math.pow(1 + propertyValueIncreaseRate / 100, i - 1);
      
      // Calculate expenses
      // Mortgage calculation needs the correct loanAmount based on effectivePrice
      // Note: calculateCashflow should already provide the correct monthlyMortgage based on propertyForCashflow
      const yearlyMortgage = cashflow.monthlyMortgage * 12; // Mortgage stays fixed
      
      // Tax and insurance typically increase with property value (based on effective price)
      const yearlyTaxInsurance = effectivePrice * (settings.taxInsurancePercent / 100) * Math.pow(1 + propertyValueIncreaseRate / 100, i - 1);
      
      // Other expenses are calculated as percentage of rent
      const yearlyVacancy = yearRent * (settings.vacancyPercent / 100);
      const yearlyCapex = yearRent * (settings.capexPercent / 100);
      const yearlyPropertyManagement = yearRent * (settings.propertyManagementPercent / 100);
      
      // Total expenses for the year
      const yearlyExpenses = yearlyMortgage + yearlyTaxInsurance + yearlyVacancy + yearlyCapex + yearlyPropertyManagement;
      
      // Cashflow for the year
      const yearlyCashflow = yearRent - yearlyExpenses;
      
      // Calculate principal paid this year using amortization
      // let principalPaidThisYear = 0;
      
      // Calculate month by month for the current year
      const startMonth = (i - 1) * 12 + 1;
      const endMonth = Math.min(i * 12, totalPayments);
      
      // Only calculate if we're still within the loan term
      if (startMonth <= totalPayments) {
        // For each month in the current year
        for (let month = startMonth; month <= endMonth; month++) {
          // Calculate interest for this month
          const interestPayment = remainingPrincipal * monthlyInterestRate;
          
          // Calculate principal payment for this month (mortgage payment - interest)
          const principalPayment = cashflow.monthlyMortgage - interestPayment;
          
          // Add to yearly principal total
          // principalPaidThisYear += principalPayment;
          
          // Reduce remaining principal
          remainingPrincipal = Math.max(0, remainingPrincipal - principalPayment);
        }
      }
      
      // Update equity (original down payment + principal paid so far + appreciation)
      equity = propertyValue - remainingPrincipal;
      
      // Calculate equity growth from previous year
      const equityGrowth = equity - previousYearEquity;
      previousYearEquity = equity;
      
      // Calculate ROI based on effectivePrice and investment
      // Use effectivePrice for initial investment calculation
      const initialInvestment = effectivePrice * (settings.downPaymentPercent / 100)
                                + effectivePrice * 0.03 // Closing costs based on effective price
                                + settings.rehabAmount; // Rehab costs
      const cashOnCashReturn = initialInvestment > 0 ? (yearlyCashflow / initialInvestment) * 100 : 0; // Avoid division by zero
      
      // Calculate ROI with equity growth included
      const totalReturn = yearlyCashflow + equityGrowth;
      const roiWithEquity = initialInvestment > 0 ? (totalReturn / initialInvestment) * 100 : 0; // Avoid division by zero
      
      years.push({
        year: i,
        propertyValue,
        annualRent: yearRent,
        yearlyExpenses,
        yearlyCashflow,
        equity,
        equityGrowth,
        roi: cashOnCashReturn,
        roiWithEquity
      });
      
      // No need to update annualRent for the next iteration since we're using the power function
      // with the initial value for proper compounding
    }
    
    return years;
  }, [
    property, cashflow, customRentEstimate, effectivePrice, settings, rentAppreciationRate,
    propertyValueIncreaseRate, yearsToProject
    // Removed calculateCashflow from deps if it comes from props and is stable
  ]);
  
  // Copy to clipboard handler
  const generatePropertySummary = () => {
    if (!property || !cashflow) return '';
    
    const rentValue = customRentEstimate !== null ? customRentEstimate : property.rent_estimate;
    const downPaymentAmount = property.price * (settings.downPaymentPercent / 100);
    // Calculate total initial investment including rehab
    const closingCosts = property.price * 0.03;
    const totalInvestment = downPaymentAmount + closingCosts + settings.rehabAmount;
    
    // Add notes to summary if they exist
    const notesSection = notes ? `\n📝 NOTES:\n${notes}\n` : '\n';
    
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
• Down payment (${settings.downPaymentPercent}%): ${formatCurrency(downPaymentAmount)}
• Initial Rehab: ${formatCurrency(settings.rehabAmount)} 
• Closing Costs (est. 3%): ${formatCurrency(closingCosts)}
• Total Investment: ${formatCurrency(totalInvestment)}
-----------------------------
• Mortgage payment: ${formatCurrency(cashflow.monthlyMortgage)}
• Property Tax & Insurance: ${formatCurrency(cashflow.monthlyTaxInsurance)}
• Vacancy (${settings.vacancyPercent}%): ${formatCurrency(cashflow.monthlyVacancy)}
• CapEx (${settings.capexPercent}%): ${formatCurrency(cashflow.monthlyCapex)}
• Property Management (${settings.propertyManagementPercent}%): ${formatCurrency(cashflow.monthlyPropertyManagement)}
• Total Monthly Expenses: ${formatCurrency(cashflow.totalMonthlyExpenses)}
-----------------------------
• Monthly Cashflow: ${formatCurrency(cashflow.monthlyCashflow)}
• Annual Cashflow: ${formatCurrency(cashflow.annualCashflow)}
• Cash-on-Cash Return: ${formatPercent(cashflow.cashOnCashReturn)}

${notesSection}🔗 ZILLOW LISTING: ${property.url}
🔗 RENTCAST ANALYSIS: ${rentCastUrl}

See full analysis: ${generateShareableURL()}

Generated with CashflowCrunch - https://cashflowcrunch.com/
`;
  };
  
  // Function to encode property data into a URL-safe string
  const encodePropertyToURL = (property: Property, currentNotes: string): string => {
    // Create a minimal version of the property with only essential fields
    // Use shorter property names to reduce JSON size
    const minimalProperty = {
      id: property.property_id,
      a: property.address,
      p: property.price,
      b: property.bedrooms,
      bt: property.bathrooms,
      s: property.sqft,
      r: customRentEstimate !== null ? customRentEstimate : property.rent_estimate,
      // Only include thumbnail if it exists and isn't too long
      ...(property.thumbnail && property.thumbnail.length < 100 ? { t: property.thumbnail } : {}),
      u: property.url,
      d: property.days_on_market,
      rt: property.ratio,
      rs: property.rent_source,
      // Only include coordinates if they exist
      ...(property.latitude && property.longitude ? { 
        lat: property.latitude,
        lng: property.longitude 
      } : {}),
      // Only include notes if they exist and aren't empty
      ...(currentNotes && currentNotes.trim() !== '' ? { n: currentNotes } : {})
    };
    
    // Encode as JSON and then to base64
    const jsonStr = JSON.stringify(minimalProperty);
    
    // Use a more compact encoding: URL-safe base64 without padding
    return btoa(encodeURIComponent(jsonStr))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  };
  
  // Add IRR calculation function
  const calculateIRR = (initialInvestment: number, cashFlows: number[], finalEquity: number = 0): number => {
    // Combine initial investment (negative) with cash flows and final value
    const allCashFlows = [-initialInvestment, ...cashFlows, finalEquity];
    
    // IRR calculation using Newton's method
    const maxIterations = 1000;
    const tolerance = 0.0000001;
    
    let guess = 0.1; // Start with 10% as initial guess
    
    // Newton's method iteration
    for (let iteration = 0; iteration < maxIterations; iteration++) {
      let fValue = 0;
      let fPrime = 0;
      
      // Calculate function value and derivative
      for (let i = 0; i < allCashFlows.length; i++) {
        fValue += allCashFlows[i] / Math.pow(1 + guess, i);
        if (i > 0) {
          fPrime -= i * allCashFlows[i] / Math.pow(1 + guess, i + 1);
        }
      }
      
      // Adjust guess using Newton's method
      const newGuess = guess - fValue / fPrime;
      
      // Check for convergence
      if (Math.abs(newGuess - guess) < tolerance) {
        return newGuess * 100; // Convert to percentage
      }
      
      guess = newGuess;
    }
    
    // Return best guess if not converged
    return guess * 100;
  };
  
  // Function to decode property data from URL string
  const decodePropertyFromURL = (encodedStr: string): (Property & { notes?: string }) | null => {
    try {
      // Add padding if needed
      let padded = encodedStr;
      while (padded.length % 4 !== 0) {
        padded += '=';
      }
      
      // Restore standard base64 characters
      padded = padded.replace(/-/g, '+').replace(/_/g, '/');
      
      // Decode from base64, then from URI encoding, then parse JSON
      const jsonStr = decodeURIComponent(atob(padded));
      const data = JSON.parse(jsonStr);
      
      // Convert back to original property structure
      return {
        property_id: data.id,
        address: data.a,
        price: data.p,
        bedrooms: data.b,
        bathrooms: data.bt,
        sqft: data.s,
        rent_estimate: data.r,
        thumbnail: data.t || null,
        url: data.u,
        days_on_market: data.d,
        ratio: data.rt,
        rent_source: data.rs,
        latitude: data.lat || null,
        longitude: data.lng || null,
        notes: data.n || ""
      } as (Property & { notes?: string });
    } catch (error) {
      console.error('Error decoding property from URL:', error);
      return null;
    }
  };
  
  // Function to generate a shareable URL
  const generateShareableURL = useCallback((): string => {
    if (!property) return window.location.href;
    const baseUrl = `https://cashflowcrunch.com/#/property/${property.property_id}`;
    const params = new URLSearchParams();
    // Ensure encodePropertyToURL uses the correct price (effectivePrice)
    const encodedProperty = encodePropertyToURL(property, notes);
    params.set('d', encodedProperty);

    // Add settings to params...
    // ... (rest of the function)
    
    return `${baseUrl}?${params.toString()}`;
  }, [
    property, notes, settings, defaultSettings, rentAppreciationRate,
    propertyValueIncreaseRate, customRentEstimate, encodePropertyToURL
  ]);
  
  // Function to handle share via URL
  const handleShareViaURL = async () => {
    const shareableURL = generateShareableURL();
    
    try {
      // Use the clipboard API to copy the URL
      await navigator.clipboard.writeText(shareableURL);
      setCopySuccess('Shareable URL copied to clipboard!');
      setTimeout(() => setCopySuccess(''), 3000);
    } catch (err) {
      setCopySuccess('Failed to copy URL. Try copying it from the address bar.');
    }
  };
  
  // Add function to handle bookmarking properties
  const handleBookmarkToggle = () => {
    if (!property) return;

    // Generate the shareable URL that contains all settings/customizations including notes
    const shareableURL = generateShareableURL(); // Already includes notes logic
    
    // Get current bookmarks from localStorage
    const bookmarksStr = localStorage.getItem('rentToolFinder_bookmarks');
    let bookmarks: Record<string, {url: string, property: Property, date: string}> = {};
    
    try {
      bookmarks = bookmarksStr ? JSON.parse(bookmarksStr) : {};
    } catch (e) {
      console.error('Error parsing bookmarks:', e);
    }
    
    if (isBookmarked) {
      // Remove bookmark
      if (property.property_id in bookmarks) {
        delete bookmarks[property.property_id];
        setIsBookmarked(false);
        setCopySuccess('Property removed from bookmarks');
      }
    } else {
      // Add bookmark - ensure notes are included in the saved property object
      bookmarks[property.property_id] = {
        url: shareableURL,
        property: {
            ...property,
            notes: notes // Explicitly add notes here
        },
        date: new Date().toISOString()
      };
      setIsBookmarked(true);
      setCopySuccess('Property bookmarked!');
    }
    
    // Save updated bookmarks back to localStorage
    localStorage.setItem('rentToolFinder_bookmarks', JSON.stringify(bookmarks));
    
    // Clear the success message after 3 seconds
    setTimeout(() => setCopySuccess(''), 3000);
  };
  
  // Check if property is bookmarked on component mount
  useEffect(() => {
    if (!property) return;
    
    const bookmarksStr = localStorage.getItem('rentToolFinder_bookmarks');
    try {
      const bookmarks = bookmarksStr ? JSON.parse(bookmarksStr) : {};
      setIsBookmarked(!!bookmarks[property.property_id]);
    } catch (e) {
      console.error('Error checking bookmark status:', e);
    }
  }, [property]);
  
  // Handle PDF generation
  const handleGeneratePDF = useCallback(() => {
    setShowPdfModal(true);
  }, []);

  const handleDownloadPDF = useCallback(() => {
    toPDF();
    setCopySuccess('PDF downloaded successfully!');
    setTimeout(() => setCopySuccess(''), 3000);
  }, [toPDF]);

  // Close PDF modal
  const handleClosePdfModal = useCallback(() => {
    setShowPdfModal(false);
  }, []);

  // --- Early Returns (Keep AFTER all hooks) ---
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
  
  // --- Calculate derived values AFTER checks ---
  // Now we are sure property, cashflow, effectivePrice are valid
  let downPaymentAmount: number = 0;
  let closingCosts: number = 0;
  let totalInvestment: number = 0;
  let longTermCashflowData: YearlyProjection[] = [];

  downPaymentAmount = effectivePrice * (settings.downPaymentPercent / 100);
  closingCosts = effectivePrice * 0.03;
  totalInvestment = downPaymentAmount + closingCosts + settings.rehabAmount;
  longTermCashflowData = generateLongTermCashflow(); // Call the useCallback memoized function

  // Generate long-term cashflow data - wrapped in useMemo
  
  // Generate chart data
  const chartYears = longTermCashflowData.map(data => data.year);
  const chartPropertyValues = longTermCashflowData.map(data => data.propertyValue);
  const chartEquity = longTermCashflowData.map(data => data.equity);
  const chartCashflow = longTermCashflowData.map(data => data.yearlyCashflow);
  
  // Custom bar component for handling positive and negative cashflow values
  // const CustomBar = (props: any) => { ... }; // Comment out or delete
  
  return (
    <>
      <CssBaseline />
      <AppBar position="sticky" elevation={0} sx={{ bgcolor: '#6366f1', color: 'white' }}>
        <Toolbar sx={{ 
          px: { xs: 1, sm: 2 },
          minHeight: { xs: '56px', sm: '64px' }
        }}>
          <IconButton 
            edge="start" 
            color="inherit" 
            aria-label="back" 
            onClick={handleBackToSearch}
            sx={{ mr: { xs: 0.5, sm: 2 } }} // Reduced margin-right on xs screens
          >
            <ArrowBackIcon />
          </IconButton>
          {/* Wrap Icon and Title in a Link */}
          <RouterLink to="/" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center' }}>
            {/* Remove the img tag for the logo */}
            {/* <img src={process.env.PUBLIC_URL + '/favicon.png'} alt="CashflowCrunch Logo" style={{ height: '40px', width: '40px', marginRight: '8px', verticalAlign: 'middle' }} /> */}
            <Typography
              variant="h6"
              color="inherit"
              noWrap
              sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }} // Smaller font size on xs screens
            >
              CashflowCrunch
            </Typography>
          </RouterLink>
          {/* Use flexGrow on a Box after the Link to push buttons to the right */}
          <Box sx={{ flexGrow: 1 }} /> 
          <Box sx={{ 
            display: 'flex', 
            gap: { xs: 0.5, sm: 2 }, // Reduced gap on xs screens
            flexWrap: 'nowrap'
          }}>
            {/* Add Bookmark Button */}
            <Button
              variant="outlined"
              startIcon={isBookmarked ? <BookmarkIcon /> : <BookmarkBorderIcon />}
              onClick={handleBookmarkToggle}
              size="small"
              sx={{ 
                color: 'white', 
                borderColor: 'white', 
                '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.1)' },
                whiteSpace: 'nowrap',
                minWidth: { xs: 'auto', sm: 'auto' }, // Allow shrink on xs
                px: { xs: 1, sm: 2 } // Less padding on xs
              }}
            >
              {/* Change breakpoint from sm to md */}
              <Box sx={{ display: { xs: 'none', md: 'block' }, ml: 1 }}> 
                {isBookmarked ? 'Bookmarked' : 'Bookmark'}
              </Box>
              {/* Change breakpoint from sm to md */}
              <Box sx={{ display: { xs: 'block', md: 'none' } }}> 
                {/* Content only needed for xs/sm (icon only) - currently empty */} 
              </Box>
            </Button>
            
            <Button 
              variant="outlined" 
              startIcon={<ShareIcon />}
              onClick={handleShareViaURL}
              size="small"
              sx={{ 
                color: 'white', 
                borderColor: 'white', 
                '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.1)' },
                whiteSpace: 'nowrap',
                minWidth: { xs: 'auto', sm: 'auto' }, // Allow shrink on xs
                px: { xs: 1, sm: 2 } // Less padding on xs
              }}
            >
              {/* Change breakpoint from sm to md */}
              <Box sx={{ display: { xs: 'none', md: 'block' }, ml: 1 }}>Copy URL</Box> 
            </Button>

            <Button 
              variant="outlined" 
              startIcon={<PdfIcon />}
              onClick={handleGeneratePDF}
              size="small"
              sx={{ 
                color: 'white', 
                borderColor: 'white', 
                '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.1)' },
                whiteSpace: 'nowrap',
                minWidth: { xs: 'auto', sm: 'auto' }, // Allow shrink on xs
                px: { xs: 1, sm: 2 } // Less padding on xs
              }}
            >
              {/* Change breakpoint from sm to md */}
              <Box sx={{ display: { xs: 'none', md: 'block' }, ml: 1 }}> 
                PDF Report
              </Box>
              {/* Change breakpoint from sm to md */}
              <Box sx={{ display: { xs: 'block', md: 'none' } }}>
                {/* Content only needed for xs/sm (icon only) - currently empty */} 
              </Box>
            </Button>
          </Box>
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
          {/* Display Address and Actions */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1, flexWrap: 'wrap' }}>
            <Box>
              <Typography variant="h4" component="h1" sx={{ mb: 0.5, display: 'flex', alignItems: 'center' }}>
                {/* Conditionally render TextField or clickable span for Price */}
                {isPriceEditing ? (
                  <TextField
                    variant="standard"
                    size="small"
                    value={displayPrice}
                    onChange={handlePriceChange}
                    onFocus={handlePriceFocus} 
                    onBlur={handlePriceBlur}
                    autoFocus
                    InputProps={{
                      disableUnderline: false, // Show underline while editing
                      sx: { fontSize: 'inherit', fontWeight: 'inherit', color: 'inherit' }
                    }}
                    sx={{ fontSize: 'inherit', padding: 0, margin: 0, height: 'auto', boxSizing: 'border-box' }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        (e.target as HTMLInputElement).blur(); // Trigger blur on Enter
                      }
                    }}
                  />
                ) : (
                  // Display formatted price, allow clicking to edit
                  <Box 
                    component="span" 
                    onClick={handlePriceFocus} 
                    sx={{ 
                      cursor: 'pointer', 
                      borderBottom: '1px dashed transparent', 
                      '&:hover': { borderBottomColor: 'currentColor' } // Use sx prop for hover
                    }}
                  >
                    {formatCurrency(overridePrice !== undefined ? overridePrice : (property?.price ?? 0))}
                  </Box>
                )}
                <Tooltip title="Edit Purchase Price">
                  <IconButton size="small" onClick={handlePriceFocus} sx={{ ml: 0.5 }}>
                    <EditIcon fontSize="inherit" />
                  </IconButton>
                </Tooltip>
                {/* Override indicator */}
                {overridePrice !== undefined && 
                 <Tooltip title="Price has been manually overridden for this analysis" arrow placement="top">
                   <span style={{ fontSize: '0.6em', verticalAlign: 'super', marginLeft: '4px', color: '#ffc107' }}>*</span>
                 </Tooltip>
               }
          </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
                {property?.address}
            </Typography>
            </Box>
            <Box> {/* PASTE Crunch Score inside this Box */} 
              {/* Remove this comment: Add any additional actions you want to display here */}
              {/* Add Crunch Score display here */}
              <Tooltip title={crunchScoreTooltip} arrow>
                <Box 
                  sx={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    mt: { xs: 1, sm: 0.5 }, // Adjusted margin-top for spacing
                    justifyContent: 'flex-end',
                    // Styling enhancements (copied from previous location)
                    px: 1.5,
                    py: 0.5,
                    borderRadius: '16px', // Increased for pill shape
                    backgroundColor: 
                      crunchScore >= 65 ? 'success.light' : 
                      crunchScore >= 45 ? 'warning.light' : 
                      'error.light',
                    color: 
                      crunchScore >= 45 ? 'text.primary' : // Dark text for lighter backgrounds
                      'common.white' // White text for darker (error) background
                  }}
                >
                  <Typography variant="body1" fontWeight="medium" sx={{ mr: 0.5, color: 'common.white' }}> {/* Explicitly set white */} 
                      Crunch Score:
                  </Typography>
                  <Typography variant="h6" fontWeight="bold" sx={{ color: 'common.white' }}> {/* Explicitly set white */} 
                    {crunchScore.toFixed(0)} 
                  </Typography>
                    <InfoIcon sx={{ fontSize: '1rem', ml: 0.5, color: 'common.white' }} /> {/* Explicitly set white */} 
                </Box>
              </Tooltip>
            </Box>
          </Box>
        </Box>
        
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 4, mb: 4 }}>
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
                <a href={property.url} target="_blank" rel="noopener noreferrer" className="quick-link">
                  <HomeIcon sx={{ fontSize: 16, mr: 0.5, color: '#0D6EFD' }} /> Zillow
                </a>
                <a href={rentCastUrl} target="_blank" rel="noopener noreferrer" className="quick-link">
                  <BarChartIcon sx={{ fontSize: 16, mr: 0.5, color: '#6366F1' }} /> RentCast
                </a>
              </Box>
            </Paper>
          </Box>
          
          {/* Right column: Cashflow Analysis & Settings */}
          <Box sx={{ flex: '1', maxWidth: { xs: '100%', md: '60%' } }}>
            {/* Cashflow Header */}
            <Paper sx={{ p: 3, borderRadius: 2, mb: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="h5">Cashflow Analysis</Typography>
                <Box sx={{ textAlign: 'right' }}> {/* Align text within this box */} 
                  <Typography 
                    variant="h5" 
                    fontWeight="bold" 
                    color={cashflow.monthlyCashflow >= 0 ? 'success.main' : 'error.main'}
                    sx={{ textAlign: 'right' }}
                  >
                    {formatCurrency(cashflow.monthlyCashflow)}/mo
                  </Typography>
                  <Typography 
                    variant="body2" 
                    color={cashflow.annualCashflow >= 0 ? 'success.main' : 'error.main'}
                    sx={{ textAlign: 'right' }}
                  >
                    {formatCurrency(cashflow.annualCashflow)}/year
                  </Typography>
                </Box>
              </Box>
              
              <Divider sx={{ my: 2 }} />
              
              <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ bgcolor: '#f9f9f9', p: 2, borderRadius: 2 }}>
                    <Typography variant="subtitle2" gutterBottom fontWeight="bold">Monthly Income</Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5, alignItems: 'center' }}>
                      <Typography variant="body2">Rental Income:</Typography>
                      <TextField
                        variant="outlined" 
                        size="small"
                        value={isRentEditing ? displayRent : formatCurrency(customRentEstimate !== null ? customRentEstimate : property.rent_estimate)}
                        onChange={handleRentChange}
                        onFocus={handleRentFocus}
                        onBlur={handleRentBlur}
                        sx={{ maxWidth: '120px' }}
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
                  </Box>
                </Box>
                
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ bgcolor: '#f0f7ff', p: 2, borderRadius: 2 }}>
                    <Typography variant="subtitle2" gutterBottom fontWeight="bold">Annual Returns</Typography>
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
                  <Typography variant="body2">Initial Rehab:</Typography> {/* Added Rehab */}
                  <Typography variant="body2">{formatCurrency(settings.rehabAmount)}</Typography>
                </Box>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2">Closing Costs (est. 3%):</Typography>
                  <Typography variant="body2">{formatCurrency(closingCosts)}</Typography> {/* Use calculated closing costs */}
                </Box>
                
                <Divider sx={{ my: 1 }} />
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2" fontWeight="bold">Total Investment:</Typography>
                  <Typography variant="body2" fontWeight="bold">{formatCurrency(totalInvestment)}</Typography> {/* Use calculated total investment */}
                </Box>
              </Box>
            </Paper>
            
            {/* Assumptions Tab - positioned relative to drawer edge */}
            <div 
              className="assumptions-tab"
              onClick={() => setIsAssumptionsDrawerOpen(!isAssumptionsDrawerOpen)}
              style={{
                position: 'fixed',
                right: isAssumptionsDrawerOpen ? '350px' : '0',
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
                transition: 'right 225ms cubic-bezier(0, 0, 0.2, 1) 0ms'
              }}
            >
              <TuneIcon /> {/* Replace ExpandMoreIcon with TuneIcon */}
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
                  borderTopLeftRadius: 0,
                  borderBottomLeftRadius: 0,
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
              <Typography variant="h6" fontWeight="medium" gutterBottom> 
                Customize Assumptions
              </Typography>

              {/* Sliders use settings state and handleSettingChange */}
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" gutterBottom>
                  <Tooltip title="The annual interest rate for your mortgage loan. Higher rates increase your monthly payment." arrow>
                    <span>Interest Rate: {settings.interestRate}%</span>
                  </Tooltip>
                </Typography>
                <Slider value={settings.interestRate} onChange={handleSettingChange('interestRate')} aria-labelledby="interest-rate-slider" valueLabelDisplay="auto" step={0.1} min={0.1} max={15} sx={{ color: '#4f46e5' }} />
              </Box>
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" gutterBottom>
                  <Tooltip title="The number of years you'll be paying your mortgage. Longer terms reduce monthly payments but increase total interest paid." arrow>
                    <span>Loan Term: {settings.loanTerm} years</span>
                  </Tooltip>
                </Typography>
                <Slider value={settings.loanTerm} onChange={handleSettingChange('loanTerm')} aria-labelledby="loan-term-slider" valueLabelDisplay="auto" step={1} min={5} max={40} sx={{ color: '#4f46e5' }} />
              </Box>
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" gutterBottom>
                  <Tooltip title="Percentage of the property price you pay upfront. Higher down payments reduce your loan amount and monthly payments." arrow>
                    <span>Down Payment: {settings.downPaymentPercent}%</span>
                  </Tooltip>
                </Typography>
                <Slider value={settings.downPaymentPercent} onChange={handleSettingChange('downPaymentPercent')} aria-labelledby="down-payment-slider" valueLabelDisplay="auto" step={1} min={0} max={100} sx={{ color: '#4f46e5' }} />
              </Box>
              
              {/* --- Add Initial Rehab Slider --- */}
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" gutterBottom>
                  <Tooltip title="Initial rehab costs needed before renting. This amount is added to your total investment when calculating ROI." arrow>
                    <span>Initial Rehab: {formatCurrency(settings.rehabAmount)}</span>
                  </Tooltip>
                </Typography>
                <Slider 
                  value={settings.rehabAmount} 
                  onChange={handleSettingChange('rehabAmount')} 
                  min={0} 
                  max={100000} // Increased max to 100k
                  step={500} 
                  valueLabelDisplay="auto" 
                  valueLabelFormat={(value) => formatCurrency(value)}
                  sx={{ color: '#4f46e5' }} 
                />
              </Box>
              {/* --- End Initial Rehab Slider --- */}
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" gutterBottom>
                  <Tooltip title="Annual property taxes and insurance calculated as a percentage of property value. Varies by location." arrow>
                    <span>Property Tax & Insurance: {settings.taxInsurancePercent}%</span>
                  </Tooltip>
                </Typography>
                <Slider value={settings.taxInsurancePercent} onChange={handleSettingChange('taxInsurancePercent')} min={0} max={5} step={0.1} valueLabelDisplay="auto" valueLabelFormat={(value) => `${value}%`} sx={{ color: '#4f46e5' }} />
              </Box>
              
              {/* Original slider content continues... */}
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" gutterBottom>
                  <Tooltip title="Accounts for periods when the property is vacant between tenants. Typical range is 5-8%." arrow>
                    <span>Vacancy: {settings.vacancyPercent}%</span>
                  </Tooltip>
                </Typography>
                <Slider value={settings.vacancyPercent} onChange={handleSettingChange('vacancyPercent')} min={0} max={10} step={1} valueLabelDisplay="auto" valueLabelFormat={(value) => `${value}%`} sx={{ color: '#4f46e5' }} />
              </Box>
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" gutterBottom>
                  <Tooltip title="Capital Expenditures: Savings for major replacements like roof, HVAC, etc. Typically 5-10% of rental income." arrow>
                    <span>CapEx: {settings.capexPercent}%</span>
                  </Tooltip>
                </Typography>
                <Slider value={settings.capexPercent} onChange={handleSettingChange('capexPercent')} min={0} max={10} step={1} valueLabelDisplay="auto" valueLabelFormat={(value) => `${value}%`} sx={{ color: '#4f46e5' }} />
              </Box>
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" gutterBottom>
                  <Tooltip title="Fee for professional property management. Typical range is 8-12% of rental income." arrow>
                    <span>Property Management: {settings.propertyManagementPercent}%</span>
                  </Tooltip>
                </Typography>
                <Slider value={settings.propertyManagementPercent} onChange={handleSettingChange('propertyManagementPercent')} min={0} max={20} step={1} valueLabelDisplay="auto" valueLabelFormat={(value) => `${value}%`} sx={{ color: '#4f46e5' }} />
              </Box>
              
              <Typography variant="h6" fontWeight="medium" sx={{ mt: 4, mb: 2 }}>
                Long-Term Projection
              </Typography>
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" gutterBottom>
                  <Tooltip title="Annual percentage increase in rental rates due to inflation and market demand. Historically averages 2-4% in most markets." arrow>
                    <span>Annual Rent Appreciation: {rentAppreciationRate}%</span>
                  </Tooltip>
                </Typography>
                <Slider 
                  value={rentAppreciationRate} 
                  onChange={handleRentAppreciationChange} 
                  min={0} 
                  max={10} 
                  step={0.1} 
                  valueLabelDisplay="auto" 
                  valueLabelFormat={(value) => `${value}%`}
                  sx={{ color: '#4f46e5' }}
                />
              </Box>
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" gutterBottom>
                  <Tooltip title="Annual percentage increase in property value over time. Historically real estate appreciates at 3-5% annually over the long term." arrow>
                    <span>Property Value Increase: {propertyValueIncreaseRate}%</span>
                  </Tooltip>
                </Typography>
                <Slider 
                  value={propertyValueIncreaseRate} 
                  onChange={handlePropertyValueIncreaseChange} 
                  min={0} 
                  max={10} 
                  step={0.1} 
                  valueLabelDisplay="auto" 
                  valueLabelFormat={(value) => `${value}%`}
                  sx={{ color: '#4f46e5' }}
                />
              </Box>
            </Drawer>
          </Box>
        </Box>
        
        {/* Notes Section - Add this before the Map */}
        <Paper sx={{ p: 3, borderRadius: 2, mb: 3 }}>
            <Typography variant="h5" mb={2}>Notes</Typography>
            <TextField
                fullWidth
                multiline
                rows={4}
                variant="outlined"
                placeholder="Add notes about this property... (saved with bookmarks & shared URLs)"
                value={notes}
                onChange={handleNotesChange}
                sx={{
                    '& .MuiOutlinedInput-root': {
                        borderRadius: 1,
                    },
                }}
            />
        </Paper>
        
        {/* Property Location Map */}
        <Paper sx={{ p: 3, borderRadius: 2, mb: 3 }}>
          <Typography variant="h5" mb={2}>Property Location</Typography>
          <PropertyMap 
            address={property.address} 
            lat={property.latitude || null} 
            lng={property.longitude || null} 
          />
        </Paper>

        {/* Cashflow Sankey Diagram */}
        <Paper sx={{ p: 3, borderRadius: 2, mb: 3 }}>
        {cashflow && (
              <CashflowSankeyChart
                data={{
                  rentalIncome: customRentEstimate !== null ? customRentEstimate : property.rent_estimate,
                  mortgage: cashflow.monthlyMortgage,
                  taxInsurance: cashflow.monthlyTaxInsurance,
                  vacancy: cashflow.monthlyVacancy,
                  capex: cashflow.monthlyCapex,
                  propertyManagement: cashflow.monthlyPropertyManagement,
                  monthlyCashflow: cashflow.monthlyCashflow
                }}
                formatCurrency={formatCurrency}
              />
          )}
          </Paper>
        
        {/* Add new Long-Term Cashflow Analysis Section - Moved outside the columns to span full width */}
        <Paper sx={{ p: 3, borderRadius: 2, mb: 3 }}>
          <Typography variant="h5" mb={2}>Long-Term Cashflow Analysis</Typography>
          
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>Projection Assumptions</Typography>
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 3 }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" gutterBottom>
                  <Tooltip title="Expected annual increase in rental rates due to inflation and market demand. Historically averages 2-4% in most markets." arrow>
                    <span>Annual Rent Appreciation: {rentAppreciationRate}%</span>
                  </Tooltip>
                </Typography>
                <Slider value={rentAppreciationRate} onChange={handleRentAppreciationChange} aria-labelledby="rent-appreciation-slider" valueLabelDisplay="auto" step={0.1} min={0} max={10} sx={{ color: '#4f46e5' }} />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" gutterBottom>
                  <Tooltip title="Expected annual increase in property value over time. Historically real estate appreciates at 3-5% annually over the long term." arrow>
                    <span>Property Value Increase: {propertyValueIncreaseRate}%</span>
                  </Tooltip>
                </Typography>
                <Slider value={propertyValueIncreaseRate} onChange={handlePropertyValueIncreaseChange} aria-labelledby="property-value-slider" valueLabelDisplay="auto" step={0.1} min={0} max={10} sx={{ color: '#4f46e5' }} />
              </Box>
            </Box>
          </Box>
          
          <Box sx={{ width: '100%', mb: 4, height: 300 }}>
            <Typography variant="subtitle2" gutterBottom>Property Value & Equity Growth</Typography>
            <SimpleChart 
              data={{
                years: chartYears,
                propertyValues: chartPropertyValues,
                equity: chartEquity,
                cashflow: chartCashflow
              }}
              height={300}
            />
          </Box>
          
          <Box sx={{ overflowX: 'auto' }}>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>
                      <Tooltip title="Projection year" arrow placement="top">
                        <span>Year</span>
                      </Tooltip>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip 
                        title="Estimated property value after appreciation. Calculated using the initial property price compounded annually by the property value increase rate." 
                        arrow 
                        placement="top"
                      >
                        <span>Property Value</span>
                      </Tooltip>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip 
                        title="Projected annual rental income. Calculated using the initial rent amount compounded annually by the rent appreciation rate." 
                        arrow 
                        placement="top"
                      >
                        <span>Annual Rent</span>
                      </Tooltip>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip 
                        title="Total annual expenses including mortgage, taxes, insurance, vacancy, capital expenditures, and property management." 
                        arrow 
                        placement="top"
                      >
                        <span>Expenses</span>
                      </Tooltip>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip 
                        title="Annual rental income minus all expenses. Represents your profit or loss each year." 
                        arrow 
                        placement="top"
                      >
                        <span>Cashflow</span>
                      </Tooltip>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip 
                        title="Your ownership stake in the property. Calculated as property value minus remaining mortgage balance. Grows through principal payments and property appreciation." 
                        arrow 
                        placement="top"
                      >
                        <span>Equity</span>
                      </Tooltip>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip 
                        title="Return on Investment percentage based on cashflow. Calculated as (Annual Cashflow / Initial Investment) * 100%." 
                        arrow 
                        placement="top"
                      >
                        <span>ROI (Cashflow)</span>
                      </Tooltip>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip 
                        title="Total Return on Investment including both cashflow and equity growth. Calculated as ((Annual Cashflow + Annual Equity Growth) / Initial Investment) * 100%." 
                        arrow 
                        placement="top"
                      >
                        <span>ROI with Equity</span>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {longTermCashflowData
                    .filter(data => [1, 5, 10, 15, 20, 25, 30].includes(data.year))
                    .map((data) => (
                      <TableRow key={data.year}>
                        <TableCell>{data.year}</TableCell>
                        <TableCell align="right">{formatCurrency(data.propertyValue)}</TableCell>
                        <TableCell align="right">{formatCurrency(data.annualRent)}</TableCell>
                        <TableCell align="right">{formatCurrency(data.yearlyExpenses)}</TableCell>
                        <TableCell 
                          align="right"
                          sx={{ color: data.yearlyCashflow >= 0 ? 'success.main' : 'error.main' }}
                        >
                          {formatCurrency(data.yearlyCashflow)}
                        </TableCell>
                        <TableCell align="right">{formatCurrency(data.equity)}</TableCell>
                        <TableCell 
                          align="right"
                          sx={{ color: data.roi >= 0 ? 'success.main' : 'error.main' }}
                        >
                          {formatPercent(data.roi)}
                        </TableCell>
                        <TableCell 
                          align="right"
                          sx={{ color: data.roiWithEquity >= 0 ? 'success.main' : 'error.main' }}
                        >
                          {formatPercent(data.roiWithEquity)}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </Paper>

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
              const relevantCashflows = longTermCashflowData // Use memoized data
                .filter(data => data.year <= holdingPeriod)
                .map(data => data.yearlyCashflow);
                
              // Get final property value and equity for the exit scenario
              const finalYearData = longTermCashflowData.find(data => data.year === holdingPeriod);
              const finalEquity = finalYearData ? finalYearData.equity : 0;
              
              // Assume sale at end of period and use equity as final value
              // Make sure to use the totalInvestment calculated earlier
              const irr = calculateIRR(
                totalInvestment, // Use total investment including rehab
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
      </Container>

      {/* PDF Preview Modal */}
      <Dialog
        open={showPdfModal}
        onClose={handleClosePdfModal}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            maxHeight: '90vh', 
            height: 'auto',
            width: '100%',
            maxWidth: '960px',
            m: 2
          }
        }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">PDF Report Preview</Typography>
          <IconButton onClick={handleClosePdfModal} edge="end">
            <ExpandMoreIcon sx={{ transform: 'rotate(180deg)' }} />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 0, overflow: 'auto' }}>
          <Box sx={{ 
            bgcolor: '#f3f4f6', 
            display: 'flex', 
            justifyContent: 'center', 
            p: 2, 
            overflow: 'auto'
          }}>
            {/* Render PDF component conditionally based on data availability */}
            {property && cashflow && (
              <PropertyPDFReport
                ref={targetRef}
                property={property}
                cashflow={cashflow}
                settings={settings}
                customRentEstimate={customRentEstimate}
                notes={notes}
                generateShareableURL={generateShareableURL}
                generateLongTermCashflow={generateLongTermCashflow}
                formatCurrency={formatCurrency}
                formatPercent={formatPercent}
                calculateIRR={calculateIRR} // Pass IRR function
                yearsToProject={yearsToProject}
                rentAppreciationRate={rentAppreciationRate}
                propertyValueIncreaseRate={propertyValueIncreaseRate}
                effectivePrice={effectivePrice}
              />
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClosePdfModal}>Cancel</Button>
          <Button 
            variant="contained" 
            color="primary"
            startIcon={<PdfIcon />}
            onClick={handleDownloadPDF}
          >
            Download PDF
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default PropertyDetailsPage; 