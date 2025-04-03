import React from 'react';
import { Typography, Box, Pagination, Alert, CircularProgress } from '@mui/material';
import PropertyCard from './PropertyCard';

interface PropertyListProps {
  properties: any[];
  loading: boolean;
  error: string | null;
  searchPerformed: boolean;
  totalPages: number;
  totalProperties: number;
  currentPage: number;
  handlePageChange: (event: React.ChangeEvent<unknown>, value: number) => void;
  calculateCashflow: (property: any) => any;
  formatCurrency: (amount: number) => string;
  formatPercent: (percent: number) => string;
  vacancyPercent: number;
  capexPercent: number;
}

const PropertyList: React.FC<PropertyListProps> = ({
  properties,
  loading,
  error,
  searchPerformed,
  totalPages,
  totalProperties,
  currentPage,
  handlePageChange,
  calculateCashflow,
  formatCurrency,
  formatPercent,
  vacancyPercent,
  capexPercent
}) => {
  if (loading) {
    return (
      <Box display="flex" justifyContent="center" my={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 3 }}>
        {error}
      </Alert>
    );
  }

  if (searchPerformed && properties.length === 0 && !error) {
    return (
      <Alert severity="info">
        No properties found in this location. Please try another zip code or city.
      </Alert>
    );
  }

  return (
    <>
      {/* Show pagination info if we have results */}
      {searchPerformed && !loading && properties.length > 0 && totalPages > 0 && (
        <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
          Showing {properties.length} of {totalProperties} properties (Page {currentPage + 1} of {totalPages})
        </Typography>
      )}

      <div className="property-grid">
        {properties.map(property => {
          const cashflow = calculateCashflow(property);
          
          return (
            <PropertyCard 
              key={property.property_id}
              property={property}
              cashflow={cashflow}
              formatCurrency={formatCurrency}
              formatPercent={formatPercent}
              vacancyPercent={vacancyPercent}
              capexPercent={capexPercent}
            />
          );
        })}
      </div>
      
      {/* Simple pagination controls */}
      {totalPages > 1 && (
        <Box display="flex" justifyContent="center" mt={4} mb={4}>
          <Pagination 
            count={totalPages} 
            page={currentPage + 1} 
            onChange={handlePageChange}
            color="primary"
          />
        </Box>
      )}
    </>
  );
};

export default PropertyList;
