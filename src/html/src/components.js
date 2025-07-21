// html/src/components.js
/**
 * @file A collection of functions to generate HTML component strings with customizable styles and attributes.
 * @module @daitanjs/html/components
 */
import { DaitanInvalidInputError } from '@daitanjs/error';
import { mergeStyles, buildAttributes } from './styles.js';

// --- Component Implementations ---

export function createHeading({
  text,
  level = 1,
  customStyles = {},
  ...otherAttrs
}) {
  if (!text) throw new DaitanInvalidInputError('Heading text is required.');
  const HeadingTag = `h${level}`;
  const defaultStyles =
    {
      1: 'font-size:32px; color:#1F2937; margin:0 0 15px 0;',
      2: 'font-size:26px; color:#1F2937; margin:0 0 12px 0;',
      3: 'font-size:22px; color:#374151; margin:0 0 10px 0;',
      4: 'font-size:18px; color:#4B5563; margin:0 0 8px 0;',
    }[level] || 'font-size:16px; color:#6B7280;';
  const styleString = mergeStyles(defaultStyles, customStyles);
  const attributes = buildAttributes({ style: styleString, ...otherAttrs });
  return `<${HeadingTag}${attributes}>${text}</${HeadingTag}>`;
}

export function createParagraph({
  text,
  fontSize = 16,
  color = '#34495E',
  customStyles = {},
  ...otherAttrs
}) {
  if (!text) throw new DaitanInvalidInputError('Paragraph text is required.');
  const defaultStyles = `font-size:${fontSize}px; color:${color}; line-height:1.6; margin:0 0 1em 0;`;
  const styleString = mergeStyles(defaultStyles, customStyles);
  const attributes = buildAttributes({ style: styleString, ...otherAttrs });
  return `<p${attributes}>${text}</p>`;
}

export function createLink({
  href,
  text,
  target = '_blank',
  customStyles = {},
  ...otherAttrs
}) {
  const defaultStyles = 'color:#3498DB; text-decoration:none;';
  const styleString = mergeStyles(defaultStyles, customStyles);
  const rel = target === '_blank' ? 'noopener noreferrer' : undefined;
  const attributes = buildAttributes({
    href,
    target,
    rel,
    style: styleString,
    ...otherAttrs,
  });
  return `<a${attributes}>${text}</a>`;
}

export function createImage({
  src,
  alt,
  width,
  height,
  customStyles = {},
  ...otherAttrs
}) {
  const defaultStyles = `max-width:100%; height:auto; display:block;`;
  const styleString = mergeStyles(defaultStyles, customStyles);
  const attributes = buildAttributes({
    src,
    alt,
    width,
    height,
    style: styleString,
    ...otherAttrs,
  });
  return `<img${attributes}>`;
}

export function createButton({
  text,
  href,
  as = 'link',
  type = 'button',
  customStyles = {},
  ...otherAttrs
}) {
  const defaultStyles = `display:inline-block; padding:10px 20px; font-size:16px; font-weight:bold; color:#ffffff; background-color:#3498DB; border:none; border-radius:5px; text-align:center; text-decoration:none; cursor:pointer;`;
  const styleString = mergeStyles(defaultStyles, customStyles);
  if (as === 'link') {
    const attributes = buildAttributes({
      href,
      role: 'button',
      style: styleString,
      ...otherAttrs,
    });
    return `<a${attributes}>${text}</a>`;
  } else {
    const attributes = buildAttributes({
      type: as === 'submit' ? 'submit' : 'button',
      style: styleString,
      ...otherAttrs,
    });
    return `<button${attributes}>${text}</button>`;
  }
}

export function createList({
  items,
  ordered = false,
  customStyles = {},
  ...otherAttrs
}) {
  const ListTag = ordered ? 'ol' : 'ul';
  const defaultStyles = `list-style-position:inside; padding-left:20px;`;
  const styleString = mergeStyles(defaultStyles, customStyles);
  const attributes = buildAttributes({ style: styleString, ...otherAttrs });
  const listItems = items
    .map((item) => `<li style="margin-bottom:5px;">${item}</li>`)
    .join('');
  return `<${ListTag}${attributes}>${listItems}</${ListTag}>`;
}

