import React from 'react';
import { TextField, Button, Box, CircularProgress } from '@mui/material';

interface SearchBarProps {
  location: string;
  setLocation: (location: string) => void;
  handleSearch: () => void;
  loading: boolean;
}

const SearchBar: React.FC<SearchBarProps> = ({ 
  location, 
  setLocation, 
  handleSearch, 
  loading 
}) => {
  return (
    <Box sx={{ mb: 4 }}>
      <TextField
        fullWidth
        label="Enter Zip Code or City"
        variant="outlined"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
        sx={{ mb: 2 }}
      />
      <Button 
        variant="contained" 
        color="primary" 
        onClick={handleSearch}
        disabled={loading}
        fullWidth
      >
        {loading ? <CircularProgress size={24} color="inherit" /> : 'Search Properties'}
      </Button>
    </Box>
  );
};

export default SearchBar;
