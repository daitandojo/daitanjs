// Utility function for merging default styles with custom styles
const mergeStyles = (
  defaultStyles, 
  customStyles
) => {
  return Object.entries(customStyles).reduce((acc, [key, value]) => {
    return acc + `${key}:${value};`;
  }, defaultStyles);
};

/**
 * Creates a heading element.
 * @param {string} text - The heading text.
 * @param {number} [level=1] - The heading level (1-6).
 * @param {Object} [customStyles={}] - Custom CSS styles.
 * @returns {string} HTML string for the heading.
 */
export function createHeading({
  text, 
  level = 1, 
  customStyles = {}
}) {
  const defaultStyles = `font-family:'Helvetica Neue',Arial,sans-serif;color:#2C3E50;margin-bottom:20px;text-align:center;`;
  const styles = mergeStyles(defaultStyles, customStyles);
  return `<h${level} style="${styles}">${text}</h${level}>`;
}

/**
 * Creates a paragraph element.
 * @param {string} text - The paragraph text.
 * @param {number} [fontSize=16] - Font size in pixels.
 * @param {string} [color='#34495E'] - Text color.
 * @param {Object} [customStyles={}] - Custom CSS styles.
 * @returns {string} HTML string for the paragraph.
 */
export function createParagraph({
  text, 
  fontSize = 16, 
  color = '#34495E', 
  customStyles = {}
}) {
  const defaultStyles = `font-family:'Helvetica Neue',Arial,sans-serif;font-size:${fontSize}px;color:${color};line-height:1.6;margin-bottom:15px;`;
  const styles = mergeStyles(defaultStyles, customStyles);
  return `<p style="${styles}">${text}</p>`;
}

/**
 * Creates a card container.
 * @param {string} content - The HTML content inside the card.
 * @param {Object} [customStyles={}] - Custom CSS styles.
 * @returns {string} HTML string for the card.
 */
export function createCard({
  content, 
  customStyles = {}
}) {
  const defaultStyles = `background-color:#FFFFFF;border-radius:8px;padding:20px;margin-bottom:20px;box-shadow:0 4px 6px rgba(0,0,0,0.1);`;
  const styles = mergeStyles(defaultStyles, customStyles);
  return `<div style="${styles}">${content}</div>`;
}

/**
 * Creates a block element.
 * @param {string} content - The HTML content inside the block.
 * @param {Object} [customStyles={}] - Custom CSS styles.
 * @returns {string} HTML string for the block.
 */
export function createBlock({
  content, 
  customStyles = {}
}) {
  const defaultStyles = `background-color:#F8F9FA;border-radius:8px;padding:15px;margin-bottom:20px;`;
  const styles = mergeStyles(defaultStyles, customStyles);
  return `<div style="${styles}">${content}</div>`;
}

/**
 * Creates a flex container.
 * @param {string} content - The HTML content inside the flex container.
 * @param {Object} [customStyles={}] - Custom CSS styles.
 * @returns {string} HTML string for the flex container.
 */
export function createFlexContainer({
  content, 
  customStyles = {}
}) {
  const defaultStyles = `display:flex;justify-content:space-between;flex-wrap:wrap;gap:15px;`;
  const styles = mergeStyles(defaultStyles, customStyles);
  return `<div style="${styles}">${content}</div>`;
}

/**
 * Creates a flex item.
 * @param {string} content - The HTML content inside the flex item.
 * @param {string} [flexBasis='100%'] - The flex-basis property.
 * @param {Object} [customStyles={}] - Custom CSS styles.
 * @returns {string} HTML string for the flex item.
 */
export function createFlexItem({
  content, 
  flexBasis = '100%', 
  customStyles = {}
}) {
  const defaultStyles = `flex-basis:${flexBasis};min-width:150px;`;
  const styles = mergeStyles(defaultStyles, customStyles);
  return `<div style="${styles}">${content}</div>`;
}

/**
 * Creates a button element.
 * @param {string} text - The button text.
 * @param {string} [href='#'] - The URL for the button link.
 * @param {Object} [customStyles={}] - Custom CSS styles.
 * @returns {string} HTML string for the button.
 */
export function createButton({
  text, 
  href = '#', 
  customStyles = {}
}) {
  const defaultStyles = `display:inline-block;padding:10px 20px;background-color:#3498DB;color:#FFFFFF;text-decoration:none;border-radius:5px;font-weight:bold;text-align:center;`;
  const styles = mergeStyles(defaultStyles, customStyles);
  return `<a href="${href}" style="${styles}">${text}</a>`;
}

/**
 * Creates an image element.
 * @param {string} src - The image source URL.
 * @param {string} alt - The alternative text for the image.
 * @param {Object} [customStyles={}] - Custom CSS styles.
 * @returns {string} HTML string for the image.
 */
export function createImage({
  src, 
  alt, 
  customStyles = {}
}) {
  const defaultStyles = `max-width:100%;height:auto;display:block;margin:0 auto;`;
  const styles = mergeStyles(defaultStyles, customStyles);
  return `<img src="${src}" alt="${alt}" style="${styles}">`;
}

/**
 * Creates a list (ordered or unordered).
 * @param {string[]} items - Array of list items.
 * @param {boolean} [ordered=false] - Whether the list should be ordered.
 * @param {Object} [customStyles={}] - Custom CSS styles.
 * @returns {string} HTML string for the list.
 */
export function createList({
  items, 
  ordered = false, 
  customStyles = {}
}) {
  const listType = ordered ? 'ol' : 'ul';
  const defaultStyles = `padding-left:20px;margin-bottom:15px;`;
  const styles = mergeStyles(defaultStyles, customStyles);
  const listItems = items.map(item => `<li>${item}</li>`).join('');
  return `<${listType} style="${styles}">${listItems}</${listType}>`;
}

