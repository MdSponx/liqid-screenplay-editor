// Sarabun font for Thai language support in PDF export
// This is a minimal subset of the Sarabun font that includes Thai characters
// For production use, you should include the full font file

// Note: This is a placeholder implementation. In a real application, you would:
// 1. Download the actual Sarabun font from Google Fonts or Thai government sources
// 2. Convert it to base64 format
// 3. Include the full character set

// For now, we'll use a fallback approach with proper font registration
export const registerThaiFont = (pdf: any) => {
  // Register a custom font that supports Thai characters
  // This is a simplified approach - in production you'd use the actual font file
  
  try {
    // For now, we'll use the built-in fonts with proper encoding
    // and add Thai character support through proper text encoding
    pdf.addFont('THSarabunNew', 'normal');
    pdf.addFont('THSarabunNew-Bold', 'bold');
  } catch (error) {
    console.warn('Could not register Thai font, falling back to default font');
  }
};

// Function to ensure proper Thai text encoding
export const encodeThaiText = (text: string): string => {
  // Ensure proper Unicode encoding for Thai text
  try {
    // Normalize Thai text to ensure proper rendering
    return text.normalize('NFC');
  } catch (error) {
    console.warn('Text normalization failed, using original text');
    return text;
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
    return 'THSarabunNew';
  }
  return 'Courier';
};
