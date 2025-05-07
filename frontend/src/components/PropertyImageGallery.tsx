import React, { useState, useEffect } from 'react';
import { Box, CircularProgress } from '@mui/material';
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
      if (!zpid) {
        console.log('No ZPID provided for PropertyImageGallery');
        setLoading(false);
        setError(true);
        return;
      }

      try {
        console.log(`[PropertyImageGallery] Fetching images for ZPID: ${zpid}`);
        const imageUrls = await getPropertyImages(zpid);
        console.log(`[PropertyImageGallery] Received ${imageUrls.length} images`);
        
        if (imageUrls.length > 0) {
          const formattedImages = imageUrls.map(url => ({
            original: url,
            thumbnail: url
          }));
          setImages(formattedImages);
        } else {
          // Use fallback image if no images returned
          setImages([{
            original: fallbackImage,
            thumbnail: fallbackImage
          }]);
          console.log(`[PropertyImageGallery] No images found, using fallback image`);
        }
      } catch (error) {
        console.error('[PropertyImageGallery] Error fetching images:', error);
        setError(true);
        // Use fallback image on error
        setImages([{
          original: fallbackImage,
          thumbnail: fallbackImage
        }]);
      } finally {
        setLoading(false);
      }
    };

    fetchImages();
  }, [zpid, fallbackImage]);

  // If loading show spinner
  if (loading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        height: '100%',
        minHeight: 300
      }}>
        <CircularProgress />
      </Box>
    );
  }

  // If error or no images, show fallback
  if (error || images.length === 0) {
    return (
      <Box
        component="img"
        src={fallbackImage}
        alt="Property Image"
        sx={{
          width: '100%',
          height: 'auto',
          maxHeight: '100%',
          objectFit: 'contain',
          borderRadius: 1
        }}
      />
    );
  }

  // Custom styles to ensure gallery fits in the container
  const galleryStyles = {
    '.image-gallery': {
      height: '100%',
      overflow: 'hidden'
    },
    '.image-gallery-content': {
      height: '100%'
    },
    '.image-gallery-slide-wrapper': {
      height: 'calc(100% - 80px)'  // Subtract thumbnail height
    },
    '.image-gallery-swipe': {
      height: '100%'
    },
    '.image-gallery-slides': {
      height: '100%'
    },
    '.image-gallery-slide': {
      height: '100%'
    },
    '.image-gallery-image': {
      objectFit: 'contain',
      height: '100%'
    }
  };

  return (
    <Box sx={{ 
      height: '100%', 
      width: '100%',
      ...galleryStyles 
    }}>
      <ImageGallery
        items={images}
        showPlayButton={false}
        showFullscreenButton={true}
        showNav={true}
        showBullets={images.length > 1}
        thumbnailPosition="bottom"
        useBrowserFullscreen={true}
      />
    </Box>
  );
};

export default PropertyImageGallery; 