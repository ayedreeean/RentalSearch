# Rental Property Finder Research

## Available Real Estate APIs

### 1. Zillow Zestimate API
- **Provider**: Zillow Group via Bridge Interactive platform
- **Features**:
  - Retrieves current Property, Rental, and Foreclosure Zestimates for ~100 million properties in the US
  - Provides property valuations which can be used for rent-to-purchase price ratio calculations
- **Authentication**: Password and access token authentication
- **Format**: RESTful API with JSON responses
- **Endpoint**: `/zestimates_v2/zestimates`
- **Access Requirements**: Commercial use requires approval and likely paid subscription
- **Notes**: 
  - Requires registration with Bridge Interactive platform
  - For research/academic projects, alternative metrics with looser Terms of Use are available at https://www.zillow.com/research/data/

### 2. RapidAPI US Real Estate Listings
- **Provider**: apimaker on RapidAPI
- **Features**:
  - Search US real estate for sale, rent, and sold properties
  - Get property details, photos, history
  - Get rental listings by parameters (including zip code)
  - Get market trends and location scores
  - Similar to data from Realtor.com, Redfin
- **Authentication**: RapidAPI key
- **Format**: RESTful API with JSON responses
- **Key Endpoints**:
  - `GET /for-rent` - Get a property list for rent by parameters
  - `GET /property/detail` - Get detailed property information
  - `GET /market/trends` - Get market trends data
- **Pricing**:
  - Basic: Free (with limit of 2 requests per second)
  - Pro: $9.70/month
  - Ultra: $24.70/month
  - Mega: $109.70/month
- **Notes**: 
  - Reproduces public data from Realtor.com
  - Includes commercial properties

### 3. Other Potential APIs
- **Redfin API**: Unofficial APIs available through RapidAPI
- **Mashvisor API**: Real estate analysis API for rental rates
- **Public Data APIs**: County assessor records and market insights

## API Comparison for Rental Property Finder Requirements

| Requirement | Zillow Zestimate API | RapidAPI US Real Estate Listings |
|-------------|----------------------|----------------------------------|
| Property Search by Zip Code | Limited | Yes, direct endpoint |
| Rental Rate Data | Yes | Yes |
| Property Valuation | Yes (Zestimates) | Yes (real estimates) |
| Property Details/Images | Limited | Yes |
| Market Trends | Limited | Yes |

## Integration Considerations

1. **Authentication and Access**:
   - Zillow Zestimate API requires commercial approval and registration
   - RapidAPI offers immediate access with free tier available

2. **Data Completeness**:
   - RapidAPI provides more comprehensive property listing data
   - Zillow provides strong valuation estimates (Zestimates)

3. **Cost Considerations**:
   - RapidAPI has a free tier with limited requests
   - Zillow likely requires paid commercial access

4. **API Reliability**:
   - Both are backed by established companies
   - RapidAPI service has 100% test score and 1587ms latency

## Recommendation

Based on the research, the **RapidAPI US Real Estate Listings** appears to be the most suitable primary API for our rental property finder application because:

1. It provides direct endpoints for rental property searches by zip code
2. It offers comprehensive property details including images
3. It has market trend data for financial analysis
4. It has a free tier for initial development
5. It doesn't require special approval for access

We could potentially supplement this with Zillow's Zestimate data for more accurate property valuations if needed, but this would require additional approval and likely payment.

## Next Steps

1. Sign up for RapidAPI and obtain an API key
2. Test the rental property search endpoint with sample zip codes
3. Evaluate the response data structure for frontend integration
4. Determine if additional APIs are needed for mortgage rate data