export function createCard({ content, customStyles = {}, ...otherAttrs }) {
  if (!content) throw new DaitanInvalidInputError('Card content is required.');
  const defaultStyles = `border:1px solid #e1e4e8; border-radius:6px; padding:16px; background-color:#ffffff; box-shadow:0 1px 3px rgba(0,0,0,0.05);`;
  const styleString = mergeStyles(defaultStyles, customStyles);
  const attributes = buildAttributes({ style: styleString, ...otherAttrs });
  return `<div${attributes}>${content}</div>`;
}

export function createBlock({ content, customStyles = {}, ...otherAttrs }) {
  const styleString = mergeStyles('', customStyles);
  const attributes = buildAttributes({ style: styleString, ...otherAttrs });
  return `<div${attributes}>${content}</div>`;
}

export function createFlexContainer({
  children = [],
  customStyles = {},
  ...otherAttrs
}) {
  const defaultStyles = `display:flex;`;
  const styleString = mergeStyles(defaultStyles, customStyles);
  const attributes = buildAttributes({ style: styleString, ...otherAttrs });
  return `<div${attributes}>${children.join('')}</div>`;
}

export function createFlexItem({ content, customStyles = {}, ...otherAttrs }) {
  const defaultStyles = `flex:1;`;
  const styleString = mergeStyles(defaultStyles, customStyles);
  const attributes = buildAttributes({ style: styleString, ...otherAttrs });
  return `<div${attributes}>${content}</div>`;
}

export function createForm({
  children = [],
  action = '#',
  method = 'POST',
  customStyles = {},
  ...otherAttrs
}) {
  const attributes = buildAttributes({
    action,
    method,
    style: mergeStyles('', customStyles),
    ...otherAttrs,
  });
  return `<form${attributes}>${children.join('')}</form>`;
}

export function createInput({
  type = 'text',
  name,
  value = '',
  placeholder = '',
  customStyles = {},
  ...otherAttrs
}) {
  const defaultStyles = `padding:8px 12px; border:1px solid #ccc; border-radius:4px; font-size:14px;`;
  const styleString = mergeStyles(defaultStyles, customStyles);
  const attributes = buildAttributes({
    type,
    name,
    value,
    placeholder,
    style: styleString,
    ...otherAttrs,
  });
  return `<input${attributes}>`;
}

export function createLabel({
  forInput,
  text,
  customStyles = {},
  ...otherAttrs
}) {
  const defaultStyles = `display:block; margin-bottom:5px; font-weight:bold;`;
  const styleString = mergeStyles(defaultStyles, customStyles);
  const attributes = buildAttributes({
    for: forInput,
    style: styleString,
    ...otherAttrs,
  });
  return `<label${attributes}>${text}</label>`;
}

export function createDivider({ customStyles = {}, ...otherAttrs }) {
  const defaultStyles = `border:0; border-top:1px solid #e1e4e8; margin:20px 0;`;
  const styleString = mergeStyles(defaultStyles, customStyles);
  const attributes = buildAttributes({ style: styleString, ...otherAttrs });
  return `<hr${attributes}>`;
}

export function createBadge({ text, customStyles = {}, ...otherAttrs }) {
  const defaultStyles = `display:inline-block; padding:4px 8px; font-size:12px; font-weight:bold; color:#ffffff; background-color:#0366d6; border-radius:20px;`;
  const styleString = mergeStyles(defaultStyles, customStyles);
  const attributes = buildAttributes({ style: styleString, ...otherAttrs });
  return `<span${attributes}>${text}</span>`;
}

