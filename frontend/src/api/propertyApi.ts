// @ts-ignore - Suppressing persistent TS2305 error after trying multiple fixes
import axios, { AxiosResponse } from 'axios';

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

// --- Zillow API Response Type Definitions ---
interface ZillowPropertyItem {
    zpid: string | number; // Can be number or string based on API docs/examples
    address: string;
    price: number;
    rentZestimate?: number; // Optional rent estimate from Zillow
    imgSrc: string;
    bedrooms: number;
    bathrooms: number;
    livingArea?: number; // Optional square footage
    detailUrl: string;
    daysOnZillow?: number; // Optional days on market
    // Add any other relevant fields you might use from the 'props' item
}

interface ZillowSearchResponseData {
    props: ZillowPropertyItem[];
    totalResultCount: number; // Usually present, good for context
    // Add other potential top-level fields if needed
}

interface ZillowSearchCountResponseData {
  totalResultCount: number;
  // Add other potential fields from the count response if needed
}

// Interface for the Rent Estimate endpoint response
interface ZillowRentEstimateResponseData {
    rent: number;
    // Add other potential fields if needed
}

// Interface for the Property Details endpoint response
interface ZillowPropertyDetailsData {
    zpid: string | number;
    address: {
      streetAddress: string;
      city: string;
      state: string;
      zipcode: string;
    };
    price: number;
    rentZestimate?: number;
    zestimate?: number; // Zillow's estimated market value
    bedrooms?: number;
    bathrooms?: number;
    livingArea?: number; // Square footage
    photos?: { url: string }[]; // Array of photos, take the first?
    hdpUrl?: string; // Relative URL to Zillow details page
    daysOnZillow?: number;
    homeStatus?: string; // e.g., FOR_SALE, SOLD
    // Add other potentially useful fields from the details endpoint
}
// --- End Zillow API Response Type Definitions ---

