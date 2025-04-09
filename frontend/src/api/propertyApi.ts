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
// interface CacheItem {
//   data: any;
//   timestamp: number;
// }

class ApiCache {
  constructor() {
    // Remove loading from storage
    // this.loadFromStorage();
    
    // Remove interval timer
    // setInterval(() => this.cleanExpired(), 5 * 60 * 1000);
  }

  set(key: string, data: any /* Remove isRentEstimate */): void {
    // --- Disable ALL caching --- 
    return; // Do nothing
  }

  get(key: string /* Remove isRentEstimate */): any | null {
    // --- Disable ALL caching --- 
    return null; // Always return null
  }

  clear(): void {
    // Clear in-memory object (though it should be empty)
    // this.cache = {}; 
    // Remove from localStorage (if anything was ever stored)
    try {
       localStorage.removeItem('rental_search_cache'); // Use literal key if STORAGE_KEY removed
    } catch (e) { 
      console.warn('Could not clear potential localStorage cache:', e);
    }
  }
  
  // Remove private methods related to storage and cleaning
  /*
  private cleanExpired(): void { ... }
  private saveToStorage(): void { ... }
  private loadFromStorage(): void { ... }
  */
}

// EXPORT the instance
export const apiCache = new ApiCache();

// Rate limiter implementation with priority queue
class RateLimiter {
  private queue: Array<{
    apiCall: () => Promise<any>,
    resolve: (value: any) => void,
    reject: (reason?: any) => void,
    priority: number
  }> = [];
  private isProcessing = false;
  private readonly requestInterval: number = 1000; // Revert to 1 request per second

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
        // --- DEBUG LOG --- 
        console.log(`[RateLimiter] Try block entered for priority ${nextRequest.priority}`);
        console.log(`[RateLimiter] About to await apiCall for priority ${nextRequest.priority}`); // LOG A
        const result = await nextRequest.apiCall(); 
        console.log(`[RateLimiter] Await apiCall finished for priority ${nextRequest.priority}`); // LOG B
        nextRequest.resolve(result);
      } catch (error) {
        // --- DEBUG LOG --- 
        console.error(`[RateLimiter] Caught error during apiCall execution for priority ${nextRequest.priority}:`, error); // LOG C
        console.error('Error processing queued request:', error); // Keep original log
        nextRequest.reject(error);
      } finally {
        // --- DEBUG LOG --- 
        console.log(`[RateLimiter] Finally block reached for priority ${nextRequest.priority}`); // LOG D
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
  private readonly batchInterval = 2000; // Try 2 seconds between batches
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
  
  // Global callback for any property update
  private globalUpdateCallback: ((property: Property) => void) | null = null;

  registerGlobalUpdateCallback(callback: (property: Property) => void): void {
    this.globalUpdateCallback = callback;
  }

  // Notify callbacks when a property is updated
  private notifyPropertyUpdated(property: Property): void {
    const callbacks = this.callbacks[property.property_id];
    if (callbacks && callbacks.length > 0) {
      callbacks.forEach(callback => callback(property));
    }
    // Also notify the global callback
    if (this.globalUpdateCallback) {
      this.globalUpdateCallback(property);
    }
  }
  
  private async processQueue() {
    // --- DEBUG LOG START ---
    console.log(`[BackgroundProcessor] processQueue called. Queue length: ${this.queue.length}`);
    // --- DEBUG LOG END ---
    if (this.queue.length === 0) {
      this.isProcessing = false;
      return;
    }
    
    this.isProcessing = true;
    
    // Process in batches
    const batch = this.queue.splice(0, this.batchSize);
    console.log(`Processing background batch of ${batch.length} properties`);
    // --- DEBUG LOG START ---
    console.log('[BackgroundProcessor] Batch properties:', batch.map(p => p.address));
    // --- DEBUG LOG END ---
    
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
              // Max retries reached - notify with original property
              console.log(`[BackgroundProcessor] Max retries reached for ${property.property_id} after API error. Notifying with last known state.`);
              this.notifyPropertyUpdated(property);
              return { success: false, property, retry: false };
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
            console.log(`[BackgroundProcessor] Max retries reached for ${property.property_id} after API error. Notifying with last known state.`);
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

// Expose function to register for updates
export const registerForPropertyUpdates = (callback: (property: Property) => void) => {
  backgroundProcessor.registerGlobalUpdateCallback(callback);
};

// Function to get total properties count for pagination
export const getTotalPropertiesCount = async (
  location: string,
  minPrice?: number | null,
  maxPrice?: number | null,
  propertyType?: string
): Promise<number> => {
  try {
    // --- Prepare API Params ---
    const apiParams: any = {
      location: location,
      home_type: propertyType && propertyType !== 'All' ? propertyType : 'Houses',
      page: 1
    };
    // --- Use Direct Price Params (Relaxed Check) --- 
    if (typeof minPrice === 'number' && minPrice >= 0) {
      apiParams.minPrice = minPrice;
      console.log('[getTotalPropertiesCount] Adding minPrice param:', apiParams.minPrice);
    }
    if (typeof maxPrice === 'number' && maxPrice > 0) {
      apiParams.maxPrice = maxPrice;
      console.log('[getTotalPropertiesCount] Adding maxPrice param:', apiParams.maxPrice);
    }

    // Search for properties using the Zillow API
    const searchResponse = await rateLimiter.enqueue(() => axios.request({
      method: 'GET',
      url: 'https://zillow-com1.p.rapidapi.com/propertyExtendedSearch',
      params: apiParams, // Use prepared params
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
  minPrice?: number | null,
  maxPrice?: number | null,
  propertyType?: string,
  minRatio?: number | null
): Promise<{
  allProperties: Property[],
  completeProperties: Property[]
}> => {
  try {
    console.log(`Searching for properties in ${location}, page ${page + 1}`);
    
    // --- Prepare API Params ---
    const apiParams: any = {
        location: location,
        home_type: propertyType && propertyType !== 'All' ? propertyType : 'Houses',
        page: page + 1 // API uses 1-based indexing
    };
    // --- Use Direct Price Params (Relaxed Check) ---
    if (typeof minPrice === 'number' && minPrice >= 0) {
      apiParams.minPrice = minPrice;
      console.log('[searchProperties] Adding minPrice param:', apiParams.minPrice);
    }
    if (typeof maxPrice === 'number' && maxPrice > 0) {
      apiParams.maxPrice = maxPrice;
      console.log('[searchProperties] Adding maxPrice param:', apiParams.maxPrice);
    }

    // Search for properties using the Zillow API
    const searchResponse = await rateLimiter.enqueue(() => axios.request({
      method: 'GET',
      url: 'https://zillow-com1.p.rapidapi.com/propertyExtendedSearch',
      params: apiParams, // Use prepared params
      headers: {
        'X-RapidAPI-Key': RAPIDAPI_KEY,
        'X-RapidAPI-Host': 'zillow-com1.p.rapidapi.com'
      },
      timeout: 20000 // Increase timeout to 20 seconds
    }), 1); // Use default priority 1
    
    // Check if we have results
    if (!searchResponse.data || !searchResponse.data.props || searchResponse.data.props.length === 0) {
      return { allProperties: [], completeProperties: [] };
    }
    
    // Get properties for the current page directly from API
    // This is more efficient than fetching all and slicing
    let pageProperties = searchResponse.data.props;
    
    // Apply filters (still needed as API doesn't support all our filters)
    // Price filter is handled by API
    
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
    const filteredProperties = minRatio !== null && minRatio !== undefined
      ? allProperties.filter(prop => prop.ratio >= minRatio!)
      : allProperties;
    
    // --- Enqueue ALL properties for background processing --- 
    if (filteredProperties.length > 0) {
      console.log(`[searchProperties page ${page + 1}] Enqueueing ${filteredProperties.length} properties for background processing.`); // DEBUG
      backgroundProcessor.enqueueMany(filteredProperties);
    } else {
      console.log(`[searchProperties page ${page + 1}] No properties found or filtered out on this page.`); // DEBUG
    }

    // Return basic properties; updates happen via background callback
    const result = {
      allProperties: filteredProperties,
      completeProperties: [] // Return empty array, App.tsx doesn't use this directly anymore
    };
    
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
  const cachedRentEstimate = apiCache.get(rentEstimateCacheKey);
  
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
    // --- DEBUG LOG --- 
    console.log(`[getPropertyWithRentEstimate] Attempting to get rent for ${property.address} via RateLimiter. Priority: ${isPriority}`);
    
    // Use the Zillow API rentEstimate endpoint with more specific parameters
    const rentResponse = await rateLimiter.enqueue(() => {
      // --- DEBUG LOG --- 
      console.log(`[getPropertyWithRentEstimate] Executing axios request for ${property.address} inside RateLimiter.`);
      return axios.request({
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
      });
    }, isPriority ? 2 : 0); // Add priority back (will be 0 since isPriority is false)
    
    // --- Updated Validation Logic --- 
    let rentEstimate: number | null = null;
    
    // Option 1: Check for direct 'rent' field
    if (rentResponse.data && 
        typeof rentResponse.data === 'object' && 
        'rent' in rentResponse.data && 
        typeof rentResponse.data.rent === 'number' && 
        rentResponse.data.rent > 0) {
      
      rentEstimate = rentResponse.data.rent;
      // Cache the successful rent estimate response data
      apiCache.set(rentEstimateCacheKey, rentResponse.data);

    // Option 2: Check for 'lowRent' and 'highRent' fields
    } else if (rentResponse.data && 
               typeof rentResponse.data === 'object' &&
               'lowRent' in rentResponse.data && typeof rentResponse.data.lowRent === 'number' &&
               'highRent' in rentResponse.data && typeof rentResponse.data.highRent === 'number' &&
               rentResponse.data.lowRent > 0 && rentResponse.data.highRent > 0) {
      
      console.log(`Using average of lowRent (${rentResponse.data.lowRent}) and highRent (${rentResponse.data.highRent}) for ${property.address}`);
      rentEstimate = (rentResponse.data.lowRent + rentResponse.data.highRent) / 2;
      // Cache the data that was received, even if we averaged it
      apiCache.set(rentEstimateCacheKey, rentResponse.data);
      
    } else {
      // If neither structure is found, log warning and throw error for retry
      console.warn(`Invalid or unusable rent estimate data structure for ${property.address}:`, rentResponse.data);
      throw new Error('Invalid or unusable rent estimate data structure');
    }

    // Return updated property if we got an estimate
    if (rentEstimate !== null) {
       return {
         ...property,
         rent_estimate: rentEstimate,
         ratio: rentEstimate / property.price,
         rent_source: 'zillow' // Mark as zillow even if averaged from low/high
       };
    } else {
        // This path should ideally not be reached if the above logic is correct,
        // but throw error just in case to trigger retry.
        throw new Error('Failed to extract a valid rent estimate');
    }

    /* --- Original Validation Logic --- 
    if (rentResponse.data && 
        typeof rentResponse.data === 'object' && 
        'rent' in rentResponse.data && 
        typeof rentResponse.data.rent === 'number' && 
        rentResponse.data.rent > 0) {
      
      const rentEstimate = rentResponse.data.rent;
      
      // Cache the rent estimate
      apiCache.set(rentEstimateCacheKey, rentResponse.data);
      
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
    */
  } catch (error) {
    console.error(`Error getting rent estimate for ${property.address}:`, error);
    throw error; // Propagate error for retry logic
  }
};
