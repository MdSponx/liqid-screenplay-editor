import jsPDF from 'jspdf';
import { Block } from '../types';
import { 
  FONT_SIZE, 
  LINE_HEIGHT, 
  MARGIN_TOP, 
  MARGIN_LEFT, 
  MARGIN_RIGHT, 
  CONTENT_WIDTH,
  PAGE_HEIGHT,
  getLayoutForBlockType
} from './pdfLayout';
import { 
  containsThaiText, 
  normalizeThaiText, 
  setFontForText,
  setupThaiSupport,
  processTextForPDF,
  splitThaiTextToSize,
  renderThaiTextAsImage
} from './thai-pdf-support-fixed';

/**
 * Transforms text according to block type requirements
 * @param text The text to transform
 * @param blockType The type of block
 * @returns Transformed text
 */
const transformText = (text: string, blockType: string): string => {
  const layout = getLayoutForBlockType(blockType);
  
  // Process text for better PDF rendering
  let processedText = processTextForPDF(text);
  
  if ((layout as any).textTransform === 'uppercase') {
    processedText = processedText.toUpperCase();
  }
  
  return processedText;
};

/**
 * Calculates the height a block will occupy in the PDF
 * @param text The text content
 * @param blockType The type of block
 * @param pdf The jsPDF instance
 * @returns The height in points
 */
const calculateBlockHeight = (text: string, blockType: string, pdf: any): number => {
  const layout = getLayoutForBlockType(blockType) as any;
  
  // Transform text if needed
  const transformedText = transformText(text, blockType);
  
  // Set font based on block type
  setFontForText(pdf, transformedText, layout.fontStyle === 'bold' ? 'bold' : 'normal');
  
  // Calculate available width for text
  const availableWidth = layout.maxWidth;
  
  // Use improved Thai text splitting
  const lines = containsThaiText(transformedText) 
    ? splitThaiTextToSize(pdf, transformedText, availableWidth)
    : pdf.splitTextToSize(transformedText, availableWidth);
  
  // Calculate total height
  const textHeight = lines.length * LINE_HEIGHT;
  const totalHeight = textHeight + (layout.spaceBefore || 0) + (layout.spaceAfter || 0);
  
  return totalHeight;
};

/**
 * Draws a block of text in the PDF with enhanced Thai support
 * @param text The text content
 * @param blockType The type of block
 * @param y The current Y position
 * @param pdf The jsPDF instance
 * @param sceneNumber Optional scene number for scene headings
 * @param dialogueNumber Optional dialogue number for dialogue blocks
 * @returns The new Y position after drawing
 */
const drawBlock = async (
  text: string, 
  blockType: string, 
  y: number, 
  pdf: any,
  sceneNumber?: number,
  dialogueNumber?: number
): Promise<number> => {
  const layout = getLayoutForBlockType(blockType) as any;
  
  // Apply space before
  y += layout.spaceBefore || 0;
  
  // Transform text if needed
  let transformedText = transformText(text, blockType);
  
  // Add scene number for scene headings
  if (blockType === 'scene-heading' && sceneNumber !== undefined) {
    transformedText = `${sceneNumber}. ${transformedText}`;
  }
  
  // Set appropriate font for the text content
  setFontForText(pdf, transformedText, layout.fontStyle === 'bold' ? 'bold' : 'normal');
  
  // Calculate x position based on indent and alignment
  let x = MARGIN_LEFT + (layout.indent || 0);
  
  // Calculate available width for text
  const availableWidth = layout.maxWidth;
  
  // Use improved Thai text splitting
  const lines = containsThaiText(transformedText) 
    ? splitThaiTextToSize(pdf, transformedText, availableWidth)
    : pdf.splitTextToSize(transformedText, availableWidth);
  
  // Draw each line
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Handle right alignment for transitions
    if (layout.alignment === 'right') {
      const lineWidth = pdf.getTextWidth(line);
      x = MARGIN_LEFT + CONTENT_WIDTH - lineWidth;
    }
    
    // Check if we should render Thai text as image for better quality
    if (containsThaiText(line)) {
      try {
        // Try rendering as image for better Thai text quality
        await renderThaiTextAsImage(pdf, line, x, y, {
          fontSize: pdf.getFontSize(),
          fontWeight: layout.fontStyle === 'bold' ? 'bold' : 'normal'
        });
      } catch (error) {
        // Fallback to regular text rendering
        console.warn('Failed to render Thai text as image, using fallback:', error);
        pdf.text(line, x, y);
      }
    } else {
      // Regular text rendering for non-Thai text
      pdf.text(line, x, y);
    }
    
    // Add dialogue number to the last line of dialogue
    if (blockType === 'dialogue' && dialogueNumber !== undefined && i === lines.length - 1) {
      const numberText = `${dialogueNumber}`;
      const numberWidth = pdf.getTextWidth(numberText);
      const rightMarginX = MARGIN_LEFT + CONTENT_WIDTH;
      pdf.text(numberText, rightMarginX - numberWidth, y);
    }
    
    // Move to next line
    y += LINE_HEIGHT;
  }
  
  // Apply space after
  y += layout.spaceAfter || 0;
  
  return y;
};

