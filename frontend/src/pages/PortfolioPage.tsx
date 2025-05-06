import React, { useState, useEffect, useCallback } from 'react';
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
    Paper,
    Alert,
    CircularProgress,
    Grid,
    TableContainer,
    Table,
    TableHead,
    TableBody,
    TableRow,
    TableCell,
    Tabs,
    Tab,
    Slider,
    Checkbox,
    FormGroup,
    FormControlLabel,
    Chip,
    Dialog, // Add Dialog
    DialogContent, // Add DialogContent
    DialogActions, // Add DialogActions
    Snackbar // Add Snackbar
} from '@mui/material';
import {
    ArrowBack as ArrowBackIcon,
    HomeWork as HomeWorkIcon,
    BusinessCenter as BusinessCenterIcon,
    Delete as DeleteIcon,
    CheckBox as CheckBoxIcon,
    CheckBoxOutlineBlank as CheckBoxOutlineBlankIcon,
    AttachMoney as AttachMoneyIcon,
    ExpandMore as ExpandMoreIcon,
    ExpandLess as ExpandLessIcon,
    TableChart as TableChartIcon,
    PictureAsPdf as PictureAsPdfIcon, // Add PDF Icon
    Share as ShareIcon // Add Share Icon
} from '@mui/icons-material';
import Tooltip from '@mui/material/Tooltip';
import Collapse from '@mui/material/Collapse';
// PDF Imports (assuming @react-pdf/renderer is installed)
import { PDFViewer, Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
// Compression Import (assuming pako is installed)
import pako from 'pako';
import { Property, Cashflow, CashflowSettings, YearlyProjection, PortfolioAssumptionOverrides } from '../types';
import PropertyCard from '../components/PropertyCard';
import { calculateCrunchScore } from '../utils/scoring';
import { formatCurrency, formatPercent } from '../utils/formatting';
import { calculateCashflow as calculateCashflowUtil } from '../utils/calculations';
import CashflowSankeyChart from '../components/CashflowSankeyChart';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import AssumptionControls from '../components/AssumptionControls';
import { useAnimatedCountUp } from '../hooks/useAnimatedCountUp'; // Import the new hook

// Fix Leaflet's default icon path issues
// This fixes the common broken icon issue in Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png',
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-violet.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
});

// Geocoding function to convert addresses to coordinates
const geocodeAddress = async (address: string): Promise<[number, number] | null> => {
    try {
        // Using OpenStreetMap Nominatim API (free, no API key required)
        const encodedAddress = encodeURIComponent(address);
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1`
        );
        
        if (!response.ok) {
            throw new Error('Geocoding request failed');
        }
        
        const data = await response.json();
        
        if (data && data.length > 0) {
            const latitude = parseFloat(data[0].lat);
            const longitude = parseFloat(data[0].lon);
            
            if (!isNaN(latitude) && !isNaN(longitude)) {
                console.log(`Geocoded address "${address}" to:`, [latitude, longitude]);
                return [latitude, longitude];
            }
        }
        
        console.warn(`Could not geocode address: ${address}`);
        return null;
    } catch (error) {
        console.error('Error geocoding address:', error);
        return null;
    }
};

// Define a custom type for our yearly projections
interface ProjectionData {
    year: number;
    propertyValue: number;
    equity: number;
    cashflow: number;
}

// Simple Chart Component - RESTORED
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
    const xScale = numPoints > 1 ? plotAreaWidth / (numPoints - 1) : plotAreaWidth / 2;
    
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
    const yearsToShow = numPoints <= 10 ? data.years : [0, 1, 5, 10, 15, 20, 25, 30].filter(year => {
      return year <= Math.max(...data.years);
    });
    yearsToShow.forEach(yearToShow => {
      const index = data.years.indexOf(yearToShow);
      if (index !== -1) {
        const x = padding.left + (index * xScale);
        ctx.fillText(yearToShow === 0 ? 'Current' : yearToShow.toString(), x, canvasHeight - padding.bottom + 5);
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
    
    // Draw property value line (using purple)
    if (data.propertyValues.length > 1) {
      ctx.strokeStyle = '#4f46e5'; ctx.lineWidth = 2; ctx.beginPath();
      for (let i = 0; i < data.propertyValues.length; i++) {
        const x = padding.left + (i * xScale);
        const y = getPrimaryYCoordinate(data.propertyValues[i]);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    
    // Draw equity line (using green)
    if (data.equity.length > 1) {
      ctx.strokeStyle = '#10b981'; ctx.lineWidth = 2; ctx.beginPath();
      for (let i = 0; i < data.equity.length; i++) {
        const x = padding.left + (i * xScale);
        const y = getPrimaryYCoordinate(data.equity[i]);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    
    // Draw cashflow bars (using orange/red)
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
    const legendWidth = 150;
    const legendStartX = (canvasWidth - (legendItems.length * legendWidth)) / 2; const legendY = canvasHeight - 15;
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

// Define a custom marker icon for the map - RESTORED
const customMarkerIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    shadowSize: [41, 41]
});

// MapEffect component to ensure proper Leaflet initialization
const MapEffect = ({ properties }: { properties: Record<string, any> }) => {
    const map = useMap();
    
    useEffect(() => {
        // Debug: Log all property coordinates when map initializes
        console.log('===== MAP DEBUG INFO =====');
        console.log('Map initialized, property count:', Object.keys(properties).length);
        
        // Extract and log coordinate info for debugging
        const propertyCoordinates = Object.entries(properties).map(([id, property]) => {
            const prop = property?.property || property;
            let lat = prop?.latitude || prop?.property?.latitude;
            let lng = prop?.longitude || prop?.property?.longitude;
            
            // Convert string coordinates to numbers if needed
            if (typeof lat === 'string') lat = parseFloat(lat);
            if (typeof lng === 'string') lng = parseFloat(lng);
            
            // Check validity
            const isValid = lat !== undefined && lng !== undefined && 
                !isNaN(lat) && !isNaN(lng) && 
                Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
                
            // Return details for logging
            return {
                id,
                latitude: lat,
                longitude: lng,
                latType: typeof lat,
                lngType: typeof lng,
                isValid,
                propertyAddress: prop?.address || 'Unknown',
                hasAddress: Boolean(prop?.address)
            };
        });
        
        console.log('Property coordinates:', propertyCoordinates);
        console.log('Valid properties for map:', propertyCoordinates.filter(p => p.isValid).length);
        console.log('Properties with addresses but no coordinates:', 
            propertyCoordinates.filter(p => !p.isValid && p.hasAddress).length);
        console.log('========================');
        
        // Collection to store all markers (both from direct coordinates and geocoded ones)
        const allMarkerPositions: L.LatLngExpression[] = [];
        
        // Fix Leaflet icon paths by ensuring the marker images are loaded
        setTimeout(() => {
            map.invalidateSize();
            
            // If no properties with coordinates, use default view
            if (Object.values(properties).length === 0) return;
            
            // Get valid coordinates to create bounds
            const validCoordinates = Object.values(properties)
                .map(property => {
                    const prop = property?.property || property;
                    let lat = prop?.latitude || prop?.property?.latitude;
                    let lng = prop?.longitude || prop?.property?.longitude;
                    
                    if (typeof lat === 'string') lat = parseFloat(lat);
                    if (typeof lng === 'string') lng = parseFloat(lng);
                    
                    if (lat && lng && !isNaN(lat) && !isNaN(lng) && 
                        Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
                        return [lat, lng];
                    }
                    return null;
                })
                .filter(coords => coords !== null);
            
            // If we have valid coordinates, add markers and collect positions for bounds
            if (validCoordinates.length > 0) {
                console.log('Valid coordinates found:', validCoordinates);
                
                // Add all valid coordinates to our collection
                validCoordinates.forEach(coords => {
                    if (coords) allMarkerPositions.push(coords as L.LatLngExpression);
                });
                
                // Create markers directly as a fallback
                console.log('Adding markers directly from MapEffect as fallback');
                validCoordinates.forEach((position, index) => {
                    try {
                        L.marker(position as L.LatLngExpression, {
                            icon: customMarkerIcon
                        }).addTo(map);
                        console.log(`Added fallback marker ${index} at`, position);
                    } catch (e) {
                        console.error('Error adding fallback marker:', e);
                    }
                });
            }
            
            // Try to geocode addresses for properties without coordinates
            const propertiesWithAddressButNoCoords = Object.entries(properties)
                .filter(([_, property]) => {
                    const prop = property?.property || property;
                    let lat = prop?.latitude || prop?.property?.latitude;
                    let lng = prop?.longitude || prop?.property?.longitude;
                    
                    if (typeof lat === 'string') lat = parseFloat(lat);
                    if (typeof lng === 'string') lng = parseFloat(lng);
                    
                    const hasValidCoords = lat && lng && !isNaN(lat) && !isNaN(lng) && 
                        Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
                        
                    const address = prop?.address || prop?.property?.address;
                    
                    return !hasValidCoords && address;
                });
                
            console.log('Properties to geocode:', propertiesWithAddressButNoCoords.length);
            
            // Create a promise for each geocoding operation
            const geocodePromises = propertiesWithAddressButNoCoords.map(async ([id, property]) => {
                const prop = property?.property || property;
                const address = prop?.address || prop?.property?.address;
                
                if (address) {
                    try {
                        const coords = await geocodeAddress(address);
                        if (coords) {
                            // Add coordinates to our collection
                            allMarkerPositions.push(coords as L.LatLngExpression);
                            
                            // Add a marker for the geocoded location
                            const marker = L.marker(coords as L.LatLngExpression, {
                                icon: customMarkerIcon
                            }).addTo(map);
                            
                            // Create popup content
                            const popupContent = document.createElement('div');
                            popupContent.innerHTML = `
                                <div style="font-weight: bold; margin-bottom: 5px;">${address}</div>
                                <div style="margin-bottom: 5px;">${prop?.price || property?.price || 'N/A'}</div>
                                <div style="margin-bottom: 10px;">Rent: ${prop?.rentEstimate || prop?.rent_estimate || 'N/A'}</div>
                            `;
                            
                            // Add button to popup
                            const button = document.createElement('button');
                            button.textContent = 'View Details';
                            button.style.padding = '5px 10px';
                            button.style.cursor = 'pointer';
                            button.addEventListener('click', () => {
                                window.location.href = `/#/property/${id}`;
                            });
                            popupContent.appendChild(button);
                            
                            // Attach popup to marker
                            marker.bindPopup(popupContent);
                            
                            console.log(`Added geocoded marker for "${address}" at:`, coords);
                            return coords;
                        }
                    } catch (e) {
                        console.error(`Error geocoding address "${address}":`, e);
                    }
                }
                return null;
            });
            
            // After all geocoding is done, fit the map to show all markers
            Promise.all(geocodePromises).then(() => {
                // Set the map bounds after a small delay to ensure all markers are added
                setTimeout(() => {
                    if (allMarkerPositions.length > 0) {
                        try {
                            console.log('Setting map bounds to fit all markers:', allMarkerPositions);
                            
                            // Create bounds from all marker positions
                            const bounds = L.latLngBounds(allMarkerPositions);
                            
                            if (bounds.isValid()) {
                                // Add padding around the bounds
                                map.fitBounds(bounds, {
                                    padding: [50, 50],
                                    maxZoom: 15 // Limit maximum zoom level
                                });
                                console.log('Map bounds set successfully to:', bounds.toString());
                            } else {
                                console.warn('Could not create valid bounds from markers');
                            }
                        } catch (e) {
                            console.error('Error setting map bounds:', e);
                        }
                    } else if (validCoordinates.length === 0) {
                        // If no valid coordinates at all, set a default view
                        map.setView([39.8283, -98.5795], 4); // Center on US
                    }
                }, 500); // Additional delay to ensure everything is loaded
            });
        }, 300);
        
        return () => {
            // Clean up if needed
        };
    }, [map, properties]);
    
    // Return a Fragment instead of null to avoid TypeScript errors
    return <></>;
};

