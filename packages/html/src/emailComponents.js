// src/html/src/emailComponents.js
/**
 * @file HTML generation functions specifically tailored for email clients.
 * @module @daitanjs/html/emailComponents
 *
 * @description
 * This module provides functions to create HTML structures that are generally
 * well-supported across various email clients, which often have limited CSS support
 * compared to modern web browsers. Inline styles are heavily used.
 *
 * Security Note:
 * As with `html/src/components.js`, these functions DO NOT sanitize inputs.
 * Any dynamic content (text, URLs, style values) from untrusted sources
 * MUST be sanitized by the caller before use to prevent XSS.
 */

import {
  truncateString as truncateStringUtility,
  isValidURL as isValidURLUtility,
} from '@daitanjs/utilities';
import { getLogger } from '@daitanjs/development';
import {
  createHeading as createGenericHeading,
  createImage as createGenericImage,
  createParagraph as createGenericParagraph,
  createButton as createGenericButton,
  createCard as createGenericCard,
  createBlock as createGenericBlock,
} from './components.js';

const emailHtmlLogger = getLogger('daitan-html-email-components');

const mergeEmailStyles = (defaultStylesString, customStylesObject = {}) => {
  let finalStyles = defaultStylesString
    ? String(defaultStylesString).trim()
    : '';
  if (finalStyles && !finalStyles.endsWith(';')) {
    finalStyles += ';';
  }
  if (customStylesObject && typeof customStylesObject === 'object') {
    for (const [key, value] of Object.entries(customStylesObject)) {
      const cssKey = key.replace(
        /[A-Z]/g,
        (match) => `-${match.toLowerCase()}`
      );
      if (
        value !== undefined &&
        value !== null &&
        String(value).trim() !== ''
      ) {
        const stringValue = String(value);
        if (
          stringValue.includes('<script') ||
          stringValue.includes('javascript:') ||
          stringValue.includes('url(')
        ) {
          emailHtmlLogger.warn(
            `mergeEmailStyles: Potentially unsafe value for CSS property "${cssKey}". Skipping.`
          );
          continue;
        }
        finalStyles += `${cssKey}:${stringValue};`;
      }
    }
  }
  return finalStyles.trim();
};

/**
 * Creates a responsive and email-client-friendly HTML wrapper for email content.
 * @public
 */
export function createEmailWrapper({ bodyContent, config = {} }) {
  const conf = {
    title: 'Notification Email',
    language: 'en',
    previewText: '',
    backgroundColor: '#ECEFF1',
    contentBackgroundColor: '#FFFFFF',
    fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    maxWidth: '650px',
    linkColor: '#007BFF',
    contentBorderRadius: '8px',
    contentPadding: '25px 30px',
    ...config,
  };

  return `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html lang="${
    conf.language
  }" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${conf.title}</title>
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    table { border-collapse: collapse !important; }
    body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; font-family: ${
      conf.fontFamily
    }; background-color: ${conf.backgroundColor}; }
    a { color: ${conf.linkColor}; text-decoration: underline; }
    @media screen and (max-width: ${parseInt(conf.maxWidth, 10)}px) {
      .email-container { width: 100% !important; max-width: 100% !important; }
      .content-cell { padding: 20px 15px !important; border-radius: 0 !important; }
    }
  </style>
</head>
<body style="margin:0; padding:0; background-color:${conf.backgroundColor};">
  ${
    conf.previewText
      ? `<div style="display:none;font-size:1px;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;mso-hide:all;font-family:sans-serif;">${conf.previewText}</div>`
      : ''
  }
  <center>
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: ${
      conf.backgroundColor
    };">
      <tr>
        <td align="center" valign="top" style="padding: 20px 10px;">
          <!--[if (gte mso 9)|(IE)]>
          <table align="center" border="0" cellspacing="0" cellpadding="0" width="${parseInt(
            conf.maxWidth,
            10
          )}">
          <tr>
          <td align="center" valign="top" width="${parseInt(
            conf.maxWidth,
            10
          )}">
          <![endif]-->
          <table border="0" cellpadding="0" cellspacing="0" class="email-container" style="max-width: ${
            conf.maxWidth
          }; margin:0 auto;">
            <tr>
              <td align="center" valign="top" class="content-cell" style="background-color:${
                conf.contentBackgroundColor
              }; border-radius:${conf.contentBorderRadius}; padding:${
    conf.contentPadding
  }; border: 1px solid #DDDDDD;">
                ${bodyContent}
              </td>
            </tr>
          </table>
          <!--[if (gte mso 9)|(IE)]>
          </td>
          </tr>
          </table>
          <![endif]-->
        </td>
      </tr>
    </table>
  </center>
</body>
</html>`;
}

