import { 
  createTemplate, 
  composeEmail, 
  createAttachment, 
  previewEmail 
} from '../composer/EmailComposer.js';

// Create a template
createTemplate('securityCode', {
    subjectTemplate: {
        en: `✨ Your Haelpers security code: {{token}}`,
        es: `✨ Tu código de seguridad de Haelpers: {{token}}`,
        // ... other languages ...
    },
    bodySections: {
        en: [
            'Hello {{firstname}}',
            'Your security code is: {{token}}',
            'Click here to verify: {{link}}',
            'Best regards,\nThe {{team}} Team'
        ],
        es: [
            'Hola {{firstname}}',
            'Tu código de seguridad es: {{token}}',
            'Haz clic aquí para verificar: {{link}}',
            'Saludos cordiales,\nEl equipo de {{team}}'
        ],
        // ... other languages ...
    },
    placeholders: {
        team: 'Haelpers'
    },
    isHTML: false
});

// Compose an email
const email = composeEmail({
    templateName: 'securityCode',
    language: 'en',
    replacements: {
        firstname: 'John',
        token: '123456',
        link: 'https://example.com/verify'
    },
    to: ['john@example.com'],
    cc: ['support@haelpers.com'],
    includeSections: [0, 1, 2], // Exclude the footer
    attachments: [createAttachment('terms.pdf', 'PDF content', 'application/pdf')]
});

// Preview the email
console.log(previewEmail(email));