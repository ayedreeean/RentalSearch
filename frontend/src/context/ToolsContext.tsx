import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';

// Define the shape of the tool data if needed
interface Tool {
  id: string;
  name: string;
  // Add other relevant properties for a tool
}

// Define the shape of the context data
interface ToolsContextProps {
  tools: Tool[];
  addTool: (tool: Tool) => void;
  removeTool: (toolId: string) => void;
  updateTool: (toolId: string, updatedTool: Partial<Tool>) => void;
  // Potentially add functions to load/save tools, etc.
}

// Create the context with a default value
const ToolsContext = createContext<ToolsContextProps | undefined>(undefined);

// Default state for tools (can be loaded from storage or API)
const defaultTools: Tool[] = [];

// Local storage key (optional, if you want persistence)
const TOOLS_STORAGE_KEY = 'rentToolFinder_tools';

// Create the Provider component
interface ToolsProviderProps {
  children: ReactNode;
}

export const ToolsProvider: React.FC<ToolsProviderProps> = ({ children }) => {
  const [tools, setTools] = useState<Tool[]>(() => {
    // Example: Load from local storage or use defaults
    const storedTools = localStorage.getItem(TOOLS_STORAGE_KEY);
    if (storedTools) {
      try {
        return JSON.parse(storedTools);
      } catch (e) {
        console.error("Failed to parse tools from localStorage", e);
        return defaultTools;
      }
    }
    return defaultTools;
  });

  // Example: Save tools to local storage whenever they change
  useEffect(() => {
    localStorage.setItem(TOOLS_STORAGE_KEY, JSON.stringify(tools));
  }, [tools]);

  // Function to add a new tool
  const addTool = (newTool: Tool) => {
    // Basic implementation: add tool with a unique ID if needed
    // You might want to generate IDs more robustly
    const toolWithId = { ...newTool, id: newTool.id || `tool-${Date.now()}` };
    setTools(prevTools => [...prevTools, toolWithId]);
  };

  // Function to remove a tool
  const removeTool = (toolId: string) => {
    setTools(prevTools => prevTools.filter(tool => tool.id !== toolId));
  };

  // Function to update an existing tool
  const updateTool = (toolId: string, updatedToolData: Partial<Tool>) => {
    setTools(prevTools =>
      prevTools.map(tool =>
        tool.id === toolId ? { ...tool, ...updatedToolData } : tool
      )
    );
  };

  return (
    <ToolsContext.Provider value={{ tools, addTool, removeTool, updateTool }}>
      {children}
    </ToolsContext.Provider>
  );
};

// Custom hook to use the Tools context
export const useTools = (): ToolsContextProps => {
  const context = useContext(ToolsContext);
  if (context === undefined) {
    throw new Error('useTools must be used within a ToolsProvider');
  }
  return context;
}; 