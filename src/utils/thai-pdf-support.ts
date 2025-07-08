// Simple Thai PDF support without external font loading
// This provides basic Thai text support for PDF export

// Check if text contains Thai characters
export const containsThaiText = (text: string): boolean => {
  // Thai Unicode range: U+0E00-U+0E7F
  const thaiRegex = /[\u0E00-\u0E7F]/;
  return thaiRegex.test(text);
};

// Normalize Thai text for better rendering
export const normalizeThaiText = (text: string): string => {
  try {
    // Normalize Unicode to ensure consistent character representation
    return text.normalize('NFC');
  } catch (error) {
    console.warn('Text normalization failed:', error);
    return text;
  }
};

// Set appropriate font for text content with fallback
export const setFontForText = (pdf: any, text: string, style: 'normal' | 'bold' = 'normal'): void => {
  try {
    if (containsThaiText(text)) {
      // Try to use a Thai-compatible font if available
      try {
        pdf.setFont('Sarabun', style);
      } catch {
        // Fallback to a font that might handle Thai better
        try {
          pdf.setFont('Arial', style);
        } catch {
          // Final fallback to default font
          pdf.setFont('helvetica', style);
        }
      }
    } else {
      // Use Courier for English text (standard screenplay font)
      pdf.setFont('Courier', style);
    }
  } catch (error) {
    console.warn('Failed to set font, using default:', error);
    pdf.setFont('helvetica', style);
  }
};

// Register basic Thai font support
export const setupThaiSupport = async (pdf: any): Promise<void> => {
  try {
    // Set font size for better Thai rendering
    pdf.setFontSize(12);
    
    // Enable Unicode support if available
    if (pdf.setCharSpace) {
      pdf.setCharSpace(0);
    }
    
    console.log('Basic Thai PDF support initialized');
  } catch (error) {
    console.warn('Failed to setup Thai support:', error);
  }
};

// Process text for better PDF rendering
export const processTextForPDF = (text: string): string => {
  // Normalize the text
  let processedText = normalizeThaiText(text);
  
  // Handle common Thai text issues
  if (containsThaiText(processedText)) {
    // Remove any problematic characters that might cause rendering issues
    processedText = processedText.replace(/[\u200B-\u200D\uFEFF]/g, ''); // Remove zero-width characters
    
    // Ensure proper spacing around Thai text
    processedText = processedText.replace(/([a-zA-Z0-9])([ก-๙])/g, '$1 $2');
    processedText = processedText.replace(/([ก-๙])([a-zA-Z0-9])/g, '$1 $2');
  }
  
  return processedText;
};
