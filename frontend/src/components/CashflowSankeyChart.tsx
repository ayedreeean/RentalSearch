import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import { Box, Typography, Paper } from '@mui/material';
// Use individual d3 imports instead of the whole package
import { select } from 'd3-selection';
import { color as d3Color } from 'd3-color';

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

const CashflowSankeyChart: React.FC<CashflowSankeyChartProps> = ({ data, formatCurrency }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null); // Ref for the container Box
  const totalIncome = data.rentalIncome;
  const totalExpenses = data.mortgage + data.taxInsurance + data.vacancy + data.capex + data.propertyManagement;
  const cashflow = data.monthlyCashflow;
  const isPositiveCashflow = cashflow >= 0;

  // Prepare data nodes and links with useMemo to avoid dependency warnings
  const { dataNodes, links } = useMemo(() => {
    // Filter out expense categories with zero values
    const expenseCategories = [
      { id: 'mortgage', name: 'Mortgage', amount: data.mortgage },
      { id: 'taxInsurance', name: 'Tax & Insurance', amount: data.taxInsurance },
      { id: 'vacancy', name: 'Vacancy', amount: data.vacancy },
      { id: 'capex', name: 'CapEx', amount: data.capex },
      { id: 'propertyManagement', name: 'Property Mgmt', amount: data.propertyManagement },
    ].filter(item => item.amount > 0);
    
    // Create base nodes - always include income, expenses and cashflow
    const nodes: Omit<SankeyNode, 'x' | 'y' | 'height'>[] = [
      { id: 'income', name: 'Income', amount: totalIncome },
      { id: 'expenses', name: 'Expenses', amount: totalExpenses },
      ...expenseCategories,
      { id: 'cashflow', name: 'Cashflow', amount: Math.abs(cashflow) }
    ];
    
    // Create lookup for node indices after filtering
    const nodeIndices: Record<string, number> = {};
    nodes.forEach((node, index) => {
      nodeIndices[node.id] = index;
    });
    
    // Create links based on remaining nodes
    const sankeyLinks: Omit<SankeyLink, 'sourceX' | 'sourceY' | 'targetX' | 'targetY' | 'width'>[] = [];
    
    // Income to expenses link
    sankeyLinks.push({ 
      source: nodeIndices.income, 
      target: nodeIndices.expenses, 
      // Value depends on cashflow: if negative, all income goes to expenses
      value: (isPositiveCashflow && cashflow > 0) ? totalExpenses : totalIncome
    });
    
    // Different links structure based on cashflow
    if (isPositiveCashflow && cashflow > 0) {
      // Income to positive cashflow
      sankeyLinks.push({ 
        source: nodeIndices.income, 
        target: nodeIndices.cashflow, 
        value: cashflow 
      });
    } else if (cashflow < 0) {
      // Negative cashflow (additional input)
      sankeyLinks.push({ 
        source: nodeIndices.cashflow, 
        target: nodeIndices.expenses, 
        value: Math.abs(cashflow) 
      });
    }
    
    // Add expense breakdown links for non-zero categories
    expenseCategories.forEach(category => {
      sankeyLinks.push({
        source: nodeIndices.expenses,
        target: nodeIndices[category.id],
        value: category.amount
      });
    });
    
    return { 
      dataNodes: nodes as SankeyNode[], 
      links: sankeyLinks as SankeyLink[]
    };
  }, [totalIncome, totalExpenses, data, cashflow, isPositiveCashflow]);

  // Color mapping for nodes
  const getNodeColor = useMemo(() => {
    return (id: string) => {
      switch (id) {
        case 'income': return '#4ade80'; // Green for income
        case 'expenses': return '#f87171'; // Red for expenses
        case 'mortgage': return '#fb923c'; // Orange
        case 'taxInsurance': return '#a78bfa'; // Purple
        case 'vacancy': return '#60a5fa'; // Blue
        case 'capex': return '#fbbf24'; // Yellow
        case 'propertyManagement': return '#e879f9'; // Pink
        case 'cashflow': return cashflow >= 0 ? '#10b981' : '#ef4444'; // Green/red based on positive/negative
        default: return '#94a3b8'; // Default gray
      }
    };
  }, [cashflow]);

  // Define the drawing function using useCallback
  const drawChart = useCallback(() => {
    if (!svgRef.current || !containerRef.current) return;

    // Get container dimensions
    const containerWidth = containerRef.current.clientWidth;
    
    // Ensure width is valid
    const effectiveWidth = containerWidth > 0 ? containerWidth : 600; 

    const height = 400; // Keep height fixed or make it responsive too if needed

    // Adjust margins based on width
    const isSmallScreen = effectiveWidth < 600;
    const margin = {
      top: 40,
      right: isSmallScreen ? 100 : 150, // Smaller right margin for small screens
      bottom: 40,
      left: isSmallScreen ? 100 : 150 // Smaller left margin for small screens
    };
    
    // Clear previous SVG content
    const svgElement = select(svgRef.current);
    svgElement.selectAll("*").remove();

    // Set up SVG
    const svg = svgElement
      .attr("width", effectiveWidth)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const innerWidth = effectiveWidth - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    // Adjust column positions based on width
    const columns = [
      { x: 0 },
      { x: innerWidth * (isSmallScreen ? 0.35 : 0.4) }, // Columns closer on small screens
      { x: innerWidth * (isSmallScreen ? 0.7 : 0.8) }
    ];
    
    // Calculate total flow for proper scaling
    const totalFlow = isPositiveCashflow ? totalIncome : totalIncome + Math.abs(cashflow);
    
    // Calculate height factor - use same scale for all nodes for consistency
    const heightFactor = Math.min(240, innerHeight * 0.7) / Math.max(totalFlow, 1); // Avoid division by zero
    
    // Initialize positions and heights for nodes
    const sankeyData: SankeyData = {
      nodes: dataNodes.map((node, i) => ({ 
        ...node, 
        index: i,
        x: 0,
        y: 0,
        height: 0
      })),
      links: links.map(link => ({
        ...link,
        sourceX: 0,
        sourceY: 0,
        targetX: 0,
        targetY: 0,
        width: 0
      }))
    };
    
    // Vertical spacing between categories - adjust for small screens
    const categorySpacing = isSmallScreen ? 15 : 25;
    
    // STEP 1: Position all nodes
    
    // Get nodes by ID for easier access
    const incomeNode = sankeyData.nodes.find(n => n.id === 'income')!;
    const expensesNode = sankeyData.nodes.find(n => n.id === 'expenses')!;
    const cashflowNode = sankeyData.nodes.find(n => n.id === 'cashflow')!;
    
    // Filter expense categories
    const expenseCategories = sankeyData.nodes.filter(n => 
      !['income', 'expenses', 'cashflow'].includes(n.id)
    );
    
    // Set columns for each node
    incomeNode.x = columns[0].x;
    expensesNode.x = columns[1].x;
    
    if (isPositiveCashflow) {
      cashflowNode.x = columns[2].x;
    } else {
      cashflowNode.x = columns[0].x;
    }
    
    expenseCategories.forEach(node => {
      node.x = columns[2].x;
    });
    
    // Calculate space needed for expense categories
    const totalCategoriesHeight = (expenseCategories.reduce((sum, cat) => sum + cat.amount, 0) * heightFactor) + 
                                  ((expenseCategories.length - 1) * categorySpacing);
    
    // Position expense categories first
    let currentY = innerHeight / 2 - (totalCategoriesHeight / 2);
    for (const category of expenseCategories) {
      category.y = currentY;
      category.height = heightFactor * category.amount;
      currentY += category.height + categorySpacing;
    }
    
    // Position main nodes
    expensesNode.y = innerHeight / 2 - (heightFactor * expensesNode.amount / 2);
    expensesNode.height = heightFactor * expensesNode.amount;
    
    incomeNode.y = innerHeight / 2 - (heightFactor * incomeNode.amount / 2);
    incomeNode.height = heightFactor * incomeNode.amount;
    
    if (isPositiveCashflow) {
      // Position positive cashflow at bottom of right side
      if (expenseCategories.length > 0) {
        const lastCategory = expenseCategories[expenseCategories.length - 1];
        cashflowNode.y = lastCategory.y + lastCategory.height + categorySpacing;
      } else {
        cashflowNode.y = innerHeight / 2 + 50; 
      }
      cashflowNode.height = heightFactor * cashflowNode.amount;
    } else {
      // Position negative cashflow below income with spacing
      cashflowNode.y = incomeNode.y + incomeNode.height + 30;
      cashflowNode.height = heightFactor * Math.abs(cashflow);
    }
    
    // STEP 2: Calculate link paths
    sankeyData.links.forEach(link => {
      const source = sankeyData.nodes[link.source];
      const target = sankeyData.nodes[link.target];
      
      // Calculate link width consistently as proportional to value
      link.width = heightFactor * link.value;
      
      // Income to expenses link
      if (source.id === 'income' && target.id === 'expenses') {
        link.sourceX = source.x + 15;
        
        if (isPositiveCashflow && cashflow > 0) {
          const startOffset = incomeNode.height * (link.value / totalIncome) / 2;
          link.sourceY = source.y + startOffset;
        } else {
          link.sourceY = source.y + (source.height / 2);
        }
        
        link.targetX = target.x;
        link.targetY = target.y + (isPositiveCashflow ? target.height / 2 : (link.width / 2));
      }
      
      // Income to cashflow link (positive cashflow)
      else if (source.id === 'income' && target.id === 'cashflow') {
        link.sourceX = source.x + 15;
        const startOffset = incomeNode.height - (incomeNode.height * (link.value / totalIncome) / 2);
        link.sourceY = source.y + startOffset;
        link.targetX = target.x;
        link.targetY = target.y + (target.height / 2);
      }
      
      // Negative cashflow to expenses link
      else if (source.id === 'cashflow' && target.id === 'expenses') {
        link.sourceX = source.x + 15;
        link.sourceY = source.y + (source.height / 2);
        link.targetX = target.x;
        link.targetY = target.y + target.height - (link.width / 2);
      }
      
      // Expenses to specific expense category
      else if (source.id === 'expenses') {
        const targetCategory = expenseCategories.find(cat => cat.id === target.id);
        if (targetCategory) {
          let heightBefore = 0;
          for (const cat of expenseCategories) {
            if (cat.id === target.id) break;
            heightBefore += cat.amount;
          }
          link.sourceX = source.x + 15;
          link.sourceY = source.y + (source.height * (heightBefore / totalExpenses)) + 
                          (source.height * (target.amount / totalExpenses / 2));
          link.targetX = target.x;
          link.targetY = target.y + (target.height / 2);
        }
      }
    });
    
    // STEP 3: Draw links
    svg.append("g")
      .selectAll("path")
      .data(sankeyData.links)
      .join("path")
      .attr("d", (d: SankeyLink) => {
        const x0 = d.sourceX;
        const y0 = d.sourceY;
        const x1 = d.targetX;
        const y1 = d.targetY;
        const dx = x1 - x0;
        const controlX1 = x0 + dx * 0.4;
        const controlY1 = y0;
        const controlX2 = x1 - dx * 0.4;
        const controlY2 = y1;
        return `M ${x0},${y0} C ${controlX1},${controlY1} ${controlX2},${controlY2} ${x1},${y1}`;
      })
      .attr("stroke", (d: SankeyLink) => {
        const source = sankeyData.nodes[d.source];
        const nodeClr = getNodeColor(source.id);
        const c = d3Color(nodeClr);
        return c ? c.toString() : nodeClr;
      })
      .attr("stroke-width", (d: SankeyLink) => d.width)
      .attr("fill", "none")
      .attr("opacity", 0.8);
    
    // STEP 4: Draw node rectangles
    const nodeGroups = svg.append("g")
      .selectAll("g")
      .data(sankeyData.nodes)
      .join("g")
      .attr("transform", (d: SankeyNode) => `translate(${d.x},${d.y})`);
    
    nodeGroups.append("rect")
      .attr("width", 15)
      .attr("height", (d: SankeyNode) => d.height)
      .attr("fill", (d: SankeyNode) => getNodeColor(d.id))
      .attr("rx", 4)
      .attr("ry", 4);
    
    // Add text labels
    nodeGroups.append("text")
      .attr("x", (d: SankeyNode) => {
        // Position text based on node position
        if (d.id === 'income' || (d.id === 'cashflow' && !isPositiveCashflow)) {
          return -10; // Left-side labels
        } else if (d.id === 'expenses') {
          return 60; // Move Expenses label further right into whitespace
        } else {
          return 25; // Right-side labels
        }
      })
      .attr("y", (d: SankeyNode) => d.height / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", (d: SankeyNode) => {
        // Align text based on position
        if (d.id === 'income' || (d.id === 'cashflow' && !isPositiveCashflow)) {
          return "end"; // Right-aligned
        } else {
          return "start"; // Left-aligned
        }
      })
      .text((d: SankeyNode) => `${d.name}: ${formatCurrency(d.amount)}`)
      .attr("fill", "#333333")
      .attr("font-size", "14px")
      .attr("font-weight", (d: SankeyNode) => ['income', 'expenses', 'cashflow'].includes(d.id) ? "bold" : "normal");
      
  }, [dataNodes, links, getNodeColor, isPositiveCashflow, totalIncome, totalExpenses, cashflow, formatCurrency]); // Include drawChart dependencies

  // Add ResizeObserver
  useEffect(() => {
    // Initial draw
    drawChart();

    const resizeObserver = new ResizeObserver(() => {
      drawChart(); // Redraw on resize
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    // Cleanup observer on component unmount
    return () => {
      resizeObserver.disconnect();
    };
  }, [drawChart]); // Dependency on the memoized drawChart function

  return (
    <Paper sx={{ p: 3, borderRadius: 2, mb: 3, overflow: 'hidden' }}> {/* Add overflow hidden */} 
      <Typography variant="h5" mb={2}>
        Cashflow Breakdown
      </Typography>
      {/* Use a Box as the container for ResizeObserver */} 
      <Box ref={containerRef} sx={{ width: '100%', height: 400, position: 'relative' }}>
        <svg ref={svgRef} style={{ display: 'block' }} /> {/* Ensure SVG takes block display */} 
      </Box>
    </Paper>
  );
};

export default CashflowSankeyChart; 