// Function to get total properties count for pagination
export const getTotalPropertiesCount = async (
  location: string,
  minPrice: number | null,
  maxPrice: number | null,
  minBeds: number | null,
  minBaths: number | null,
  propertyType: string | null
): Promise<number> => {
  try {
    // --- Prepare API Params ---
    const apiParams: any = {
        location: location,
        home_type: propertyType && propertyType !== 'All' ? propertyType : 'Houses',
        status: 'forSale', // Ensure we only count properties for sale
        // Add other necessary parameters for count if different from search
    };
    // --- Add Price Params ---
    if (typeof minPrice === 'number' && minPrice >= 0) {
      apiParams.minPrice = minPrice;
      console.log('[getTotalPropertiesCount] Adding minPrice param:', apiParams.minPrice);
    }
    if (typeof maxPrice === 'number' && maxPrice > 0) {
      apiParams.maxPrice = maxPrice;
      console.log('[getTotalPropertiesCount] Adding maxPrice param:', apiParams.maxPrice);
    }
    // --- Add Bed/Bath Params ---
    if (typeof minBeds === 'number' && minBeds >= 0) {
      apiParams.bedsMin = minBeds;
      console.log('[getTotalPropertiesCount] Adding bedsMin param:', apiParams.bedsMin);
    }
    if (typeof minBaths === 'number' && minBaths >= 0) {
      apiParams.bathsMin = minBaths;
      console.log('[getTotalPropertiesCount] Adding bathsMin param:', apiParams.bathsMin);
    }

    // Search for properties using the Zillow API
    // Explicitly type the expected result of the enqueue call
    const searchResponse = await rateLimiter.enqueue<AxiosResponse<ZillowSearchCountResponseData>>(async () => {
        // Explicitly await the request to ensure a standard Promise is returned
        return await axios.request<ZillowSearchCountResponseData>({
            method: 'GET',
            url: 'https://zillow-com1.p.rapidapi.com/propertyExtendedSearch',
            params: apiParams,
            headers: {
                'X-RapidAPI-Key': RAPIDAPI_KEY,
                'X-RapidAPI-Host': 'zillow-com1.p.rapidapi.com'
            },
            timeout: 10000
        });
    }, 3);
    
    // Check if we have results
    if (!searchResponse.data || typeof searchResponse.data.totalResultCount !== 'number') {
      console.warn('[getTotalPropertiesCount] Invalid response data:', searchResponse.data);
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
  minBeds?: number | null,
  minBaths?: number | null,
  propertyType?: string | null,
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
    // --- Add Bed/Bath Params ---
    if (typeof minBeds === 'number' && minBeds >= 0) {
      apiParams.bedsMin = minBeds;
      console.log('[searchProperties] Adding bedsMin param:', apiParams.bedsMin);
    }
    if (typeof minBaths === 'number' && minBaths >= 0) {
      apiParams.bathsMin = minBaths;
      console.log('[searchProperties] Adding bathsMin param:', apiParams.bathsMin);
    }

    // Search for properties using the Zillow API
    // Explicitly type the expected result of the enqueue call
    const searchResponse = await rateLimiter.enqueue<AxiosResponse<ZillowSearchResponseData>>(async () => {
         // Explicitly await the request to ensure a standard Promise is returned
        return await axios.request<ZillowSearchResponseData>({
            method: 'GET',
            url: 'https://zillow-com1.p.rapidapi.com/propertyExtendedSearch',
            params: apiParams,
            headers: {
                'X-RapidAPI-Key': RAPIDAPI_KEY,
                'X-RapidAPI-Host': 'zillow-com1.p.rapidapi.com'
            },
            timeout: 20000
        });
    }, 1);
    
    // Check if we have results
    if (!searchResponse.data || !Array.isArray(searchResponse.data.props) || searchResponse.data.props.length === 0) {
      console.warn('[searchProperties] Invalid or empty response data:', searchResponse.data);
      return { allProperties: [], completeProperties: [] };
    }
    
    // Get properties for the current page directly from API
    let pageProperties = searchResponse.data.props;
    
    // Apply filters (still needed as API doesn't support all our filters)
    // Price filter is handled by API
    
    // Map the API response to our Property interface
    const allProperties: Property[] = pageProperties.map((item: ZillowPropertyItem) => {
      // Use rentZestimate if available, otherwise calculate based on price
      const calculatedRent = item.price * 0.007; // 0.7% rule as fallback
      
      // Use a robust way to generate property_id if zpid is missing or not unique
      const propertyId = item.zpid ? String(item.zpid) : `prop-${item.address.replace(/\\s+/g, '-')}-${item.price}`;

      return {
        property_id: propertyId,
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
      console.log(`[searchProperties page ${page + 1}] Enqueueing ${filteredProperties.length} properties for background processing.`);
      backgroundProcessor.enqueueMany(filteredProperties);
    } else {
      console.log(`[searchProperties page ${page + 1}] No properties found or filtered out on this page.`);
    }

    // Return basic properties; updates happen via background callback
    const result = {
      allProperties: filteredProperties,
      completeProperties: []
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
    // Wrap the axios call in an async function to ensure it returns a standard Promise
    const rentResponse: AxiosResponse<ZillowRentEstimateResponseData> = await rateLimiter.enqueue(async () => {
      // --- DEBUG LOG --- 
      console.log(`[getPropertyWithRentEstimate] Executing axios request for ${property.address} inside RateLimiter.`);
      return axios.request<ZillowRentEstimateResponseData>({
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
        timeout: 15000
      });
    }, isPriority ? 2 : 0);
    
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

// Function to get property details by ZPID
export const getPropertyDetailsByZpid = async (zpid: string): Promise<Property | null> => {
    try {
        console.log(`[getPropertyDetailsByZpid] Fetching details for ZPID: ${zpid}`);
        const detailsResponse = await rateLimiter.enqueue<AxiosResponse<ZillowPropertyDetailsData>>(async () => {
            return await axios.request<ZillowPropertyDetailsData>({
                method: 'GET',
                url: 'https://zillow-com1.p.rapidapi.com/property', // Use the correct endpoint
                params: { zpid: zpid },
                headers: {
                    'X-RapidAPI-Key': RAPIDAPI_KEY,
                    'X-RapidAPI-Host': 'zillow-com1.p.rapidapi.com'
                },
                timeout: 15000 // Increased timeout for potentially slower detail requests
            });
        }, 2); // Higher priority than standard search

        if (!detailsResponse.data || !detailsResponse.data.zpid) {
            console.warn(`[getPropertyDetailsByZpid] Invalid or empty response for ZPID ${zpid}:`, detailsResponse.data);
            return null;
        }

        const details = detailsResponse.data;
        
        // --- Format the response into our Property type ---
        const street = details.address?.streetAddress || '';
        const city = details.address?.city || '';
        const state = details.address?.state || '';
        const zip = details.address?.zipcode || '';
        const fullAddress = `${street}, ${city}, ${state} ${zip}`.replace(/^, |, $/g, '').trim(); // Clean up address string

        const price = details.price || details.zestimate || 0; // Use listed price, fallback to zestimate
        const rentEstimate = details.rentZestimate || price * 0.007; // Use Zillow rent, fallback to 0.7% rule
        
        // --- Use the correct image field from the response --- 
        const thumbnail = details.image_url // Prioritize image_url
                       || details.imgSrc    // Fallback to imgSrc
                       || (details.photos && details.photos.length > 0 ? details.photos[0].url : null) // Fallback to photos array
                       || './placeholder-house.png'; // Final fallback to a placeholder image

        if (price === 0) {
            console.warn(`[getPropertyDetailsByZpid] Price is zero for ZPID ${zpid}, skipping property.`);
            return null; // Cannot calculate ratio if price is zero
        }

        const property: Property = {
            property_id: String(details.zpid),
            address: fullAddress,
            price: price,
            rent_estimate: rentEstimate,
            ratio: rentEstimate / price,
            thumbnail: thumbnail,
            bedrooms: details.bedrooms || 0,
            bathrooms: details.bathrooms || 0,
            sqft: details.livingArea || 0,
            url: details.hdpUrl ? `https://www.zillow.com${details.hdpUrl}` : '#', // Construct full URL
            days_on_market: details.daysOnZillow || null,
            rent_source: details.rentZestimate ? 'zillow' : 'calculated',
            // homeStatus: details.homeStatus // Could add homeStatus if needed in the Property type
        };

        console.log(`[getPropertyDetailsByZpid] Successfully fetched and formatted details for ZPID ${zpid}`);
        return property;

    } catch (error) {
        console.error(`Error fetching property details for ZPID ${zpid}:`, error);
        // Consider how to handle specific errors (e.g., 404 Not Found)
        // if (axios.isAxiosError(error) && error.response?.status === 404) {
        //     console.log(`Property with ZPID ${zpid} not found.`);
        // }
        return null; // Return null on error
    }
};

// Function to search for a single property by specific address
export const searchPropertyByAddress = async (address: string): Promise<Property | null> => {
    try {
        console.log(`[searchPropertyByAddress] Searching for address: ${address}`);

        // --- Step 1: Use extended search to find ZPID ---
        const searchParams = {
            location: address,
            status: 'any' // Explicitly search for any status (including sold)
        };

        const searchResponse = await rateLimiter.enqueue<AxiosResponse<ZillowSearchResponseData>>(async () => {
            return await axios.request<ZillowSearchResponseData>({
                method: 'GET',
                url: 'https://zillow-com1.p.rapidapi.com/propertyExtendedSearch',
                params: searchParams,
                headers: {
                    'X-RapidAPI-Key': RAPIDAPI_KEY,
                    'X-RapidAPI-Host': 'zillow-com1.p.rapidapi.com'
                },
                timeout: 10000
            });
        }, 3); // Highest priority

        // --- Log the raw response --- 
        console.log('[searchPropertyByAddress] Raw API Response Data:', searchResponse.data);

        let zpid: string | null = null;

        // --- Check for direct ZPID in response (likely for exact address match) ---
        if (searchResponse.data && searchResponse.data.zpid) {
             zpid = String(searchResponse.data.zpid);
             console.log(`[searchPropertyByAddress] Found direct ZPID: ${zpid}`);
        }
        // --- Fallback: Check if it returned a props array (like general search) ---
        else if (searchResponse.data && Array.isArray(searchResponse.data.props) && searchResponse.data.props.length > 0) {
            // Heuristic: Assume the first result is the most relevant
            const firstResult = searchResponse.data.props[0];
            if (firstResult.zpid) {
                zpid = String(firstResult.zpid);
                console.log(`[searchPropertyByAddress] Found ZPID in props array: ${zpid}`);
            } else {
                console.warn(`[searchPropertyByAddress] First result in props array lacks ZPID for address: ${address}`, firstResult);
            }
        } else {
            console.warn(`[searchPropertyByAddress] No ZPID found or properties array in response for address: ${address}`, searchResponse.data);
            return null; // No usable data found
        }

        if (!zpid) {
             console.warn(`[searchPropertyByAddress] Final ZPID is null or undefined for address: ${address}`);
             return null;
        }

        // --- Step 2: Get detailed property info using the ZPID ---
        return await getPropertyDetailsByZpid(zpid);

    } catch (error) {
        console.error(`Error searching for address ${address}:`, error);
        // Rethrow or handle specific errors as needed
        // For example, if the extended search fails, we can't proceed
        return null; // Return null if any step fails
  }
};
