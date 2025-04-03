import React from 'react';
import { Typography, Slider, AccordionSummary, AccordionDetails, Accordion } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

interface CashflowCalculatorProps {
  interestRate: number;
  setInterestRate: (rate: number) => void;
  loanTerm: number;
  setLoanTerm: (term: number) => void;
  downPaymentPercent: number;
  setDownPaymentPercent: (percent: number) => void;
  taxInsurancePercent: number;
  setTaxInsurancePercent: (percent: number) => void;
  vacancyPercent: number;
  setVacancyPercent: (percent: number) => void;
  capexPercent: number;
  setCapexPercent: (percent: number) => void;
}

const CashflowCalculator: React.FC<CashflowCalculatorProps> = ({
  interestRate,
  setInterestRate,
  loanTerm,
  setLoanTerm,
  downPaymentPercent,
  setDownPaymentPercent,
  taxInsurancePercent,
  setTaxInsurancePercent,
  vacancyPercent,
  setVacancyPercent,
  capexPercent,
  setCapexPercent
}) => {
  return (
    <Accordion sx={{ mb: 3 }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography>Cashflow Calculator Settings</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Typography gutterBottom>Interest Rate: {interestRate}%</Typography>
        <Slider
          value={interestRate}
          onChange={(_, value) => setInterestRate(value as number)}
          min={2}
          max={10}
          step={0.1}
          valueLabelDisplay="auto"
          sx={{ mb: 3 }}
        />
        
        <Typography gutterBottom>Loan Term: {loanTerm} years</Typography>
        <Slider
          value={loanTerm}
          onChange={(_, value) => setLoanTerm(value as number)}
          min={15}
          max={30}
          step={5}
          marks
          valueLabelDisplay="auto"
          sx={{ mb: 3 }}
        />
        
        <Typography gutterBottom>Down Payment: {downPaymentPercent}%</Typography>
        <Slider
          value={downPaymentPercent}
          onChange={(_, value) => setDownPaymentPercent(value as number)}
          min={5}
          max={50}
          step={5}
          valueLabelDisplay="auto"
          sx={{ mb: 3 }}
        />
        
        <Typography gutterBottom>Property Tax & Insurance: {taxInsurancePercent}% of property value annually</Typography>
        <Slider
          value={taxInsurancePercent}
          onChange={(_, value) => setTaxInsurancePercent(value as number)}
          min={0.5}
          max={3}
          step={0.1}
          valueLabelDisplay="auto"
          sx={{ mb: 3 }}
        />
        
        <Typography gutterBottom>Vacancy: {vacancyPercent}% of rent</Typography>
        <Slider
          value={vacancyPercent}
          onChange={(_, value) => setVacancyPercent(value as number)}
          min={0}
          max={10}
          step={1}
          valueLabelDisplay="auto"
          sx={{ mb: 3 }}
        />
        
        <Typography gutterBottom>Capital Expenditures: {capexPercent}% of rent</Typography>
        <Slider
          value={capexPercent}
          onChange={(_, value) => setCapexPercent(value as number)}
          min={0}
          max={10}
          step={1}
          valueLabelDisplay="auto"
        />
      </AccordionDetails>
    </Accordion>
  );
};

export default CashflowCalculator;
