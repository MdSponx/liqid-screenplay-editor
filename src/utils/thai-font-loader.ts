// Thai font loader for PDF export
// This module handles loading and embedding Thai fonts for proper PDF rendering

// Cache for loaded fonts
const fontCache = new Map<string, string>();

// Convert font file to base64
const fontToBase64 = async (url: string): Promise<string> => {
  if (fontCache.has(url)) {
    return fontCache.get(url)!;
  }

  try {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    fontCache.set(url, base64);
    return base64;
  } catch (error) {
    console.error('Failed to load font:', error);
    throw error;
  }
};

// Register Thai fonts with jsPDF
export const registerThaiFont = async (pdf: any): Promise<void> => {
  try {
    // Sarabun font URLs from Google Fonts
    const SARABUN_REGULAR_URL = 'https://fonts.gstatic.com/s/sarabun/v13/DtVhJx26TKEqsc-lWJNJ2QKBUwM.woff2';
    const SARABUN_BOLD_URL = 'https://fonts.gstatic.com/s/sarabun/v13/DtVjJx26TKEqsc-lWJNJ2QKBUwM.woff2';

    // Load Sarabun Regular
    const sarabunRegular = await fontToBase64(SARABUN_REGULAR_URL);
    pdf.addFileToVFS('Sarabun-Regular.ttf', sarabunRegular);
    pdf.addFont('Sarabun-Regular.ttf', 'Sarabun', 'normal');

    // Load Sarabun Bold
    const sarabunBold = await fontToBase64(SARABUN_BOLD_URL);
    pdf.addFileToVFS('Sarabun-Bold.ttf', sarabunBold);
    pdf.addFont('Sarabun-Bold.ttf', 'Sarabun', 'bold');

    console.log('Thai fonts registered successfully');
  } catch (error) {
    console.warn('Failed to register Thai fonts, falling back to default fonts:', error);
  }
};

// Check if text contains Thai characters
export const containsThaiText = (text: string): boolean => {
  // Thai Unicode range: U+0E00-U+0E7F
  const thaiRegex = /[\u0E00-\u0E7F]/;
  return thaiRegex.test(text);
};

// Get appropriate font family for text
export const getFontFamily = (text: string): string => {
  if (containsThaiText(text)) {
    return 'Sarabun';
  }
  return 'Courier';
};

// Normalize Thai text for proper rendering
export const normalizeThaiText = (text: string): string => {
  try {
    // Normalize Unicode to ensure consistent character representation
    return text.normalize('NFC');
  } catch (error) {
    console.warn('Text normalization failed:', error);
    return text;
  }
};

// Set appropriate font for text content
export const setFontForText = (pdf: any, text: string, style: 'normal' | 'bold' = 'normal'): void => {
  const fontFamily = getFontFamily(text);
  try {
    pdf.setFont(fontFamily, style);
  } catch (error) {
    console.warn(`Failed to set font ${fontFamily}, falling back to Courier:`, error);
    pdf.setFont('Courier', style);
  }
};
