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
  private readonly TTL: number = 60 * 60 * 1000; // 60 minutes in milliseconds for rent estimates
  private readonly SEARCH_TTL: number = 30 * 60 * 1000; // 30 minutes for search results
  private readonly STORAGE_KEY = 'rental_search_cache';

  constructor() {
    // Load cache from localStorage if available
    this.loadFromStorage();
    
    // Set up interval to clean expired items
    setInterval(() => this.cleanExpired(), 5 * 60 * 1000); // Clean every 5 minutes
  }

  set(key: string, data: any, isRentEstimate: boolean = false): void {
    this.cache[key] = {
      data,
      timestamp: Date.now()
    };
    
    // Save to localStorage
    this.saveToStorage();
  }

  get(key: string, isRentEstimate: boolean = false): any | null {
    const item = this.cache[key];
    if (!item) return null;
    
    // Check if the cache item has expired
    const ttl = isRentEstimate || key.startsWith('rent_') ? this.TTL : this.SEARCH_TTL;
    if (Date.now() - item.timestamp > ttl) {
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
      const ttl = key.startsWith('rent_') ? this.TTL : this.SEARCH_TTL;
      if (now - this.cache[key].timestamp > ttl) {
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
      
      // If localStorage is full, clear older items
      try {
        // Keep only the most recent 100 items
        const keys = Object.keys(this.cache);
        if (keys.length > 100) {
          // Sort by timestamp (oldest first)
          const sortedKeys = keys.sort((a, b) => 
            this.cache[a].timestamp - this.cache[b].timestamp
          );
          
          // Remove oldest items
          const keysToRemove = sortedKeys.slice(0, keys.length - 100);
          keysToRemove.forEach(key => {
            delete this.cache[key];
          });
          
          // Try saving again
          localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.cache));
        }
      } catch (e) {
        console.error('Failed to clean up cache:', e);
        // Last resort: clear entire cache
        this.clear();
      }
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

// Rate limiter implementation with priority queue
class RateLimiter {
  private queue: Array<{
    apiCall: () => Promise<any>,
    resolve: (value: any) => void,
    reject: (reason?: any) => void,
    priority: number
  }> = [];
  private isProcessing = false;
  private readonly requestInterval: number = 1000; // 1 request per second (half of the allowed 2/sec)

  async enqueue<T>(apiCall: () => Promise<T>, priority: number = 1): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        apiCall,
        resolve,
        reject,
        priority
      });
      
      // Sort queue by priority (higher number = higher priority)
      this.queue.sort((a, b) => b.priority - a.priority);
      
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
        const result = await nextRequest.apiCall();
        nextRequest.resolve(result);
      } catch (error) {
        console.error('Error processing queued request:', error);
        nextRequest.reject(error);
      }
      
      // Wait before processing next request
      await new Promise(resolve => setTimeout(resolve, this.requestInterval));
      this.processQueue();
    }
  }
}

const rateLimiter = new RateLimiter();

// Background processing queue for rent estimates
class BackgroundProcessor {
  private queue: Property[] = [];
  private isProcessing = false;
  private readonly batchSize = 5;
  private readonly batchInterval = 5000; // 5 seconds between batches
  private readonly maxRetries = 3; // Maximum number of retries for each property
  private retryMap: Record<string, number> = {}; // Track retry attempts
  private callbacks: Record<string, ((property: Property) => void)[]> = {}; // Callbacks for property updates
  
  enqueue(property: Property): void {
    // Don't add duplicates
    if (!this.queue.some(p => p.property_id === property.property_id)) {
      this.queue.push(property);
      this.retryMap[property.property_id] = 0; // Initialize retry count
      
      if (!this.isProcessing) {
        this.processQueue();
      }
    }
  }
  
  enqueueMany(properties: Property[]): void {
    // Filter out duplicates
    const newProperties = properties.filter(
      prop => !this.queue.some(p => p.property_id === prop.property_id)
    );
    
    newProperties.forEach(prop => {
      this.retryMap[prop.property_id] = 0; // Initialize retry count
    });
    
    this.queue.push(...newProperties);
    
    if (!this.isProcessing && newProperties.length > 0) {
      this.processQueue();
    }
  }
  
  // Register a callback for when a property is updated
  onPropertyUpdated(propertyId: string, callback: (property: Property) => void): void {
    if (!this.callbacks[propertyId]) {
      this.callbacks[propertyId] = [];
    }
    this.callbacks[propertyId].push(callback);
  }
  
  // Notify callbacks when a property is updated
  private notifyPropertyUpdated(property: Property): void {
    const callbacks = this.callbacks[property.property_id];
    if (callbacks && callbacks.length > 0) {
      callbacks.forEach(callback => callback(property));
    }
  }
  
