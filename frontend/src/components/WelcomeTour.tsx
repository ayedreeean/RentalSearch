import React, { useState } from 'react';
import {
  Modal,
  Box,
  Typography,
  Button,
  Paper,
  MobileStepper,
  IconButton,
} from '@mui/material';
import { KeyboardArrowLeft, KeyboardArrowRight, Close as CloseIcon } from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';

interface WelcomeTourProps {
  open: boolean;
  onClose: () => void;
  onSearchExample?: () => void;
}

const steps = [
  {
    label: 'Find Properties Fast',
    description: `Welcome to CashflowCrunch! Enter a location (city, state, or zip) and use filters like price, beds, and baths to quickly discover potential investment properties.`,
    imgPath: '/screenshots/screen1.png',
  },
  {
    label: 'Detailed Cashflow Analysis',
    description: `Dive deep into the numbers. See estimated monthly income, expenses (mortgage, taxes, vacancy), and cash flow. Customize assumptions like interest rates and down payment using the side panel.`,
    imgPath: '/screenshots/screen2.png',
  },
  {
    label: 'Long-Term Projections',
    description: `Visualize growth over 30 years. The interactive chart shows projected property value, equity buildup, and annual cashflow. Adjust appreciation rates to see different scenarios.`,
    imgPath: '/screenshots/screen3.png',
  },
  {
    label: 'Visualize & Get Started',
    description: `Understand the financial breakdown visually with charts like the Cashflow Sankey. Ready to find your next deal? Close this tour and start crunching!`,
    imgPath: '/screenshots/screen4.png', // Or use screen1.png again if preferred
  },
];

const modalStyle = {
  position: 'absolute' as 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: '90%',
  maxWidth: 700, // Increased max width
  bgcolor: 'background.paper',
  border: 'none', // Removed border
  boxShadow: 24,
  borderRadius: '12px', // Added border radius
  p: 0, // Remove padding from the main Box, handle it internally
  outline: 'none',
  overflow: 'hidden', // Ensure content respects border radius
};

const WelcomeTour: React.FC<WelcomeTourProps> = ({ open, onClose }) => {
  const theme = useTheme();
  const [activeStep, setActiveStep] = useState(0);
  const maxSteps = steps.length;

  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  return (
    <Modal
      open={open}
      onClose={onClose} // Close modal on backdrop click
      aria-labelledby="welcome-tour-title"
      aria-describedby="welcome-tour-description"
      closeAfterTransition
    >
      <Box sx={modalStyle}>
        <Paper
          square
          elevation={0}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between', // Space out title and close button
            height: 50,
            pl: 2,
            pr: 1, // Padding for close button
            bgcolor: 'primary.main', // Use primary color for header
            color: 'primary.contrastText', // White text
            borderTopLeftRadius: '12px', // Match modal radius
            borderTopRightRadius: '12px',
          }}
        >
          <Typography variant="h6" id="welcome-tour-title">{steps[activeStep].label}</Typography>
          <IconButton onClick={onClose} size="small" sx={{ color: 'primary.contrastText' }}>
            <CloseIcon />
          </IconButton>
        </Paper>
        <Box sx={{ p: 3 }}> {/* Add padding for content area */}
          <Box
            sx={{
              height: 255, // Adjust height as needed
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              overflow: 'hidden',
              mb: 2, // Margin below image
              borderRadius: '8px', // Rounded corners for image container
              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)', // Inner shadow
            }}
          >
            <img
              src={process.env.PUBLIC_URL + steps[activeStep].imgPath}
              alt={steps[activeStep].label}
              style={{
                maxHeight: '100%',
                maxWidth: '100%',
                display: 'block', // Prevents extra space below image
                objectFit: 'contain', // Ensures image fits without distortion
              }}
            />
          </Box>
          <Typography id="welcome-tour-description" sx={{ mb: 2 }}>{steps[activeStep].description}</Typography>
        </Box>
        <MobileStepper
          steps={maxSteps}
          position="static"
          activeStep={activeStep}
          sx={{
            borderBottomLeftRadius: '12px', // Match modal radius
            borderBottomRightRadius: '12px',
          }}
          nextButton={
            <Button
              size="small"
              onClick={activeStep === maxSteps - 1 ? onClose : handleNext} // Close on last step
              // disabled={activeStep === maxSteps - 1} // Keep enabled to close
            >
              {activeStep === maxSteps - 1 ? 'Get Started' : 'Next'}
              {theme.direction === 'rtl' ? (
                <KeyboardArrowLeft />
              ) : (
                <KeyboardArrowRight />
              )}
            </Button>
          }
          backButton={
            <Button size="small" onClick={handleBack} disabled={activeStep === 0}>
              {theme.direction === 'rtl' ? (
                <KeyboardArrowRight />
              ) : (
                <KeyboardArrowLeft />
              )}
              Back
            </Button>
          }
        />
      </Box>
    </Modal>
  );
};

export default WelcomeTour; 