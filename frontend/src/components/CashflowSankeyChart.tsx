import React, { useMemo } from 'react';
import { Box, Typography, Paper, useTheme, useMediaQuery } from '@mui/material';
// Use individual d3 imports instead of the whole package
import { ResponsiveSankey } from '@nivo/sankey'; // Import ResponsiveSankey

interface CashflowSankeyChartProps {
  data: {
    rentalIncome: number;
    mortgage: number;
    taxInsurance: number;
    vacancy: number;
    capex: number;
    propertyManagement: number;
    monthlyCashflow: number;
  };
  formatCurrency: (amount: number) => string;
}

// Define interfaces for Sankey data
// Nivo uses its own structure, these are not needed
/*
interface SankeyNode {
  id: string;
  name: string;
  amount: number;
  index?: number;
  x: number;
  y: number;
  height: number;
}

interface SankeyLink {
  source: number;
  target: number;
  value: number;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  width: number;
}

interface SankeyData {
  nodes: SankeyNode[];
  links: SankeyLink[];
}
*/

const CashflowSankeyChart: React.FC<CashflowSankeyChartProps> = ({ data, formatCurrency }) => {
  // Remove refs and drawing logic
  // const svgRef = useRef<SVGSVGElement>(null);
  // const containerRef = useRef<HTMLDivElement>(null); // Ref for the container Box
  const totalIncome = data.rentalIncome;
  const totalExpenses = data.mortgage + data.taxInsurance + data.vacancy + data.capex + data.propertyManagement;
  const cashflow = data.monthlyCashflow;
  const isPositiveCashflow = cashflow >= 0;

  // Add media query hook
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Prepare data nodes and links with useMemo to avoid dependency warnings
  const nivoData = useMemo(() => {
    // Filter out expense categories with zero values
    const expenseCategories = [
      { id: 'Mortgage', name: 'Mortgage', amount: data.mortgage },
      { id: 'Tax/Ins', name: 'Tax/Ins', amount: data.taxInsurance },
      { id: 'Vacancy', name: 'Vacancy', amount: data.vacancy },
      { id: 'CapEx', name: 'CapEx', amount: data.capex },
      { id: 'Property Mgmt', name: 'Property Mgmt', amount: data.propertyManagement },
    ].filter(item => item.amount > 0);

    // Create base nodes - always include income, expenses and cashflow
    // Nodes for Nivo just need an ID. We add 'name' for potential labels/tooltips.
    const nodes = [
      { id: 'Income', name: 'Income', amount: totalIncome },
      { id: 'Expenses', name: 'Expenses', amount: totalExpenses },
      ...expenseCategories,
      // Use different node ID for negative cashflow if needed for clarity
      { id: (isPositiveCashflow ? 'Cashflow' : 'Cash Deficit'), name: (isPositiveCashflow ? 'Cashflow' : 'Cash Deficit'), amount: Math.abs(cashflow) }
    ];

    // Nivo links use node IDs (strings)
    const links: { source: string; target: string; value: number }[] = [];

    // Income to expenses link
    links.push({
      source: 'Income',
      target: 'Expenses',
      // Value depends on cashflow: if negative, all income goes to expenses
      value: Math.max(0.01, (isPositiveCashflow && cashflow > 0) ? totalExpenses : totalIncome) // Nivo requires value > 0
    });

    // Different links structure based on cashflow
    if (isPositiveCashflow && cashflow > 0) {
      // Income to positive cashflow
      links.push({
        source: 'Income',
        target: 'Cashflow',
        value: Math.max(0.01, cashflow)
      });
    } else if (cashflow < 0) {
      // Negative cashflow (additional input)
      links.push({
        source: 'Cash Deficit', // Use the negative cashflow node ID
        target: 'Expenses',
        value: Math.max(0.01, Math.abs(cashflow))
      });
    }

    // Add expense breakdown links for non-zero categories
    expenseCategories.forEach(category => {
      links.push({
        source: 'Expenses',
        target: category.id, // Use the category ID directly
        value: Math.max(0.01, category.amount)
      });
    });

    // Filter nodes list to only include nodes actually used in links
    const nodeIdsInLinks = new Set<string>();
    links.forEach(link => {
        nodeIdsInLinks.add(link.source);
        nodeIdsInLinks.add(link.target);
    });
    const filteredNodes = nodes.filter(node => nodeIdsInLinks.has(node.id));

    return {
      nodes: filteredNodes,
      links: links
    };
  }, [totalIncome, totalExpenses, data, cashflow, isPositiveCashflow]);

  // Color mapping for nodes - Adjust for Nivo structure
  const getNodeColor = useMemo(() => {
    return (node: { id: string | number }) => { // Nivo passes the node object
      const id = node.id as string;
       switch (id) {
        case 'Income': return '#4ade80'; // Green
        case 'Expenses': return '#f87171'; // Red
        case 'Mortgage': return '#fb923c'; // Orange
        case 'Tax/Ins': return '#a78bfa'; // Purple - Shortened label
        case 'Vacancy': return '#60a5fa'; // Blue
        case 'CapEx': return '#fbbf24'; // Yellow
        case 'Property Mgmt': return '#e879f9'; // Pink
        case 'Cashflow': return '#10b981'; // Green
        case 'Cash Deficit': return '#ef4444'; // Red
        default: return '#94a3b8'; // Default gray
      }
    };
  }, []); // No dependency on cashflow needed here if IDs are distinct

  // Add ResizeObserver
  // No longer needed as ResponsiveSankey handles resizing

  // Prepare legend data
  const legendData = useMemo(() => {
    const items = [
      { id: 'Income', name: 'Income' },
      { id: 'Mortgage', name: 'Mortgage' },
      { id: 'Tax/Ins', name: 'Tax/Ins' }, // Shortened label
      { id: 'Vacancy', name: 'Vacancy' },
      { id: 'CapEx', name: 'CapEx' },
      { id: 'Property Mgmt', name: 'Property Mgmt' },
      // Use the correct ID based on cashflow state
      { id: (isPositiveCashflow ? 'Cashflow' : 'Cash Deficit'), name: (isPositiveCashflow ? 'Cashflow' : 'Cash Deficit') },
    ];

    // Filter out items that are zero in the input data
    // This requires checking the original `data` prop
    const activeItems = items.filter(item => {
        if (item.id === 'Income') return data.rentalIncome > 0;
        if (item.id === 'Mortgage') return data.mortgage > 0;
        if (item.id === 'Tax/Ins') return data.taxInsurance > 0; // Shortened label
        if (item.id === 'Vacancy') return data.vacancy > 0;
        if (item.id === 'CapEx') return data.capex > 0;
        if (item.id === 'Property Mgmt') return data.propertyManagement > 0;
        if (item.id === 'Cashflow' || item.id === 'Cash Deficit') return true; // Always show cashflow/deficit
        return false;
    });

    return activeItems.map(item => ({
      name: item.name,
      // Call getNodeColor with the expected object structure
      color: getNodeColor({ id: item.id })
    }));
  }, [data, getNodeColor, isPositiveCashflow]); // Add isPositiveCashflow dependency

  return (
    <Paper sx={{ p: 3, borderRadius: 2, mb: 3 }}>
      <Typography variant="h5" mb={2}>
        Cashflow Breakdown
      </Typography>
      {/* Replace SVG with ResponsiveSankey */}
      <Box sx={{ width: '100%', height: 400 }}>
        <ResponsiveSankey
          data={nivoData}
          margin={isMobile ? 
            { top: 20, right: 30, bottom: 20, left: 30 } : 
            { top: 20, right: 120, bottom: 20, left: 120 }
          }
          align="justify" // Or "start", "end", "center"
          colors={getNodeColor} // Use the color function
          nodeOpacity={1}
          nodeHoverOpacity={1}
          nodeThickness={18}
          nodeInnerPadding={3}
          nodeSpacing={10} // Spacing between nodes in the same column
          nodeBorderWidth={0}
          // nodeBorderColor={{ from: 'color', modifiers: [['darker', 0.8]] }}
          nodeBorderRadius={3}
          linkOpacity={0.6}
          linkHoverOpacity={0.8}
          linkContract={3}
          // enableLinkGradient={true}

          // Conditionally set label based on screen size
          label={isMobile ? () => '' : node => `${node.id}: ${formatCurrency(node.value)}`}

          labelPosition="outside"
          labelOrientation="horizontal"
          labelPadding={16}
          labelTextColor={{ from: 'color', modifiers: [['darker', 1]] }}
          valueFormat={value => formatCurrency(value)} // Format tooltip values
          
          // Add custom node tooltip
          nodeTooltip={({ node }) => (
            <div style={{
              background: 'white',
              color: 'black',
              padding: '5px 10px',
              border: '1px solid #ccc',
              borderRadius: '3px',
              boxShadow: '2px 2px 5px rgba(0,0,0,0.1)',
              fontSize: '12px'
            }}>
              <strong>{node.id}:</strong> {formatCurrency(node.value)}
            </div>
          )}

          // Add custom link tooltip
          linkTooltip={({ link }) => (
            <div style={{
              background: 'white',
              color: 'black',
              padding: '5px 10px',
              border: '1px solid #ccc',
              borderRadius: '3px',
              boxShadow: '2px 2px 5px rgba(0,0,0,0.1)',
              fontSize: '12px'
            }}>
              <strong>{link.source.id} → {link.target.id}:</strong> {formatCurrency(link.value)}
            </div>
          )}

          legends={[]} // Disable built-in Nivo legends if using custom one below
        />
      </Box>
      {/* Add Legend Section */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 2, justifyContent: 'center' }}>
        {legendData.map((item) => (
          <Box key={item.name} sx={{ display: 'flex', alignItems: 'center' }}>
            <Box 
              sx={{ 
                width: 14, 
                height: 14, 
                bgcolor: item.color, 
                mr: 1, 
                borderRadius: '2px' 
              }}
            />
            <Typography variant="body2">{item.name}</Typography>
          </Box>
        ))}
      </Box>
    </Paper>
  );
};

export default CashflowSankeyChart; 