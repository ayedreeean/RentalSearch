import React, { useEffect, useState } from 'react';
import { 
  Box, 
  Typography, 
  CircularProgress, 
  Alert
} from '@mui/material';
import { Property } from '../types';
import { getPropertyDetailsByZpid } from '../api/propertyApi';
import PropertyImageGallery from './PropertyImageGallery';

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

  // Load property details when the component mounts
  useEffect(() => {
    const fetchExtendedDetails = async () => {
      // Don't fetch if we already have images
      if (property.images && property.images.length > 1) {
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
        
        const extendedDetails = await getPropertyDetailsByZpid(zpid);
        
        if (!extendedDetails) {
          throw new Error('Failed to fetch extended property details');
        }
        
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
        console.error('Error fetching extended property details:', err);
        setError('Failed to load extended property details. Using basic information instead.');
        
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

    fetchExtendedDetails();
  }, [property, onDetailsLoaded]);

  // Show loading state
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  // Show error state
  if (error) {
    return (
      <>
        <Alert severity="warning" sx={{ mb: 2 }}>{error}</Alert>
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