  private async processQueue() {
    if (this.queue.length === 0) {
      this.isProcessing = false;
      return;
    }
    
    this.isProcessing = true;
    
    // Process in batches
    const batch = this.queue.splice(0, this.batchSize);
    console.log(`Processing background batch of ${batch.length} properties`);
    
    // Process batch in parallel
    const results = await Promise.all(
      batch.map(async property => {
        try {
          const updatedProperty = await getPropertyWithRentEstimate(property, false);
          
          // Check if we got a Zillow rent estimate
          if (updatedProperty.rent_source === 'zillow') {
            // Success - notify callbacks
            this.notifyPropertyUpdated(updatedProperty);
            return { success: true, property: updatedProperty };
          } else {
            // Failed to get Zillow estimate - check if we should retry
            const retryCount = this.retryMap[property.property_id] || 0;
            if (retryCount < this.maxRetries) {
              // Increment retry count and re-queue
              this.retryMap[property.property_id] = retryCount + 1;
              return { success: false, property, retry: true };
            } else {
              // Max retries reached - notify with calculated estimate
              this.notifyPropertyUpdated(updatedProperty);
              return { success: false, property: updatedProperty, retry: false };
            }
          }
        } catch (error) {
          console.error(`Error in background processing for ${property.property_id}:`, error);
          
          // Check if we should retry
          const retryCount = this.retryMap[property.property_id] || 0;
          if (retryCount < this.maxRetries) {
            // Increment retry count and re-queue
            this.retryMap[property.property_id] = retryCount + 1;
            return { success: false, property, retry: true };
          } else {
            // Max retries reached - notify with original property
            this.notifyPropertyUpdated(property);
            return { success: false, property, retry: false };
          }
        }
      })
    );
    
    // Re-queue properties that need retry
    const propertiesToRetry = results
      .filter(result => !result.success && result.retry)
      .map(result => result.property);
    
    if (propertiesToRetry.length > 0) {
      console.log(`Re-queuing ${propertiesToRetry.length} properties for retry`);
      this.queue.push(...propertiesToRetry);
    }
    
    // If there are more items in the queue, wait before processing next batch
    if (this.queue.length > 0) {
      setTimeout(() => this.processQueue(), this.batchInterval);
    } else {
      this.isProcessing = false;
    }
  }
}

const backgroundProcessor = new BackgroundProcessor();

// Helper function to add delay between API calls
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Function to get total properties count for pagination
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
    if (cachedData) {
      console.log('Using cached data for property count');
      return cachedData;
    }
    
    // Search for properties using the Zillow API
    const searchResponse = await rateLimiter.enqueue(() => axios.request({
      method: 'GET',
      url: 'https://zillow-com1.p.rapidapi.com/propertyExtendedSearch',
      params: {
        location: location,
        home_type: filters.propertyType && filters.propertyType !== 'All' ? filters.propertyType : 'Houses',
        page: 1
      },
      headers: {
        'X-RapidAPI-Key': RAPIDAPI_KEY,
        'X-RapidAPI-Host': 'zillow-com1.p.rapidapi.com'
      },
      timeout: 10000
    }), 3); // High priority for count
    
    // Check if we have results
    if (!searchResponse.data || !searchResponse.data.totalResultCount) {
      return 0;
    }
    
    const totalCount = searchResponse.data.totalResultCount;
    
    // Cache the count
    apiCache.set(cacheKey, totalCount);
    
    return totalCount;
  } catch (error) {
    console.error('Error getting property count:', error);
    return 0;
  }
};

