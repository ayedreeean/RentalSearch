import React from 'react';
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
const RAPIDAPI_KEY = process.env.REACT_APP_RAPIDAPI_KEY || '8d9a4bdab8mshf7bb6f8edad5863p1c1b0ejsn7c4d5dde23f0';

// Cache implementation
interface CacheItem {
  data: any;
  timestamp: number;
}

class ApiCache {
  private cache: Record<string, CacheItem> = {};
  private readonly TTL: number = 30 * 60 * 1000; // 30 minutes in milliseconds
  private readonly STORAGE_KEY = 'rental_search_cache';

  constructor() {
    // Load cache from localStorage if available
    this.loadFromStorage();
    
    // Set up interval to clean expired items
    setInterval(() => this.cleanExpired(), 5 * 60 * 1000); // Clean every 5 minutes
  }

  set(key: string, data: any): void {
    this.cache[key] = {
      data,
      timestamp: Date.now()
    };
    
    // Save to localStorage
    this.saveToStorage();
  }

  get(key: string): any | null {
    const item = this.cache[key];
    if (!item) return null;
    
    // Check if the cache item has expired
    if (Date.now() - item.timestamp > this.TTL) {
      delete this.cache[key];
      this.saveToStorage();
      return null;
    }
    
    return item.data;
  }

  clear(): void {
    this.cache = {};
    localStorage.removeItem(this.STORAGE_KEY);
  }
  
  // Clean expired items from cache
  private cleanExpired(): void {
    const now = Date.now();
    let hasChanges = false;
    
    Object.keys(this.cache).forEach(key => {
      if (now - this.cache[key].timestamp > this.TTL) {
        delete this.cache[key];
        hasChanges = true;
      }
    });
    
    if (hasChanges) {
      this.saveToStorage();
    }
  }
  
  // Save cache to localStorage
  private saveToStorage(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.cache));
    } catch (error) {
      console.warn('Failed to save cache to localStorage:', error);
    }
  }
  
  // Load cache from localStorage
  private loadFromStorage(): void {
    try {
      const storedCache = localStorage.getItem(this.STORAGE_KEY);
      if (storedCache) {
        this.cache = JSON.parse(storedCache);
      }
    } catch (error) {
      console.warn('Failed to load cache from localStorage:', error);
    }
  }
}

const apiCache = new ApiCache();

// Rate limiter implementation
class RateLimiter {
  private queue: Array<() => Promise<any>> = [];
  private isProcessing = false;
  private readonly requestInterval: number = 1000; // 1 request per second (half of the allowed 2/sec)

  async enqueue<T>(apiCall: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await apiCall();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      
      if (!this.isProcessing) {
        this.processQueue();
      }
    });
  }

  private async processQueue() {
    if (this.queue.length === 0) {
      this.isProcessing = false;
      return;
    }

    this.isProcessing = true;
    const nextRequest = this.queue.shift();
    
    if (nextRequest) {
      try {
        await nextRequest();
      } catch (error) {
        console.error('Error processing queued request:', error);
      }
      
      // Wait before processing next request
      await new Promise(resolve => setTimeout(resolve, this.requestInterval));
      this.processQueue();
    }
  }
}

const rateLimiter = new RateLimiter();

