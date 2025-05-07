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
          height: 400, 
          width: '100%', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          bgcolor: 'grey.100' 
        }}
      >
        <Typography variant="h6" color="text.secondary">
          No images available
        </Typography>
      </Paper>
    );
  }

  const handlePrevImage = () => {
    setCurrentIndex((prevIndex) => (prevIndex === 0 ? images.length - 1 : prevIndex - 1));
  };

  const handleNextImage = () => {
    setCurrentIndex((prevIndex) => (prevIndex === images.length - 1 ? 0 : prevIndex + 1));
  };

  const handleOpenModal = () => {
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
  };

  return (
    <>
      <Paper sx={{ position: 'relative', overflow: 'hidden' }}>
        {/* Main Image */}
        <Box
          sx={{
            position: 'relative',
            paddingTop: '56.25%', // 16:9 aspect ratio
            backgroundImage: `url(${images[currentIndex]})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            cursor: 'pointer',
          }}
          onClick={handleOpenModal}
        >
          {/* Zoom icon */}
          <IconButton
            sx={{
              position: 'absolute',
              bottom: 8,
              right: 8,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              color: 'white',
              '&:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
              },
            }}
            onClick={handleOpenModal}
          >
            <ZoomInIcon />
          </IconButton>
        </Box>

        {/* Navigation controls */}
        {images.length > 1 && (
          <>
            <IconButton
              sx={{
                position: 'absolute',
                top: '50%',
                left: 8,
                transform: 'translateY(-50%)',
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                color: 'white',
                '&:hover': {
                  backgroundColor: 'rgba(0, 0, 0, 0.7)',
                },
              }}
              onClick={handlePrevImage}
            >
              <PrevIcon />
            </IconButton>
            <IconButton
              sx={{
                position: 'absolute',
                top: '50%',
                right: 8,
                transform: 'translateY(-50%)',
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                color: 'white',
                '&:hover': {
                  backgroundColor: 'rgba(0, 0, 0, 0.7)',
                },
              }}
              onClick={handleNextImage}
            >
              <NextIcon />
            </IconButton>
          </>
        )}

        {/* Image counter */}
        {images.length > 1 && (
          <Box
            sx={{
              position: 'absolute',
              bottom: 8,
              left: 8,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              color: 'white',
              padding: '4px 8px',
              borderRadius: 1,
              fontSize: '0.875rem',
            }}
          >
            {currentIndex + 1} / {images.length}
          </Box>
        )}

        {/* Property address overlay */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            color: 'white',
            padding: '8px 16px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          <Typography variant="body1">{address}</Typography>
        </Box>

        {/* Image thumbnails for desktop */}
        {!isMobile && images.length > 1 && (
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'nowrap',
              overflowX: 'auto',
              p: 1,
              gap: 1,
              backgroundColor: 'grey.100',
            }}
          >
            {images.map((image, index) => (
              <Box
                key={index}
                sx={{
                  width: 80,
                  height: 60,
                  flexShrink: 0,
                  backgroundImage: `url(${image})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  cursor: 'pointer',
                  border: index === currentIndex ? `2px solid ${theme.palette.primary.main}` : 'none',
                  opacity: index === currentIndex ? 1 : 0.7,
                  '&:hover': {
                    opacity: 1,
                  },
                }}
                onClick={() => setCurrentIndex(index)}
              />
            ))}
          </Box>
        )}
      </Paper>

      {/* Fullscreen modal */}
      <Modal
        open={showModal}
        onClose={handleCloseModal}
        aria-labelledby="image-modal"
        aria-describedby="fullscreen-property-image"
      >
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Close button */}
          <IconButton
            sx={{
              position: 'absolute',
              top: 16,
              right: 16,
              backgroundColor: 'rgba(255, 255, 255, 0.3)',
              color: 'white',
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.5)',
              },
            }}
            onClick={handleCloseModal}
          >
            <CloseIcon />
          </IconButton>

          {/* Fullscreen image */}
          <Box
            sx={{
              position: 'relative',
              width: '90%',
              height: '80%',
              backgroundImage: `url(${images[currentIndex]})`,
              backgroundSize: 'contain',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
            }}
          />

          {/* Modal navigation controls */}
          {images.length > 1 && (
            <>
              <IconButton
                sx={{
                  position: 'absolute',
                  top: '50%',
                  left: 16,
                  transform: 'translateY(-50%)',
                  backgroundColor: 'rgba(255, 255, 255, 0.3)',
                  color: 'white',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.5)',
                  },
                }}
                onClick={handlePrevImage}
              >
                <PrevIcon fontSize="large" />
              </IconButton>
              <IconButton
                sx={{
                  position: 'absolute',
                  top: '50%',
                  right: 16,
                  transform: 'translateY(-50%)',
                  backgroundColor: 'rgba(255, 255, 255, 0.3)',
                  color: 'white',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.5)',
                  },
                }}
                onClick={handleNextImage}
              >
                <NextIcon fontSize="large" />
              </IconButton>
            </>
          )}

          {/* Image counter in modal */}
          {images.length > 1 && (
            <Box
              sx={{
                position: 'absolute',
                bottom: 16,
                left: 0,
                right: 0,
                textAlign: 'center',
                color: 'white',
                fontSize: '1rem',
              }}
            >
              {currentIndex + 1} / {images.length}
            </Box>
          )}
        </Box>
      </Modal>
    </>
  );
};

export default PropertyImageGallery; 