/**
 * Creates an HTML header section for an email.
 * @public
 */
export function createEmailHeader({
  logoUrl,
  logoAlt = 'Company Logo',
  logoWidth = '180',
  title,
  titleHeadingConfig = {},
  customStyles = {},
}) {
  let headerContent = '';
  if (logoUrl) {
    if (!isValidURLUtility(logoUrl)) {
      emailHtmlLogger.warn(
        `createEmailHeader: Invalid logoUrl provided: "${logoUrl}". Logo will not be rendered.`
      );
    } else {
      headerContent += `<div style="text-align:center; margin-bottom:25px;">${createGenericImage(
        {
          src: logoUrl,
          alt: logoAlt,
          width: String(logoWidth),
          customStyles: { margin: '0 auto', display: 'block' },
        }
      )}</div>`;
    }
  }

  if (title && typeof title === 'string') {
    const headingOptions = {
      text: title,
      level: 1,
      customStyles: {
        textAlign: 'center',
        color: '#333333',
        marginBottom: '20px',
      },
      ...titleHeadingConfig,
    };
    headerContent += createGenericHeading(headingOptions);
  }

  const defaultContainerStyles = `padding-bottom:20px; border-bottom:1px solid #DDDDDD; margin-bottom:25px;`;
  const finalContainerStyles = mergeEmailStyles(
    defaultContainerStyles,
    customStyles
  );

  return `<div style="${finalContainerStyles}">${headerContent}</div>`;
}

/**
 * Creates an HTML footer section for an email.
 * @public
 */
export function createEmailFooter({
  companyName = 'Your Company Name',
  address = '',
  unsubscribeUrl = '#',
  unsubscribeText = 'Unsubscribe',
  footerText = `© ${new Date().getFullYear()} ${companyName}. All rights reserved.`,
  customStyles = {},
  textStyles = {},
  linkStyles = {},
}) {
  const defaultContainerStyles = `text-align:center; padding-top:20px; border-top:1px solid #DDDDDD; margin-top:30px;`;
  const finalContainerStyles = mergeEmailStyles(
    defaultContainerStyles,
    customStyles
  );
  const defaultPStyles = `font-size:12px; color:#777777; line-height:1.5; margin:5px 0; font-family: Arial, sans-serif;`;
  const finalPStyles = mergeEmailStyles(defaultPStyles, textStyles);
  const defaultLinkStyles = `color:#555555; text-decoration:underline;`;
  const finalLinkStyles = mergeEmailStyles(defaultLinkStyles, linkStyles);

  let content = '';
  if (companyName) {
    content += `<p style="${finalPStyles}">${companyName}${
      address ? `<br>${address}` : ''
    }</p>`;
  }
  if (unsubscribeUrl && unsubscribeText) {
    content += `<p style="${finalPStyles}"><a href="${unsubscribeUrl}" target="_blank" style="${finalLinkStyles}">${unsubscribeText}</a></p>`;
  }
  if (footerText) {
    content += `<p style="${finalPStyles}">${footerText}</p>`;
  }

  return `<div style="${finalContainerStyles}">${content}</div>`;
}