/**
 * Creates a title page for the screenplay with Thai support
 * @param title The screenplay title
 * @param author The screenplay author
 * @param contact Contact information
 * @param pdf The jsPDF instance
 */
const createTitlePage = async (
  title: string,
  author: string,
  contact: string,
  pdf: any
): Promise<void> => {
  // Title (centered, about 1/3 down the page)
  const titleText = normalizeThaiText(title.toUpperCase());
  setFontForText(pdf, titleText, 'bold');
  const titleY = PAGE_HEIGHT / 3;
  const titleWidth = pdf.getTextWidth(titleText);
  const titleX = (pdf.internal.pageSize.width - titleWidth) / 2;
  
  if (containsThaiText(titleText)) {
    await renderThaiTextAsImage(pdf, titleText, titleX, titleY, {
      fontSize: pdf.getFontSize(),
      fontWeight: 'bold'
    });
  } else {
    pdf.text(titleText, titleX, titleY);
  }
  
  // "Written by" text (centered, about 1/2 down the page)
  const writtenByText = 'Written by';
  setFontForText(pdf, writtenByText, 'normal');
  const writtenByY = PAGE_HEIGHT / 2;
  const writtenByWidth = pdf.getTextWidth(writtenByText);
  const writtenByX = (pdf.internal.pageSize.width - writtenByWidth) / 2;
  pdf.text(writtenByText, writtenByX, writtenByY);
  
  // Author name (centered, below "Written by")
  const authorText = normalizeThaiText(author);
  setFontForText(pdf, authorText, 'normal');
  const authorY = writtenByY + LINE_HEIGHT * 2;
  const authorWidth = pdf.getTextWidth(authorText);
  const authorX = (pdf.internal.pageSize.width - authorWidth) / 2;
  
  if (containsThaiText(authorText)) {
    await renderThaiTextAsImage(pdf, authorText, authorX, authorY, {
      fontSize: pdf.getFontSize(),
      fontWeight: 'normal'
    });
  } else {
    pdf.text(authorText, authorX, authorY);
  }
  
  // Contact information (bottom right)
  if (contact) {
    const contactText = normalizeThaiText(contact);
    setFontForText(pdf, contactText, 'normal');
    const contactY = PAGE_HEIGHT - MARGIN_TOP;
    const contactWidth = pdf.getTextWidth(contactText);
    const contactX = pdf.internal.pageSize.width - MARGIN_RIGHT - contactWidth;
    
    if (containsThaiText(contactText)) {
      await renderThaiTextAsImage(pdf, contactText, contactX, contactY, {
        fontSize: pdf.getFontSize(),
        fontWeight: 'normal'
      });
    } else {
      pdf.text(contactText, contactX, contactY);
    }
  }
};

/**
 * Exports the screenplay to a PDF file with enhanced Thai support
 * @param blocks Array of screenplay blocks
 * @param title Screenplay title
 * @param author Screenplay author
 * @param contact Contact information
 */
