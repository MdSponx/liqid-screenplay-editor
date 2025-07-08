import { 
  Document, 
  Paragraph, 
  TextRun, 
  HeadingLevel, 
  AlignmentType, 
  Header, 
  Footer, 
  PageNumber, 
  PageNumberFormat, 
  Packer, 
  SectionType,
  TabStopPosition,
  TabStopType
} from 'docx';
import { saveAs } from 'file-saver';
import { Block } from '../types';
import { docxStyles, pageSetup, headerSetup } from './docxStyles';

/**
 * Generates DOCX paragraphs from screenplay blocks
 * @param blocks Array of screenplay blocks
 * @returns Array of DOCX paragraphs
 */
export const generateDocxParagraphs = (blocks: Block[]): Paragraph[] => {
  const paragraphs: Paragraph[] = [];
  
  // Initialize counters for scene and dialogue numbering
  let sceneCounter = 1;
  let dialogueCounter = 1;
  
  blocks.forEach(block => {
    // Skip empty blocks
    if (!block.content.trim()) return;
    
    let paragraph: Paragraph;
    
    switch (block.type) {
      case 'scene-heading':
        // Pre-compose paragraph configuration for scene heading
        const sceneHeadingParagraphConfig = {
          spacing: {
            before: docxStyles.sceneHeading.spacing.before,
            after: docxStyles.sceneHeading.spacing.after,
            line: docxStyles.default.spacing.line
          }
        };
        
        // Create paragraph with scene number on the left side
        paragraph = new Paragraph({
          ...sceneHeadingParagraphConfig,
          children: [
            // Left scene number
            new TextRun({
              text: `${sceneCounter}. `,
              bold: docxStyles.sceneHeading.bold,
              size: docxStyles.default.size,
              font: docxStyles.default.font
            }),
            // Scene heading text
            new TextRun({
              text: block.content.toUpperCase(),
              bold: docxStyles.sceneHeading.bold,
              size: docxStyles.default.size,
              font: docxStyles.default.font
            })
          ]
        });
        
        // Increment scene counter after adding the scene heading
        sceneCounter++;
        break;
        
      case 'action':
        const actionParagraphConfig = {
          spacing: {
            before: docxStyles.action.spacing.before,
            after: docxStyles.action.spacing.after,
            line: docxStyles.default.spacing.line
          }
        };
        
        const actionRunConfig = {
          text: block.content,
          size: docxStyles.default.size,
          font: docxStyles.default.font
        };
        
        paragraph = new Paragraph({
          ...actionParagraphConfig,
          children: [new TextRun(actionRunConfig)]
        });
        break;
        
      case 'character':
        const characterParagraphConfig = {
          spacing: {
            before: docxStyles.character.spacing.before,
            after: docxStyles.character.spacing.after,
            line: docxStyles.default.spacing.line
          },
          indent: {
            left: docxStyles.character.indent.left
          }
        };
        
        const characterRunConfig = {
          text: block.content.toUpperCase(),
          size: docxStyles.default.size,
          font: docxStyles.default.font
        };
        
        paragraph = new Paragraph({
          ...characterParagraphConfig,
          children: [new TextRun(characterRunConfig)]
        });
        break;
        
      case 'parenthetical':
        const parentheticalParagraphConfig = {
          spacing: {
            before: docxStyles.parenthetical.spacing.before,
            after: docxStyles.parenthetical.spacing.after,
            line: docxStyles.default.spacing.line
          },
          indent: {
            left: docxStyles.parenthetical.indent.left,
            right: docxStyles.parenthetical.indent.right
          }
        };
        
        const parentheticalRunConfig = {
          text: block.content,
          size: docxStyles.default.size,
          font: docxStyles.default.font
        };
        
        paragraph = new Paragraph({
          ...parentheticalParagraphConfig,
          children: [new TextRun(parentheticalRunConfig)]
        });
        break;
        
      case 'dialogue':
        // Pre-compose paragraph configuration for dialogue with right-aligned tab stop
        const dialogueParagraphConfig = {
          spacing: {
            before: docxStyles.dialogue.spacing.before,
            after: docxStyles.dialogue.spacing.after,
            line: docxStyles.default.spacing.line
          },
          indent: {
            left: docxStyles.dialogue.indent.left,
            right: docxStyles.dialogue.indent.right
          },
          tabStops: [
            {
              type: TabStopType.RIGHT,
              position: 9000 // Right margin position
            }
          ]
        };
        
        // Create paragraph with dialogue text and number on the right
        paragraph = new Paragraph({
          ...dialogueParagraphConfig,
          children: [
            // Dialogue text
            new TextRun({
              text: block.content,
              size: docxStyles.default.size,
              font: docxStyles.default.font
            }),
            // Tab to right margin
            new TextRun({
              text: "\t",
              size: docxStyles.default.size,
              font: docxStyles.default.font
            }),
            // Right-aligned dialogue number
            new TextRun({
              text: `${dialogueCounter}`,
              size: docxStyles.default.size,
              font: docxStyles.default.font
            })
          ]
        });
        
        // Increment dialogue counter after adding the dialogue
        dialogueCounter++;
        break;
        
      case 'transition':
        const transitionParagraphConfig = {
          spacing: {
            before: docxStyles.transition.spacing.before,
            after: docxStyles.transition.spacing.after,
            line: docxStyles.default.spacing.line
          },
          alignment: docxStyles.transition.alignment
        };
        
        const transitionRunConfig = {
          text: block.content.toUpperCase(),
          bold: docxStyles.transition.bold,
          size: docxStyles.default.size,
          font: docxStyles.default.font
        };
        
        paragraph = new Paragraph({
          ...transitionParagraphConfig,
          children: [new TextRun(transitionRunConfig)]
        });
        break;
        
      case 'shot':
        const shotParagraphConfig = {
          spacing: {
            before: docxStyles.shot.spacing.before,
            after: docxStyles.shot.spacing.after,
            line: docxStyles.default.spacing.line
          }
        };
        
        const shotRunConfig = {
          text: block.content.toUpperCase(),
          bold: docxStyles.shot.bold,
          size: docxStyles.default.size,
          font: docxStyles.default.font
        };
        
        paragraph = new Paragraph({
          ...shotParagraphConfig,
          children: [new TextRun(shotRunConfig)]
        });
        break;
        
      case 'text':
      default:
        const textParagraphConfig = {
          spacing: {
            before: docxStyles.text.spacing.before,
            after: docxStyles.text.spacing.after,
            line: docxStyles.default.spacing.line
          }
        };
        
        const textRunConfig = {
          text: block.content,
          size: docxStyles.default.size,
          font: docxStyles.default.font
        };
        
        paragraph = new Paragraph({
          ...textParagraphConfig,
          children: [new TextRun(textRunConfig)]
        });
        break;
    }
    
    paragraphs.push(paragraph);
  });
  
  return paragraphs;
};