/**
 * Creates an HTML structure for an article card, suitable for email.
 * @public
 */
export function createArticleCardForEmail({ article, config = {} }) {
  if (
    !article ||
    typeof article !== 'object' ||
    !article.link ||
    !article.headline
  ) {
    emailHtmlLogger.error(
      'createArticleCardForEmail: Invalid or missing article object or required fields (link, headline).'
    );
    return '<!-- Invalid Article Data -->';
  }

  const conf = {
    cardBackgroundColor: '#ffffff',
    cardBorderColor: '#eeeeee',
    cardBorderRadius: '5px',
    cardPadding: '20px',
    cardMarginBottom: '20px',
    headingColor: '#1a1a1a',
    paragraphColor: '#555555',
    metaTextColor: '#888888',
    assessmentBlockBgColor: '#f9f9f9',
    assessmentBlockBorderColor: '#e9e9e9',
    buttonColor: '#007BFF',
    buttonTextColor: '#ffffff',
    ...config,
  };

  const {
    link,
    headline,
    source = 'N/A',
    summary = 'No summary available.',
    imageUrl,
    imageAlt = headline || 'Article image',
    assessmentText = 'Assessment not provided.',
    relevanceScore = 'N/A',
    callToActionText = 'Read Full Article →',
  } = article;

  let imageHtml = '';
  if (imageUrl && isValidURLUtility(imageUrl)) {
    imageHtml = createGenericImage({
      src: imageUrl,
      alt: imageAlt,
      customStyles: {
        marginBottom: '15px',
        maxWidth: '100%',
        height: 'auto',
        borderRadius: '4px',
      },
    });
  }

  const contentHtml = `
    ${imageHtml}
    ${createGenericHeading({
      text: `<a href="${link}" target="_blank" style="color:${
        conf.headingColor
      };text-decoration:none;font-weight:bold;">${truncateStringUtility(
        headline,
        75
      )}</a>`,
      level: 3,
      customStyles: {
        color: conf.headingColor,
        textAlign: 'left',
        fontSize: '18px',
        lineHeight: '1.3',
        marginBottom: '8px',
        marginTop: '0',
      },
    })}
    ${createGenericParagraph({
      text: `<strong>Source:</strong> ${source}`,
      fontSize: 13,
      color: conf.metaTextColor,
      customStyles: { marginBottom: '10px', marginTop: '0' },
    })}
    ${createGenericParagraph({
      text: `<em>${truncateStringUtility(summary, 220)}</em>`,
      fontSize: 14,
      color: conf.paragraphColor,
      customStyles: { marginBottom: '15px', marginTop: '0' },
    })}
    ${createGenericBlock({
      content: createGenericParagraph({
        text: `<strong>Assessment:</strong> ${truncateStringUtility(
          assessmentText,
          150
        )} (Score: ${relevanceScore})`,
        fontSize: 13,
        color: conf.paragraphColor,
        customStyles: { margin: '0' },
      }),
      customStyles: {
        backgroundColor: conf.assessmentBlockBgColor,
        border: `1px solid ${conf.assessmentBlockBorderColor}`,
        padding: '10px',
        borderRadius: '4px',
        marginTop: '10px',
        marginBottom: '15px',
      },
    })}
    ${createGenericButton({
      text: callToActionText,
      href: link,
      target: '_blank',
      as: 'link',
      customStyles: {
        backgroundColor: conf.buttonColor,
        color: conf.buttonTextColor,
        fontSize: '14px',
        padding: '10px 15px',
        borderRadius: '4px',
        textDecoration: 'none',
      },
    })}
  `;

  return createGenericCard({
    content: contentHtml,
    customStyles: {
      backgroundColor: conf.cardBackgroundColor,
      border: `1px solid ${conf.cardBorderColor}`,
      borderRadius: conf.cardBorderRadius,
      padding: conf.cardPadding,
      marginBottom: conf.cardMarginBottom,
    },
  });
}