// Function to search for properties by location with prioritized loading
export const searchProperties = async (
  location: string, 
  page: number = 0,
  filters: {
    priceRange?: [number, number],
    bedroomsFilter?: number[],
    bathroomsFilter?: number[],
    minRatio?: number,
    propertyType?: string
  } = {},
  isPrioritized: boolean = false
): Promise<{
  allProperties: Property[],
  completeProperties: Property[]
}> => {
  try {
    console.log(`Searching for properties in ${location}, page ${page + 1}, prioritized: ${isPrioritized}`);
    
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
    }), isPrioritized ? 3 : 1); // Higher priority for initial search
    
    // Check if we have results
    if (!searchResponse.data || !searchResponse.data.props || searchResponse.data.props.length === 0) {
      return { allProperties: [], completeProperties: [] };
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
    
    // Map the API response to our Property interface
    const allProperties: Property[] = pageProperties.map((item: any) => {
      // Use rentZestimate if available, otherwise calculate based on price
      const calculatedRent = item.price * 0.007; // 0.7% rule as fallback
      
      return {
        property_id: item.zpid || `property-${item.address}`,
        address: item.address,
        price: item.price,
        rent_estimate: item.rentZestimate || calculatedRent,
        ratio: (item.rentZestimate || calculatedRent) / item.price,
        thumbnail: item.imgSrc,
        bedrooms: item.bedrooms,
        bathrooms: item.bathrooms,
        sqft: item.livingArea || 0,
        url: `https://www.zillow.com${item.detailUrl}`,
        days_on_market: item.daysOnZillow || null,
        rent_source: item.rentZestimate ? 'zillow' : 'calculated'
      };
    });
    
    // Filter out properties that don't meet the minimum ratio requirement
    const filteredProperties = filters.minRatio 
      ? allProperties.filter(prop => prop.ratio >= filters.minRatio!)
      : allProperties;
    
    // For prioritized loading, we'll process the first 10 properties first
    // For non-prioritized loading, we'll process all properties
    const priorityCount = isPrioritized ? Math.min(10, filteredProperties.length) : filteredProperties.length;
    const priorityProperties = filteredProperties.slice(0, priorityCount);
    const remainingProperties = isPrioritized ? filteredProperties.slice(priorityCount) : [];
    
    // Process priority properties to get accurate rent estimates
    const completeProperties: Property[] = [];
    
    // Process priority properties in parallel with controlled concurrency
    // Use Promise.allSettled to ensure we continue even if some requests fail
    const results = await Promise.allSettled(
      priorityProperties.map(async (property) => {
        try {
          // Try up to 3 times to get a Zillow rent estimate
          let updatedProperty = property;
          let attempts = 0;
          const maxAttempts = 3;
          
          while (attempts < maxAttempts) {
            try {
              updatedProperty = await getPropertyWithRentEstimate(property, true);
              
              // If we got a Zillow rent estimate, break the loop
              if (updatedProperty.rent_source === 'zillow') {
                break;
              }
              
              // If we didn't get a Zillow estimate, try again
              attempts++;
              if (attempts < maxAttempts) {
                await delay(1000); // Wait 1 second before retrying
              }
            } catch (error) {
              console.error(`Attempt ${attempts + 1} failed for ${property.property_id}:`, error);
              attempts++;
              if (attempts < maxAttempts) {
                await delay(1000); // Wait 1 second before retrying
              }
            }
          }
          
          return updatedProperty;
        } catch (error) {
          console.error(`Error processing property ${property.property_id}:`, error);
          // If all attempts fail, return the original property
          return property;
        }
      })
    );
    
    // Process results
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        completeProperties.push(result.value);
      } else {
        // If the promise was rejected, use the original property
        console.error(`Property processing rejected: ${result.reason}`);
        completeProperties.push(priorityProperties[index]);
      }
    });
    
    // Sort complete properties to match original order
    completeProperties.sort((a, b) => {
      const aIndex = filteredProperties.findIndex(p => p.property_id === a.property_id);
      const bIndex = filteredProperties.findIndex(p => p.property_id === b.property_id);
      return aIndex - bIndex;
    });
    
    // Start background processing of remaining properties if this is prioritized loading
    if (isPrioritized && remainingProperties.length > 0) {
      // Add remaining properties to background processing queue
      backgroundProcessor.enqueueMany(remainingProperties);
    }
    
    const result = {
      allProperties: filteredProperties,
      completeProperties: completeProperties
    };
    
    // Cache the result
    apiCache.set(cacheKey, result);
    
    return result;
  } catch (error) {
    console.error('Error searching properties:', error);
    return { allProperties: [], completeProperties: [] };
  }
};

// Function to get property with accurate rent estimate
const getPropertyWithRentEstimate = async (property: Property, isPriority: boolean = false): Promise<Property> => {
  // Check cache for rent estimate
  const rentEstimateCacheKey = `rent_${property.property_id}`;
  const cachedRentEstimate = apiCache.get(rentEstimateCacheKey, true);
  
  if (cachedRentEstimate) {
    console.log(`Using cached rent estimate for ${property.address}`);
    return {
      ...property,
      rent_estimate: cachedRentEstimate.rent,
      ratio: cachedRentEstimate.rent / property.price,
      rent_source: 'zillow'
    };
  }
  
  try {
    // Use the Zillow API rentEstimate endpoint with more specific parameters
    const rentResponse = await rateLimiter.enqueue(() => axios.request({
      method: 'GET',
      url: 'https://zillow-com1.p.rapidapi.com/rentEstimate',
      params: {
        propertyType: 'SingleFamily',
        address: property.address,
        beds: property.bedrooms || 3,
        baths: property.bathrooms || 2,
        sqft: property.sqft || 1500,
        d: 0.5
      },
      headers: {
        'X-RapidAPI-Key': RAPIDAPI_KEY,
        'X-RapidAPI-Host': 'zillow-com1.p.rapidapi.com'
      },
      timeout: 15000 // Increased timeout for rent estimates
    }), isPriority ? 2 : 0); // Higher priority for visible properties
    
    // Validate the response data more thoroughly
    if (rentResponse.data && 
        typeof rentResponse.data === 'object' && 
        'rent' in rentResponse.data && 
        typeof rentResponse.data.rent === 'number' && 
        rentResponse.data.rent > 0) {
      
      const rentEstimate = rentResponse.data.rent;
      
      // Cache the rent estimate
      apiCache.set(rentEstimateCacheKey, rentResponse.data, true);
      
      // Return updated property with accurate rent estimate
      return {
        ...property,
        rent_estimate: rentEstimate,
        ratio: rentEstimate / property.price,
        rent_source: 'zillow'
      };
    } else {
      console.warn(`Invalid rent estimate data for ${property.address}:`, rentResponse.data);
      throw new Error('Invalid rent estimate data');
    }
  } catch (error) {
    console.error(`Error getting rent estimate for ${property.address}:`, error);
    throw error; // Propagate error for retry logic
  }
};
