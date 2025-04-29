import React, { useState, useEffect, useCallback } from 'react';
import {
  Drawer, Typography, Box, Slider, Tooltip, IconButton
} from '@mui/material';
import TuneIcon from '@mui/icons-material/Tune';
import CloseIcon from '@mui/icons-material/Close'; // Import CloseIcon
import { useSettings } from '../context/SettingsContext'; // Import the context hook
import { formatCurrency } from '../utils/formatting'; // Corrected import path
import { CashflowSettings } from '../types'; // Adjust path if needed

const AssumptionsDrawer: React.FC = () => {
  const { settings, updateSettings } = useSettings();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const drawerWidth = '300px';

  // Function to toggle the drawer
  const toggleDrawer = (open: boolean) => (
    event: React.KeyboardEvent | React.MouseEvent,
  ) => {
    if (
      event.type === 'keydown' &&
      ((event as React.KeyboardEvent).key === 'Tab' ||
        (event as React.KeyboardEvent).key === 'Shift')
    ) {
      return;
    }
    setIsDrawerOpen(open);
  };

  // Update CSS variable for tab positioning when drawer state changes
  useEffect(() => {
    document.documentElement.style.setProperty('--drawer-width', isDrawerOpen ? drawerWidth : '0px');
  }, [isDrawerOpen, drawerWidth]);

  // Generic handler for slider changes
  const handleSliderChange = (settingKey: keyof CashflowSettings) => (_: Event | React.SyntheticEvent, newValue: number | number[]) => {
    const value = typeof newValue === 'number' ? newValue : newValue[0];
    updateSettings({ [settingKey]: value });
  };

  return (
    <>
      {/* Assumptions Tab */}
      <Tooltip title="Adjust mortgage and cashflow assumptions" placement="left">
        <div
          className="assumptions-tab"
          onClick={toggleDrawer(true)} // Use toggleDrawer
          style={{
            position: 'fixed',
            // Use CSS variable for right offset
            right: isDrawerOpen ? `var(--drawer-width, ${drawerWidth})` : '0px',
            top: '50%',
            transform: 'translateY(-50%)',
            backgroundColor: '#4f46e5',
            color: 'white',
            padding: '12px 8px',
            borderRadius: '8px 0 0 8px',
            cursor: 'pointer',
            zIndex: 1250,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
            transition: 'right 225ms cubic-bezier(0, 0, 0.2, 1) 0ms'
          }}>
          <TuneIcon />
          <span style={{
            writingMode: 'vertical-rl',
            textOrientation: 'mixed',
            transform: 'rotate(180deg)',
            marginTop: '8px',
            fontWeight: 'bold',
            letterSpacing: '1px',
            fontSize: '14px'
          }}>Assumptions</span>
        </div>
      </Tooltip>

      {/* Assumptions Drawer */}
      <Drawer
        anchor="right"
        open={isDrawerOpen}
        onClose={toggleDrawer(false)} // Use toggleDrawer
        className="assumptions-drawer"
        sx={{
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            maxWidth: '80vw',
            boxSizing: 'border-box',
            padding: 2,
            borderTopLeftRadius: 0,
            borderBottomLeftRadius: 0,
            overflowY: 'auto',
          },
          '& .MuiBackdrop-root': {
            backgroundColor: 'rgba(0, 0, 0, 0.2)'
          }
        }}
        transitionDuration={225}
        SlideProps={{
          easing: {
            enter: 'cubic-bezier(0, 0, 0.2, 1)',
            exit: 'cubic-bezier(0.4, 0, 0.6, 1)'
          }
        }}
      >
        {/* Add Close Button */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="h6" fontWeight="medium">
              Mortgage & Cashflow Assumptions
            </Typography>
            <IconButton onClick={toggleDrawer(false)} size="small">
              <CloseIcon />
            </IconButton>
        </Box>

        {/* Sliders using context state and update function */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" gutterBottom>Interest Rate: {settings.interestRate}%</Typography>
          <Slider
            value={settings.interestRate}
            onChange={handleSliderChange('interestRate')}
            aria-labelledby="interest-rate-slider"
            valueLabelDisplay="auto"
            step={0.1}
            min={0.1}
            max={15}
            sx={{ color: '#4f46e5' }}
          />
        </Box>

        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" gutterBottom>Loan Term: {settings.loanTerm} years</Typography>
          <Slider
            value={settings.loanTerm}
            onChange={handleSliderChange('loanTerm')}
            aria-labelledby="loan-term-slider"
            valueLabelDisplay="auto"
            step={1}
            min={5}
            max={40}
            sx={{ color: '#4f46e5' }}
          />
        </Box>

        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" gutterBottom>Down Payment: {settings.downPaymentPercent}%</Typography>
          <Slider
            value={settings.downPaymentPercent}
            onChange={handleSliderChange('downPaymentPercent')}
            aria-labelledby="down-payment-slider"
            valueLabelDisplay="auto"
            step={1}
            min={0}
            max={100}
            sx={{ color: '#4f46e5' }}
          />
        </Box>

        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" gutterBottom>
            <Tooltip title="Initial rehab costs needed before renting. This amount is added to your total investment when calculating ROI." arrow>
              <span>Initial Rehab: {formatCurrency(settings.rehabAmount)}</span>
            </Tooltip>
          </Typography>
          <Slider 
            value={settings.rehabAmount} 
            onChange={handleSliderChange('rehabAmount')}
            min={0} 
            max={100000}
            step={500} 
            valueLabelDisplay="auto" 
            valueLabelFormat={(value) => formatCurrency(value)}
            sx={{ color: '#4f46e5' }} 
          />
        </Box>

        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" gutterBottom>Property Tax & Insurance: {settings.taxInsurancePercent}%</Typography>
          <Slider
            value={settings.taxInsurancePercent}
            onChange={handleSliderChange('taxInsurancePercent')}
            min={0}
            max={5}
            step={0.1}
            valueLabelDisplay="auto"
            valueLabelFormat={(value) => `${value}%`}
            sx={{ color: '#4f46e5' }}
          />
        </Box>

        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" gutterBottom>Vacancy: {settings.vacancyPercent}%</Typography>
          <Slider
            value={settings.vacancyPercent}
            onChange={handleSliderChange('vacancyPercent')}
            min={0}
            max={10}
            step={1}
            valueLabelDisplay="auto"
            valueLabelFormat={(value) => `${value}%`}
            sx={{ color: '#4f46e5' }}
          />
        </Box>

        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" gutterBottom>CapEx: {settings.capexPercent}%</Typography>
          <Slider
            value={settings.capexPercent}
            onChange={handleSliderChange('capexPercent')}
            min={0}
            max={10}
            step={1}
            valueLabelDisplay="auto"
            valueLabelFormat={(value) => `${value}%`}
            sx={{ color: '#4f46e5' }}
          />
        </Box>

        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" gutterBottom>Property Management: {settings.propertyManagementPercent}%</Typography>
          <Slider
            value={settings.propertyManagementPercent}
            onChange={handleSliderChange('propertyManagementPercent')}
            min={0}
            max={20}
            step={1}
            valueLabelDisplay="auto"
            valueLabelFormat={(value) => `${value}%`}
            sx={{ color: '#4f46e5' }}
          />
        </Box>
      </Drawer>
    </>
  );
};

export default AssumptionsDrawer; 