// Calculate IRR (Internal Rate of Return) function
const calculateIRR = (initialInvestment: number, cashFlows: number[], finalEquity?: number): number => {
  // Basic validation
  if (initialInvestment <= 0) {
    // console.warn('IRR calculation skipped: Initial investment must be positive.');
    return 0; // Or handle as appropriate, NaN might be better if distinguishable
  }
  if (!cashFlows || cashFlows.length === 0) {
    // console.warn('IRR calculation skipped: No cash flows provided.');
    return 0; // Or handle as appropriate
  }

  let flows = [...cashFlows];
  const holdingPeriod = cashFlows.length; // Get holding period
  
  // Add final equity to the last cash flow if provided
  if (finalEquity !== undefined && flows.length > 0) {
    flows[flows.length - 1] += finalEquity;
  }

  // Add initial investment as the first negative flow
  flows.unshift(-initialInvestment);

  // --- DEBUG LOG: Print the flows array for this calculation ---
  console.log(`[IRR Debug ${holdingPeriod}yr] Flows:`, JSON.stringify(flows.map(f => Math.round(f))));
  // --- END DEBUG LOG ---

  // Check if there's a mix of positive and negative flows, necessary for IRR
  const hasPositive = flows.some(flow => flow > 0);
  const hasNegative = flows.some(flow => flow < 0);
  if (!hasPositive || !hasNegative) {
    console.warn(`[IRR Debug ${holdingPeriod}yr] Calculation might be unreliable: Cash flows do not change sign.`);
    return 0; 
  }

  let guess = 0.1; // Initial guess rate (10%)
  const MAX_ITERATIONS = 100;
  const TOLERANCE = 1e-7; // Use a smaller tolerance for better precision

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    let npv = 0; // Net Present Value
    let dNpv = 0; // Derivative of NPV with respect to rate

    for (let t = 0; t < flows.length; t++) {
      const factor = Math.pow(1 + guess, t);
      npv += flows[t] / factor;
      if (t > 0) { // Exclude initial investment from derivative calculation
        dNpv -= t * flows[t] / Math.pow(1 + guess, t + 1);
      }
    }

    // --- DEBUG LOG: Print iteration details (only for 5-year period to limit output) ---
    if (holdingPeriod === 5 && i < 15) { // Log first 15 iterations for 5yr period
        console.log(`[IRR Debug 5yr] Iter ${i}: Guess=${guess.toFixed(5)}, NPV=${npv.toFixed(2)}, dNPV=${dNpv.toFixed(2)}`);
    }
    // --- END DEBUG LOG ---

    // Check for division by zero or negligible derivative
    if (Math.abs(dNpv) < TOLERANCE) {
      console.warn(`[IRR Debug ${holdingPeriod}yr] Calculation stopped at iter ${i}: Derivative too small.`);
      return 0; 
    }

    const newGuess = guess - npv / dNpv;

    // Check for convergence
    if (Math.abs(newGuess - guess) < TOLERANCE) {
      // --- DEBUG LOG: Print success ---
      console.log(`[IRR Debug ${holdingPeriod}yr] Converged at iter ${i}. Final Rate: ${(newGuess * 100).toFixed(2)}%`);
      // --- END DEBUG LOG ---
      return newGuess * 100; // Converged
    }

    guess = newGuess;

    // Check if guess is becoming non-finite or unreasonable (e.g., less than -100%)
    if (!isFinite(guess) || guess <= -1.0) {
      console.warn(`[IRR Debug ${holdingPeriod}yr] Calculation stopped at iter ${i}: Guess is non-finite or <= -100%.`);
      return 0; // Indicate failure or unreasonable result
    }
  }

  // If max iterations reached without convergence
  console.warn(`[IRR Debug ${holdingPeriod}yr] Calculation failed to converge within ${MAX_ITERATIONS} iterations.`);
  return 0; // Return 0 or NaN to indicate failure to converge
};

// Placeholder default settings (should match App.tsx)
const defaultSettingsPlaceholder: CashflowSettings = {
    interestRate: 7.5,
    loanTerm: 30,
    downPaymentPercent: 20,
    taxInsurancePercent: 1.5,
    vacancyPercent: 8,
    capexPercent: 5,
    propertyManagementPercent: 10,
    rehabAmount: 0
};

