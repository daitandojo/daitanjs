const templates = new Map();

export const replacePlaceholders = ({ 
    template, 
    replacements 
}) => {
    return template.replace(/{{(\w+)}}/g, (match, placeholder) => 
        replacements[placeholder] || match
    );
};

export const createTemplate = (name, template) => {
    templates.set(name, template);
};

export const composeEmail = ({ templateName, language, replacements, attachments = [], to, cc, bcc, includeSections }) => {
    const template = templates.get(templateName);
      if (!template) {
        throw new Error(`Template '${templateName}' not found`);
    }

    const mergedReplacements = { ...template.placeholders, ...replacements };

    const subject = replacePlaceholders({
        template: template.subjectTemplate[language], 
        placeholders: mergedReplacements
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
        .join(template.isHTML ? '<br>' : '\n\n');

    return { subject, html, attachments, to, cc, bcc };
};

export const createAttachment = (filename, content, contentType) => {
    return { filename, content, contentType };
};

export const previewEmail = (email) => {
    return `
        To: ${email.to.join(', ')}
        ${email.cc ? `CC: ${email.cc.join(', ')}\n` : ''}${email.bcc ? `BCC: ${email.bcc.join(', ')}\n` : ''}
        Subject: ${email.subject}

        ${email.html}

        Attachments: ${email.attachments.map(a => a.filename).join(', ')}
    `;
};