/**
 * Creates a table element.
 * @param {string[][]} data - 2D array of table data.
 * @param {boolean} [hasHeader=true] - Whether the first row is a header.
 * @param {Object} [customStyles={}] - Custom CSS styles.
 * @returns {string} HTML string for the table.
 */
export function createTable({
  data, 
  hasHeader = true, 
  customStyles = {}
}) {
  const defaultStyles = `width:100%;border-collapse:collapse;margin-bottom:20px;`;
  const styles = mergeStyles(defaultStyles, customStyles);
  const rows = data.map((row, index) => {
    const cellType = (hasHeader && index === 0) ? 'th' : 'td';
    const cells = row.map(cell => `<${cellType} style="border:1px solid #ddd;padding:8px;">${cell}</${cellType}>`).join('');
    return `<tr>${cells}</tr>`;
  }).join('');
  return `<table style="${styles}">${rows}</table>`;
}

/**
 * Creates a form element.
 * @param {string} content - The HTML content inside the form.
 * @param {string} [action='#'] - The form action URL.
 * @param {string} [method='post'] - The form method.
 * @param {Object} [customStyles={}] - Custom CSS styles.
 * @returns {string} HTML string for the form.
 */
export function createForm({
  content, 
  action = '#', 
  method = 'post', 
  customStyles = {}
}) {
  const defaultStyles = `margin-bottom:20px;`;
  const styles = mergeStyles(defaultStyles, customStyles);
  return `<form action="${action}" method="${method}" style="${styles}">${content}</form>`;
}

/**
 * Creates an input element.
 * @param {string} type - The input type.
 * @param {string} name - The input name.
 * @param {string} [placeholder=''] - The input placeholder.
 * @param {Object} [customStyles={}] - Custom CSS styles.
 * @returns {string} HTML string for the input.
 */
export function createInput({
  type, 
  name, 
  placeholder = '', 
  customStyles = {}
}) {
  const defaultStyles = `width:100%;padding:8px;margin-bottom:10px;border:1px solid #ddd;border-radius:4px;`;
  const styles = mergeStyles(defaultStyles, customStyles);
  return `<input type="${type}" name="${name}" placeholder="${placeholder}" style="${styles}">`;
}

/**
 * Creates a label element.
 * @param {string} text - The label text.
 * @param {string} forAttribute - The 'for' attribute value.
 * @param {Object} [customStyles={}] - Custom CSS styles.
 * @returns {string} HTML string for the label.
 */
export function createLabel({
  text, 
  forAttribute, 
  customStyles = {}
}) {
  const defaultStyles = `display:block;margin-bottom:5px;font-weight:bold;`;
  const styles = mergeStyles(defaultStyles, customStyles);
  return `<label for="${forAttribute}" style="${styles}">${text}</label>`;
}

/**
 * Creates a divider element.
 * @param {Object} [customStyles={}] - Cust{om CSS styles.
 * @returns {string} HTML string for the divider.
 */
export function createDivider({
  customStyles = {}
}) {
  const defaultStyles = `border:0;border-top:1px solid #eee;margin:20px 0;`;
  const styles = mergeStyles(defaultStyles, customStyles);
  return `<hr style="${styles}">`;
}

/**
 * Creates a badge element.
 * @param {string} text - The badge text.
 * @param {Object} [customStyles={}] - Custom CSS styles.
 * @returns {string} HTML string for the badge.
 */
export function createBadge({
  text, 
  customStyles = {}
}) {
  const defaultStyles = `display:inline-block;padding:3px 7px;font-size:12px;font-weight:bold;line-height:1;color:#fff;background-color:#6c757d;border-radius:10px;`;
  const styles = mergeStyles(defaultStyles, customStyles);
  return `<span style="${styles}">${text}</span>`;
}

/**
 * Creates an alert element.
 * @param {string} message - The alert message.
 * @param {string} [type='info'] - The alert type (info, success, warning, error).
 * @param {Object} [customStyles={}] - Custom CSS styles.
 * @returns {string} HTML string for the alert.
 */
export function createAlert({
  message, 
  type = 'info', 
  customStyles = {}
}) {
  const colors = {
    info: '#17a2b8',
    success: '#28a745',
    warning: '#ffc107',
    error: '#dc3545'
  };
  const defaultStyles = `padding:15px;margin-bottom:20px;border:1px solid ${colors[type]};border-radius:4px;color:${colors[type]};background-color:${colors[type]}22;`;
  const styles = mergeStyles(defaultStyles, customStyles);
  return `<div style="${styles}" role="alert">${message}</div>`;
}

/**
 * Creates a table row element.
 * @param {string[]} cells - Array of cell values.
 * @param {Object} [customStyles={}] - Custom CSS styles for the row.
 * @returns {string} HTML string for the table row.
 */
export function createTableRow(cells, customStyles = {}) {
  const defaultStyles = `border:1px solid #ddd;padding:8px;`;
  const styles = mergeStyles(defaultStyles, customStyles);

  const cellElements = cells.map(cell => createTableCell(cell)).join('');
  return `<tr style="${styles}">${cellElements}</tr>`;
}

/**
 * Creates a table cell element.
 * @param {string} content - The content inside the table cell.
 * @param {boolean} [isHeader=false] - Whether the cell is a header cell.
 * @param {Object} [customStyles={}] - Custom CSS styles for the cell.
 * @returns {string} HTML string for the table cell.
 */
export function createTableCell(content, isHeader = false, customStyles = {}) {
  const cellType = isHeader ? 'th' : 'td';
  const defaultStyles = `border:1px solid #ddd;padding:8px;text-align:left;`;
  const styles = mergeStyles(defaultStyles, customStyles);

  return `<${cellType} style="${styles}">${content}</${cellType}>`;
}
