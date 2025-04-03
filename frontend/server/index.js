const express = require('express');
const axios = require('axios');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const { mockProperties } = require('./mockData');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, './.env') });

const app = express();
const PORT = process.env.PORT || 4000;

// Get API key from environment variable
const RAPIDAPI_KEY = process.env.REACT_APP_RAPIDAPI_KEY;

// Use mock data flag
const USE_MOCK_DATA = false;

if (!RAPIDAPI_KEY && !USE_MOCK_DATA) {
  console.error('ERROR: RapidAPI key not found in environment variables');
  process.exit(1);
}

// Enable CORS for all routes
app.use(cors());

// Serve static files from the build directory
app.use(express.static(path.join(__dirname, '../build')));

// Middleware to parse JSON bodies
app.use(express.json());

// Helper function to add delay between API calls
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// API proxy endpoint for property search
app.get('/api/search', async (req, res) => {
  try {
    const { location, page = 0 } = req.query;
    console.log(`Searching for properties in ${location}, page ${parseInt(page) + 1}`);
    
    // Use mock data if flag is set
    if (USE_MOCK_DATA) {
      console.log('Using mock data for property search');
      
      // Calculate pagination
      const pageSize = 10;
      const startIndex = parseInt(page) * pageSize;
      const endIndex = Math.min(startIndex + pageSize, mockProperties.length);
      
      // Get properties for the current page
      const paginatedProperties = mockProperties.slice(startIndex, endIndex);
      
      // Return mock properties and total count
      return res.json({
        properties: paginatedProperties,
        totalCount: mockProperties.length
      });
    }
    
    // If not using mock data, proceed with real API call
    const searchResponse = await axios.request({
      method: 'GET',
      url: 'https://zillow-com1.p.rapidapi.com/propertyExtendedSearch',
      params: {
        location: location,
        home_type: 'Houses'
      },
      headers: {
        'X-RapidAPI-Key': RAPIDAPI_KEY,
        'X-RapidAPI-Host': 'zillow-com1.p.rapidapi.com'
      },
      timeout: 10000
    });
    
    // Check if we have results
    if (!searchResponse.data || !searchResponse.data.props || searchResponse.data.props.length === 0) {
      return res.json({ properties: [], totalCount: 0 });
    }
    
    // Get all properties for pagination
    const allProperties = searchResponse.data.props;
    const totalCount = allProperties.length;
    
    // Calculate start and end indices for pagination (10 properties per page)
    const pageSize = 10;
    const startIndex = parseInt(page) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, allProperties.length);
    
    // Get properties for the current page
    const paginatedProperties = allProperties.slice(startIndex, endIndex);
    
    // Process each property to get additional details and rent estimates
    const properties = [];
    
    // Process properties sequentially with optimized delays to avoid rate limiting
    for (const item of paginatedProperties) {
      // Get property details to fetch days on market
      let daysOnMarket = null;
      
      try {
        if (item.zpid) {
          const propertyResponse = await axios.request({
            method: 'GET',
            url: 'https://zillow-com1.p.rapidapi.com/property',
            params: {
              zpid: item.zpid
            },
            headers: {
              'X-RapidAPI-Key': RAPIDAPI_KEY,
              'X-RapidAPI-Host': 'zillow-com1.p.rapidapi.com'
            },
            timeout: 10000
          });
          
          // Extract days on market if available
          if (propertyResponse.data && propertyResponse.data.hasOwnProperty('daysOnZillow')) {
            daysOnMarket = propertyResponse.data.daysOnZillow;
          } else if (propertyResponse.data && propertyResponse.data.hasOwnProperty('timeOnZillow')) {
            // Alternative property name that might contain days on market
            daysOnMarket = propertyResponse.data.timeOnZillow;
          }
        }
        
        // Add delay to avoid rate limiting (3 seconds between API calls)
        await delay(3000);
        
      } catch (error) {
        console.error('Error getting property details:', error);
        // Continue with the process even if this API call fails
      }
      
      // Get rent estimate for each property
      let rentEstimate = 0;
      let rentSource = 'calculated'; // Default to calculated
      
      try {
        // Use the Zillow API rentEstimate endpoint with optimized parameters
        const rentResponse = await axios.request({
          method: 'GET',
          url: 'https://zillow-com1.p.rapidapi.com/rentEstimate',
          params: {
            propertyType: 'SingleFamily', // Required parameter
            address: item.address, // Axios handles URL encoding
            d: 0.5, // Diameter parameter (default is 0.5)
            beds: item.bedrooms || 3,
            baths: item.bathrooms || 2,
            sqftMin: item.livingArea || 1000 // For better accuracy
          },
          headers: {
            'X-RapidAPI-Key': RAPIDAPI_KEY,
            'X-RapidAPI-Host': 'zillow-com1.p.rapidapi.com'
          },
          timeout: 10000
        });
        
        console.log('Rent estimate API response:', rentResponse.data);
        
        // Extract rent estimate from response
        if (rentResponse.data && rentResponse.data.rent) {
          rentEstimate = rentResponse.data.rent;
          rentSource = 'zillow'; // Set source to zillow when we get data from API
        } else {
          // Fallback: estimate rent as 0.7% of property value per month
          rentEstimate = Math.round(item.price * 0.007);
          rentSource = 'calculated'; // Set source to calculated for fallback
        }
        
        // Add delay to avoid rate limiting (3 seconds between API calls)
        await delay(3000);
        
      } catch (error) {
        console.error('Error getting rent estimate:', error);
        // Fallback: estimate rent as 0.7% of property value per month
        rentEstimate = Math.round(item.price * 0.007);
        rentSource = 'calculated'; // Set source to calculated for fallback
      }
      
      // Calculate rent-to-price ratio
      const price = item.price;
      const ratio = rentEstimate / price;
      
      // Get a default image if none is provided
      const thumbnail = item.imgSrc || 'https://via.placeholder.com/150?text=No+Image';
      
      properties.push({
        property_id: item.zpid || `property-${Math.random().toString(36).substr(2, 9)}`,
        address: item.address,
        price: price,
        rent_estimate: rentEstimate,
        ratio: ratio,
        thumbnail: thumbnail,
        bedrooms: item.bedrooms || 0,
        bathrooms: item.bathrooms || 0,
        sqft: item.livingArea || 0,
        url: `https://www.zillow.com/homes/${item.zpid}_zpid/`,
        days_on_market: daysOnMarket,
        rent_source: rentSource
      });
    }
    
    // Sort by rent-to-price ratio (highest first)
    const sortedProperties = properties.sort((a, b) => b.ratio - a.ratio);
    
    // Return properties and total count
    res.json({
      properties: sortedProperties,
      totalCount: totalCount
    });
    
  } catch (error) {
    console.error('Error fetching properties:', error);
    res.status(500).json({ error: 'Error searching for properties. Please try again.' });
  }
});

// API endpoint to get total properties count
app.get('/api/count', async (req, res) => {
  try {
    const { location } = req.query;
    
    // Use mock data if flag is set
    if (USE_MOCK_DATA) {
      console.log('Using mock data for property count');
      return res.json({ count: mockProperties.length });
    }
    
    const searchResponse = await axios.request({
      method: 'GET',
      url: 'https://zillow-com1.p.rapidapi.com/propertyExtendedSearch',
      params: {
        location: location,
        home_type: 'Houses'
      },
      headers: {
        'X-RapidAPI-Key': RAPIDAPI_KEY,
        'X-RapidAPI-Host': 'zillow-com1.p.rapidapi.com'
      },
      timeout: 10000
    });
    
    if (!searchResponse.data || !searchResponse.data.props) {
      return res.json({ count: 0 });
    }
    
    res.json({ count: searchResponse.data.props.length });
  } catch (error) {
    console.error('Error getting total properties count:', error);
    res.status(500).json({ error: 'Error getting property count. Please try again.' });
  }
});

// Catch-all route to serve the React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../build', 'index.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API Key status: ${RAPIDAPI_KEY ? 'Found' : 'Not found'}`);
});
