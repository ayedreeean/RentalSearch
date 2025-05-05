import React, { useState, useEffect, useCallback } from 'react';
import { Box, Typography, Slider, Grid, TextField, Button } from '@mui/material';
import { PortfolioAssumptionOverrides, Property } from '../types'; // Import Property type
import { formatCurrency, formatPercent } from '../utils/formatting';

interface AssumptionControlsProps {
    propertyId: string;
    propertyPrice: number; // Add original price prop
    assumptions: PortfolioAssumptionOverrides;
    onChange: (propertyId: string, key: keyof PortfolioAssumptionOverrides | 'price', value: number) => void; // Allow 'price' key
    handleSaveAssumptions: () => void;
    // Add default settings as a fallback for slider min/max if needed
    defaultSettings: { 
        interestRate: number;
        loanTerm: number;
        downPaymentPercent: number;
        taxInsurancePercent: number;
        vacancyPercent: number;
        capexPercent: number;
        propertyManagementPercent: number;
        rehabAmount: number;
    };
}

// Debounce function
function debounce<F extends (...args: any[]) => any>(func: F, waitFor: number) {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    return (...args: Parameters<F>): void => {
        if (timeoutId !== null) {
            clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => func(...args), waitFor);
    };
}

const AssumptionControls: React.FC<AssumptionControlsProps> = ({ 
    propertyId, 
    propertyPrice, 
    assumptions, 
    onChange, 
    handleSaveAssumptions,
    defaultSettings 
}) => {

    // Internal state to manage slider values for immediate feedback
    const [internalAssumptions, setInternalAssumptions] = useState<PortfolioAssumptionOverrides>(() => ({
        ...assumptions
    }));
    // Separate state for internal price
    const [internalPrice, setInternalPrice] = useState<number>(propertyPrice);

    // Effect to update internal state if external assumptions or price prop changes
    useEffect(() => {
        // Update assumption fields
        setInternalAssumptions(prev => ({
            ...prev, // Keep existing internal overrides
            ...assumptions, // Apply external overrides
        }));
        // Update internal price state separately
        setInternalPrice(propertyPrice);

    }, [assumptions, propertyPrice]);

    // Debounced change handler to update parent state
    const debouncedParentOnChange = useCallback(debounce(onChange, 300), [onChange, propertyId]);

    const handleSliderChange = (
        key: keyof PortfolioAssumptionOverrides
    ) => (_: Event, newValue: number | number[]) => {
        const value = typeof newValue === 'number' ? newValue : newValue[0];
        
        // 1. Update internal state immediately for visual feedback
        setInternalAssumptions(prev => ({
            ...prev,
            [key]: value
        }));

        // 2. Call the debounced handler to update parent state
        debouncedParentOnChange(propertyId, key, value);
    };
    
    // Handler for rent estimate TextField
    const handleRentChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const rentString = event.target.value;
        const rentValue = rentString.trim() === '' ? 0 : parseFloat(rentString.replace(/[^\d.-]/g, ''));
        
        if (!isNaN(rentValue)) {
            // 1. Update internal state immediately
            setInternalAssumptions(prev => ({
                ...prev,
                rentEstimate: rentValue
            }));
            // 2. Call parent onChange directly (no debounce needed for text usually)
            onChange(propertyId, 'rentEstimate', rentValue);
        }
    };

    // Handler for price TextField
    const handlePriceChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const priceString = event.target.value;
        const priceValue = priceString.trim() === '' ? 0 : parseFloat(priceString.replace(/[^\d.-]/g, ''));
        
        if (!isNaN(priceValue)) {
            // 1. Update internal state immediately
            setInternalPrice(priceValue);
            // 2. Call parent onChange directly for price
            onChange(propertyId, 'price', priceValue);
        }
    };

    // Helper to get current value from internal state or default
    const getValue = (key: keyof PortfolioAssumptionOverrides, defaultValue: number): number => {
        // Read from internal state now
        // @ts-ignore
        return (internalAssumptions[key] as number | undefined) ?? defaultValue;
    };

    return (
        <Box sx={{ p: 2 }}>
            <Grid container spacing={3}>
                {/* Purchase Price Input */}
                {/* @ts-ignore TODO: Fix Grid type issue */}
                <Grid item xs={12} sm={6}>
                    <TextField
                        label="Purchase Price"
                        type="text"
                        fullWidth
                        variant="outlined"
                        size="small"
                        value={formatCurrency(internalPrice)}
                        onChange={handlePriceChange}
                        placeholder="Enter purchase price"
                    />
                </Grid>
                {/* Rehab Amount Slider (moved next to price) */}
                {/* @ts-ignore TODO: Fix Grid type issue */}
                <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" gutterBottom>Rehab Amount: {formatCurrency(getValue('rehabAmount', defaultSettings.rehabAmount))}</Typography>
                    <Slider 
                        value={getValue('rehabAmount', defaultSettings.rehabAmount)}
                        onChange={handleSliderChange('rehabAmount')} 
                        min={0} 
                        max={Math.max(50000, getValue('rehabAmount', defaultSettings.rehabAmount) * 1.5)} // Dynamic max
                        step={1000}
                        valueLabelDisplay="auto" 
                        valueLabelFormat={(value) => formatCurrency(value)}
                    />
                </Grid>
                {/* Mortgage Assumptions */}
                {/* @ts-ignore TODO: Fix Grid type issue */}
                <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" gutterBottom>Interest Rate: {formatPercent(getValue('interestRate', defaultSettings.interestRate))}</Typography>
                    <Slider
                        value={getValue('interestRate', defaultSettings.interestRate)}
                        onChange={handleSliderChange('interestRate')}
                        min={2}
                        max={12}
                        step={0.25}
                        valueLabelDisplay="auto"
                        valueLabelFormat={(value) => `${value.toFixed(2)}%`}
                    />
                </Grid>
                {/* @ts-ignore TODO: Fix Grid type issue */}
                <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" gutterBottom>Loan Term: {getValue('loanTerm', defaultSettings.loanTerm)} years</Typography>
                    <Slider
                        value={getValue('loanTerm', defaultSettings.loanTerm)}
                        onChange={handleSliderChange('loanTerm')}
                        min={5}
                        max={40}
                        step={5}
                        valueLabelDisplay="auto"
                        valueLabelFormat={(value) => `${value} yrs`}
                    />
                </Grid>
                 {/* @ts-ignore TODO: Fix Grid type issue */}
                 <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" gutterBottom>Down Payment: {getValue('downPaymentPercent', defaultSettings.downPaymentPercent)}%</Typography>
                    <Slider
                        value={getValue('downPaymentPercent', defaultSettings.downPaymentPercent)}
                        onChange={handleSliderChange('downPaymentPercent')}
                        min={0}
                        max={100}
                        step={5}
                        valueLabelDisplay="auto"
                        valueLabelFormat={(value) => `${value}%`}
                    />
                </Grid>
                
                {/* Expense Assumptions */}
                 {/* @ts-ignore TODO: Fix Grid type issue */}
                 <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" gutterBottom>Tax & Insurance: {getValue('taxInsurancePercent', defaultSettings.taxInsurancePercent)}%</Typography>
                    <Slider
                        value={getValue('taxInsurancePercent', defaultSettings.taxInsurancePercent)}
                        onChange={handleSliderChange('taxInsurancePercent')}
                        min={0}
                        max={5}
                        step={0.1}
                        valueLabelDisplay="auto"
                        valueLabelFormat={(value) => `${value.toFixed(1)}%`}
                    />
                </Grid>
                 {/* @ts-ignore TODO: Fix Grid type issue */}
                 <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" gutterBottom>Vacancy: {getValue('vacancyPercent', defaultSettings.vacancyPercent)}%</Typography>
                    <Slider
                        value={getValue('vacancyPercent', defaultSettings.vacancyPercent)}
                        onChange={handleSliderChange('vacancyPercent')}
                        min={0}
                        max={15}
                        step={1}
                        valueLabelDisplay="auto"
                        valueLabelFormat={(value) => `${value}%`}
                    />
                </Grid>
                 {/* @ts-ignore TODO: Fix Grid type issue */}
                 <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" gutterBottom>CapEx: {getValue('capexPercent', defaultSettings.capexPercent)}%</Typography>
                    <Slider
                        value={getValue('capexPercent', defaultSettings.capexPercent)}
                        onChange={handleSliderChange('capexPercent')}
                        min={0}
                        max={15}
                        step={1}
                        valueLabelDisplay="auto"
                        valueLabelFormat={(value) => `${value}%`}
                    />
                </Grid>
                 {/* @ts-ignore TODO: Fix Grid type issue */}
                 <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" gutterBottom>Property Mgmt: {getValue('propertyManagementPercent', defaultSettings.propertyManagementPercent)}%</Typography>
                    <Slider
                        value={getValue('propertyManagementPercent', defaultSettings.propertyManagementPercent)}
                        onChange={handleSliderChange('propertyManagementPercent')}
                        min={0}
                        max={20}
                        step={1}
                        valueLabelDisplay="auto"
                        valueLabelFormat={(value) => `${value}%`}
                    />
                </Grid>

                {/* Rent Estimate */}
                {/* @ts-ignore TODO: Fix Grid type issue */}
                <Grid item xs={12}>
                    <TextField
                        label="Custom Rent Estimate"
                        type="text" // Use text to allow currency symbols, parse manually
                        fullWidth
                        variant="outlined"
                        size="small"
                        // Read value from internal state for display, format it
                        value={internalAssumptions.rentEstimate !== undefined ? formatCurrency(internalAssumptions.rentEstimate) : ''}
                        onChange={handleRentChange}
                        placeholder="Enter custom monthly rent"
                        InputProps={{
                           // startAdornment: <Typography sx={{ mr: 0.5 }}>$</Typography>, // Removed to prevent double '$'
                        }}
                        sx={{ mt: 1 }}
                    />
                 </Grid>
            </Grid>
            {/* Add Save Button */}
            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                <Button 
                    variant="contained" 
                    size="small" 
                    onClick={handleSaveAssumptions} // Call the save handler prop
                >
                    Save Assumptions
                </Button>
            </Box>
        </Box>
    );
};

export default AssumptionControls; 