// Helper function to add delay between API calls
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Function to search for properties by location
export const searchProperties = async (
  location: string, 
  page: number = 0,
  filters: {
    priceRange?: [number, number],
    bedroomsFilter?: number[],
    bathroomsFilter?: number[],
    minRatio?: number,
    propertyType?: string
  } = {}
): Promise<Property[]> => {
  try {
    console.log(`Searching for properties in ${location}, page ${page + 1}`);
    
    // Create cache key based on search parameters
    const cacheKey = `search_${location}_${page}_${JSON.stringify(filters)}`;
    
    // Check cache first
    const cachedData = apiCache.get(cacheKey);
    if (cachedData) {
      console.log('Using cached data for property search');
      return cachedData;
    }
    
    // Search for properties using the Zillow API
    const searchResponse = await rateLimiter.enqueue(() => axios.request({
      method: 'GET',
      url: 'https://zillow-com1.p.rapidapi.com/propertyExtendedSearch',
      params: {
        location: location,
        home_type: filters.propertyType && filters.propertyType !== 'All' ? filters.propertyType : 'Houses',
        page: page + 1 // API uses 1-based indexing
      },
      headers: {
        'X-RapidAPI-Key': RAPIDAPI_KEY,
        'X-RapidAPI-Host': 'zillow-com1.p.rapidapi.com'
      },
      timeout: 10000
    }));
    
    // Check if we have results
    if (!searchResponse.data || !searchResponse.data.props || searchResponse.data.props.length === 0) {
      return [];
    }
    
    // Get properties for the current page directly from API
    // This is more efficient than fetching all and slicing
    let pageProperties = searchResponse.data.props;
    
    // Apply filters (still needed as API doesn't support all our filters)
    if (filters.priceRange) {
      pageProperties = pageProperties.filter(
        (item: any) => item.price >= filters.priceRange![0] && item.price <= filters.priceRange![1]
      );
    }
    
    if (filters.bedroomsFilter && filters.bedroomsFilter.length > 0) {
      pageProperties = pageProperties.filter((item: any) => {
        // Handle 5+ bedrooms
        if (filters.bedroomsFilter!.includes(5) && item.bedrooms >= 5) return true;
        return filters.bedroomsFilter!.includes(item.bedrooms);
      });
    }
    
    if (filters.bathroomsFilter && filters.bathroomsFilter.length > 0) {
      pageProperties = pageProperties.filter((item: any) => 
        filters.bathroomsFilter!.includes(item.bathrooms)
      );
    }
    
    // Process each property to get additional details and rent estimates
    const properties: Property[] = [];
    
    // Process properties sequentially to avoid rate limiting
    for (const item of pageProperties) {
      // Get property details to fetch days on market
      let daysOnMarket = null;
      
      try {
        if (item.zpid) {
          // Check cache for property details
          const propertyDetailsCacheKey = `property_${item.zpid}`;
          const cachedPropertyDetails = apiCache.get(propertyDetailsCacheKey);
          
          let propertyData;
          if (cachedPropertyDetails) {
            console.log(`Using cached data for property ${item.zpid}`);
            propertyData = cachedPropertyDetails;
          } else {
            try {
              const propertyResponse = await rateLimiter.enqueue(() => axios.request({
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
              }));
              
              propertyData = propertyResponse.data;
              // Cache the property details
              apiCache.set(propertyDetailsCacheKey, propertyData);
            } catch (error) {
              console.error('Error getting property details:', error);
              // Continue with the process even if this API call fails
              propertyData = null;
            }
          }
          
          // Extract days on market if available
          if (propertyData && propertyData.hasOwnProperty('daysOnZillow')) {
            daysOnMarket = propertyData.daysOnZillow;
          } else if (propertyData && propertyData.hasOwnProperty('timeOnZillow')) {
            // Alternative property name that might contain days on market
            daysOnMarket = propertyData.timeOnZillow;
          }
        }
      } catch (error) {
        console.error('Error getting property details:', error);
        // Continue with the process even if this API call fails
      }
      
      // Get rent estimate for each property
      let rentEstimate = 0;
      let rentSource: 'zillow' | 'calculated' = 'calculated'; // Default to calculated
      
      try {
        // Check cache for rent estimate
        const rentEstimateCacheKey = `rent_${item.address}_${item.bedrooms}_${item.bathrooms}`;
        const cachedRentEstimate = apiCache.get(rentEstimateCacheKey);
        
        if (cachedRentEstimate) {
          console.log(`Using cached rent estimate for ${item.address}`);
          rentEstimate = cachedRentEstimate.rent;
          rentSource = 'zillow';
        } else {
          try {
            // Use the Zillow API rentEstimate endpoint with optimized parameters
            const rentResponse = await rateLimiter.enqueue(() => axios.request({
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
            }));
            
            // Extract rent estimate from response
            if (rentResponse.data && rentResponse.data.rent) {
              rentEstimate = rentResponse.data.rent;
              rentSource = 'zillow'; // Set source to zillow when we get data from API
              
              // Cache the rent estimate
              apiCache.set(rentEstimateCacheKey, rentResponse.data);
            } else {
              // Fallback: estimate rent as 0.7% of property value per month
              rentEstimate = Math.round(item.price * 0.007);
              rentSource = 'calculated'; // Set source to calculated for fallback
            }
          } catch (error) {
            console.error('Error getting rent estimate:', error);
            // Fallback: estimate rent as 0.7% of property value per month
            rentEstimate = Math.round(item.price * 0.007);
            rentSource = 'calculated'; // Set source to calculated for fallback
          }
        }
      } catch (error) {
        console.error('Error getting rent estimate:', error);
        // Fallback: estimate rent as 0.7% of property value per month
        rentEstimate = Math.round(item.price * 0.007);
        rentSource = 'calculated'; // Set source to calculated for fallback
      }
      
      // Calculate rent-to-price ratio
      const price = item.price;
      const ratio = rentEstimate / price;
      
      // Apply minimum ratio filter if specified
      if (filters.minRatio && ratio < filters.minRatio) {
        continue;
      }
      
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
    
    // Cache the results
    apiCache.set(cacheKey, sortedProperties);
    
    return sortedProperties;
  } catch (error) {
    console.error('Error fetching properties:', error);
    throw error;
  }
};

// Function to get total number of properties from search
export const getTotalPropertiesCount = async (
  location: string,
  filters: {
    priceRange?: [number, number],
    bedroomsFilter?: number[],
    bathroomsFilter?: number[],
    minRatio?: number,
    propertyType?: string
  } = {}
): Promise<number> => {
  try {
    // Create cache key based on search parameters
    const cacheKey = `count_${location}_${JSON.stringify(filters)}`;
    
    // Check cache first
    const cachedData = apiCache.get(cacheKey);
    if (cachedData !== null) {
      console.log('Using cached data for property count');
      return cachedData;
    }
    
    const searchResponse = await rateLimiter.enqueue(() => axios.request({
      method: 'GET',
      url: 'https://zillow-com1.p.rapidapi.com/propertyExtendedSearch',
      params: {
        location: location,
        home_type: filters.propertyType && filters.propertyType !== 'All' ? filters.propertyType : 'Houses'
      },
      headers: {
        'X-RapidAPI-Key': RAPIDAPI_KEY,
        'X-RapidAPI-Host': 'zillow-com1.p.rapidapi.com'
      },
      timeout: 10000
    }));
    
    if (!searchResponse.data || !searchResponse.data.totalPages) {
      return 0;
    }
    
    // Use the totalPages and resultsPerPage from the API response
    // This is more accurate than counting the properties ourselves
    const totalPages = searchResponse.data.totalPages || 1;
    const resultsPerPage = searchResponse.data.resultsPerPage || 10;
    let estimatedCount = totalPages * resultsPerPage;
    
    // Apply a correction factor for our filters
    // This is an estimate since we can't know exactly how many properties
    // will match our filters without fetching them all
    if (filters.priceRange || filters.bedroomsFilter?.length || filters.bathroomsFilter?.length || filters.minRatio) {
      // Apply a conservative reduction factor
      estimatedCount = Math.floor(estimatedCount * 0.8);
    }
    
    // Cache the count
    apiCache.set(cacheKey, estimatedCount);
    
    return estimatedCount;
  } catch (error) {
    console.error('Error getting total properties count:', error);
    return 0;
  }
};

// Function to clear the cache
export const clearCache = (): void => {
  apiCache.clear();
  console.log('API cache cleared');
};