/**
 * Creates a title page for the screenplay
 * @param title Screenplay title
 * @param author Screenplay author
 * @param contact Contact information
 * @returns Array of paragraphs for the title page
 */
export const createTitlePage = (
  title: string = 'Untitled Screenplay',
  author: string = '',
  contact: string = ''
): Paragraph[] => {
  const titlePageParagraphs: Paragraph[] = [];
  
  // Add empty space at the top (about 3 inches)
  for (let i = 0; i < 10; i++) {
    titlePageParagraphs.push(
      new Paragraph({
        text: '',
        spacing: {
          line: docxStyles.default.spacing.line
        }
      })
    );
  }
  
  // Add title (centered, all caps)
  titlePageParagraphs.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: {
        after: 240, // 12pt
        line: docxStyles.default.spacing.line
      },
      children: [
        new TextRun({
          text: title.toUpperCase(),
          bold: true,
          size: docxStyles.default.size,
          font: docxStyles.default.font
        })
      ]
    })
  );
  
  // Add "Written by" (centered)
  titlePageParagraphs.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: {
        before: 480, // 24pt
        line: docxStyles.default.spacing.line
      },
      children: [
        new TextRun({
          text: 'Written by',
          size: docxStyles.default.size,
          font: docxStyles.default.font
        })
      ]
    })
  );
  
  // Add author name (centered)
  titlePageParagraphs.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: {
        before: 120, // 6pt
        line: docxStyles.default.spacing.line
      },
      children: [
        new TextRun({
          text: author,
          size: docxStyles.default.size,
          font: docxStyles.default.font
        })
      ]
    })
  );
  
  // Add contact information at the bottom right
  if (contact) {
    // Add empty space
    for (let i = 0; i < 10; i++) {
      titlePageParagraphs.push(
        new Paragraph({
          text: '',
          spacing: {
            line: docxStyles.default.spacing.line
          }
        })
      );
    }
    
    titlePageParagraphs.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: {
          line: docxStyles.default.spacing.line
        },
        children: [
          new TextRun({
            text: contact,
            size: docxStyles.default.size,
            font: docxStyles.default.font
          })
        ]
      })
    );
  }
  
  return titlePageParagraphs;
};

/**
 * Exports the screenplay to a DOCX file
 * @param blocks Array of screenplay blocks
 * @param title Screenplay title
 * @param author Screenplay author
 * @param contact Contact information
 */
export const exportToDocx = async (
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
        <p class="text-[#1E4D3A] dark:text-white font-medium">Generating DOCX...</p>
        <p class="text-[#577B92] dark:text-gray-400 text-sm mt-1">This may take a moment for large screenplays.</p>
      </div>
    `;
    document.body.appendChild(loadingIndicator);
    
    // Generate title page
    const titlePageParagraphs = createTitlePage(title, author, contact);
    
    // Generate content paragraphs
    const contentParagraphs = generateDocxParagraphs(blocks);
    
    // Create document with title page and content sections
    const doc = new Document({
      sections: [
        // Title page section
        {
          properties: {
            type: SectionType.NEXT_PAGE,
            page: {
              margin: pageSetup.margins,
              size: pageSetup.pageSize
            }
          },
          children: titlePageParagraphs
        },
        // Content section with page numbers
        {
          properties: {
            type: SectionType.CONTINUOUS,
            page: {
              margin: pageSetup.margins,
              size: pageSetup.pageSize
            }
          },
          headers: {
            default: new Header({
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new TextRun({
                      children: [PageNumber.CURRENT],
                      font: headerSetup.default.font,
                      size: headerSetup.default.size
                    }),
                    new TextRun({
                      text: ".",
                      font: headerSetup.default.font,
                      size: headerSetup.default.size
                    })
                  ]
                })
              ]
            })
          },
          children: contentParagraphs
        }
      ]
    });
    
    // Generate blob from document
    const blob = await Packer.toBlob(doc);
    
    // Create a safe filename
    const safeFilename = title.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.docx';
    
    // Save the file
    saveAs(blob, safeFilename);
    
    // Remove loading indicator
    document.body.removeChild(loadingIndicator);
  } catch (error) {
    console.error('Error generating DOCX:', error);
    
    // Remove loading indicator if it exists
    const loadingIndicator = document.querySelector('.fixed.inset-0.bg-black\\/50');
    if (loadingIndicator && loadingIndicator.parentNode) {
      loadingIndicator.parentNode.removeChild(loadingIndicator);
    }
    
    // Show error message
    alert('Failed to generate DOCX. Please try again.');
  }
};