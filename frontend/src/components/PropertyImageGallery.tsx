import React, { useState } from 'react';
import { 
  Box, 
  IconButton, 
  Paper, 
  Typography,
  useTheme,
  useMediaQuery,
  Modal
} from '@mui/material';
import { 
  NavigateBefore as PrevIcon, 
  NavigateNext as NextIcon,
  ZoomIn as ZoomInIcon,
  Close as CloseIcon
} from '@mui/icons-material';

interface PropertyImageGalleryProps {
  images: string[];
  address: string;
}

const PropertyImageGallery: React.FC<PropertyImageGalleryProps> = ({ images, address }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Handle empty images array
  if (!images || images.length === 0) {
    return (
      <Paper 
        sx={{ 
          width: '100%', 
          height: 300, 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          bgcolor: 'grey.200' 
        }}
      >
        <Typography variant="body1" color="text.secondary">
          No images available
        </Typography>
      </Paper>
    );
  }

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prevIndex) => (prevIndex + 1) % images.length);
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prevIndex) => (prevIndex - 1 + images.length) % images.length);
  };

  const handleZoom = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowModal(true);
  };

  const handleCloseModal = () => setShowModal(false);

  // Main image container
  return (
    <>
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          height: 400,
          overflow: 'hidden',
          borderRadius: 1,
          '&:hover .controls': {
            opacity: 1,
          },
        }}
      >
        {/* Main Image */}
        <Box
          component="img"
          src={images[currentIndex]}
          alt={`${address} - Image ${currentIndex + 1}`}
          sx={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            cursor: 'pointer',
          }}
          onClick={handleZoom}
        />

        {/* Navigation Controls */}
        <Box 
          className="controls"
          sx={{ 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            width: '100%', 
            height: '100%', 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            padding: 1,
            opacity: isMobile ? 1 : 0,
            transition: 'opacity 0.3s',
            bgcolor: 'rgba(0,0,0,0.03)'
          }}
        >
          <IconButton 
            onClick={handlePrev} 
            color="primary" 
            size="large"
            sx={{ 
              bgcolor: 'rgba(255,255,255,0.7)', 
              '&:hover': { bgcolor: 'rgba(255,255,255,0.9)' } 
            }}
          >
            <PrevIcon />
          </IconButton>
          
          <IconButton 
            onClick={handleZoom} 
            color="primary" 
            size="large"
            sx={{ 
              bgcolor: 'rgba(255,255,255,0.7)', 
              '&:hover': { bgcolor: 'rgba(255,255,255,0.9)' } 
            }}
          >
            <ZoomInIcon />
          </IconButton>
          
          <IconButton 
            onClick={handleNext} 
            color="primary" 
            size="large"
            sx={{ 
              bgcolor: 'rgba(255,255,255,0.7)', 
              '&:hover': { bgcolor: 'rgba(255,255,255,0.9)' } 
            }}
          >
            <NextIcon />
          </IconButton>
        </Box>

        {/* Image Counter */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 16,
            right: 16,
            bgcolor: 'rgba(0,0,0,0.6)',
            color: 'white',
            padding: '4px 8px',
            borderRadius: 1,
            fontSize: 14,
          }}
        >
          {currentIndex + 1} / {images.length}
        </Box>
      </Box>

      {/* Thumbnail Navigation (only if there are multiple images) */}
      {images.length > 1 && (
        <Box 
          sx={{ 
            display: 'flex', 
            overflowX: 'auto', 
            gap: 1, 
            mt: 1, 
            pb: 1,
            '&::-webkit-scrollbar': {
              height: 6,
            },
            '&::-webkit-scrollbar-track': {
              backgroundColor: 'rgba(0,0,0,0.05)',
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: 'rgba(0,0,0,0.2)',
              borderRadius: 3,
            }
          }}
        >
          {images.map((img, index) => (
            <Box
              key={index}
              component="img"
              src={img}
              alt={`Thumbnail ${index + 1}`}
              onClick={() => setCurrentIndex(index)}
              sx={{
                width: 80,
                height: 60,
                objectFit: 'cover',
                borderRadius: 1,
                cursor: 'pointer',
                opacity: index === currentIndex ? 1 : 0.6,
                transition: 'opacity 0.3s',
                border: index === currentIndex ? `2px solid ${theme.palette.primary.main}` : 'none',
                '&:hover': {
                  opacity: 0.9,
                },
              }}
            />
          ))}
        </Box>
      )}

      {/* Fullscreen Modal */}
      <Modal
        open={showModal}
        onClose={handleCloseModal}
        aria-labelledby="image-modal-title"
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Box sx={{ 
          position: 'relative', 
          width: '90%', 
          height: '90%', 
          bgcolor: 'background.paper',
          boxShadow: 24, 
          p: 1,
          borderRadius: 1
        }}>
          <IconButton
            sx={{ position: 'absolute', top: 8, right: 8, bgcolor: 'rgba(255,255,255,0.7)' }}
            onClick={handleCloseModal}
          >
            <CloseIcon />
          </IconButton>

          <Box
            component="img"
            src={images[currentIndex]}
            alt={`${address} - Image ${currentIndex + 1} (Full Size)`}
            sx={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
            }}
          />

          {/* Controls for modal */}
          <Box sx={{ 
            position: 'absolute', 
            bottom: 16, 
            left: '50%', 
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: 2,
          }}>
            <IconButton
              onClick={handlePrev}
              sx={{ bgcolor: 'rgba(255,255,255,0.7)' }}
            >
              <PrevIcon />
            </IconButton>
            <Typography 
              variant="body2" 
              sx={{ 
                bgcolor: 'rgba(0,0,0,0.6)', 
                color: 'white', 
                padding: '4px 12px', 
                borderRadius: 1,
                display: 'flex',
                alignItems: 'center'
              }}
            >
              {currentIndex + 1} / {images.length}
            </Typography>
            <IconButton
              onClick={handleNext}
              sx={{ bgcolor: 'rgba(255,255,255,0.7)' }}
            >
              <NextIcon />
            </IconButton>
          </Box>
        </Box>
      </Modal>
    </>
  );
};

export default PropertyImageGallery; 