export function createAlert({
  message,
  type = 'info',
  customStyles = {},
  ...otherAttrs
}) {
  const typeStyles = {
    info: 'color:#004085; background-color:#cce5ff; border-color:#b8daff;',
    success: 'color:#155724; background-color:#d4edda; border-color:#c3e6cb;',
    error: 'color:#721c24; background-color:#f8d7da; border-color:#f5c6cb;',
    warning: 'color:#856404; background-color:#fff3cd; border-color:#ffeeba;',
  };
  const defaultStyles = `padding:15px; margin-bottom:20px; border:1px solid transparent; border-radius:4px;`;
  const styleString = mergeStyles(
    `${defaultStyles} ${typeStyles[type] || typeStyles.info}`,
    customStyles
  );
  const attributes = buildAttributes({
    role: 'alert',
    style: styleString,
    ...otherAttrs,
  });
  return `<div${attributes}>${message}</div>`;
}

function createTableRowInternal(
  cellsData,
  cellType,
  defaultCellStylesObj,
  defaultRowStylesObj
) {
  const defaultBaseCellStyles = `padding:10px;border:1px solid #ddd;text-align:left;font-family:'Helvetica Neue',Arial,sans-serif;font-size:14px;line-height:1.5;`;
  const cellElements = cellsData
    .map((cellItem) => {
      let cellText;
      let cellCustomStyles = {};
      let cellOtherAttrs = {};

      if (typeof cellItem === 'string' || typeof cellItem === 'number') {
        cellText = String(cellItem ?? '');
      } else if (
        cellItem &&
        typeof cellItem === 'object' &&
        cellItem.text !== undefined
      ) {
        cellText = String(cellItem.text ?? '');
        cellCustomStyles = cellItem.customStyles || {};
        cellOtherAttrs = cellItem.otherAttrs || {};
      } else {
        cellText = String(cellItem ?? '');
      }

      const finalCellStylesString = mergeStyles(defaultBaseCellStyles, {
        ...defaultCellStylesObj,
        ...cellCustomStyles,
      });

      const cellAttributes = buildAttributes({
        style: finalCellStylesString,
        ...cellOtherAttrs,
      });
      return `<${cellType}${cellAttributes}>${cellText}</${cellType}>`;
    })
    .join('');

  const finalRowStyleString = mergeStyles('', defaultRowStylesObj);
  const rowAttributes = buildAttributes({ style: finalRowStyleString });
  return `<tr${rowAttributes}>${cellElements}</tr>`;
}

export function createTable({
  headers = [],
  rows = [],
  customStyles = {},
  headerRowStyles = {},
  headerCellStyles = {},
  bodyRowStyles = {},
  bodyCellStyles = {},
  caption = '',
  id = '',
  className = '',
  ...otherAttrs
}) {
  const defaultTableStyles = `width:100%;border-collapse:collapse;margin-bottom:20px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:14px;border:1px solid #ddd;`;
  const tableStyleString = mergeStyles(defaultTableStyles, customStyles);
  const attributes = buildAttributes({
    id,
    class: className,
    style: tableStyleString,
    ...otherAttrs,
  });

  let captionHtml = '';
  if (caption) {
    captionHtml = `<caption style="padding:10px;text-align:left;font-weight:bold;font-size:1.1em;border-bottom:1px solid #ddd;">${caption}</caption>`;
  }

  let headerHtml = '';
  if (Array.isArray(headers) && headers.length > 0) {
    const finalHeaderCellStyles = {
      backgroundColor: '#f2f2f2',
      fontWeight: 'bold',
      ...headerCellStyles,
    };
    headerHtml =
      '<thead>' +
      createTableRowInternal(
        headers,
        'th',
        finalHeaderCellStyles,
        headerRowStyles
      ) +
      '</thead>';
  }

  let bodyHtml = '';
  if (Array.isArray(rows) && rows.length > 0) {
    const bodyRowsHtml = rows
      .map((rowArray) => {
        if (!Array.isArray(rowArray)) return '';
        return createTableRowInternal(
          rowArray,
          'td',
          bodyCellStyles,
          bodyRowStyles
        );
      })
      .join('');
    bodyHtml = `<tbody>${bodyRowsHtml}</tbody>`;
  } else {
    const colspan = headers?.length || 1;
    bodyHtml = `<tbody><tr><td colspan="${colspan}" style="padding:10px;text-align:center;font-style:italic;">No data available.</td></tr></tbody>`;
  }

  return `<table${attributes}>${captionHtml}${headerHtml}${bodyHtml}</table>`;
}
