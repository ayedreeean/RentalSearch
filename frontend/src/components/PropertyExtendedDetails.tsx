import React, { useEffect, useState } from 'react';
import { 
  Box, 
  Typography, 
  CircularProgress, 
  Alert,
  Button
} from '@mui/material';
import { Property } from '../types';
import { getPropertyDetailsByZpid } from '../api/propertyApi';
import PropertyImageGallery from './PropertyImageGallery';
import { Refresh as RefreshIcon } from '@mui/icons-material';

interface PropertyExtendedDetailsProps {
  property: Property;
  onDetailsLoaded?: (updatedProperty: Property) => void;
}

const PropertyExtendedDetails: React.FC<PropertyExtendedDetailsProps> = ({ 
  property,
  onDetailsLoaded
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailedProperty, setDetailedProperty] = useState<Property | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Function to fetch extended details
  const fetchExtendedDetails = async () => {
    // Don't fetch if we already have multiple images
    if (property.images && property.images.length > 1) {
      console.log(`[PropertyExtendedDetails] Property already has ${property.images.length} images, skipping fetch`);
      setDetailedProperty(property);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      // Extract the Zillow property ID from the property_id
      const zpid = property.property_id;
      
      if (!zpid) {
        throw new Error('No valid property ID found');
      }
      
      console.log(`[PropertyExtendedDetails] Fetching extended details for property ${zpid}`);
      const extendedDetails = await getPropertyDetailsByZpid(zpid);
      
      if (!extendedDetails) {
        throw new Error('Failed to fetch extended property details');
      }
      
      console.log(`[PropertyExtendedDetails] Successfully fetched details with ${extendedDetails.images?.length || 0} images`);
      
      // Merge the extended details with the original property data
      // This ensures we keep any custom data from the original property
      const updatedProperty = {
        ...property,
        images: extendedDetails.images || [property.thumbnail]
      };
      
      setDetailedProperty(updatedProperty);
      
      // Notify parent component if needed
      if (onDetailsLoaded) {
        onDetailsLoaded(updatedProperty);
      }
    } catch (err) {
      console.error('[PropertyExtendedDetails] Error fetching extended property details:', err);
      setError(`Failed to load extended property details. Using basic information instead. ${err instanceof Error ? err.message : ''}`);
      
      // Fallback to original property with thumbnail as image
      const fallbackProperty = {
        ...property,
        images: [property.thumbnail]
      };
      setDetailedProperty(fallbackProperty);
    } finally {
      setLoading(false);
    }
  };

  // Load property details when the component mounts
  useEffect(() => {
    fetchExtendedDetails();
  }, [property, onDetailsLoaded, retryCount]);

  // Function to retry loading
  const handleRetry = () => {
    setRetryCount(prevCount => prevCount + 1);
  };

  // Show loading state
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
        <Typography variant="body2" sx={{ ml: 2 }}>
          Loading property images...
        </Typography>
      </Box>
    );
  }

  // Show error state with retry button
  if (error) {
    return (
      <>
        <Alert 
          severity="warning" 
          sx={{ mb: 2 }}
          action={
            <Button 
              color="inherit" 
              size="small" 
              onClick={handleRetry}
              startIcon={<RefreshIcon />}
            >
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
        <PropertyImageGallery 
          images={[property.thumbnail]} 
          address={property.address} 
        />
      </>
    );
  }

  // Show property images
  return (
    <Box sx={{ mb: 3 }}>
      <PropertyImageGallery 
        images={detailedProperty?.images || [property.thumbnail]} 
        address={property.address} 
      />
    </Box>
  );
};

export default PropertyExtendedDetails; 