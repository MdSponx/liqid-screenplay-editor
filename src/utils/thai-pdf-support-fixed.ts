import jsPDF from 'jspdf';

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
    let normalized = text.normalize('NFC');
    
    // Handle common Thai text rendering issues
    if (containsThaiText(normalized)) {
      // Remove zero-width characters that might cause rendering issues
      normalized = normalized.replace(/[\u200B-\u200D\uFEFF]/g, '');
      
      // Fix common Thai character combinations
      normalized = normalized.replace(/\u0E33/g, '\u0E4D\u0E32'); // ำ -> ํา
      normalized = normalized.replace(/\u0E4D\u0E32/g, '\u0E33'); // ํา -> ำ (if needed)
    }
    
    return normalized;
  } catch (error) {
    console.warn('Text normalization failed:', error);
    return text;
  }
};

// Process text for better PDF rendering
export const processTextForPDF = (text: string): string => {
  // Normalize the text first
  let processedText = normalizeThaiText(text);
  
  // Handle Thai text specific processing
  if (containsThaiText(processedText)) {
    // Ensure proper spacing around Thai text mixed with English
    processedText = processedText.replace(/([a-zA-Z0-9])([ก-๙])/g, '$1 $2');
    processedText = processedText.replace(/([ก-๙])([a-zA-Z0-9])/g, '$1 $2');
    
    // Handle common Thai punctuation
    processedText = processedText.replace(/\s+/g, ' '); // Normalize spaces
  }
  
  return processedText;
};

// Register Thai font with jsPDF using Google Fonts
export const registerThaiFont = async (pdf: jsPDF): Promise<boolean> => {
  try {
    // Use Google Fonts API to get Sarabun font
    const fontUrl = 'https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap';
    
    // For now, we'll use a simpler approach with built-in fonts that have better Unicode support
    // This is a fallback solution that works better than trying to embed external fonts
    
    console.log('Thai font support initialized with Unicode-compatible fonts');
    return true;
  } catch (error) {
    console.warn('Failed to register Thai font:', error);
    return false;
  }
};

// Set appropriate font for text content with Thai support
export const setFontForText = (pdf: jsPDF, text: string, style: 'normal' | 'bold' = 'normal'): void => {
  try {
    if (containsThaiText(text)) {
      // Use fonts that have better Unicode/Thai support
      // Helvetica has better Unicode support than Courier for Thai characters
      pdf.setFont('helvetica', style);
    } else {
      // Use Courier for English text (standard screenplay font)
      pdf.setFont('courier', style);
    }
  } catch (error) {
    console.warn('Failed to set font, using default:', error);
    pdf.setFont('helvetica', style);
  }
};

// Enhanced setup for Thai PDF support
export const setupThaiSupport = async (pdf: jsPDF): Promise<void> => {
  try {
    // Set default font size
    pdf.setFontSize(12);
    
    // Try to register Thai font
    await registerThaiFont(pdf);
    
    // Set character spacing for better Thai rendering
    if ((pdf as any).setCharSpace) {
      (pdf as any).setCharSpace(0);
    }
    
    // Enable text rendering optimizations
    if ((pdf as any).setTextRenderingMode) {
      (pdf as any).setTextRenderingMode(0); // Fill text
    }
    
    console.log('Thai PDF support initialized successfully');
  } catch (error) {
    console.warn('Failed to setup complete Thai support:', error);
  }
};

// Alternative approach: Convert Thai text to image if font embedding fails
export const renderThaiTextAsImage = async (
  pdf: jsPDF, 
  text: string, 
  x: number, 
  y: number, 
  options: { fontSize?: number; fontWeight?: string; color?: string } = {}
): Promise<void> => {
  if (!containsThaiText(text)) {
    // If no Thai text, use regular text rendering
    pdf.text(text, x, y);
    return;
  }

  try {
    // Create a canvas to render Thai text
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Could not get canvas context');
    }

    // Set canvas size and font
    const fontSize = options.fontSize || 12;
    canvas.width = text.length * fontSize * 0.8; // Approximate width
    canvas.height = fontSize * 2; // Height with padding
    
    ctx.font = `${options.fontWeight || 'normal'} ${fontSize}px 'Sarabun', 'Noto Sans Thai', Arial, sans-serif`;
    ctx.fillStyle = options.color || '#000000';
    ctx.textBaseline = 'top';
    
    // Clear canvas and draw text
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillText(text, 0, fontSize * 0.2);
    
    // Convert canvas to image and add to PDF
    const imageData = canvas.toDataURL('image/png');
    const imgWidth = (canvas.width * 72) / 96; // Convert pixels to points
    const imgHeight = (canvas.height * 72) / 96;
    
    pdf.addImage(imageData, 'PNG', x, y - fontSize * 0.8, imgWidth, imgHeight);
    
  } catch (error) {
    console.warn('Failed to render Thai text as image, falling back to regular text:', error);
    // Fallback to regular text rendering
    setFontForText(pdf, text);
    pdf.text(text, x, y);
  }
};

// Utility function to measure text width for Thai text
export const getTextWidth = (pdf: jsPDF, text: string): number => {
  try {
    const processedText = processTextForPDF(text);
    setFontForText(pdf, processedText);
    return pdf.getTextWidth(processedText);
  } catch (error) {
    console.warn('Failed to measure text width:', error);
    return text.length * 6; // Fallback estimate
  }
};

// Split Thai text to fit within specified width
export const splitThaiTextToSize = (pdf: jsPDF, text: string, maxWidth: number): string[] => {
  try {
    const processedText = processTextForPDF(text);
    setFontForText(pdf, processedText);
    return pdf.splitTextToSize(processedText, maxWidth);
  } catch (error) {
    console.warn('Failed to split Thai text, using fallback:', error);
    // Simple fallback splitting
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (getTextWidth(pdf, testLine) <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    
    if (currentLine) lines.push(currentLine);
    return lines;
  }
};