const PortfolioPage: React.FC = () => {
    const navigate = useNavigate();
    const [portfolio, setPortfolio] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    // Property selection for filters
    const [selectedProperties, setSelectedProperties] = useState<Record<string, boolean>>({});
    const [selectAll, setSelectAll] = useState(true);
    
    // State for expanded table row
    const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
    
    // State for long-term projection control
    const [yearsToProject, setYearsToProject] = useState(30);
    const [rentAppreciationRate, setRentAppreciationRate] = useState(2);
    const [propertyValueIncreaseRate, setPropertyValueIncreaseRate] = useState(2);
    
    // Aggregated long-term projection data state
    const [aggregatedLongTermData, setAggregatedLongTermData] = useState<ProjectionData[]>([]);
    
    // IRR data for different holding periods
    const [irrData, setIrrData] = useState<Record<string, number>>({
        '5 Year': 0,
        '10 Year': 0,
        '15 Year': 0,
        '20 Year': 0,
        '30 Year': 0
    });

    // State for aggregated monthly cash flow data to use in Sankey chart
    const [aggregatedCashflowData, setAggregatedCashflowData] = useState<{
        rentalIncome: number;
        mortgage: number;
        taxInsurance: number;
        vacancy: number;
        capex: number;
        propertyManagement: number;
        monthlyCashflow: number;
    }>({
        rentalIncome: 0,
        mortgage: 0,
        taxInsurance: 0,
        vacancy: 0,
        capex: 0,
        propertyManagement: 0,
        monthlyCashflow: 0
    });

    // State for projection table visibility
    const [isProjectionTableVisible, setIsProjectionTableVisible] = useState(false);

    // Add state for aggregated metrics calculated in generateAggregatedLongTermData
    const [aggregatedMetrics, setAggregatedMetrics] = useState({
        totalValue: 0,
        totalEquityYear0: 0, // Equity at the start based on initial investment
        avgPropertyValue: 0,
        avgMonthlyRent: 0,
        grossRentalYield: 0,
        totalInitialInvestment: 0,
        avgCocRoi: 0,
        avgCrunchScore: 0,
    });

    // State for PDF Modal
    const [pdfModalOpen, setPdfModalOpen] = useState(false);

    // State for Snackbar feedback
    const [snackbarOpen, setSnackbarOpen] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');

    // Lifted hook calls for animated dashboard numbers
    const numSelectedProps = Object.keys(selectedProperties).filter(id => selectedProperties[id]).length;
    const animatedNumSelectedProps = useAnimatedCountUp(numSelectedProps, 1000);
    const animatedTotalValue = useAnimatedCountUp(aggregatedMetrics.totalValue, 1500);
    const animatedMonthlyCashflow = useAnimatedCountUp(Math.abs(aggregatedCashflowData.monthlyCashflow), 1500);
    const animatedAnnualCashflow = useAnimatedCountUp(Math.abs(aggregatedCashflowData.monthlyCashflow * 12), 1500);
    const animatedAvgCrunchScore = useAnimatedCountUp(aggregatedMetrics.avgCrunchScore, 1500);


    // --- Load portfolio from localStorage OR URL --- 
    useEffect(() => {
        let loadedData = false;
        try {
            // Check for shared data in URL first
            const hash = window.location.hash;
            const params = new URLSearchParams(hash.substring(hash.indexOf('?'))) 
            const sharedDataParam = params.get('data');

            if (sharedDataParam) {
                console.log("Found shared data in URL param.");
                try {
                    // Decode URL component first
                    const decodedParam = decodeURIComponent(sharedDataParam);
                    const compressed = Uint8Array.from(atob(decodedParam), c => c.charCodeAt(0));
                    const jsonString = pako.inflate(compressed, { to: 'string' });
                    const sharedData = JSON.parse(jsonString);
                    
                    // Validate structure minimally
                    if (sharedData && sharedData.portfolio && sharedData.selectedProperties && sharedData.projectionSettings) {
                        console.log("Setting state from shared URL data:", sharedData);
                        setPortfolio(sharedData.portfolio);
                        setSelectedProperties(sharedData.selectedProperties);
                        setYearsToProject(sharedData.projectionSettings.yearsToProject);
                        setRentAppreciationRate(sharedData.projectionSettings.rentAppreciationRate);
                        setPropertyValueIncreaseRate(sharedData.projectionSettings.propertyValueIncreaseRate);
                        // Update selectAll based on loaded selection
                        setSelectAll(Object.values(sharedData.selectedProperties).every(sel => sel));
                        loadedData = true;
                    } else {
                         console.warn("Shared data format is invalid.");
                         setError("Failed to load shared data: Invalid format.");
                    }
                } catch (e) {
                    console.error('Error processing shared data:', e);
                    setError("Failed to load shared data. It might be corrupted.");
                }
            }
        } catch (e) {
            console.error('Error parsing URL parameters:', e);
            // Fall through to localStorage if URL parsing fails
        }

        // If not loaded from URL, try localStorage
        if (!loadedData) {
            console.log("No valid shared data in URL, loading from localStorage.");
            try {
                const portfolioStr = localStorage.getItem('rentToolFinder_portfolio');
                const loadedPortfolio = portfolioStr ? JSON.parse(portfolioStr) : {};
                setPortfolio(loadedPortfolio);
                
                // Initialize selectedProperties based on loaded portfolio
                const initialSelection: Record<string, boolean> = {};
                Object.keys(loadedPortfolio).forEach(id => {
                    initialSelection[id] = true; // All properties selected by default
                });
                setSelectedProperties(initialSelection);
                setSelectAll(true);
            } catch (e) {
                console.error('Error loading portfolio from localStorage:', e);
                setError('Failed to load portfolio. Please try refreshing the page.');
            }
        }
        
        setLoading(false);
    }, []); // Run only once on mount
    
    // Generate long-term projections when portfolio changes or projection settings change
    useEffect(() => {
        if (Object.keys(portfolio).length === 0) {
            setAggregatedLongTermData([]);
            setAggregatedCashflowData({
                rentalIncome: 0,
                mortgage: 0,
                taxInsurance: 0,
                vacancy: 0,
                capex: 0,
                propertyManagement: 0,
                monthlyCashflow: 0
            });
            return;
        }
        
        generateAggregatedLongTermData();
    }, [portfolio, yearsToProject, rentAppreciationRate, propertyValueIncreaseRate, selectedProperties]);

    // Handle removing a property from the portfolio
    const handleRemoveFromPortfolio = (propertyId: string) => {
        // Update portfolio
        const updatedPortfolio = { ...portfolio };
        delete updatedPortfolio[propertyId];
        setPortfolio(updatedPortfolio);
        
        // Update selectedProperties to remove the deleted property
        const updatedSelectedProperties = { ...selectedProperties };
        delete updatedSelectedProperties[propertyId];
        setSelectedProperties(updatedSelectedProperties);
        
        // Update localStorage
        try {
            localStorage.setItem('rentToolFinder_portfolio', JSON.stringify(updatedPortfolio));
        } catch (e) {
            console.error('Error saving portfolio:', e);
            setError('Failed to update portfolio. Storage might be full.');
        }
        
        // Update selectAll state based on whether all remaining properties are selected
        if (Object.keys(updatedSelectedProperties).length > 0) {
            const allSelected = Object.values(updatedSelectedProperties).every(selected => selected);
            setSelectAll(allSelected);
        } else {
            setSelectAll(true); // Default to true when no properties remain
        }
        
        // Force regeneration of aggregated data
        generateAggregatedLongTermData();
    };

    // Handle assumption changes from the controls - ONLY updates state now
    const handleAssumptionChange = useCallback((propertyId: string, key: keyof PortfolioAssumptionOverrides | 'price', value: number) => {
        setPortfolio(currentPortfolio => {
            const updatedPortfolio = { ...currentPortfolio };
            if (updatedPortfolio[propertyId]) {
                if (key === 'price') {
                    // Update price directly on the property object within the portfolio entry
                    if (updatedPortfolio[propertyId].property) {
                        updatedPortfolio[propertyId].property.price = value;
                    } else {
                        // Handle case where property object might be missing unexpectedly
                        console.warn(`Property object missing for ID ${propertyId} when updating price.`);
                    }
                } else {
                    // Handle regular assumption overrides
                    if (!updatedPortfolio[propertyId].portfolioAssumptions) {
                        updatedPortfolio[propertyId].portfolioAssumptions = {};
                    }
                    // @ts-ignore - Allow specific keys
                    updatedPortfolio[propertyId].portfolioAssumptions[key] = value;
                }
            } else {
                console.warn('Attempted to update assumptions/price for non-existent portfolio property:', propertyId);
            }
            return updatedPortfolio;
        });
    }, []);

    // NEW: Handler to explicitly save the current portfolio state to localStorage
    const handleSaveAssumptions = useCallback(() => {
        try {
            console.log("Saving portfolio state to localStorage:", portfolio);
            localStorage.setItem('rentToolFinder_portfolio', JSON.stringify(portfolio));
            setSnackbarMessage('Portfolio assumptions saved!');
            setSnackbarOpen(true);
        } catch (e) {
            console.error('Error saving portfolio to localStorage:', e);
            setError('Failed to save portfolio assumptions. Storage might be full.');
            setSnackbarMessage('Error saving assumptions.');
            setSnackbarOpen(true);
        }
    }, [portfolio]); // Depends on the current portfolio state

    // Handle rent estimate change
    const handleRentEstimateChange = (propertyId: string, newRentString: string) => {
         try {
             const newRentValue = parseFloat(newRentString.replace(/[^\d.-]/g, ''));
             if (!isNaN(newRentValue) && propertyId && portfolio[propertyId]) {
                 // Use the new handleAssumptionChange for consistency
                 // @ts-ignore - Assume 'rentEstimate' should be a valid key in PortfolioAssumptionOverrides
                 handleAssumptionChange(propertyId, 'rentEstimate', newRentValue);
             }
         } catch (e) {
             console.error('Error updating rent estimate:', e);
         }
     };

    // Handle back to home
    const handleBackToHome = () => {
        navigate('/');
    };

    // Handle property click to go to details page
    const handlePropertyClick = (propertyId: string) => {
        navigate(`/property/${propertyId}`);
    };
    
    // Generate aggregated long-term data for selected properties
    const generateAggregatedLongTermData = useCallback(() => { // Make it useCallback
        const selectedPropertyIds = Object.entries(selectedProperties)
            .filter(([_, selected]) => selected)
            .map(([id]) => id);

        if (selectedPropertyIds.length === 0) {
            // Reset all aggregated data if no properties are selected
            setAggregatedLongTermData([]);
            setAggregatedCashflowData({ rentalIncome: 0, mortgage: 0, taxInsurance: 0, vacancy: 0, capex: 0, propertyManagement: 0, monthlyCashflow: 0 });
            setIrrData({ '5 Year': 0, '10 Year': 0, '15 Year': 0, '20 Year': 0, '30 Year': 0 });
            setAggregatedMetrics({ totalValue: 0, totalEquityYear0: 0, avgPropertyValue: 0, avgMonthlyRent: 0, grossRentalYield: 0, totalInitialInvestment: 0, avgCocRoi: 0, avgCrunchScore: 0 });
            return;
        }

        let totalPropertyValueSum = 0;
        let totalMonthlyRentSum = 0;
        let totalInitialInvestmentSum = 0;
        let totalDownPaymentSum = 0;
        let totalCocRoiSum = 0;
        let totalCrunchScoreSum = 0;
        let validCocProperties = 0;
        let validCrunchScoreProperties = 0;
        
        const aggregatedCashflow = { rentalIncome: 0, mortgage: 0, taxInsurance: 0, vacancy: 0, capex: 0, propertyManagement: 0, monthlyCashflow: 0 };
        const propertyProjections: ProjectionData[][] = [];
        const propertyInitialInvestments: number[] = [];
        const propertyTerminalEquities: Record<number, number[]> = { 5: [], 10: [], 15: [], 20: [], 30: [] }; // Store equity per property per period
        const yearlyAggregatedCashflows: number[][] = Array(yearsToProject + 1).fill(0).map(() => []); // Store cashflow per property per year, +1 for year 0


        selectedPropertyIds.forEach(propertyId => {
            const entry = portfolio[propertyId];
            if (!entry) return; // Skip if entry is missing

            const propData = entry.property;
            const assumptions = entry.portfolioAssumptions || {};

            // --- Safer Parsing --- 
            let price = 0;
            if (propData?.price) {
                price = typeof propData.price === 'string' 
                    ? parseFloat(propData.price.replace(/[^0-9.]/g, '')) 
                    : propData.price;
                if (isNaN(price)) price = 0; // Default to 0 if parsing fails
            }

            let monthlyRent = 0;
            const rentSource = assumptions.rentEstimate ?? propData?.rent_estimate;
             if (rentSource) {
                monthlyRent = typeof rentSource === 'string'
                    ? parseFloat(rentSource.replace(/[^0-9.]/g, ''))
                    : rentSource;
                 if (isNaN(monthlyRent)) monthlyRent = 0; // Default to 0
            }

            totalPropertyValueSum += price;
            totalMonthlyRentSum += monthlyRent;

            // --- Settings ---
             const settings: CashflowSettings = {
                interestRate: assumptions.interestRate ?? defaultSettingsPlaceholder.interestRate,
                loanTerm: assumptions.loanTerm ?? defaultSettingsPlaceholder.loanTerm,
                downPaymentPercent: assumptions.downPaymentPercent ?? defaultSettingsPlaceholder.downPaymentPercent,
                taxInsurancePercent: assumptions.taxInsurancePercent ?? defaultSettingsPlaceholder.taxInsurancePercent,
                vacancyPercent: assumptions.vacancyPercent ?? defaultSettingsPlaceholder.vacancyPercent,
                capexPercent: assumptions.capexPercent ?? defaultSettingsPlaceholder.capexPercent,
                propertyManagementPercent: assumptions.propertyManagementPercent ?? defaultSettingsPlaceholder.propertyManagementPercent,
                rehabAmount: assumptions.rehabAmount ?? defaultSettingsPlaceholder.rehabAmount,
            };

            // --- Calculate Initial Investment for *this* property ---
            const downPaymentPercent = settings.downPaymentPercent / 100;
            const downPaymentAmount = price * downPaymentPercent;
            const closingCosts = price * 0.03; // Estimate closing costs (adjust percentage if needed)
            const rehabAmount = settings.rehabAmount;
            const propertyInitialInvestment = downPaymentAmount + closingCosts + rehabAmount;
            
            totalInitialInvestmentSum += propertyInitialInvestment;
            totalDownPaymentSum += downPaymentAmount;
            propertyInitialInvestments.push(propertyInitialInvestment); // Keep track for potential per-property IRR later

            // --- Calculate Initial Cashflow for this property using the util ---
            // We need to pass the property data and the specific settings for THIS property
            const initialCashflowCalc = calculateCashflowUtil(
                { ...propData, price: price, rent_estimate: monthlyRent }, // Pass parsed price/rent
                settings // Pass the resolved settings
            );
            
            // Aggregate initial monthly cashflow components
            aggregatedCashflow.rentalIncome += monthlyRent;
            aggregatedCashflow.mortgage += initialCashflowCalc.monthlyMortgage;
            aggregatedCashflow.taxInsurance += initialCashflowCalc.monthlyTaxInsurance;
            aggregatedCashflow.vacancy += initialCashflowCalc.monthlyVacancy;
            aggregatedCashflow.capex += initialCashflowCalc.monthlyCapex;
            aggregatedCashflow.propertyManagement += initialCashflowCalc.monthlyPropertyManagement;
            aggregatedCashflow.monthlyCashflow += initialCashflowCalc.monthlyCashflow;

             // Aggregate CoC ROI
            if (initialCashflowCalc && !isNaN(initialCashflowCalc.cashOnCashReturn)) {
                totalCocRoiSum += initialCashflowCalc.cashOnCashReturn;
                validCocProperties++;
            }
            
             // Aggregate Crunch Score
            const crunchScore = calculateCrunchScore(
                { ...propData, price: price, rent_estimate: monthlyRent },
                settings,
                initialCashflowCalc // Pass the calculated cashflow
            );
            if (!isNaN(crunchScore)) {
                totalCrunchScoreSum += crunchScore;
                validCrunchScoreProperties++;
            }

            // --- Generate year-by-year projections for *this* property ---
            const yearlyData: ProjectionData[] = [];
            let currentPropertyValue = price;
            let currentRent = monthlyRent;
            const loanAmount = price - downPaymentAmount;
            let remainingLoanBalance = loanAmount;
            const monthlyRate = settings.interestRate / 100 / 12;
            const loanTermMonths = settings.loanTerm * 12;

            // Calculate monthly payment (fixed) based on initial loan
             let monthlyMortgagePayment = 0;
             if (loanAmount > 0 && settings.interestRate > 0 && loanTermMonths > 0) {
                 monthlyMortgagePayment = loanAmount * monthlyRate * Math.pow(1 + monthlyRate, loanTermMonths) / (Math.pow(1 + monthlyRate, loanTermMonths) - 1);
             } else if (loanAmount > 0 && loanTermMonths > 0) { // Handle 0% interest
                 monthlyMortgagePayment = loanAmount / loanTermMonths;
             }
             if (isNaN(monthlyMortgagePayment)) monthlyMortgagePayment = 0;

            // Add Year 0 (current values) before starting the projection
            const yearlyPropertyTax0 = currentPropertyValue * (settings.taxInsurancePercent / 100) / 2;
            const yearlyInsurance0 = currentPropertyValue * (settings.taxInsurancePercent / 100) / 2;
            const yearlyVacancy0 = currentRent * 12 * (settings.vacancyPercent / 100);
            const yearlyCapex0 = currentRent * 12 * (settings.capexPercent / 100);
            const yearlyPropertyManagement0 = currentRent * 12 * (settings.propertyManagementPercent / 100);
            const yearlyMortgage0 = monthlyMortgagePayment * 12;
            
            const yearlyRentalIncome0 = currentRent * 12;
            const yearlyExpenses0 = yearlyMortgage0 + yearlyPropertyTax0 + yearlyInsurance0 +
                yearlyVacancy0 + yearlyCapex0 + yearlyPropertyManagement0;
            const yearlyCashflow0 = yearlyRentalIncome0 - yearlyExpenses0;
            
            const equity0 = currentPropertyValue - loanAmount;
            
            yearlyData.push({ year: 0, propertyValue: currentPropertyValue, equity: equity0, cashflow: yearlyCashflow0 });
            
            // Store cashflow for this property for year 0
            if (!yearlyAggregatedCashflows[0]) {
                yearlyAggregatedCashflows[0] = [];
            }
            yearlyAggregatedCashflows[0].push(yearlyCashflow0);

            for (let year = 1; year <= yearsToProject; year++) {
                // Update property value and rent using the GLOBAL state rates
                 const propertyValueGrowthRate = propertyValueIncreaseRate / 100;
                 const rentAppreciationGrowthRate = rentAppreciationRate / 100;
                 
                currentPropertyValue *= (1 + propertyValueGrowthRate);
                currentRent *= (1 + rentAppreciationGrowthRate);
                if (isNaN(currentPropertyValue)) currentPropertyValue = 0;
                if (isNaN(currentRent)) currentRent = 0;

                // Recalculate yearly expenses based on *current* values
                const yearlyPropertyTax = currentPropertyValue * (settings.taxInsurancePercent / 100) / 2;
                const yearlyInsurance = currentPropertyValue * (settings.taxInsurancePercent / 100) / 2;
                const yearlyVacancy = currentRent * 12 * (settings.vacancyPercent / 100);
                const yearlyCapex = currentRent * 12 * (settings.capexPercent / 100);
                const yearlyPropertyManagement = currentRent * 12 * (settings.propertyManagementPercent / 100);
                
                const yearlyMortgage = monthlyMortgagePayment * 12;

                // Update loan balance
                if (remainingLoanBalance > 0 && loanAmount > 0) {
                     if (settings.interestRate === 0) {
                         // Simple principal reduction for 0% interest
                         remainingLoanBalance -= Math.min(monthlyMortgagePayment * 12, remainingLoanBalance);
                     } else {
                         // Amortization for interest-bearing loan
                         // let yearlyInterestPaid = 0; // Commented out as unused
                         // let yearlyPrincipalPaid = 0; // Commented out as unused
                         for (let month = 0; month < 12; month++) {
                             const interestForMonth = remainingLoanBalance * monthlyRate;
                             const principalForMonth = Math.min(monthlyMortgagePayment - interestForMonth, remainingLoanBalance);
                             // yearlyInterestPaid += interestForMonth;
                             // yearlyPrincipalPaid += principalForMonth;
                             remainingLoanBalance -= principalForMonth;
                             if (remainingLoanBalance <= 0) {
                                 remainingLoanBalance = 0;
                                 break; // Stop if loan paid off mid-year
                             }
                         }
                     }
                }
                 remainingLoanBalance = Math.max(0, remainingLoanBalance); // Ensure non-negative


                let equity = currentPropertyValue - remainingLoanBalance; // Use let
                if (isNaN(equity)) equity = 0;

                const yearlyRentalIncome = currentRent * 12;
                const yearlyExpenses = yearlyMortgage + yearlyPropertyTax + yearlyInsurance +
                    yearlyVacancy + yearlyCapex + yearlyPropertyManagement;
                let yearlyCashflow = yearlyRentalIncome - yearlyExpenses; // Use let
                 if (isNaN(yearlyCashflow)) yearlyCashflow = 0;

                // Store cashflow for this property for this year
                if (yearlyAggregatedCashflows[year - 1]) { // Should be year, not year - 1 for future years array access
                    yearlyAggregatedCashflows[year].push(yearlyCashflow); // Corrected index to year
                }

                // Store terminal equity for IRR periods if this year matches
                 Object.keys(propertyTerminalEquities).forEach(periodStr => {
                     const period = parseInt(periodStr);
                     if (year === period) {
                         propertyTerminalEquities[period].push(equity);
                     }
                 });

                yearlyData.push({ year, propertyValue: currentPropertyValue, equity, cashflow: yearlyCashflow });
            }
            propertyProjections.push(yearlyData);
        });

        // --- Aggregate Projections ---
        const aggregatedData: ProjectionData[] = [];
        
        // Create year 0 data first - ensure consistent cashflow with dashboard
        const year0Data: ProjectionData = { 
            year: 0, 
            propertyValue: totalPropertyValueSum,
            equity: totalDownPaymentSum, // Year 0 equity is the initial down payment sum
            cashflow: aggregatedCashflow.monthlyCashflow * 12 // Use the exact same value as the dashboard tile for year 0
        };
        
        // Only add the manually created year 0 data, don't collect from property projections
        aggregatedData.push(year0Data);
        
        // Add years 1 through yearsToProject
        for (let year = 1; year <= yearsToProject; year++) {
            const yearData: ProjectionData = { year, propertyValue: 0, equity: 0, cashflow: 0 };
            propertyProjections.forEach(proj => {
                const yearIndex = year; 
                if (proj && yearIndex < proj.length) {
                    yearData.propertyValue += proj[yearIndex]?.propertyValue || 0;
                    yearData.equity += proj[yearIndex]?.equity || 0;
                    yearData.cashflow += proj[yearIndex]?.cashflow || 0;
                }
            });
            aggregatedData.push(yearData);
        }

        // --- Ensure year 0 data cashflow is consistent with dashboard values (using aggregatedCashflow.monthlyCashflow)
        if (aggregatedData.length > 0 && aggregatedData[0].year === 0) {
            aggregatedData[0].cashflow = aggregatedCashflow.monthlyCashflow * 12;
        }

        // --- Calculate Aggregated IRR ---
         const irrResults: Record<string, number> = { '5 Year': 0, '10 Year': 0, '15 Year': 0, '20 Year': 0, '30 Year': 0 };
         const holdingPeriods = [5, 10, 15, 20, 30];

         holdingPeriods.forEach(holdingPeriod => {
             if (holdingPeriod <= yearsToProject) {
                 // Aggregate cashflows for the period
                 const cashflowsForPeriod = Array(holdingPeriod).fill(0);
                 for (let year = 0; year < holdingPeriod; year++) {
                     if (year === 0) {
                         // Use the dashboard value for year 0 (current year) to ensure consistency
                         cashflowsForPeriod[0] = aggregatedCashflow.monthlyCashflow * 12;
                     } else if (yearlyAggregatedCashflows[year] && yearlyAggregatedCashflows[year].length > 0) { // Check array and its content
                         cashflowsForPeriod[year] = yearlyAggregatedCashflows[year].reduce((sum, cf) => sum + (cf || 0), 0);
                     } else {
                        cashflowsForPeriod[year] = 0; // Default to 0 if no cashflows for that year (e.g. if yearsToProject < holdingPeriod)
                     }
                 }

                 // Aggregate terminal equity for the period
                 const terminalEquityForPeriod = propertyTerminalEquities[holdingPeriod]?.reduce((sum, eq) => sum + (eq || 0), 0) || 0;
                
                 // Calculate IRR using the *total* initial investment sum and aggregated terminal equity
                 const irr = calculateIRR(totalInitialInvestmentSum, cashflowsForPeriod, terminalEquityForPeriod);
                 irrResults[`${holdingPeriod} Year`] = irr; // Already in percentage from calculateIRR
             }
         });

        // --- Update State ---
        console.log("[IRR Debug] Results before setting state:", JSON.stringify(irrResults));
        console.log("[Year 0 Debug] Aggregated Cashflow Data Monthly:", aggregatedCashflow.monthlyCashflow, "Year 0 Proj Cashflow:", year0Data.cashflow);
        setAggregatedLongTermData(aggregatedData);
        setAggregatedCashflowData(aggregatedCashflow); // This contains the monthly components
        setIrrData(irrResults);

        // Update aggregated metrics state
        const count = selectedPropertyIds.length;
        setAggregatedMetrics({
            totalValue: totalPropertyValueSum,
            totalEquityYear0: totalDownPaymentSum, // Initial equity is roughly the total down payment
            avgPropertyValue: count > 0 ? totalPropertyValueSum / count : 0,
            avgMonthlyRent: count > 0 ? totalMonthlyRentSum / count : 0,
            grossRentalYield: totalPropertyValueSum > 0 ? (totalMonthlyRentSum * 12) / totalPropertyValueSum : 0,
            totalInitialInvestment: totalInitialInvestmentSum,
            avgCocRoi: validCocProperties > 0 ? totalCocRoiSum / validCocProperties : 0,
            avgCrunchScore: validCrunchScoreProperties > 0 ? totalCrunchScoreSum / validCrunchScoreProperties : 0,
        });

    }, [portfolio, selectedProperties, yearsToProject, rentAppreciationRate, propertyValueIncreaseRate]); // Added useCallback dependencies

     // Recalculate when dependencies change
     useEffect(() => {
        generateAggregatedLongTermData();
     }, [generateAggregatedLongTermData]); // generateAggregatedLongTermData is now stable due to useCallback

    // Handle select all properties
    const handleSelectAll = () => {
        const newSelectAll = !selectAll;
        setSelectAll(newSelectAll);
        
        const updatedSelection = { ...selectedProperties };
        Object.keys(updatedSelection).forEach(id => {
            updatedSelection[id] = newSelectAll;
        });
        setSelectedProperties(updatedSelection);
    };
    
    // Handle individual property selection
    const handlePropertySelect = (propertyId: string) => {
        const updatedSelection = {
            ...selectedProperties,
            [propertyId]: !selectedProperties[propertyId]
        };
        setSelectedProperties(updatedSelection);
        
        // Update selectAll state based on whether all properties are selected
        const allSelected = Object.values(updatedSelection).every(selected => selected);
        setSelectAll(allSelected);
    };

    // --- PDF and Share Handlers ---
    const handleOpenPdfModal = () => {
        // Basic check: Don't open if no data to show
        if (Object.keys(portfolio).length === 0 || Object.keys(selectedProperties).filter(id => selectedProperties[id]).length === 0) {
            setSnackbarMessage("Add properties to portfolio and select them to generate PDF.");
            setSnackbarOpen(true);
            return;
        }
        setPdfModalOpen(true);
    };

    const handleClosePdfModal = () => {
        setPdfModalOpen(false);
    };

    const generatePortfolioShareableURL = useCallback(() => {
        try {
            const dataToShare = {
                portfolio: portfolio,
                selectedProperties: selectedProperties,
                projectionSettings: {
                    yearsToProject,
                    rentAppreciationRate,
                    propertyValueIncreaseRate
                }
            };
            const jsonString = JSON.stringify(dataToShare);
            const compressed = pako.deflate(jsonString);
            let encodedData = btoa(String.fromCharCode.apply(null, compressed as unknown as number[])); // Base64 encode
            
            // Make Base64 string URL-safe
            encodedData = encodeURIComponent(encodedData);

            // Construct URL with hash routing
            const baseUrl = window.location.origin + window.location.pathname;
            const shareUrl = `${baseUrl}#/portfolio?data=${encodedData}`;
            return shareUrl;
        } catch (error) {
            console.error("Error generating shareable URL:", error);
            return null;
        }
    }, [portfolio, selectedProperties, yearsToProject, rentAppreciationRate, propertyValueIncreaseRate]);

    const handleShare = async () => {
        if (Object.keys(portfolio).length === 0 || Object.keys(selectedProperties).filter(id => selectedProperties[id]).length === 0) {
            setSnackbarMessage("Add properties to portfolio and select them to share.");
            setSnackbarOpen(true);
            return;
        }

        const url = generatePortfolioShareableURL();
        if (url) {
            try {
                await navigator.clipboard.writeText(url);
                setSnackbarMessage('Shareable URL copied to clipboard!');
            } catch (err) {
                console.error('Failed to copy URL: ', err);
                setSnackbarMessage('Failed to copy URL.');
            }
        } else {
            setSnackbarMessage('Could not generate shareable URL.');
        }
        setSnackbarOpen(true);
    };

    const handleCloseSnackbar = (event?: React.SyntheticEvent | Event, reason?: string) => {
        if (reason === 'clickaway') {
            return;
        }
        setSnackbarOpen(false);
    };

    return (
        <>
            <CssBaseline />
            <AppBar position="static">
                <Toolbar>
                    <IconButton edge="start" color="inherit" onClick={handleBackToHome} aria-label="back">
                        <ArrowBackIcon />
                    </IconButton>
                    <Typography 
                        variant="h6" 
                        sx={{ 
                            flexGrow: 1, 
                            cursor: 'pointer',
                            '&:hover': { opacity: 0.9 }
                        }} 
                        onClick={handleBackToHome} // Make title clickable to go home
                    >
                        CashflowCrunch {/* Changed title */}
                    </Typography>
                    {/* Add PDF and Share buttons */} 
                    <Tooltip title="Generate PDF Report">
                        <IconButton color="inherit" onClick={handleOpenPdfModal}>
                            <PictureAsPdfIcon />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Copy Shareable Link">
                        <IconButton color="inherit" onClick={handleShare}>
                            <ShareIcon />
                        </IconButton>
                    </Tooltip>
                    <IconButton color="inherit" edge="end" sx={{ ml: 1 }}> {/* Added margin */}
                        <BusinessCenterIcon />
                    </IconButton>
                </Toolbar>
            </AppBar>
            <Container maxWidth="lg" sx={{ mt: 4, mb: 8 }}>
                {error && <Alert severity="error">{error}</Alert>}
                {loading ? (
                    <Box display="flex" justifyContent="center" my={4}>
                        <CircularProgress />
                    </Box>
                ) : Object.keys(portfolio).length === 0 ? (
                    <Paper sx={{ p: 4, textAlign: 'center' }}>
                        <Typography variant="h5" gutterBottom>
                            Your portfolio is empty
                        </Typography>
                        <Typography variant="body1" color="textSecondary" paragraph>
                            Add properties to your portfolio to see them here.
                        </Typography>
                        <Button
                            variant="contained"
                            color="primary"
                            onClick={handleBackToHome}
                            startIcon={<HomeWorkIcon />}
                        >
                            Find Properties
                        </Button>
                    </Paper>
                ) : (
                    <>
                        {/* Portfolio Dashboard - Metrics Section */}
                        <Box sx={{ mb: 4 }}>
                            <Typography variant="h5" sx={{ mb: 2, fontWeight: 'bold' }}>Portfolio Dashboard</Typography>
                            
                            {/* Main Metrics - Use animated values */}
                            <Grid container spacing={2} sx={{ mb: 2 }}>
                                {/* Properties Count */}
                                {/* @ts-ignore - Ignore MUI v5 Grid prop errors */}
                                <Grid item xs={12} sm={6} md={4} lg={2.4}> 
                                    <Tooltip title="Total number of properties currently selected in the portfolio analysis">
                                        <Paper elevation={2} sx={{ p: 2, height: '100%', background: 'linear-gradient(135deg, #4f46e5 0%, #7570ea 100%)', color: 'white', borderRadius: 2 }}>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}><Typography variant="subtitle2" sx={{ opacity: 0.9 }}>PROPERTIES</Typography><HomeWorkIcon /></Box>
                                            <Typography variant="h3" sx={{ fontWeight: 'bold' }}>
                                                {Math.round(animatedNumSelectedProps)}
                                            </Typography> 
                                            <Typography variant="body2" sx={{ opacity: 0.8 }}>Selected properties</Typography>
                                        </Paper>
                                    </Tooltip>
                                </Grid>
                                
                                {/* Total Value */}
                                {/* @ts-ignore - Ignore MUI v5 Grid prop errors */}
                                <Grid item xs={12} sm={6} md={4} lg={2.4}> 
                                    <Tooltip title="Estimated total market value of all selected properties">
                                        <Paper elevation={2} sx={{ p: 2, height: '100%', background: 'linear-gradient(135deg, #0ea5e9 0%, #38bdf8 100%)', color: 'white', borderRadius: 2 }}>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}><Typography variant="subtitle2" sx={{ opacity: 0.9 }}>TOTAL VALUE</Typography><BusinessCenterIcon /></Box>
                                            <Typography variant="h3" sx={{ fontWeight: 'bold' }}>
                                                {formatCurrency(animatedTotalValue)}
                                            </Typography>
                                            <Typography variant="body2" sx={{ opacity: 0.8 }}>Combined property value</Typography>
                                        </Paper>
                                    </Tooltip>
                                </Grid>
                                
                                {/* Monthly Cashflow */}
                                {/* @ts-ignore - Ignore MUI v5 Grid prop errors */}
                                <Grid item xs={12} sm={6} md={4} lg={2.4}> 
                                    <Tooltip title="Total estimated monthly cash flow (Income - Expenses) for all selected properties">
                                        <Paper elevation={2} sx={{ p: 2, height: '100%', background: aggregatedCashflowData.monthlyCashflow >= 0 ? 'linear-gradient(135deg, #10b981 0%, #34d399 100%)' : 'linear-gradient(135deg, #ef4444 0%, #f87171 100%)', color: 'white', borderRadius: 2 }}>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                                <Typography variant="subtitle2" sx={{ opacity: 0.9 }}>MONTHLY CASHFLOW</Typography>
                                                <Box component="span" sx={{ fontSize: '22px', fontWeight: 'bold', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    {aggregatedCashflowData.monthlyCashflow >= 0 ? '+' : '-'}
                                                </Box>
                                            </Box>
                                            <Typography variant="h3" sx={{ fontWeight: 'bold' }}>
                                                {formatCurrency(animatedMonthlyCashflow)}
                                            </Typography>
                                            <Typography variant="body2" sx={{ opacity: 0.8 }}>{aggregatedCashflowData.monthlyCashflow >= 0 ? 'Monthly positive cashflow' : 'Monthly negative cashflow'}</Typography>
                                        </Paper>
                                    </Tooltip>
                                </Grid>

                                {/* Annual Cashflow - NEW TILE */}
                                {/* @ts-ignore - Ignore MUI v5 Grid prop errors */}
                                <Grid item xs={12} sm={6} md={4} lg={2.4}> 
                                    <Tooltip title="Total estimated annual cash flow (Income - Expenses) for all selected properties">
                                        <Paper elevation={2} sx={{ p: 2, height: '100%', background: aggregatedCashflowData.monthlyCashflow >= 0 ? 'linear-gradient(135deg, #10b981 0%, #34d399 100%)' : 'linear-gradient(135deg, #ef4444 0%, #f87171 100%)', color: 'white', borderRadius: 2 }}>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}><Typography variant="subtitle2" sx={{ opacity: 0.9 }}>ANNUAL CASHFLOW</Typography><AttachMoneyIcon /></Box>
                                            <Typography variant="h3" sx={{ fontWeight: 'bold' }}>
                                                {formatCurrency(animatedAnnualCashflow)}
                                            </Typography>
                                            <Typography variant="body2" sx={{ opacity: 0.8 }}>{aggregatedCashflowData.monthlyCashflow >= 0 ? 'Annual positive cashflow' : 'Annual negative cashflow'}</Typography>
                                        </Paper>
                                    </Tooltip>
                                </Grid>
                                
                                {/* Avg Crunch Score */}
                                {/* @ts-ignore - Ignore MUI v5 Grid prop errors */}
                                <Grid item xs={12} sm={6} md={4} lg={2.4}> 
                                    <Tooltip title="Average Crunch Score across selected properties, indicating overall investment quality (0-100)">
                                        <Paper elevation={2} sx={{ p: 2, height: '100%', background: 'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)', color: 'white', borderRadius: 2 }}>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}><Typography variant="subtitle2" sx={{ opacity: 0.9 }}>AVG CRUNCH SCORE</Typography><Box component="span" sx={{ fontSize: '19px', fontWeight: 'bold', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>#</Box></Box>
                                            <Typography variant="h3" sx={{ fontWeight: 'bold' }}>
                                                {animatedAvgCrunchScore.toFixed(0)}
                                            </Typography>
                                            <Typography variant="body2" sx={{ opacity: 0.8 }}>Avg. Portfolio Quality Score</Typography>
                                        </Paper>
                                    </Tooltip>
                                </Grid>
                            </Grid>
                            
                            {/* Performance Metrics - Use aggregatedMetrics state */}
                            <Box sx={{ mb: 2 }}>
                                <Typography variant="h6" sx={{ mb: 1, fontWeight: 500 }}>Performance Metrics</Typography>
                                <Grid container spacing={2}>
                                    {/* Avg. Property Value */}
                                    {/* @ts-ignore TODO: Fix Grid type issue */}
                                    <Grid xs={12} sm={6} md={4} lg={3}>
                                         <Paper elevation={1} sx={{ /* ...styles... */ p: 2, borderRadius: 2, height: '100%', border: '1px solid #e0e0e0' }}>
                                             <Typography variant="subtitle2" color="text.secondary">Avg. Property Value</Typography>
                                             <Typography variant="h5" sx={{ mt: 1, fontWeight: 'medium' }}>
                                                {formatCurrency(aggregatedMetrics.avgPropertyValue)}
                                            </Typography>
                                         </Paper>
                                    </Grid>

                                    {/* Total Equity - Use projection data */}
                                     {/* @ts-ignore TODO: Fix Grid type issue */}
                                     <Grid xs={12} sm={6} md={4} lg={3}>
                                         <Paper elevation={1} sx={{ /* ...styles... */ p: 2, borderRadius: 2, height: '100%', border: '1px solid #e0e0e0' }}>
                                             <Typography variant="subtitle2" color="text.secondary">Total Equity (Current Est.)</Typography>
                                             <Typography variant="h5" sx={{ mt: 1, fontWeight: 'medium', color: 'success.main' }}>
                                                {/* Use aggregated equity from year 0 or current year if available */}
                                                {formatCurrency(aggregatedLongTermData[0]?.equity || aggregatedMetrics.totalEquityYear0)} 
                                            </Typography>
                                         </Paper>
                                     </Grid>

                                    {/* Avg. Monthly Rent */}
                                    {/* @ts-ignore TODO: Fix Grid type issue */}
                                    <Grid xs={12} sm={6} md={4} lg={3}>
                                         <Paper elevation={1} sx={{ /* ...styles... */ p: 2, borderRadius: 2, height: '100%', border: '1px solid #e0e0e0' }}>
                                             <Typography variant="subtitle2" color="text.secondary">Avg. Monthly Rent</Typography>
                                             <Typography variant="h5" sx={{ mt: 1, fontWeight: 'medium' }}>
                                                {formatCurrency(aggregatedMetrics.avgMonthlyRent)}
                                            </Typography>
                                         </Paper>
                                    </Grid>

                                    {/* Gross Rental Yield */}
                                     {/* @ts-ignore TODO: Fix Grid type issue */}
                                     <Grid xs={12} sm={6} md={4} lg={3}>
                                         <Paper elevation={1} sx={{ /* ...styles... */ p: 2, borderRadius: 2, height: '100%', border: '1px solid #e0e0e0' }}>
                                             <Typography variant="subtitle2" color="text.secondary">Gross Rental Yield</Typography>
                                             <Typography variant="h5" sx={{ mt: 1, fontWeight: 'medium' }}>
                                                {formatPercent(aggregatedMetrics.grossRentalYield)}
                                            </Typography>
                                         </Paper>
                                     </Grid>
                                </Grid>
                            </Box>
                            
                            {/* Financial Metrics - Use aggregatedMetrics and irrData state */}
                            <Box sx={{ mb: 2 }}>
                                <Typography variant="h6" sx={{ mb: 1, fontWeight: 500 }}>Financial Metrics</Typography>
                                <Grid container spacing={2}>
                                    {/* Avg. Cash-on-Cash ROI */}
                                    {/* @ts-ignore TODO: Fix Grid type issue */}
                                    <Grid xs={12} sm={6} md={4} lg={3}>
                                        <Paper elevation={1} sx={{ /* ...styles... */ p: 2, borderRadius: 2, height: '100%', border: '1px solid #e0e0e0' }}>
                                            <Typography variant="subtitle2" color="text.secondary">Avg. Cash-on-Cash ROI</Typography>
                                             <Typography variant="h5" sx={{ mt: 1, fontWeight: 'medium', color: aggregatedMetrics.avgCocRoi > 0 ? 'success.main' : 'error.main' }}>
                                                 {formatPercent(aggregatedMetrics.avgCocRoi)}
                                             </Typography>
                                        </Paper>
                                    </Grid>

                                    {/* Total Initial Investment */}
                                    {/* @ts-ignore TODO: Fix Grid type issue */}
                                    <Grid xs={12} sm={6} md={4} lg={3}>
                                        <Paper elevation={1} sx={{ /* ...styles... */ p: 2, borderRadius: 2, height: '100%', border: '1px solid #e0e0e0' }}>
                                            <Typography variant="subtitle2" color="text.secondary">Total Initial Investment</Typography>
                                            <Typography variant="h5" sx={{ mt: 1, fontWeight: 'medium' }}>
                                                {formatCurrency(aggregatedMetrics.totalInitialInvestment)}
                                            </Typography>
                                        </Paper>
                                    </Grid>

                                    {/* 5-Year IRR - Updated to use same calculation as IRR Projections */}
                                    {/* @ts-ignore TODO: Fix Grid type issue */}
                                    <Grid xs={12} sm={6} md={4} lg={2}>
                                         <Paper elevation={1} sx={{ /* ...styles... */ p: 2, borderRadius: 2, height: '100%', border: '1px solid #e0e0e0' }}>
                                             <Typography variant="subtitle2" color="text.secondary">5-Year IRR</Typography>
                                             <Typography 
                                                 variant="h5" 
                                                 sx={{ 
                                                     mt: 1, 
                                                     fontWeight: 'medium', 
                                                     color: !isFinite(irrData['5 Year']) ? 'text.secondary' :
                                                            irrData['5 Year'] > 15 ? 'success.dark' : 
                                                            irrData['5 Year'] > 10 ? 'success.main' : 
                                                            irrData['5 Year'] > 5 ? 'warning.main' : 'error.main'
                                                 }}
                                             >
                                                 {/* Use same format as IRR Projections section */}
                                                 {isFinite(irrData['5 Year']) ? formatPercent(irrData['5 Year']) : 'N/A'}
                                             </Typography>
                                         </Paper>
                                    </Grid>
                                    
                                    {/* NEW: 30-Year IRR */}
                                    {/* @ts-ignore TODO: Fix Grid type issue */}
                                    <Grid xs={12} sm={6} md={4} lg={2}>
                                         <Paper elevation={1} sx={{ p: 2, borderRadius: 2, height: '100%', border: '1px solid #e0e0e0' }}>
                                             <Typography variant="subtitle2" color="text.secondary">30-Year IRR</Typography>
                                             <Typography 
                                                 variant="h5" 
                                                 sx={{ 
                                                     mt: 1, 
                                                     fontWeight: 'medium', 
                                                     color: !isFinite(irrData['30 Year']) ? 'text.secondary' :
                                                            irrData['30 Year'] > 15 ? 'success.dark' : 
                                                            irrData['30 Year'] > 10 ? 'success.main' : 
                                                            irrData['30 Year'] > 5 ? 'warning.main' : 'error.main'
                                                 }}
                                             >
                                                 {isFinite(irrData['30 Year']) ? formatPercent(irrData['30 Year']) : 'N/A'}
                                             </Typography>
                                         </Paper>
                                    </Grid>

                                    {/* Annual Cashflow */}
                                    {/* @ts-ignore TODO: Fix Grid type issue */}
                                    <Grid xs={12} sm={6} md={4} lg={2}>
                                         <Paper elevation={1} sx={{ /* ...styles... */ p: 2, borderRadius: 2, height: '100%', border: '1px solid #e0e0e0' }}>
                                             <Typography variant="subtitle2" color="text.secondary">Annual Cashflow</Typography>
                                             <Typography 
                                                 variant="h5" 
                                                 sx={{ mt: 1, fontWeight: 'medium', color: aggregatedCashflowData.monthlyCashflow >= 0 ? 'success.main' : 'error.main' }}
                                             >
                                                 {formatCurrency(aggregatedCashflowData.monthlyCashflow * 12)}
                                             </Typography>
                                         </Paper>
                                    </Grid>
                                </Grid>
                            </Box>
                        </Box>

                        {/* Properties Table - MOVED UP */}
                        <Paper sx={{ mb: 4 }}>
                            <TableContainer>
                                <Table>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell sx={{ width: '5%' }} /> {/* Empty cell for expand icon */}
                                            <TableCell>Property</TableCell>
                                            <TableCell align="right">Price</TableCell>
                                            <TableCell align="right">Rent</TableCell>
                                            <TableCell align="right">Monthly Cashflow</TableCell>
                                            <TableCell align="right">CoC ROI</TableCell>
                                            <TableCell align="right">Crunch Score</TableCell>
                                            <TableCell align="right">Actions</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {Object.entries(portfolio)
                                            .filter(([id]) => selectedProperties[id]) // Only show selected
                                            .map(([id, entry]) => {
                                            // Ensure entry and entry.property exist
                                            const prop = entry?.property;
                                            if (!prop) return null; // Skip rendering if property data is missing

                                            const assumptions = entry?.portfolioAssumptions || {};
                                            
                                            const price = prop?.price || 0; // Use the potentially updated price from the portfolio state
                                            const monthlyRent = assumptions?.rentEstimate ?? prop?.rent_estimate ?? 0;
                                            
                                            let cashflow: Cashflow | null = null; 
                                             let crunchScore: number | null = null; 
                                            try {
                                                 const settings: CashflowSettings = {
                                                     interestRate: assumptions.interestRate ?? defaultSettingsPlaceholder.interestRate,
                                                     loanTerm: assumptions.loanTerm ?? defaultSettingsPlaceholder.loanTerm,
                                                     downPaymentPercent: assumptions.downPaymentPercent ?? defaultSettingsPlaceholder.downPaymentPercent,
                                                     taxInsurancePercent: assumptions.taxInsurancePercent ?? defaultSettingsPlaceholder.taxInsurancePercent,
                                                     vacancyPercent: assumptions.vacancyPercent ?? defaultSettingsPlaceholder.vacancyPercent,
                                                     capexPercent: assumptions.capexPercent ?? defaultSettingsPlaceholder.capexPercent,
                                                     propertyManagementPercent: assumptions.propertyManagementPercent ?? defaultSettingsPlaceholder.propertyManagementPercent,
                                                     rehabAmount: assumptions.rehabAmount ?? defaultSettingsPlaceholder.rehabAmount,
                                                 };
                                                 
                                                 const safeProp = { ...prop, price: price || 0, rent_estimate: monthlyRent || 0 };
                                                 
                                                 cashflow = calculateCashflowUtil(safeProp, settings);
                                                 crunchScore = calculateCrunchScore(safeProp, settings, cashflow); 
                                             } catch(e) { console.error("Error calculating table metrics for", id, e); }

                                             const isExpanded = expandedRowId === id;

                                            return (
                                                <React.Fragment key={id}>
                                                    <TableRow 
                                                        hover 
                                                        onClick={() => setExpandedRowId(isExpanded ? null : id)}
                                                        sx={{ cursor: 'pointer' }} 
                                                    >
                                                        {/* Expand/Collapse Icon Cell */}
                                                        <TableCell padding="none" sx={{ width: '5%' }}>
                                                            <IconButton size="small">
                                                                {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                                            </IconButton>
                                                        </TableCell>
                                                        {/* Property Cell */}
                                                        <TableCell component="th" scope="row">
                                                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                                <Box
                                                                    component="img"
                                                                    sx={{
                                                                        width: 50,
                                                                        height: 50,
                                                                        borderRadius: 1,
                                                                        mr: 2,
                                                                        objectFit: 'cover',
                                                                    }}
                                                                    alt={prop?.address || 'Unknown'}
                                                                    src={prop?.photo_url || prop?.thumbnail || 'https://via.placeholder.com/150'} 
                                                                    onError={(e) => {
                                                                        const target = e.target as HTMLImageElement;
                                                                        target.src = 'https://via.placeholder.com/150'; 
                                                                    }}
                                                                />
                                                                <Box>
                                                                    <Typography variant="subtitle2">{prop?.address || 'Unknown'}</Typography>
                                                                    {/* Consider adding city/state back if needed */}
                                                                </Box>
                                                            </Box>
                                                        </TableCell>
                                                        <TableCell align="right">{formatCurrency(price)}</TableCell> {/* Displays updated price */}
                                                        <TableCell align="right">
                                                            {formatCurrency(monthlyRent)} 
                                                        </TableCell>
                                                        <TableCell 
                                                            align="right"
                                                            sx={{ color: (cashflow && isFinite(cashflow.monthlyCashflow)) ? (cashflow.monthlyCashflow >= 0 ? 'success.main' : 'error.main') : 'text.secondary' }}
                                                        >
                                                             {cashflow && isFinite(cashflow.monthlyCashflow) ? formatCurrency(cashflow.monthlyCashflow) : '$NaN'} 
                                                        </TableCell>
                                                        <TableCell 
                                                            align="right"
                                                            sx={{ color: (cashflow && isFinite(cashflow.cashOnCashReturn)) ? (cashflow.cashOnCashReturn >= 0.08 ? 'success.main' : cashflow.cashOnCashReturn >= 0.05 ? 'warning.main' : 'error.main') : 'text.secondary' }}
                                                        >
                                                             {cashflow && isFinite(cashflow.cashOnCashReturn) ? formatPercent(cashflow.cashOnCashReturn * 100) : 'NaN%'}  {/* Multiply by 100 here as well for consistency if formatPercent expects whole numbers */}
                                                        </TableCell>
                                                        <TableCell align="right">
                                                             {/* Display Crunch Score directly, rounded */}
                                                             {crunchScore !== null && isFinite(crunchScore) ? crunchScore.toFixed(0) : 'N/A'} 
                                                        </TableCell>
                                                        <TableCell align="right">
                                                             {/* Keep Actions separate from expand click */}
                                                             <IconButton 
                                                                aria-label="view property" 
                                                                size="small"
                                                                onClick={(e) => { e.stopPropagation(); handlePropertyClick(id); }}
                                                            >
                                                                <HomeWorkIcon fontSize="small" />
                                                            </IconButton>
                                                            <IconButton 
                                                                aria-label="remove from portfolio" 
                                                                size="small"
                                                                onClick={(e) => { e.stopPropagation(); handleRemoveFromPortfolio(id); }}
                                                            >
                                                                <DeleteIcon fontSize="small" />
                                                            </IconButton>
                                                        </TableCell>
                                                    </TableRow>
                                                    {/* Expanded Row for Controls */}
                                                    {isExpanded && (
                                                        <TableRow>
                                                            {/* Update colSpan to account for new icon column */}
                                                            <TableCell colSpan={8} sx={{ p: 0, borderBottom: 'none' }}> 
                                                                <Box sx={{ p: 2, bgcolor: 'grey.100' }}>
                                                                    <Typography variant="subtitle2" gutterBottom>Adjust Assumptions for: {prop?.address}</Typography>
                                                                    <AssumptionControls 
                                                                            propertyId={id} 
                                                                            propertyPrice={prop.price} // Pass current price
                                                                            assumptions={assumptions} 
                                                                            onChange={handleAssumptionChange} 
                                                                            defaultSettings={defaultSettingsPlaceholder} 
                                                                            handleSaveAssumptions={handleSaveAssumptions} 
                                                                        />
                                                                </Box>
                                                            </TableCell>
                                                        </TableRow>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Paper>

                        {/* NEW SECTION: Detailed Cashflow Analysis Tables */}
                        <Grid container spacing={3} sx={{ mb: 4 }}>
                            {/* @ts-ignore TODO: Fix Grid type issue */}
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
                                                <TableCell align="right">{formatCurrency(aggregatedCashflowData.rentalIncome)}</TableCell>
                                                <TableCell align="right">{formatCurrency(aggregatedCashflowData.rentalIncome * 12)}</TableCell>
                                            </TableRow>
                                            <TableRow>
                                                <TableCell>Mortgage (P&I)</TableCell>
                                                <TableCell align="right">-{formatCurrency(aggregatedCashflowData.mortgage)}</TableCell>
                                                <TableCell align="right">-{formatCurrency(aggregatedCashflowData.mortgage * 12)}</TableCell>
                                            </TableRow>
                                            <TableRow>
                                                <TableCell>Property Tax & Insurance</TableCell>
                                                <TableCell align="right">-{formatCurrency(aggregatedCashflowData.taxInsurance)}</TableCell>
                                                <TableCell align="right">-{formatCurrency(aggregatedCashflowData.taxInsurance * 12)}</TableCell>
                                            </TableRow>
                                            <TableRow>
                                                <TableCell>Vacancy</TableCell>
                                                <TableCell align="right">-{formatCurrency(aggregatedCashflowData.vacancy)}</TableCell>
                                                <TableCell align="right">-{formatCurrency(aggregatedCashflowData.vacancy * 12)}</TableCell>
                                            </TableRow>
                                            <TableRow>
                                                <TableCell>Capital Expenditures</TableCell>
                                                <TableCell align="right">-{formatCurrency(aggregatedCashflowData.capex)}</TableCell>
                                                <TableCell align="right">-{formatCurrency(aggregatedCashflowData.capex * 12)}</TableCell>
                                            </TableRow>
                                            <TableRow>
                                                <TableCell>Property Management</TableCell>
                                                <TableCell align="right">-{formatCurrency(aggregatedCashflowData.propertyManagement)}</TableCell>
                                                <TableCell align="right">-{formatCurrency(aggregatedCashflowData.propertyManagement * 12)}</TableCell>
                                            </TableRow>
                                            <TableRow sx={{ '& td': { fontWeight: 'bold', borderTop: '2px solid #e0e0e0' } }}>
                                                <TableCell>Total Cashflow</TableCell>
                                                <TableCell 
                                                    align="right"
                                                    sx={{ 
                                                        color: aggregatedCashflowData.monthlyCashflow >= 0 ? 'success.main' : 'error.main',
                                                        fontSize: '1.1rem'
                                                    }}
                                                >
                                                    {formatCurrency(aggregatedCashflowData.monthlyCashflow)}
                                                </TableCell>
                                                <TableCell 
                                                    align="right"
                                                    sx={{ 
                                                        color: aggregatedCashflowData.monthlyCashflow >= 0 ? 'success.main' : 'error.main',
                                                        fontSize: '1.1rem'
                                                    }}
                                                >
                                                    {formatCurrency(aggregatedCashflowData.monthlyCashflow * 12)}
                                                </TableCell>
                                            </TableRow>
                                            <TableRow sx={{ '& td': { fontWeight: 'bold' } }}>
                                                <TableCell>Cash on Cash Return (Avg.)</TableCell>
                                                <TableCell 
                                                    align="right"
                                                    sx={{ 
                                                        color: aggregatedMetrics.avgCocRoi >= 0 ? 'success.main' : 'error.main',
                                                        fontSize: '1.1rem'
                                                    }}
                                                >
                                                    {formatPercent(aggregatedMetrics.avgCocRoi)}
                                                </TableCell>
                                                <TableCell></TableCell>
                                            </TableRow>
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </Grid>
                            
                            {/* @ts-ignore TODO: Fix Grid type issue */}
                            <Grid size={{ xs: 12, md: 5 }}>
                                <Typography variant="h5" gutterBottom>Initial Investment</Typography>
                                <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
                                    <Table>
                                        <TableBody>
                                            <TableRow>
                                                <TableCell>Total Purchase Price</TableCell>
                                                <TableCell align="right">{formatCurrency(aggregatedMetrics.totalValue)}</TableCell>
                                            </TableRow>
                                            <TableRow>
                                                <TableCell>Down Payment (Total)</TableCell>
                                                <TableCell align="right">{formatCurrency(aggregatedMetrics.totalEquityYear0)}</TableCell>
                                            </TableRow>
                                            <TableRow>
                                                <TableCell>Closing Costs + Rehab (Est.)</TableCell>
                                                <TableCell align="right">{formatCurrency(aggregatedMetrics.totalInitialInvestment - aggregatedMetrics.totalEquityYear0)}</TableCell>
                                            </TableRow>
                                            <TableRow sx={{ '& td': { fontWeight: 'bold', borderTop: '2px solid #e0e0e0' } }}>
                                                <TableCell>Total Initial Investment</TableCell>
                                                <TableCell align="right">{formatCurrency(aggregatedMetrics.totalInitialInvestment)}</TableCell>
                                            </TableRow>
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                                
                                <Typography variant="h5" gutterBottom sx={{ mt: 3 }}>Financing Summary</Typography>
                                <TableContainer component={Paper} variant="outlined">
                                    <Table>
                                        <TableBody>
                                            <TableRow>
                                                <TableCell>Total Loan Amount</TableCell>
                                                <TableCell align="right">{formatCurrency(aggregatedMetrics.totalValue - aggregatedMetrics.totalEquityYear0)}</TableCell>
                                            </TableRow>
                                            <TableRow>
                                                <TableCell>Average Loan to Value</TableCell>
                                                <TableCell align="right">
                                                    {aggregatedMetrics.totalValue > 0 
                                                        ? formatPercent(Math.min(
                                                            ((aggregatedMetrics.totalValue - aggregatedMetrics.totalEquityYear0) / aggregatedMetrics.totalValue) * 100,
                                                            100
                                                          ))
                                                        : '0%'}
                                                </TableCell>
                                            </TableRow>
                                            <TableRow>
                                                <TableCell>Monthly Principal & Interest</TableCell>
                                                <TableCell align="right">{formatCurrency(aggregatedCashflowData.mortgage)}</TableCell>
                                            </TableRow>
                                            <TableRow>
                                                <TableCell>Gross Rental Yield</TableCell>
                                                <TableCell align="right">{formatPercent(aggregatedMetrics.grossRentalYield)}</TableCell>
                                            </TableRow>
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </Grid>
                        </Grid>

                        {/* Properties Map - Now Below Table */}
                        <Paper sx={{ p: 2, mb: 4 }}>
                            <Typography variant="h5" gutterBottom>Portfolio Map</Typography>
                            <Box sx={{ height: 400, width: '100%', position: 'relative' }}>
                                {/* @ts-ignore - Ignoring TypeScript errors for react-leaflet components */}
                                <MapContainer 
                                    // @ts-ignore
                                    center={[39.8283, -98.5795]} // Center of US
                                    zoom={4} 
                                    style={{ height: '100%', width: '100%' }}
                                >
                                    {/* @ts-ignore */}
                                    <TileLayer
                                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                        // @ts-ignore
                                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                    />
                                    {/* Add MapEffect to help with initial loading and bounds */}
                                    <MapEffect properties={portfolio} />
                                    
                                    {/* Render markers for properties with valid coordinates */}
                                    {Object.entries(portfolio).map(([id, propertyEntry]) => {
                                        // Get the property data, handling possible nesting
                                        const property = propertyEntry?.property || propertyEntry;
                                        
                                        // Extract coordinates directly
                                        let latitude = property?.latitude;
                                        let longitude = property?.longitude;
                                        
                                        // Try nested properties if direct ones don't exist
                                        if (!latitude || !longitude) {
                                            latitude = property?.property?.latitude;
                                            longitude = property?.property?.longitude;
                                        }
                                        
                                        // Parse string coordinates
                                        if (typeof latitude === 'string') latitude = parseFloat(latitude);
                                        if (typeof longitude === 'string') longitude = parseFloat(longitude);
                                        
                                        // Only show markers for properties with valid coordinates
                                        const validCoords = 
                                            latitude && longitude && 
                                            !isNaN(latitude) && !isNaN(longitude) &&
                                            Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
                                            
                                        // Debug individual marker rendering
                                        console.log(`Property ${id} marker check:`, { 
                                            latitude, 
                                            longitude, 
                                            validCoords, 
                                            address: property?.address || 'Unknown' 
                                        });
                                        
                                        if (validCoords) {
                                            return (
                                                <Marker 
                                                    key={id}
                                                    position={[latitude, longitude]}
                                                    // @ts-ignore - React-Leaflet v3/v4 has incorrect typings for the icon prop
                                                    icon={customMarkerIcon}
                                                >
                                                    <Popup>
                                                        <Typography variant="subtitle1">
                                                            {property?.address || property?.property?.address || 'Property ' + id}
                                                        </Typography>
                                                        <Typography variant="body2">
                                                            {property?.price || property?.property?.price || 'N/A'}
                                                        </Typography>
                                                        <Typography variant="body2">
                                                            Rent: {property?.rentEstimate || property?.rent_estimate || 
                                                            property?.property?.rentEstimate || 'N/A'}
                                                        </Typography>
                                                        <Button 
                                                            size="small" 
                                                            variant="outlined" 
                                                            onClick={() => handlePropertyClick(id)}
                                                        >
                                                            View Details
                                                        </Button>
                                                    </Popup>
                                                </Marker>
                                            );
                                        }
                                        return null;
                                    })}
                                </MapContainer>
                            </Box>
                        </Paper>
                        
                        {/* Property Selection Filters and Projections */}
                        <Paper sx={{ p: 2, mb: 4 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                <Typography variant="h5">Portfolio Analysis</Typography>
                                <FormGroup row>
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                checked={selectAll}
                                                onChange={handleSelectAll}
                                                icon={<CheckBoxOutlineBlankIcon />}
                                                checkedIcon={<CheckBoxIcon />}
                                            />
                                        }
                                        label="Select All"
                                    />
                                </FormGroup>
                            </Box>
                            
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
                                {Object.entries(portfolio).map(([id, property]) => {
                                    const prop = property?.property || property;
                                    const address = prop?.address || prop?.property?.address || 'Property ' + id;
                                    
                                    return (
                                        <Chip
                                            key={id}
                                            label={address.split(',')[0]} // Display just the street address
                                            onClick={() => handlePropertySelect(id)}
                                            onDelete={() => handlePropertySelect(id)}
                                            deleteIcon={selectedProperties[id] ? <CheckBoxIcon /> : <CheckBoxOutlineBlankIcon />}
                                            color={selectedProperties[id] ? "primary" : "default"}
                                            variant={selectedProperties[id] ? "filled" : "outlined"}
                                            sx={{ m: 0.5 }}
                                        />
                                    );
                                })}
                            </Box>
                            
                            {/* Projection Settings */}
                            <Box sx={{ mb: 3 }}>
                                <Typography variant="subtitle1" gutterBottom>Projection Settings</Typography>
                                <Grid container spacing={3} alignItems="center" sx={{ mb: 3 }}>
                                    {/* Projection Controls */}
                                    {/* @ts-ignore */}
                                    <Grid item component="div" xs={12} md={4}>
                                        <Typography gutterBottom>Years to Project</Typography>
                                        <Slider
                                            value={yearsToProject}
                                            onChange={(e, newValue) => setYearsToProject(newValue as number)}
                                            aria-labelledby="years-to-project-slider"
                                            valueLabelDisplay="auto"
                                            step={1}
                                            marks
                                            min={1}
                                            max={30}
                                            sx={{ width: '100%', '& .MuiSlider-mark': { display: 'none' } }}
                                        />
                                    </Grid>
                                    {/* @ts-ignore */}
                                    <Grid item component="div" xs={12} md={4}>
                                        <Typography gutterBottom>Rent Appreciation (%/yr)</Typography>
                                        <Slider
                                            value={rentAppreciationRate}
                                            onChange={(e, newValue) => setRentAppreciationRate(newValue as number)}
                                            aria-labelledby="rent-appreciation-slider"
                                            valueLabelDisplay="auto"
                                            step={0.1}
                                            marks
                                            min={0}
                                            max={10}
                                            sx={{ width: '100%', '& .MuiSlider-mark': { display: 'none' } }}
                                        />
                                    </Grid>
                                    {/* @ts-ignore */}
                                    <Grid item component="div" xs={12} md={4}>
                                        <Typography gutterBottom>Property Value Increase (%/yr)</Typography>
                                        <Slider
                                            value={propertyValueIncreaseRate}
                                            onChange={(e, newValue) => setPropertyValueIncreaseRate(newValue as number)}
                                            aria-labelledby="property-value-increase-slider"
                                            valueLabelDisplay="auto"
                                            step={0.1}
                                            marks
                                            min={0}
                                            max={10}
                                            sx={{ width: '100%', '& .MuiSlider-mark': { display: 'none' } }}
                                        />
                                    </Grid>
                                </Grid>
                            </Box>

                            {/* IRR Display - Use irrData state */}
                            <Paper elevation={2} sx={{ p: 2, mb: 3, bgcolor: 'grey.50', border: '1px solid #e0e0e0' }}>
                                <Typography variant="h6" gutterBottom sx={{ textAlign: 'left', mb: 2 }}>IRR Projections</Typography>
                                <Grid container spacing={2} justifyContent="space-around"> {/* justifyContent to spread items a bit */}
                                    {Object.entries(irrData).map(([periodLabel, rate]) => (
                                        // @ts-ignore 
                                        <Grid item component="div" xs={6} sm={4} md={"auto"} key={periodLabel} sx={{ flexGrow: 1, maxWidth: {md: '20%'} }}> {/* md="auto" with flexGrow and maxWidth for 5 items */}
                                            <Box sx={{ textAlign: 'center', p: 1 }}>
                                                <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'medium' }}>
                                                    {periodLabel}
                                                </Typography>
                                                <Typography 
                                                    variant="h5" // Kept h5 for prominence from previous version
                                                    sx={{
                                                        fontWeight: 'bold',
                                                        color: !isFinite(rate) ? 'text.secondary' :
                                                               rate > 15 ? 'success.dark' :
                                                               rate > 10 ? 'success.main' :
                                                               rate > 5 ? 'warning.main' : 'error.main'
                                                    }}
                                                >
                                                     {isFinite(rate) ? formatPercent(rate) : 'N/A'}
                                                </Typography>
                                            </Box>
                                        </Grid>
                                    ))}
                                </Grid>
                            </Paper>

                            {/* Cash Flow Analysis Charts - Remove Tabs, Show Both */}
                            <Box sx={{ mb: 3, mt: 4 }}> 

                                {/* Always render Long-Term Chart */} 
                                <Box sx={{ mt: 2, mb: 1 }}> {/* Added mb: 1 */}
                                    <Typography variant="h6" gutterBottom>Long-Term Projection ({yearsToProject} Years)</Typography>
                                    {aggregatedLongTermData.length > 0 ? (
                                        <Box sx={{ height: 400 }}>
                                            <SimpleChart data={{
                                                years: aggregatedLongTermData.map(d => d.year),
                                                propertyValues: aggregatedLongTermData.map(d => d.propertyValue),
                                                equity: aggregatedLongTermData.map(d => d.equity),
                                                cashflow: aggregatedLongTermData.map(d => d.cashflow),
                                            }} />
                                        </Box>
                                    ) : (
                                        <Typography sx={{textAlign: 'center', p: 2}}>No projection data available.</Typography>
                                    )}
                                </Box>

                                {/* Toggle Button for Projection Table */}
                                {aggregatedLongTermData.length > 0 && (
                                    <Box sx={{ textAlign: 'center', mb: 1 }}>
                                        <Button 
                                            variant="outlined"
                                            size="small"
                                            onClick={() => setIsProjectionTableVisible(!isProjectionTableVisible)}
                                            startIcon={<TableChartIcon />}
                                        >
                                            {isProjectionTableVisible ? 'Hide Projection Data' : 'Show Projection Data'}
                                        </Button>
                                    </Box>
                                )}
                                
                                {/* Collapsible Projection Data Table */}
                                <Collapse in={isProjectionTableVisible} timeout="auto" unmountOnExit>
                                    <Paper sx={{ mb: 2 }}>
                                        <TableContainer sx={{ maxHeight: 400 }}> {/* Added max height for scroll */} 
                                            <Table stickyHeader size="small">
                                                <TableHead>
                                                    <TableRow>
                                                        <TableCell align="center">Year</TableCell>
                                                        <TableCell align="right">Property Value</TableCell>
                                                        <TableCell align="right">Equity</TableCell>
                                                        <TableCell align="right">Annual Cashflow</TableCell>
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {aggregatedLongTermData.map((data) => (
                                                        <TableRow key={data.year} 
                                                            sx={{ 
                                                                backgroundColor: data.year === 0 ? 'rgba(66, 165, 245, 0.08)' : 'inherit',
                                                                fontWeight: data.year === 0 ? 'bold' : 'normal'
                                                            }}
                                                        >
                                                            <TableCell align="center">{data.year === 0 ? 'Current' : data.year}</TableCell>
                                                            <TableCell align="right">{formatCurrency(data.propertyValue)}</TableCell>
                                                            <TableCell align="right">{formatCurrency(data.equity)}</TableCell>
                                                            <TableCell align="right" sx={{ color: data.cashflow >= 0 ? 'success.main' : 'error.main' }}>
                                                                {formatCurrency(data.cashflow)}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </TableContainer>
                                    </Paper>
                                </Collapse>
                                
                                {/* Always render Sankey Chart */} 
                                <Box sx={{ mt: 4 }}> 
                                    <Typography variant="h6" gutterBottom>Monthly Cash Flow Breakdown</Typography>
                                     {aggregatedCashflowData.rentalIncome > 0 ? (
                                        <Box sx={{ height: 400 }}>
                                            <CashflowSankeyChart 
                                                data={aggregatedCashflowData} 
                                                formatCurrency={formatCurrency} // Pass the formatting function
                                            />
                                        </Box>
                                     ) : (
                                         <Typography sx={{textAlign: 'center', p: 2}}>No cashflow data available.</Typography>
                                     )}
                                </Box>
                            </Box>
                        </Paper>

                        {/* Property Cards - Remove or simplify */}
                        {/* Consider removing this section or simplifying it significantly, */}
                        {/* as the table now shows detailed info. */}
                        {/* If kept, ensure it uses correct data and doesn't recalculate heavily. */}
                        {/* <Grid container spacing={3}> ... </Grid> */}
                    </>
                )}
            </Container>

            {/* PDF Modal */} 
            <Dialog
                open={pdfModalOpen}
                onClose={handleClosePdfModal}
                fullWidth
                maxWidth="lg"
            >
                {/* Basic placeholder content - PortfolioPDFDocument will go here */}
                <DialogContent sx={{ height: '80vh', p: 0 }}> 
                     <Typography sx={{ p: 2 }}>PDF Viewer Placeholder</Typography>
                     {/* 
                     <PDFViewer width="100%" height="100%">
                         <PortfolioPDFDocument 
                             portfolio={portfolio}
                             selectedProperties={selectedProperties}
                             aggregatedMetrics={aggregatedMetrics} 
                             aggregatedLongTermData={aggregatedLongTermData}
                             irrData={irrData}
                             yearsToProject={yearsToProject}
                             rentAppreciationRate={rentAppreciationRate}
                             propertyValueIncreaseRate={propertyValueIncreaseRate}
                          />
                     </PDFViewer>
                     */}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleClosePdfModal}>Close</Button>
                </DialogActions>
            </Dialog>

            {/* Snackbar for feedback */}
            <Snackbar
                open={snackbarOpen}
                autoHideDuration={4000}
                onClose={handleCloseSnackbar}
                message={snackbarMessage}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            />
        </>
    );
};

export default PortfolioPage; 