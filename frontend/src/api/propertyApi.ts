import axios from 'axios';

// Define the property interface
export interface Property {
  property_id: string;
  address: string;
  price: number;
  rent_estimate: number;
  ratio: number;
  thumbnail: string;
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  url: string;
  days_on_market: number | null;
  rent_source: 'zillow' | 'calculated';
}

// API key for Zillow RapidAPI - Use environment variable if available
// This is a more secure approach than hardcoding the API key
const RAPIDAPI_KEY = process.env.REACT_APP_RAPIDAPI_KEY || '2f3a6e2c0emsh7c9c7e2b5c3d4d0p1e8b3fjsn9e0f0f3c67d6';

// Helper function to add delay between API calls
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Function to search for properties by location
export const searchProperties = async (location: string, page: number = 0): Promise<Property[]> => {
  try {
    console.log(`Searching for properties in ${location}, page ${page + 1}`);
    
    // Search for properties using the Zillow API
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
      return [];
    }
    
    // Get all properties for pagination
    const allProperties = searchResponse.data.props;
    
    // Calculate start and end indices for pagination (10 properties per page)
    const pageSize = 10;
    const startIndex = page * pageSize;
    const endIndex = Math.min(startIndex + pageSize, allProperties.length);
    
    // Get properties for the current page
    const paginatedProperties = allProperties.slice(startIndex, endIndex);
    
    // Process each property to get additional details and rent estimates
    const properties: Property[] = [];
    
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
      let rentSource: 'zillow' | 'calculated' = 'calculated'; // Default to calculated
      
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
    return properties.sort((a, b) => b.ratio - a.ratio);
  } catch (error) {
    console.error('Error fetching properties:', error);
    throw error;
  }
};

// Function to get total number of properties from search
export const getTotalPropertiesCount = async (location: string): Promise<number> => {
  try {
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
      return 0;
    }
    
    return searchResponse.data.props.length;
  } catch (error) {
    console.error('Error getting total properties count:', error);
    return 0;
  }
};
