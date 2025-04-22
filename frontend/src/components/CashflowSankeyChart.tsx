import React, { useRef, useEffect, useMemo } from 'react';
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

  // Create the sankey diagram using D3
  useEffect(() => {
    if (!svgRef.current) return;

    // Clear previous SVG content
    select(svgRef.current).selectAll("*").remove();

    const width = svgRef.current.clientWidth;
    const height = 400;
    const margin = { top: 40, right: 200, bottom: 40, left: 150 };
    
    // Set up SVG
    const svg = select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    // Define column positions
    const columns = [
      { x: 0 }, // Left column (income and negative cashflow)
      { x: innerWidth * 0.4 }, // Middle column (expenses)
      { x: innerWidth * 0.8 } // Right column (expense categories and positive cashflow)
    ];
    
    // Calculate total flow for proper scaling
    const totalFlow = isPositiveCashflow ? totalIncome : totalIncome + Math.abs(cashflow);
    
    // Calculate height factor - use same scale for all nodes for consistency
    const heightFactor = Math.min(240, innerHeight * 0.7) / totalFlow;
    
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
    
    // Vertical spacing between categories
    const categorySpacing = 25;
    
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
      // Place it below all expense categories
      if (expenseCategories.length > 0) {
        const lastCategory = expenseCategories[expenseCategories.length - 1];
        cashflowNode.y = lastCategory.y + lastCategory.height + categorySpacing;
      } else {
        cashflowNode.y = innerHeight / 2 + 50; // Default position if no categories
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
          // Positive cashflow: Link starts from top portion of income node
          const startOffset = incomeNode.height * (link.value / totalIncome) / 2;
          link.sourceY = source.y + startOffset;
        } else {
          // Negative cashflow: Link represents total income, starts centered
          link.sourceY = source.y + (source.height / 2);
        }
        
        link.targetX = target.x;
        // For negative cashflow, target point needs to be higher up on the expenses node
        link.targetY = target.y + (isPositiveCashflow ? target.height / 2 : (link.width / 2));
      }
      
      // Income to cashflow link (positive cashflow)
      else if (source.id === 'income' && target.id === 'cashflow') {
        link.sourceX = source.x + 15;
        
        // Position at bottom of income node, proportional to cashflow value
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
        // Connect to bottom of expenses node
        link.targetY = target.y + target.height - (link.width / 2);
      }
      
      // Expenses to specific expense category
      else if (source.id === 'expenses') {
        const targetCategory = expenseCategories.find(cat => cat.id === target.id);
        if (targetCategory) {
          // Calculate proportional position within expenses node
          let heightBefore = 0;
          for (const cat of expenseCategories) {
            if (cat.id === target.id) break;
            heightBefore += cat.amount;
          }
          
          // Position within expenses node proportionally to category position
          link.sourceX = source.x + 15;
          link.sourceY = source.y + (source.height * (heightBefore / totalExpenses)) + 
                          (source.height * (target.amount / totalExpenses / 2));
          
          link.targetX = target.x;
          link.targetY = target.y + (target.height / 2);
        }
      }
    });
    
    // STEP 3: Draw links from back to front for proper layering
    
    // First: Draw expense breakdown links
    svg.append("g")
      .selectAll(".expense-links")
      .data(sankeyData.links.filter(link => 
        sankeyData.nodes[link.source].id === 'expenses'
      ))
      .join("path")
      .attr("class", "expense-links")
      .attr("d", (d: SankeyLink) => {
        const x0 = d.sourceX;
        const y0 = d.sourceY;
        const x1 = d.targetX;
        const y1 = d.targetY;
        
        const dx = x1 - x0;
        
        // Control points for a nice curve
        const controlX1 = x0 + dx * 0.4;
        const controlY1 = y0;
        const controlX2 = x1 - dx * 0.4;
        const controlY2 = y1;
        
        return `
          M ${x0},${y0}
          C ${controlX1},${controlY1} ${controlX2},${controlY2} ${x1},${y1}
        `;
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
    
    // Second: Draw main flow links
    // For the main income-expenses flow, we need to ensure the width looks consistent
    const mainFlowLinks = sankeyData.links.filter(link => (
      (sankeyData.nodes[link.source].id === 'income' && sankeyData.nodes[link.target].id === 'expenses') ||
      (sankeyData.nodes[link.source].id === 'cashflow' && sankeyData.nodes[link.target].id === 'expenses')
    ));
    
    svg.append("g")
      .selectAll(".main-flow-links")
      .data(mainFlowLinks)
      .join("path")
      .attr("class", "main-flow-links")
      .attr("d", (d: SankeyLink) => {
        const x0 = d.sourceX;
        const y0 = d.sourceY;
        const x1 = d.targetX;
        const y1 = d.targetY;
        
        const dx = x1 - x0;
        
        // Control points for a nice curve that maintains the flow width
        const controlX1 = x0 + dx * 0.4;
        const controlY1 = y0;
        const controlX2 = x1 - dx * 0.4;
        const controlY2 = y1;
        
        return `
          M ${x0},${y0}
          C ${controlX1},${controlY1} ${controlX2},${controlY2} ${x1},${y1}
        `;
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
    
    // Last: Draw cashflow link
    if (isPositiveCashflow) {
      const cashflowLinks = sankeyData.links.filter(link => 
        sankeyData.nodes[link.source].id === 'income' && 
        sankeyData.nodes[link.target].id === 'cashflow'
      );
      
      svg.append("g")
        .selectAll(".cashflow-link")
        .data(cashflowLinks)
        .join("path")
        .attr("class", "cashflow-link")
        .attr("d", (d: SankeyLink) => {
          const x0 = d.sourceX;
          const y0 = d.sourceY;
          const x1 = d.targetX;
          const y1 = d.targetY;
          
          const dx = x1 - x0;
          
          // Control points for a nice curve
          const controlX1 = x0 + dx * 0.4;
          const controlY1 = y0; 
          const controlX2 = x1 - dx * 0.4;
          const controlY2 = y1;
          
          return `
            M ${x0},${y0}
            C ${controlX1},${controlY1} ${controlX2},${controlY2} ${x1},${y1}
          `;
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
    }
    
    // STEP 4: Draw node rectangles
    const nodeGroups = svg.append("g")
      .selectAll("g")
      .data(sankeyData.nodes)
      .join("g")
      .attr("transform", (d: SankeyNode) => `translate(${d.x},${d.y})`);
    
    // Add rectangles for nodes
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
    
  }, [dataNodes, links, getNodeColor, isPositiveCashflow, totalIncome, totalExpenses, cashflow, formatCurrency]);

  return (
    <Paper sx={{ p: 3, borderRadius: 2, mb: 3 }}>
      <Typography variant="h5" mb={2}>
        Cashflow Breakdown
      </Typography>
      <Box sx={{ width: '100%', height: 400, position: 'relative' }}>
        <svg ref={svgRef} width="100%" height="100%" />
      </Box>
    </Paper>
  );
};

export default CashflowSankeyChart; 