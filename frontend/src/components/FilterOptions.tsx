import React from 'react';
import { Typography, FormControl, InputLabel, Select, MenuItem, Slider, Box, FormGroup, FormControlLabel, Checkbox } from '@mui/material';

interface FilterOptionsProps {
  priceRange: [number, number];
  setPriceRange: (range: [number, number]) => void;
  bedroomsFilter: number[];
  setBedroomsFilter: (bedrooms: number[]) => void;
  bathroomsFilter: number[];
  setBathroomsFilter: (bathrooms: number[]) => void;
  minRatio: number;
  setMinRatio: (ratio: number) => void;
  propertyType: string;
  setPropertyType: (type: string) => void;
}

const FilterOptions: React.FC<FilterOptionsProps> = ({
  priceRange,
  setPriceRange,
  bedroomsFilter,
  setBedroomsFilter,
  bathroomsFilter,
  setBathroomsFilter,
  minRatio,
  setMinRatio,
  propertyType,
  setPropertyType
}) => {
  const handleBedroomToggle = (value: number) => {
    const currentIndex = bedroomsFilter.indexOf(value);
    const newBedroomsFilter = [...bedroomsFilter];
    
    if (currentIndex === -1) {
      newBedroomsFilter.push(value);
    } else {
      newBedroomsFilter.splice(currentIndex, 1);
    }
    
    setBedroomsFilter(newBedroomsFilter);
  };
  
  const handleBathroomToggle = (value: number) => {
    const currentIndex = bathroomsFilter.indexOf(value);
    const newBathroomsFilter = [...bathroomsFilter];
    
    if (currentIndex === -1) {
      newBathroomsFilter.push(value);
    } else {
      newBathroomsFilter.splice(currentIndex, 1);
    }
    
    setBathroomsFilter(newBathroomsFilter);
  };

  return (
    <Box sx={{ mb: 4, p: 2, border: '1px solid #e0e0e0', borderRadius: 1 }}>
      <Typography variant="h6" gutterBottom>Filter Options</Typography>
      
      <Typography gutterBottom>Price Range: ${priceRange[0].toLocaleString()} - ${priceRange[1].toLocaleString()}</Typography>
      <Slider
        value={priceRange}
        onChange={(_, value) => setPriceRange(value as [number, number])}
        min={100000}
        max={2000000}
        step={50000}
        valueLabelDisplay="auto"
        valueLabelFormat={(value) => `$${value.toLocaleString()}`}
        sx={{ mb: 3 }}
      />
      
      <Typography gutterBottom>Minimum Rent-to-Price Ratio: {(minRatio * 100).toFixed(1)}%</Typography>
      <Slider
        value={minRatio}
        onChange={(_, value) => setMinRatio(value as number)}
        min={0.003}
        max={0.01}
        step={0.0005}
        valueLabelDisplay="auto"
        valueLabelFormat={(value) => `${(value * 100).toFixed(1)}%`}
        sx={{ mb: 3 }}
      />
      
      <FormControl fullWidth sx={{ mb: 3 }}>
        <InputLabel>Property Type</InputLabel>
        <Select
          value={propertyType}
          label="Property Type"
          onChange={(e) => setPropertyType(e.target.value)}
        >
          <MenuItem value="All">All Types</MenuItem>
          <MenuItem value="SingleFamily">Single Family</MenuItem>
          <MenuItem value="Condo">Condo</MenuItem>
          <MenuItem value="MultiFamily">Multi-Family</MenuItem>
          <MenuItem value="Townhouse">Townhouse</MenuItem>
        </Select>
      </FormControl>
      
      <Typography gutterBottom>Bedrooms</Typography>
      <FormGroup row sx={{ mb: 3 }}>
        {[1, 2, 3, 4, 5].map((num) => (
          <FormControlLabel
            key={`bed-${num}`}
            control={
              <Checkbox 
                checked={bedroomsFilter.includes(num)} 
                onChange={() => handleBedroomToggle(num)} 
              />
            }
            label={num === 5 ? "5+" : num.toString()}
          />
        ))}
      </FormGroup>
      
      <Typography gutterBottom>Bathrooms</Typography>
      <FormGroup row>
        {[1, 1.5, 2, 2.5, 3, 4].map((num) => (
          <FormControlLabel
            key={`bath-${num}`}
            control={
              <Checkbox 
                checked={bathroomsFilter.includes(num)} 
                onChange={() => handleBathroomToggle(num)} 
              />
            }
            label={num.toString()}
          />
        ))}
      </FormGroup>
    </Box>
  );
};

export default FilterOptions;
