// Global type definitions for the application

// Extend the Window interface to include screenplay-related properties
interface Window {
  screenplay?: {
    state?: any;
    exportToPDF?: () => void;
    exportToDocx?: () => void;
    [key: string]: any;
  };
}