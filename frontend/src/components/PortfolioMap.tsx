import React, { useState, useEffect, useMemo } from 'react';
import { Box, Typography, Button } from '@mui/material';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { formatCurrency } from '../utils/formatting';
import { calculateCashflow } from '../utils/calculations';
import { CashflowSettings, Property } from '../types';

// Default settings to use for calculating cashflow
const defaultSettings: CashflowSettings = {
  interestRate: 7.5,
  loanTerm: 30,
  downPaymentPercent: 20,
  taxInsurancePercent: 3,
  vacancyPercent: 8,
  capexPercent: 5,
  propertyManagementPercent: 0,
  rehabAmount: 0
};

// Helper component to fit bounds
const FitBoundsToMarkers = ({ bounds }: { bounds: L.LatLngBoundsExpression | undefined }) => {
  const map = useMap();
  
  useEffect(() => {
    if (bounds && map) {
      try {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      } catch (e) {
        console.warn("Error fitting map bounds: ", e);
        map.setView([39.8283, -98.5795], 4);
      }
    }
  }, [map, bounds]);
  
  return null;
};

// Helper to geocode addresses
const geocodeAddress = async (address: string): Promise<[number, number] | null> => {
  try {
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

// Component to handle address geocoding
const GeocodeEffect = ({ properties, onGeocodeComplete }: { 
  properties: Record<string, any>,
  onGeocodeComplete?: (geocodedProperties: Record<string, [number, number]>) => void 
}) => {
  const map = useMap();
  
  useEffect(() => {
    const geocodedCoords: Record<string, [number, number]> = {};
    
    // Find properties that need geocoding
    const propertiesNeedingGeocode = Object.entries(properties).filter(([_, property]) => {
      const prop = property?.property || property;
      let lat = prop?.latitude || prop?.lat;
      let lng = prop?.longitude || prop?.lng || prop?.lon;
      
      if (!lat || !lng) {
        lat = prop?.property?.latitude || prop?.property?.lat;
        lng = prop?.property?.longitude || prop?.property?.lng || prop?.property?.lon;
      }
      
      // Check if coordinates are valid
      if (lat && lng) {
        const latNum = typeof lat === 'string' ? parseFloat(lat) : lat;
        const lngNum = typeof lng === 'string' ? parseFloat(lng) : lng;
        
        if (!isNaN(latNum) && !isNaN(lngNum) && 
            Math.abs(latNum) <= 90 && Math.abs(lngNum) <= 180) {
          return false; // Valid coordinates, no need to geocode
        }
      }
      
      // Need to geocode if we have an address
      const address = prop?.address || prop?.property?.address;
      return typeof address === 'string' && address.length > 0;
    });
    
    console.log(`[GeocodeEffect] Need to geocode ${propertiesNeedingGeocode.length} properties`);
    
    if (propertiesNeedingGeocode.length > 0) {
      // Create a promise for each geocoding operation
      const geocodePromises = propertiesNeedingGeocode.map(async ([id, property]) => {
        const prop = property?.property || property;
        const address = prop?.address || prop?.property?.address;
        
        if (address) {
          try {
            const coords = await geocodeAddress(address);
            if (coords) {
              geocodedCoords[id] = coords;
              return true;
            }
          } catch (e) {
            console.error(`Error geocoding ${address}:`, e);
          }
        }
        return false;
      });
      
      // Process all geocoding results
      Promise.all(geocodePromises).then(() => {
        // Call the callback with geocoded coordinates
        if (onGeocodeComplete) {
          onGeocodeComplete(geocodedCoords);
        }
      });
    }
  }, [properties, map, onGeocodeComplete]);
  
  return null;
};

// Main portfolio map component
interface PortfolioMapProps {
  portfolio: Record<string, any>;
  settings?: CashflowSettings;
  selectedProperties?: Record<string, boolean>;
  onPropertyClick?: (propertyId: string) => void;
  height?: number | string;
}

export const PortfolioMap: React.FC<PortfolioMapProps> = ({
  portfolio,
  settings = defaultSettings,
  selectedProperties = {},
  onPropertyClick,
  height = 400
}) => {
  const [geocodedCoords, setGeocodedCoords] = useState<Record<string, [number, number]>>({});
  
  // Count properties with coordinates vs total
  const totalProperties = Object.keys(portfolio).length;
  
  // Extract coordinates from properties
  const validCoords = useMemo(() => {
    return Object.entries(portfolio).map(([id, propertyEntry]) => {
      // Get property data handling possible nesting
      const property = propertyEntry?.property || propertyEntry;
      
      // Try to get coordinates from all possible places
      let latitude = property?.latitude || property?.lat;
      let longitude = property?.longitude || property?.lng || property?.lon;
      
      if (!latitude || !longitude) {
        latitude = property?.property?.latitude || property?.property?.lat;
        longitude = property?.property?.longitude || property?.property?.lng || property?.property?.lon;
      }
      
      // If we have geocoded coordinates for this property, use them
      if (geocodedCoords[id]) {
        [latitude, longitude] = geocodedCoords[id];
      }
      
      // Parse string coordinates
      if (typeof latitude === 'string') latitude = parseFloat(latitude);
      if (typeof longitude === 'string') longitude = parseFloat(longitude);
      
      // Check for valid coordinates
      const validCoord = 
        latitude && longitude && 
        !isNaN(latitude) && !isNaN(longitude) &&
        Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
      
      return validCoord ? [id, [latitude, longitude]] : null;
    }).filter(entry => entry !== null) as [string, L.LatLngExpression][];
  }, [portfolio, geocodedCoords]);
  
  // Generate map bounds from valid coordinates
  const bounds = useMemo(() => {
    const coordsOnly = validCoords.map(([_, coords]) => coords);
    return coordsOnly.length > 0 ? L.latLngBounds(coordsOnly) : undefined;
  }, [validCoords]);
  
  // Handle geocoded coordinates
  const handleGeocodeComplete = (newGeocodedCoords: Record<string, [number, number]>) => {
    console.log(`[PortfolioMap] Received ${Object.keys(newGeocodedCoords).length} geocoded coordinates`);
    setGeocodedCoords(prev => ({ ...prev, ...newGeocodedCoords }));
  };

  // Show message if no properties
  if (totalProperties === 0) {
    return (
      <Box sx={{ height, display: 'flex', justifyContent: 'center', alignItems: 'center', bgcolor: '#f5f5f5', borderRadius: 1 }}>
        <Typography variant="body1">No properties in portfolio to display</Typography>
      </Box>
    );
  }
  
  return (
    <Box sx={{ height, width: '100%', position: 'relative', borderRadius: 1, overflow: 'hidden' }}>
      {/* Use type assertions to fix TypeScript errors */}
      <MapContainer 
        {...{
          center: [39.8283, -98.5795], // Center of US
          zoom: 4,
          style: { height: '100%', width: '100%' }
        } as any}
      >
        <TileLayer
          {...{
            url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          } as any}
        />
        
        {/* Adjust map bounds */}
        {bounds && <FitBoundsToMarkers bounds={bounds} />}
        
        {/* Geocode missing addresses */}
        <GeocodeEffect properties={portfolio} onGeocodeComplete={handleGeocodeComplete} />
        
        {/* Render markers for properties with coordinates */}
        {validCoords.map(([id, position]) => {
          const propertyEntry = portfolio[id];
          if (!propertyEntry) return null;
          
          const property = propertyEntry?.property || propertyEntry;
          
          // Get property-specific assumptions
          const assumptions = propertyEntry?.portfolioAssumptions || {};
          console.log(`[PortfolioMap] Property ${id} assumptions:`, assumptions);
          
          // Extract needed values with assumptions override
          const price = property?.price || property?.property?.price || 0;
          const rent_estimate = assumptions?.rentEstimate || property?.rent_estimate || property?.rentEstimate || 
                               property?.property?.rent_estimate || property?.property?.rentEstimate || 0;
          const address = property?.address || property?.property?.address || 'Unknown';
          
          // Apply property-specific settings
          const propertySettings: CashflowSettings = {
            interestRate: assumptions?.interestRate ?? settings.interestRate,
            loanTerm: assumptions?.loanTerm ?? settings.loanTerm,
            downPaymentPercent: assumptions?.downPaymentPercent ?? settings.downPaymentPercent,
            taxInsurancePercent: assumptions?.taxInsurancePercent ?? settings.taxInsurancePercent,
            vacancyPercent: assumptions?.vacancyPercent ?? settings.vacancyPercent,
            capexPercent: assumptions?.capexPercent ?? settings.capexPercent,
            propertyManagementPercent: assumptions?.propertyManagementPercent ?? settings.propertyManagementPercent,
            rehabAmount: assumptions?.rehabAmount ?? settings.rehabAmount
          };
          
          console.log(`[PortfolioMap] Property ${id} settings:`, {
            price,
            rent_estimate,
            address,
            settings: propertySettings
          });
          
          // Calculate cashflow with property-specific settings
          const cashflowResult = calculateCashflow(
            { price, rent_estimate } as Property, 
            propertySettings
          );
          
          console.log(`[PortfolioMap] Property ${id} calculated cashflow:`, cashflowResult);
          
          const monthlyCashflow = cashflowResult?.monthlyCashflow || 0;
          const isPositive = monthlyCashflow >= 0;
          const isSelected = selectedProperties[id];
          
          // Format pin text and determine color
          const pinText = formatCurrency(monthlyCashflow);
          const pinColorClassSuffix = isPositive ? 'positive' : 'negative';
          
          // Create marker icon
          const divIcon = L.divIcon({
            html: `<div class="cashflow-map-pin ${pinColorClassSuffix} ${isSelected ? 'selected' : ''}">${pinText}</div>`,
            className: 'cashflow-map-marker',
            iconSize: [60, 25],
            iconAnchor: [30, 25]
          });
          
          return (
            <Marker 
              {...{
                key: id,
                position: position,
                icon: divIcon
              } as any}
            >
              <Popup>
                <Typography variant="subtitle2">{address}</Typography>
                <Typography variant="body2">Price: {formatCurrency(price)}</Typography>
                <Typography variant="body2">Rent: {formatCurrency(rent_estimate)}</Typography>
                <Typography variant="body2" sx={{ color: isPositive ? 'success.main' : 'error.main' }}>
                  Cashflow: {pinText}/mo
                </Typography>
                {onPropertyClick && (
                  <Button 
                    size="small" 
                    variant="outlined" 
                    onClick={() => onPropertyClick(id)}
                    sx={{ mt: 1 }}
                  >
                    View Details
                  </Button>
                )}
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </Box>
  );
};

export default PortfolioMap; 