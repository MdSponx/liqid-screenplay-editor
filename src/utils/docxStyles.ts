import { 
  AlignmentType, 
  BorderStyle, 
  convertInchesToTwip, 
  HeadingLevel, 
  LevelFormat, 
  PageBorderDisplay, 
  PageNumberFormat, 
  TabStopPosition, 
  TabStopType 
} from 'docx';

// Standard screenplay margins in inches
const MARGINS = {
  top: 1,
  right: 1,
  bottom: 1,
  left: 1.5
};

// Convert inches to twips (1/20 of a point, 1/1440 of an inch)
const inchesToTwip = (inches: number) => convertInchesToTwip(inches);

// Standard screenplay indentation in twips
const INDENTATIONS = {
  // Character names are centered around 3.7 inches from left
  character: {
    left: inchesToTwip(2.9)
  },
  // Dialogue is indented 1 inch from left and 1.5 inches from right
  dialogue: {
    left: inchesToTwip(1),
    right: inchesToTwip(1.5)
  },
  // Parentheticals are indented 1.5 inches from left and 2 inches from right
  parenthetical: {
    left: inchesToTwip(1.5),
    right: inchesToTwip(2)
  },
  // Transitions are right-aligned
  transition: {
    alignment: AlignmentType.RIGHT
  }
};

// Define styles for each screenplay element type
export const docxStyles = {
  // Default style for all text
  default: {
    font: "Courier Prime",
    size: 24, // 12pt
    spacing: {
      line: 240, // Single spacing (24 * 10)
      before: 0,
      after: 0
    }
  },
  
  // Scene heading style
  sceneHeading: {
    allCaps: true,
    bold: true,
    spacing: {
      before: 240, // 12pt
      after: 0
    }
  },
  
  // Action style
  action: {
    spacing: {
      before: 120, // 6pt
      after: 120 // 6pt
    }
  },
  
  // Character style
  character: {
    allCaps: true,
    indent: INDENTATIONS.character,
    spacing: {
      before: 120, // 6pt
      after: 0
    }
  },
  
  // Parenthetical style
  parenthetical: {
    indent: INDENTATIONS.parenthetical,
    spacing: {
      before: 0,
      after: 0
    }
  },
  
  // Dialogue style
  dialogue: {
    indent: INDENTATIONS.dialogue,
    spacing: {
      before: 0,
      after: 120 // 6pt
    }
  },
  
  // Transition style
  transition: {
    allCaps: true,
    bold: true,
    alignment: AlignmentType.RIGHT,
    spacing: {
      before: 120, // 6pt
      after: 120 // 6pt
    }
  },
  
  // Shot style
  shot: {
    allCaps: true,
    bold: true,
    spacing: {
      before: 120, // 6pt
      after: 0
    }
  },
  
  // Text style (general text)
  text: {
    spacing: {
      before: 120, // 6pt
      after: 120 // 6pt
    }
  }
};

// Page setup for screenplay format
export const pageSetup = {
  margins: {
    top: inchesToTwip(MARGINS.top),
    right: inchesToTwip(MARGINS.right),
    bottom: inchesToTwip(MARGINS.bottom),
    left: inchesToTwip(MARGINS.left)
  },
  pageSize: {
    width: inchesToTwip(8.5),
    height: inchesToTwip(11)
  }
};

// Header setup for screenplay
export const headerSetup = {
  default: {
    size: 24, // 12pt
    font: "Courier Prime"
  }
};