export const exportToPDF = async (
  blocks: Block[],
  title: string = 'Untitled Screenplay',
  author: string = '',
  contact: string = ''
): Promise<void> => {
  try {
    // Show loading indicator
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]';
    loadingIndicator.innerHTML = `
      <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl flex flex-col items-center">
        <div class="w-12 h-12 border-4 border-[#E86F2C] border-t-transparent rounded-full animate-spin mb-4"></div>
        <p class="text-[#1E4D3A] dark:text-white font-medium">Generating PDF with Thai Support...</p>
        <p class="text-[#577B92] dark:text-gray-400 text-sm mt-1">Processing Thai characters for optimal rendering.</p>
      </div>
    `;
    document.body.appendChild(loadingIndicator);
    
    // Initialize PDF document (US Letter size in portrait orientation)
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'letter'
    });
    
    // Setup Thai support for proper Thai text rendering
    try {
      await setupThaiSupport(pdf);
      console.log('Thai PDF support initialized successfully');
    } catch (error) {
      console.warn('Failed to setup Thai support, continuing with fallback fonts:', error);
    }
    
    // Add metadata
    pdf.setProperties({
      title: title,
      author: author,
      creator: 'LiQid Screenplay Writer - Thai Support Enhanced',
      subject: 'Screenplay',
      keywords: 'screenplay, script, movie, thai, ภาษาไทย'
    });
    
    // Create title page with Thai support
    await createTitlePage(title, author, contact, pdf);
    
    // Add a new page for the screenplay content
    pdf.addPage();
    
    // Initialize position and counters
    let y = MARGIN_TOP;
    let sceneCounter = 1;
    let dialogueCounter = 1;
    
    // Process each block
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      
      // Skip empty blocks
      if (!block.content.trim()) continue;
      
      // Calculate the height this block will occupy
      const blockHeight = calculateBlockHeight(block.content, block.type, pdf);
      
      // Check if we need a page break
      if (y + blockHeight > PAGE_HEIGHT - MARGIN_TOP) {
        pdf.addPage();
        y = MARGIN_TOP;
      }
      
      // Draw the block with appropriate numbering
      if (block.type === 'scene-heading') {
        y = await drawBlock(block.content, block.type, y, pdf, sceneCounter);
        sceneCounter++;
      } else if (block.type === 'dialogue') {
        y = await drawBlock(block.content, block.type, y, pdf, undefined, dialogueCounter);
        dialogueCounter++;
      } else {
        y = await drawBlock(block.content, block.type, y, pdf);
      }
    }
    
    // Save the PDF with the screenplay title
    const safeFilename = title.replace(/[^a-z0-9ก-๙]/gi, '_').toLowerCase() + '_thai_fixed.pdf';
    pdf.save(safeFilename);
    
    // Remove loading indicator
    document.body.removeChild(loadingIndicator);
    
    // Show success message
    console.log('PDF generated successfully with Thai support');
  } catch (error) {
    console.error('Error generating PDF:', error);
    
    // Remove loading indicator if it exists
    const loadingIndicator = document.querySelector('.fixed.inset-0.bg-black\\/50');
    if (loadingIndicator && loadingIndicator.parentNode) {
      loadingIndicator.parentNode.removeChild(loadingIndicator);
    }
    
    // Show error message
    alert('Failed to generate PDF. Please try again.');
  }
};

/**
 * Exports the screenplay content to a PDF file with improved formatting and Thai support
 * This version creates a more professional-looking PDF by processing each page separately
 * @param contentElement The HTML element containing the screenplay content
 * @param pages Array of page elements to be included in the PDF
 * @param title The title of the screenplay
 * @param author The author of the screenplay
 */
export const exportScreenplayToPDF = async (
  contentElement: HTMLElement | null,
  pages: HTMLElement[],
  title: string = 'Untitled Screenplay',
  author: string = 'Anonymous'
): Promise<void> => {
  if (!contentElement || !pages.length) {
    console.error('No content or pages provided for PDF export');
    return;
  }

  try {
    // Show loading indicator
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]';
    loadingIndicator.innerHTML = `
      <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl flex flex-col items-center">
        <div class="w-12 h-12 border-4 border-[#E86F2C] border-t-transparent rounded-full animate-spin mb-4"></div>
        <p class="text-[#1E4D3A] dark:text-white font-medium">Generating PDF with Thai Support...</p>
        <p class="text-[#577B92] dark:text-gray-400 text-sm mt-1">Processing screenplay with enhanced Thai rendering...</p>
      </div>
    `;
    document.body.appendChild(loadingIndicator);

    // Get screenplay blocks from the editor state
    const blocks = (window as any).screenplay?.state?.blocks;
    
    if (!blocks || !Array.isArray(blocks)) {
      throw new Error('Could not access screenplay blocks data');
    }
    
    // Get header information
    const header = (window as any).screenplay?.state?.header || {
      title: title || 'Untitled Screenplay',
      author: author || 'Anonymous',
      contact: ''
    };
    
    // Export using the enhanced Thai-supported PDF method
    await exportToPDF(
      blocks,
      header.title || title,
      header.author || author,
      header.contact || ''
    );
    
    // Remove loading indicator
    document.body.removeChild(loadingIndicator);
  } catch (error) {
    console.error('Error generating PDF:', error);
    
    // Remove loading indicator if it exists
    const loadingIndicator = document.querySelector('.fixed.inset-0.bg-black\\/50');
    if (loadingIndicator && loadingIndicator.parentNode) {
      loadingIndicator.parentNode.removeChild(loadingIndicator);
    }
    
    // Show error message
    alert('Failed to generate PDF. Please try again.');
  }
};
