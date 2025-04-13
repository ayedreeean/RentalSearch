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
  CssBaseline,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip
} from '@mui/material';
import HomeWorkIcon from '@mui/icons-material/HomeWork';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import HomeIcon from '@mui/icons-material/Home';
import BarChartIcon from '@mui/icons-material/BarChart';
import EditIcon from '@mui/icons-material/Edit';
import ShareIcon from '@mui/icons-material/Share';
import EmailIcon from '@mui/icons-material/Email';
import TuneIcon from '@mui/icons-material/Tune';
import LinkIcon from '@mui/icons-material/Link';
import { Property, Cashflow, CashflowSettings } from '../types';
// import { LineChart } from '@mui/x-charts/LineChart';

interface PropertyDetailsPageProps {
  properties: Property[];
  calculateCashflow: (property: Property, settings: CashflowSettings) => Cashflow;
  formatCurrency: (amount: number) => string;
  formatPercent: (percent: number) => string;
  defaultSettings: CashflowSettings;
}

// Add the interface for long-term cashflow data
interface YearlyProjection {
  year: number;
  propertyValue: number;
  annualRent: number;
  yearlyExpenses: number;
  yearlyCashflow: number;
  equity: number;
  roi: number;
}

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
    const maxPropertyValue = Math.max(...data.propertyValues);
    const maxEquity = Math.max(...data.equity);
    const maxPrimaryY = Math.max(maxPropertyValue, maxEquity);
    
    // Calculate scales for secondary Y-axis (cashflow)
    const maxCashflow = Math.max(...data.cashflow);
    const minCashflow = Math.min(...data.cashflow);
    
    // For positive-only data, start at 0. For data with negatives, include the negative range.
    const minSecondaryY = Math.min(0, minCashflow);
    const maxSecondaryY = Math.max(0, maxCashflow);
    
    // Calculate ratios to maintain proper scale proportions
    const primaryToSecondaryRatio = maxPrimaryY / maxSecondaryY;
    
    // Add padding to both scales
    const primaryYPadding = maxPrimaryY * 0.1;
    const secondaryYRange = maxSecondaryY - minSecondaryY;
    const secondaryYPadding = secondaryYRange * 0.2; // More padding for cashflow scale
    
    // Determine the effective min/max for both axes, ensuring full visibility
    const effectiveMinPrimaryY = 0; // Keep primary axis starting at 0
    const effectiveMaxPrimaryY = maxPrimaryY + primaryYPadding;
    
    // Adjust secondary axis min/max to ensure all data is visible
    // but maintain proportional relationship with primary axis
    const effectiveMinSecondaryY = minSecondaryY - (minSecondaryY < 0 ? secondaryYPadding : 0);
    const effectiveMaxSecondaryY = maxSecondaryY + secondaryYPadding;
    
    // Ensure the secondary scale can represent all data points
    // by applying the primary:secondary ratio to determine appropriate scaling
    const adjustedMaxSecondary = Math.max(effectiveMaxSecondaryY, effectiveMaxPrimaryY / primaryToSecondaryRatio);
    
    // Calculate Y scales with adjusted ranges to ensure all data fits
    const primaryYScale = chartHeight / (effectiveMaxPrimaryY - effectiveMinPrimaryY);
    const secondaryYScale = chartHeight / (adjustedMaxSecondary - effectiveMinSecondaryY);
    
    // Calculate zero Y-coordinate position (will be the same for both axes)
    const zeroYCoordinate = canvasHeight - padding.bottom - ((0 - effectiveMinSecondaryY) * secondaryYScale);
    
    // Function to convert a primary Y value to canvas coordinate
    const getPrimaryYCoordinate = (value: number) => {
      // Align the zero point to match the secondary axis zero point
      return zeroYCoordinate - ((value - 0) * primaryYScale);
    };
    
    // Function to convert a secondary Y value to canvas coordinate
    const getSecondaryYCoordinate = (value: number) => {
      return canvasHeight - padding.bottom - ((value - effectiveMinSecondaryY) * secondaryYScale);
    };
    
    // Calculate plot area width (space available for data points)
    const plotAreaWidth = chartWidth;
    
    // Use data-based X coordinates instead of evenly spaced
    // Calculate X scale with proper inset to keep bars within bounds
    // For n points, divide width into n sections instead of n-1
    const xScale = plotAreaWidth / Math.max(data.years.length - 1, 1);
    
    // Draw background grid
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 1;
    
    // Draw horizontal grid lines for primary axis
    const primaryGridStep = Math.ceil(effectiveMaxPrimaryY / 5);
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
    
    // Calculate step size for primary Y axis labels - use fewer labels to avoid overlap
    const optimalStepCount = 5;
    let primaryStepSize = Math.ceil(effectiveMaxPrimaryY / optimalStepCount);
    
    // Round step size to a nice number
    const primaryMagnitude = Math.pow(10, Math.floor(Math.log10(primaryStepSize)));
    primaryStepSize = Math.ceil(primaryStepSize / primaryMagnitude) * primaryMagnitude;
    
    // Draw primary Y axis labels
    for (let i = 0; i <= effectiveMaxPrimaryY; i += primaryStepSize) {
      if (i > effectiveMaxPrimaryY) break;
      const y = getPrimaryYCoordinate(i);
      
      // Format large numbers with K or M suffix
      let label;
      if (i >= 1000000) {
        label = '$' + (i / 1000000).toFixed(1) + 'M';
      } else if (i >= 1000) {
        label = '$' + (i / 1000).toFixed(0) + 'K';
      } else {
        label = '$' + i;
      }
      
      ctx.fillText(label, padding.left - 8, y);
    }
    
    // Draw secondary Y-axis labels (right - cashflow)
    ctx.textAlign = 'left';
    
    // Calculate step size for secondary Y axis labels
    let secondaryStepSize = (adjustedMaxSecondary - effectiveMinSecondaryY) / optimalStepCount;
    
    // Round step size to a nice number
    const secondaryMagnitude = Math.pow(10, Math.floor(Math.log10(secondaryStepSize)));
    secondaryStepSize = Math.ceil(secondaryStepSize / secondaryMagnitude) * secondaryMagnitude;
    
    // Start from the lowest multiple of stepSize below effectiveMinSecondaryY
    let secondaryLabelValue = Math.floor(effectiveMinSecondaryY / secondaryStepSize) * secondaryStepSize;
    
    // Draw secondary Y axis labels
    while (secondaryLabelValue <= adjustedMaxSecondary) {
      const y = getSecondaryYCoordinate(secondaryLabelValue);
      
      // Format with K suffix for thousands
      let label;
      if (Math.abs(secondaryLabelValue) >= 1000) {
        label = '$' + (secondaryLabelValue / 1000).toFixed(1) + 'K';
      } else {
        label = '$' + secondaryLabelValue;
      }
      
      // Add cashflow label on right axis
      ctx.fillText(label, canvasWidth - padding.right + 8, y);
      
      // If we're at zero, make the line a bit darker for both axes
      if (secondaryLabelValue === 0) {
        ctx.strokeStyle = '#999';
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(canvasWidth - padding.right, y);
        ctx.stroke();
        ctx.strokeStyle = '#ccc'; // Reset for other lines
      }
      
      secondaryLabelValue += secondaryStepSize;
    }
    
    // Draw X-axis labels (selected years to avoid overcrowding)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#666';
    
    // Select a subset of years to display (e.g., years 1, 5, 10, 15, 20, 25, 30)
    const yearsToShow = [1, 5, 10, 15, 20, 25, 30].filter(year => year <= data.years.length);
    
    // If we have a small number of years, show all of them
    const displayYears = data.years.length <= 10 ? data.years : yearsToShow;
    
    displayYears.forEach(yearToShow => {
      const index = data.years.indexOf(yearToShow);
      if (index !== -1) {
        const x = padding.left + (index * xScale);
        ctx.fillText(yearToShow.toString(), x, canvasHeight - padding.bottom + 5);
        
        // Add light vertical grid line
        ctx.strokeStyle = '#f0f0f0';
        ctx.beginPath();
        ctx.moveTo(x, padding.top);
        ctx.lineTo(x, canvasHeight - padding.bottom);
        ctx.stroke();
      }
    });
    
    // Draw axis titles with better positioning
    ctx.textAlign = 'center';
    ctx.font = 'bold 11px Arial';
    ctx.fillStyle = '#555';
    
    // Primary Y-axis title (left)
    ctx.save();
    ctx.translate(padding.left - 60, padding.top + chartHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Property Value & Equity ($)', 0, 0);
    ctx.restore();
    
    // Secondary Y-axis title (right)
    ctx.save();
    ctx.translate(canvasWidth - padding.right + 60, padding.top + chartHeight / 2);
    ctx.rotate(Math.PI / 2);
    ctx.fillText('Annual Cashflow ($)', 0, 0);
    ctx.restore();
    
    // X-axis title
    ctx.fillText('Year', padding.left + chartWidth / 2, canvasHeight - 10);
    
    // Draw property value line using primary Y-axis
    if (data.propertyValues.length > 1) {
      ctx.strokeStyle = '#4f46e5'; // Purple
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      for (let i = 0; i < data.propertyValues.length; i++) {
        const x = padding.left + (i * xScale);
        const y = getPrimaryYCoordinate(data.propertyValues[i]);
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      
      ctx.stroke();
    }
    
    // Draw equity line using primary Y-axis
    if (data.equity.length > 1) {
      ctx.strokeStyle = '#10b981'; // Green
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      for (let i = 0; i < data.equity.length; i++) {
        const x = padding.left + (i * xScale);
        const y = getPrimaryYCoordinate(data.equity[i]);
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      
      ctx.stroke();
    }
    
    // Calculate optimal bar width based on available space
    // Make bars narrower to ensure they stay within bounds
    const barWidth = Math.min(xScale * 0.4, 12); // Narrower bars with a maximum width
    
    // Draw cashflow bars using secondary Y-axis
    for (let i = 0; i < data.cashflow.length; i++) {
      // Calculate x position with special handling for first and last bars to keep them within bounds
      let x;
      if (i === 0) {
        // First bar should start exactly at the left boundary
        x = padding.left;
      } else if (i === data.cashflow.length - 1) {
        // Last bar should end exactly at the right boundary
        x = (canvasWidth - padding.right) - barWidth;
      } else {
        // Center the bars for middle points
        x = padding.left + (i * xScale) - (barWidth / 2);
      }
      
      const cashflowValue = data.cashflow[i];
      const zeroY = getSecondaryYCoordinate(0);
      const valueY = getSecondaryYCoordinate(cashflowValue);
      const barHeight = Math.abs(zeroY - valueY);
      
      // Set color based on positive/negative cashflow
      ctx.fillStyle = cashflowValue >= 0 ? '#f97316' : '#ef4444'; // Orange for positive, red for negative
      
      // Draw bar from zero baseline
      if (cashflowValue >= 0) {
        // Positive cashflow - draw up from zero line
        ctx.fillRect(x, valueY, barWidth, barHeight);
      } else {
        // Negative cashflow - draw down from zero line
        ctx.fillRect(x, zeroY, barWidth, barHeight);
      }
    }
    
    // Draw legend at the bottom of the chart
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = '12px Arial';
    ctx.fillStyle = '#333';
    
    const legendItems = [
      { label: 'Property Value', color: '#4f46e5' },
      { label: 'Equity', color: '#10b981' },
      { label: 'Annual Cashflow', color: '#f97316' }
    ];
    
    const legendWidth = 150;  // Width allocated for each legend item
    const legendStartX = (canvasWidth - (legendItems.length * legendWidth)) / 2;
    const legendY = canvasHeight - 15;  // Place at the bottom
    
    // Draw legend background to ensure better visibility
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillRect(legendStartX - 10, legendY - 15, (legendItems.length * legendWidth) + 20, 30);
    
    legendItems.forEach((item, index) => {
      const x = legendStartX + (index * legendWidth);
      
      ctx.fillStyle = item.color;
      ctx.fillRect(x, legendY - 5, 15, 10);
      
      ctx.fillStyle = '#333';
      ctx.fillText(item.label, x + 20, legendY);
    });
    
    // If we have hover data, draw a vertical indicator line
    if (hoverInfo && hoverInfo.visible) {
      const hoverX = hoverInfo.x;
      
      // Draw vertical hover line
      ctx.save();
      ctx.strokeStyle = 'rgba(100, 100, 100, 0.5)';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 3]);
      ctx.beginPath();
      ctx.moveTo(hoverX, padding.top);
      ctx.lineTo(hoverX, canvasHeight - padding.bottom);
      ctx.stroke();
      ctx.restore();
    }
    
  }, [data, hoverInfo]);
  
  // Draw chart on mount and when data or hover state changes
  React.useEffect(() => {
    drawChart();
  }, [drawChart]);
  
  // Add mouse move handler for tooltip
  const handleMouseMove = React.useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Calculate chart dimensions
    const canvasWidth = canvas.offsetWidth;
    const canvasHeight = canvas.offsetHeight;
    
    const padding = {
      top: 50,
      right: 110,
      bottom: 80,
      left: 110
    };
    
    const chartWidth = canvasWidth - padding.left - padding.right;
    const plotAreaWidth = chartWidth;
    const xScale = plotAreaWidth / Math.max(data.years.length - 1, 1);
    
    // Check if mouse is in chart area
    if (
      x >= padding.left && 
      x <= canvasWidth - padding.right && 
      y >= padding.top && 
      y <= canvasHeight - padding.bottom
    ) {
      // Find closest data point
      const dataIndex = Math.round((x - padding.left) / xScale);
      
      // Ensure index is within bounds
      if (dataIndex >= 0 && dataIndex < data.years.length) {
        // Calculate the exact x position of the data point
        const dataPointX = padding.left + (dataIndex * xScale);
        
        setHoverInfo({
          visible: true,
          x: dataPointX,
          y: y,
          year: data.years[dataIndex],
          propertyValue: data.propertyValues[dataIndex],
          equity: data.equity[dataIndex],
          cashflow: data.cashflow[dataIndex]
        });
        return;
      }
    }
    
    // Mouse not over data point or chart area
    setHoverInfo(null);
  }, [data]);
  
  const handleMouseLeave = React.useCallback(() => {
    setHoverInfo(null);
  }, []);
  
  return (
    <Box sx={{ width: '100%', height, mb: 2, position: 'relative' }}>
      <canvas 
        ref={canvasRef} 
        style={{ 
          width: '100%', 
          height: '100%'
        }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />
      {/* Tooltip */}
      {hoverInfo && hoverInfo.visible && (
        <div
          style={{
            position: 'absolute',
            left: `${hoverInfo.x + 10}px`,
            top: `${hoverInfo.y - 80}px`,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            padding: '8px',
            borderRadius: '4px',
            fontSize: '12px',
            pointerEvents: 'none',
            zIndex: 1000,
            whiteSpace: 'nowrap'
          }}
        >
          <div>Year: {hoverInfo.year}</div>
          <div>Property Value: {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(hoverInfo.propertyValue)}</div>
          <div>Equity: {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(hoverInfo.equity)}</div>
          <div>Cashflow: {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(hoverInfo.cashflow)}</div>
        </div>
      )}
    </Box>
  );
};

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
  
  // Add state for long-term analysis
  const [rentAppreciationRate, setRentAppreciationRate] = useState<number>(3); // Default 3%
  const [propertyValueIncreaseRate, setPropertyValueIncreaseRate] = useState<number>(3); // Default 3%
  const [yearsToProject, setYearsToProject] = useState<number>(30); // Default 30 years
  
  // Load property data
  useEffect(() => {
    if (!propertyId) {
      setError('Invalid property ID');
      setLoading(false);
      return;
    }
    
    const foundProperty = properties.find(p => p.property_id === propertyId);
    
    if (!foundProperty) {
      // First check if property data is in the URL using the new format (d parameter)
      const searchParams = new URLSearchParams(location.search);
      const compressedData = searchParams.get('d');
      
      if (compressedData) {
        try {
          // Restore base64 padding if needed
          let base64Fixed = compressedData.replace(/-/g, '+').replace(/_/g, '/');
          // Add padding if needed
          switch (base64Fixed.length % 4) {
            case 2: base64Fixed += '=='; break;
            case 3: base64Fixed += '='; break;
          }
          
          // Decode the base64 string to JSON
          const jsonString = atob(base64Fixed);
          
          // Parse the JSON string to get the property object
          const decodedProperty = JSON.parse(jsonString) as Property;
          
          // Ensure all required fields are present
          if (decodedProperty && decodedProperty.property_id) {
            // Use the property data from the URL
            setProperty(decodedProperty);
            setLoading(false);
            
            // Initialize custom rent to property's rent estimate
            if (decodedProperty.rent_estimate) {
              setCustomRentEstimate(decodedProperty.rent_estimate);
              setDisplayRent(formatCurrency(decodedProperty.rent_estimate));
            }
            
            // Also save the property to localStorage for future use
            savePropertyToLocalStorage(decodedProperty);
            return;
          }
        } catch (error) {
          console.error('Error decoding property data from URL parameter d:', error);
        }
      }
      
      // Fall back to the old format (data parameter) for backwards compatibility
      const propertyData = searchParams.get('data');
      if (propertyData) {
        try {
          // Decode the property data from the URL
          const decodedProperty = JSON.parse(decodeURIComponent(propertyData)) as Property;
          
          // Use the property data from the URL
          setProperty(decodedProperty);
          setLoading(false);
          
          // Initialize custom rent to property's rent estimate
          if (decodedProperty.rent_estimate) {
            setCustomRentEstimate(decodedProperty.rent_estimate);
            setDisplayRent(formatCurrency(decodedProperty.rent_estimate));
          }
          
          // Also save the property to localStorage for future use
          savePropertyToLocalStorage(decodedProperty);
          return;
        } catch (error) {
          console.error('Error decoding property data from URL parameter data:', error);
        }
      }
      
      // Try to load from localStorage
      try {
        const savedPropertiesStr = localStorage.getItem('rentToolFinder_properties');
        if (savedPropertiesStr) {
          const savedProperties = JSON.parse(savedPropertiesStr);
          const savedProperty = savedProperties[propertyId];
          
          if (savedProperty) {
            setProperty(savedProperty);
            setLoading(false);
            
            // Initialize custom rent to property's rent estimate
            if (savedProperty.rent_estimate) {
              setCustomRentEstimate(savedProperty.rent_estimate);
              setDisplayRent(formatCurrency(savedProperty.rent_estimate));
            }
            return;
          }
        }
      } catch (error) {
        console.error('Error loading property from localStorage:', error);
      }
      
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
  }, [propertyId, properties, formatCurrency, location.search]);
  
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
  
  // Create a shareable URL with property data embedded
  const createShareableUrl = () => {
    if (!property) {
      console.error('Cannot create shareable URL: property is undefined');
      return;
    }
    
    try {
      // Create a minimal object with only the essential properties
      // to keep the URL as short as possible
      const minimalProperty = {
        property_id: property.property_id,
        address: property.address,
        price: property.price,
        rent_estimate: property.rent_estimate,
        ratio: property.ratio,
        thumbnail: property.thumbnail,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        sqft: property.sqft,
        url: property.url,
        days_on_market: property.days_on_market,
        rent_source: property.rent_source || "calculated"
      };
      
      // Compress the data before encoding to create a shorter URL
      // First, stringify the object to JSON
      const jsonString = JSON.stringify(minimalProperty);
      console.log('Property data JSON length:', jsonString.length);
      
      // Base64 encode the JSON string to make it URL-safe
      let base64Data = btoa(jsonString);
      
      // Make the base64 string URL-safe by replacing + with - and / with _
      base64Data = base64Data.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      console.log('Base64 encoded data length:', base64Data.length);
      
      // Get the base URL (without hash or search params)
      const url = new URL(window.location.href);
      const urlBase = url.origin + url.pathname;
      
      // Construct full URL with hash routing and query parameter
      // This works better with React Router's hash routing
      const fullUrl = `${urlBase}#/property/${property.property_id}?d=${base64Data}`;
      
      // Update the URL without reloading the page
      window.history.replaceState({}, '', fullUrl);
      
      // For debugging - log the URL length to console
      console.log(`Shareable URL created - Length: ${fullUrl.length} characters`);
      console.log(`Shareable URL: ${fullUrl}`);
      
      // Return the URL for direct use
      return fullUrl;
    } catch (error) {
      console.error('Error creating shareable URL:', error);
      return null;
    }
  };

  // Update copy to clipboard handler to directly use the created URL
  const handleCopyToClipboard = async () => {
    // Save the current property to localStorage to enable shared links to work
    if (property) {
      savePropertyToLocalStorage(property);
      
      // Generate the property summary
      const summary = generatePropertySummary();
      
      // Create a shareable URL and get the URL string
      const shareableUrl = createShareableUrl();
      
      try {
        // Copy the summary to clipboard
        await navigator.clipboard.writeText(summary);
        setCopySuccess('Copied to clipboard!');
        
        // Also log the shareable URL to console for troubleshooting
        console.log('Shareable URL for clipboard:', shareableUrl);
        
        setTimeout(() => setCopySuccess(''), 3000);
      } catch (err) {
        setCopySuccess('Failed to copy! Try selecting and copying the text manually.');
        console.error('Clipboard error:', err);
      }
    } else {
      console.error('Cannot copy to clipboard: property is undefined');
    }
  };

  // Update email share handler
  const handleEmailShare = () => {
    // Save the current property to localStorage to enable shared links to work
    if (property) {
      savePropertyToLocalStorage(property);
      
      // Create a shareable URL and get the URL string
      const shareableUrl = createShareableUrl();
      
      // Include the shareable URL in the email body
      const summary = encodeURIComponent(generatePropertySummary() + 
        '\n\nView this property online: ' + shareableUrl);
      const subject = encodeURIComponent(`Property Investment Analysis: ${property.address}`);
      
      // Log the URL for troubleshooting
      console.log('Shareable URL for email:', shareableUrl);
      
      window.open(`mailto:?subject=${subject}&body=${summary}`);
    } else {
      console.error('Cannot share via email: property is undefined');
    }
  };

  // Add new function to save property to localStorage
  const savePropertyToLocalStorage = (prop: Property) => {
    try {
      // Get existing saved properties
      const savedPropertiesStr = localStorage.getItem('rentToolFinder_properties');
      const savedProperties = savedPropertiesStr ? JSON.parse(savedPropertiesStr) : {};
      
      // Add or update this property
      savedProperties[prop.property_id] = prop;
      
      // Save back to localStorage
      localStorage.setItem('rentToolFinder_properties', JSON.stringify(savedProperties));
    } catch (error) {
      console.error('Error saving property to localStorage:', error);
    }
  };
  
  // Add handler for rent appreciation rate change
  const handleRentAppreciationChange = (_event: Event, newValue: number | number[]) => {
    setRentAppreciationRate(newValue as number);
  };
  
  // Add handler for property value increase rate change
  const handlePropertyValueIncreaseChange = (_event: Event, newValue: number | number[]) => {
    setPropertyValueIncreaseRate(newValue as number);
  };
  
  // Add handler for years to project change
  const handleYearsToProjectChange = (_event: Event, newValue: number | number[]) => {
    setYearsToProject(newValue as number);
  };
  
  // Function to generate long-term cashflow projections
  const generateLongTermCashflow = (): YearlyProjection[] => {
    if (!property || !cashflow) return [];
    
    const years: YearlyProjection[] = [];
    // Get the initial monthly rent
    const initialMonthlyRent = customRentEstimate !== null ? customRentEstimate : property.rent_estimate;
    // Calculate initial annual rent
    const initialAnnualRent = initialMonthlyRent * 12;
    let propertyValue = property.price;
    
    // Calculate initial equity (down payment)
    let equity = property.price * (settings.downPaymentPercent / 100);
    
    // Calculate loan details
    const loanAmount = property.price - equity;
    const monthlyInterestRate = settings.interestRate / 100 / 12;
    const totalPayments = settings.loanTerm * 12;
    
    // Calculate remaining principal as of start
    let remainingPrincipal = loanAmount;
    
    for (let i = 1; i <= yearsToProject; i++) {
      // Calculate rent with appreciation compounding properly from initial value
      const yearRent = initialAnnualRent * Math.pow(1 + rentAppreciationRate / 100, i - 1);
      
      // Increase property value with appreciation (compounding)
      propertyValue = property.price * Math.pow(1 + propertyValueIncreaseRate / 100, i - 1);
      
      // Calculate expenses
      const yearlyMortgage = cashflow.monthlyMortgage * 12; // Mortgage stays fixed
      
      // Tax and insurance typically increase with property value
      const yearlyTaxInsurance = cashflow.monthlyTaxInsurance * 12 * Math.pow(1 + propertyValueIncreaseRate / 100, i - 1);
      
      // Other expenses are calculated as percentage of rent
      const yearlyVacancy = yearRent * (settings.vacancyPercent / 100);
      const yearlyCapex = yearRent * (settings.capexPercent / 100);
      const yearlyPropertyManagement = yearRent * (settings.propertyManagementPercent / 100);
      
      // Total expenses for the year
      const yearlyExpenses = yearlyMortgage + yearlyTaxInsurance + yearlyVacancy + yearlyCapex + yearlyPropertyManagement;
      
      // Cashflow for the year
      const yearlyCashflow = yearRent - yearlyExpenses;
      
      // Calculate principal paid this year using amortization
      let principalPaidThisYear = 0;
      
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
          principalPaidThisYear += principalPayment;
          
          // Reduce remaining principal
          remainingPrincipal = Math.max(0, remainingPrincipal - principalPayment);
        }
      }
      
      // Update equity (original down payment + principal paid so far + appreciation)
      equity = propertyValue - remainingPrincipal;
      
      // Calculate ROI
      const initialInvestment = property.price * (settings.downPaymentPercent / 100) + property.price * 0.03;
      const cashOnCashReturn = (yearlyCashflow / initialInvestment) * 100;
      
      years.push({
        year: i,
        propertyValue,
        annualRent: yearRent,
        yearlyExpenses,
        yearlyCashflow,
        equity,
        roi: cashOnCashReturn
      });
      
      // No need to update annualRent for the next iteration since we're using the power function
      // with the initial value for proper compounding
    }
    
    return years;
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
  
  // Add a handler function to copy just the URL to clipboard
  const handleShareUrl = async () => {
    if (property) {
      // Save the property to localStorage
      savePropertyToLocalStorage(property);
      
      // Create the shareable URL and get the URL string
      const shareableUrl = createShareableUrl();
      
      if (shareableUrl) {
        try {
          // Copy the URL to clipboard
          await navigator.clipboard.writeText(shareableUrl);
          setCopySuccess('URL copied to clipboard!');
          setTimeout(() => setCopySuccess(''), 3000);
        } catch (err) {
          setCopySuccess('Failed to copy URL. Try copying it from the address bar.');
          console.error('Clipboard error:', err);
        }
      }
    } else {
      console.error('Cannot share URL: property is undefined');
    }
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
  
  // Generate long-term cashflow data
  const longTermCashflowData: YearlyProjection[] = generateLongTermCashflow();
  
  // Generate chart data
  const chartYears = longTermCashflowData.map(data => data.year);
  const chartPropertyValues = longTermCashflowData.map(data => data.propertyValue);
  const chartEquity = longTermCashflowData.map(data => data.equity);
  const chartCashflow = longTermCashflowData.map(data => data.yearlyCashflow);
  
  return (
    <>
      <CssBaseline />
      <AppBar position="sticky" elevation={0} sx={{ 
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        bgcolor: '#6366f1'
      }}>
        <Toolbar sx={{ flexWrap: 'wrap' }}>
          <IconButton 
            edge="start" 
            color="inherit"
            aria-label="back" 
            onClick={handleBackToSearch}
            sx={{ mr: 2 }}
          >
            <ArrowBackIcon />
          </IconButton>
          <HomeWorkIcon sx={{ mr: 1, color: 'white' }} />
          <Typography variant="h6" color="inherit" noWrap sx={{ flexGrow: 1 }}>
            RentalSearch
          </Typography>
          
          {/* Mobile-friendly button group with dropdown on small screens */}
          <Box sx={{ 
            display: { xs: 'none', sm: 'flex' }, 
            gap: 1 
          }}>
            <Button 
              variant="outlined" 
              startIcon={<LinkIcon />}
              onClick={handleShareUrl}
              color="inherit"
              sx={{ borderColor: 'rgba(255,255,255,0.5)' }}
            >
              Share URL
            </Button>
            <Button 
              variant="outlined" 
              startIcon={<ShareIcon />}
              onClick={handleCopyToClipboard}
              color="inherit"
              sx={{ borderColor: 'rgba(255,255,255,0.5)' }}
            >
              Copy Analysis
            </Button>
            <Button 
              variant="outlined"
              startIcon={<EmailIcon />}
              onClick={handleEmailShare}
              color="inherit"
              sx={{ borderColor: 'rgba(255,255,255,0.5)' }}
            >
              Email
            </Button>
          </Box>
          
          {/* Mobile menu - only shown on xs screens */}
          <Box sx={{ display: { xs: 'block', sm: 'none' } }}>
            <IconButton
              color="inherit"
              onClick={handleShareUrl}
              sx={{ mr: 1 }}
            >
              <LinkIcon />
            </IconButton>
            <IconButton
              color="inherit"
              onClick={handleCopyToClipboard}
              sx={{ mr: 1 }}
            >
              <ShareIcon />
            </IconButton>
            <IconButton
              color="inherit"
              onClick={handleEmailShare}
            >
              <EmailIcon />
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>
      
      <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 } }}>
        {/* Success message for clipboard copy */}
        {copySuccess && (
          <Alert severity="success" sx={{ mb: 3 }}>
            {copySuccess}
          </Alert>
        )}
        
        {/* Property Header */}
        <Box sx={{ mb: { xs: 2, md: 4 } }}>
          <Typography variant="h4" component="h1" gutterBottom sx={{ 
            fontSize: { xs: '1.5rem', md: '2.125rem' }
          }}>
            {property.address}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', mb: 2 }}>
            <Typography variant="h5" component="div" fontWeight="bold" sx={{
              fontSize: { xs: '1.25rem', md: '1.5rem' }
            }}>
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
        
        <Box sx={{ 
          display: 'flex', 
          flexDirection: { xs: 'column', md: 'row' }, 
          gap: { xs: 2, md: 4 }, 
          mb: { xs: 2, md: 4 } 
        }}>
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
            
            <Paper sx={{ mt: 3, p: { xs: 2, md: 3 }, borderRadius: 2 }}>
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
              <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1 }}>
                <Button 
                  variant="outlined" 
                  startIcon={<HomeIcon />} 
                  fullWidth
                  href={property.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  size="small"
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
                  size="small"
                >
                  Rentcast Analysis
                </Button>
              </Box>
            </Paper>
          </Box>
          
          {/* Right column: Cashflow Analysis & Settings */}
          <Box sx={{ flex: '1', maxWidth: { xs: '100%', md: '60%' } }}>
            {/* Cashflow Header */}
            <Paper sx={{ p: { xs: 2, md: 3 }, borderRadius: 2, mb: 3 }}>
              <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, mb: 1 }}>
                <Typography variant="h5" sx={{ mb: { xs: 1, sm: 0 }, fontSize: { xs: '1.25rem', md: '1.5rem' } }}>Cashflow Analysis</Typography>
                <Box>
                  <Typography 
                    variant="h5" 
                    fontWeight="bold" 
                    color={cashflow.monthlyCashflow >= 0 ? 'success.main' : 'error.main'}
                    sx={{ textAlign: { xs: 'left', sm: 'right' }, fontSize: { xs: '1.25rem', md: '1.5rem' } }}
                  >
                    {formatCurrency(cashflow.monthlyCashflow)}/mo
                  </Typography>
                  <Typography 
                    variant="body2" 
                    color={cashflow.annualCashflow >= 0 ? 'success.main' : 'error.main'}
                    sx={{ textAlign: { xs: 'left', sm: 'right' } }}
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
                        sx={{ maxWidth: { xs: '100px', sm: '120px' } }}
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
                bgcolor: '#6366f1',
                color: 'white',
                '&:hover': {
                  bgcolor: '#4f46e5'
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
                  <Typography variant="body2" gutterBottom>
                    <Tooltip title="The annual interest rate for your mortgage loan. Higher rates increase your monthly payment." arrow>
                      <span>Interest Rate: {settings.interestRate}%</span>
                    </Tooltip>
                  </Typography>
                  <Slider value={settings.interestRate} onChange={handleSettingChange('interestRate')} aria-labelledby="interest-rate-slider" valueLabelDisplay="auto" step={0.1} min={0.1} max={15} sx={{ color: '#6366f1' }} />
                </Box>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" gutterBottom>
                    <Tooltip title="The number of years you'll be paying your mortgage. Longer terms reduce monthly payments but increase total interest paid." arrow>
                      <span>Loan Term: {settings.loanTerm} years</span>
                    </Tooltip>
                  </Typography>
                  <Slider value={settings.loanTerm} onChange={handleSettingChange('loanTerm')} aria-labelledby="loan-term-slider" valueLabelDisplay="auto" step={1} min={5} max={40} sx={{ color: '#6366f1' }} />
                </Box>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" gutterBottom>
                    <Tooltip title="Percentage of the property price you pay upfront. Higher down payments reduce your loan amount and monthly payments." arrow>
                      <span>Down Payment: {settings.downPaymentPercent}%</span>
                    </Tooltip>
                  </Typography>
                  <Slider value={settings.downPaymentPercent} onChange={handleSettingChange('downPaymentPercent')} aria-labelledby="down-payment-slider" valueLabelDisplay="auto" step={1} min={0} max={100} sx={{ color: '#6366f1' }} />
                </Box>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" gutterBottom>
                    <Tooltip title="Annual property taxes and insurance calculated as a percentage of property value. Varies by location." arrow>
                      <span>Property Tax & Insurance: {settings.taxInsurancePercent}%</span>
                    </Tooltip>
                  </Typography>
                  <Slider value={settings.taxInsurancePercent} onChange={handleSettingChange('taxInsurancePercent')} min={0} max={5} step={0.1} valueLabelDisplay="auto" valueLabelFormat={(value) => `${value}%`} sx={{ color: '#6366f1' }} />
                </Box>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" gutterBottom>
                    <Tooltip title="Expected percentage of time the property will be vacant. Higher vacancy rates reduce annual income." arrow>
                      <span>Vacancy: {settings.vacancyPercent}%</span>
                    </Tooltip>
                  </Typography>
                  <Slider value={settings.vacancyPercent} onChange={handleSettingChange('vacancyPercent')} min={0} max={20} step={1} valueLabelDisplay="auto" valueLabelFormat={(value) => `${value}%`} sx={{ color: '#6366f1' }} />
                </Box>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" gutterBottom>
                    <Tooltip title="Capital Expenditures - funds set aside for major repairs and replacements (roof, HVAC, etc.)." arrow>
                      <span>CapEx: {settings.capexPercent}%</span>
                    </Tooltip>
                  </Typography>
                  <Slider value={settings.capexPercent} onChange={handleSettingChange('capexPercent')} min={0} max={10} step={1} valueLabelDisplay="auto" valueLabelFormat={(value) => `${value}%`} sx={{ color: '#6366f1' }} />
                </Box>
                <Box sx={{ mb: 0 }}>
                  <Typography variant="body2" gutterBottom>
                    <Tooltip title="Fee for property management services, typically a percentage of monthly rent. Set to 0% if self-managing." arrow>
                      <span>Property Management: {settings.propertyManagementPercent}%</span>
                    </Tooltip>
                  </Typography>
                  <Slider value={settings.propertyManagementPercent} onChange={handleSettingChange('propertyManagementPercent')} min={0} max={20} step={1} valueLabelDisplay="auto" valueLabelFormat={(value) => `${value}%`} sx={{ color: '#6366f1' }} />
                </Box>
              </Paper>
            )}
          </Box>
        </Box>
        
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
                <Slider value={rentAppreciationRate} onChange={handleRentAppreciationChange} aria-labelledby="rent-appreciation-slider" valueLabelDisplay="auto" step={0.1} min={0} max={10} sx={{ color: '#6366f1' }} />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" gutterBottom>
                  <Tooltip title="Expected annual increase in property value over time. Historically real estate appreciates at 3-5% annually over the long term." arrow>
                    <span>Property Value Increase: {propertyValueIncreaseRate}%</span>
                  </Tooltip>
                </Typography>
                <Slider value={propertyValueIncreaseRate} onChange={handlePropertyValueIncreaseChange} aria-labelledby="property-value-slider" valueLabelDisplay="auto" step={0.1} min={0} max={10} sx={{ color: '#6366f1' }} />
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
                        title="Return on Investment percentage. Calculated as annual cashflow divided by initial investment (down payment + closing costs)." 
                        arrow 
                        placement="top"
                      >
                        <span>ROI</span>
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
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </Paper>
      </Container>
    </>
  );
};

export default PropertyDetailsPage; 