const templates = new Map();

export const replacePlaceholders = ({ template, replacements }) => {
  if (!template || typeof template !== "string") {
    throw new Error("Invalid template string provided to replacePlaceholders");
  }
  return template.replace(/{{(\w+)}}/g, (match, placeholder) => 
    replacements[placeholder] ?? match
  );
};

export const createTemplate = (name, template) => {
  if (!name || typeof name !== "string") {
    throw new Error("Invalid template name provided to createTemplate");
  }
  if (!template || typeof template !== "object") {
    throw new Error("Invalid template object provided to createTemplate");
  }
  templates.set(name, template);
};

export const composeEmail = ({
  templateName,
  language,
  replacements = {},
  attachments = [],
  to,
  cc,
  bcc,
  includeSections
}) => {
  try {
    const template = templates.get(templateName);
    if (!template) {
      throw new Error(`Template '${templateName}' not found`);
    }

    if (!Array.isArray(to) || to.length === 0) {
      throw new Error("Missing required 'to' field in composeEmail");
    }

    if (!template.subjectTemplate?.[language]) {
      throw new Error(`Missing subject template for language: ${language}`);
    }

    if (!template.bodySections?.[language]) {
      throw new Error(`Missing body sections for language: ${language}`);
    }

    const mergedReplacements = { ...template.placeholders, ...replacements };

    const subject = replacePlaceholders({
      template: template.subjectTemplate[language],
      replacements: mergedReplacements
    });

    let bodySections = template.bodySections[language];
    if (includeSections) {
      bodySections = bodySections.filter((_, index) => includeSections.includes(index));
    }

    const html = bodySections
      .map(section => replacePlaceholders({
        template: section,
        replacements: mergedReplacements
      }))
      .join(template.isHTML ? "<br>" : "\n\n");

    if (!subject || !html) {
      throw new Error("Generated email is missing required fields: subject or html");
    }

    return { subject, html, attachments, to, cc, bcc };

  } catch (err) {
    console.error("❌ Error in composeEmail:", err.message);
    throw err;
  }
};

export const createAttachment = (filename, content, contentType) => {
  if (!filename || !content || !contentType) {
    throw new Error("Missing fields in createAttachment");
  }
  return { filename, content, contentType };
};

export const previewEmail = (email) => {
  try {
    if (!email || typeof email !== "object") throw new Error("Invalid email object for previewEmail");

    return `
To: ${email.to?.join(', ') || 'N/A'}
${email.cc ? `CC: ${email.cc.join(', ')}\n` : ''}${email.bcc ? `BCC: ${email.bcc.join(', ')}\n` : ''}
Subject: ${email.subject || 'N/A'}

${email.html || 'No body content'}

Attachments: ${email.attachments?.map(a => a.filename).join(', ') || 'None'}
    `;
  } catch (err) {
    console.error("❌ Error in previewEmail:", err.message);
    return "⚠ Unable to generate email preview.";
  }
};
