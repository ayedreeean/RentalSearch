import React, { useState, useEffect } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { getPropertyImages } from '../api/propertyApi';
import ImageGallery from 'react-image-gallery';
import 'react-image-gallery/styles/css/image-gallery.css';

interface PropertyImageGalleryProps {
  zpid: string;
  fallbackImage?: string;
}

const PropertyImageGallery: React.FC<PropertyImageGalleryProps> = ({ 
  zpid, 
  fallbackImage = 'https://via.placeholder.com/800x500?text=No+Property+Image+Available' 
}) => {
  const [images, setImages] = useState<Array<{original: string; thumbnail: string}>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchImages = async () => {
      console.log(`[PropertyImageGallery] Attempting to fetch images for zpid: ${zpid}`);
      try {
        setLoading(true);
        setError(false);
        
        if (!zpid) {
          console.error('[PropertyImageGallery] No zpid provided');
          setError(true);
          setLoading(false);
          return;
        }

        const propertyImages = await getPropertyImages(zpid);
        console.log(`[PropertyImageGallery] Received ${propertyImages?.length || 0} images from API`);
        
        if (propertyImages && propertyImages.length > 0) {
          // Format images for react-image-gallery
          const formattedImages = propertyImages.map(imageUrl => ({
            original: imageUrl,
            thumbnail: imageUrl,
          }));
          setImages(formattedImages);
          console.log('[PropertyImageGallery] Successfully formatted images for gallery');
        } else {
          console.warn('[PropertyImageGallery] No images returned from API');
          setError(true);
        }
      } catch (err) {
        console.error('[PropertyImageGallery] Error fetching property images:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchImages();
  }, [zpid]);

  if (loading) {
    return (
      <Box 
        display="flex" 
        justifyContent="center" 
        alignItems="center" 
        sx={{ 
          height: '100%', 
          minHeight: '300px',
          bgcolor: 'background.paper' 
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error || images.length === 0) {
    console.log(`[PropertyImageGallery] Showing fallback image due to error=${error} or empty images array (length=${images.length})`);
    return (
      <Box 
        component="img"
        src={fallbackImage}
        alt="Property image not available"
        sx={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          borderRadius: 1
        }}
      />
    );
  }

  return (
    <Box sx={{ 
      height: '100%', 
      '& .image-gallery': { 
        borderRadius: 1, 
        overflow: 'hidden',
        height: '100%'
      },
      '& .image-gallery-content': {
        height: '100%'
      },
      '& .image-gallery-slide-wrapper': {
        height: 'calc(100% - 80px)'
      },
      '& .image-gallery-swipe': {
        height: '100%'
      },
      '& .image-gallery-slides': {
        height: '100%'
      },
      '& .image-gallery-slide': {
        height: '100%'
      },
      '& .image-gallery-image': {
        objectFit: 'contain',
        height: '100%'
      }
    }}>
      <ImageGallery
        items={images}
        showPlayButton={false}
        showFullscreenButton={true}
        showNav={true}
        thumbnailPosition="bottom"
        useBrowserFullscreen={true}
        lazyLoad={true}
      />
    </Box>
  );
};

export default PropertyImageGallery; 