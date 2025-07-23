// knowledge/src/education/index.js
import { getLogger } from '@daitanjs/development';

const educationLogger = getLogger('daitan-knowledge-education');

educationLogger.info(
  'Education levels data module loaded. Contains static data for education levels.'
);

// Review of the data structure for educationLevels:
// - The structure is an array of objects.
// - Each object has a 'value' (likely for internal use, e.g., storing in a DB) and a 'label' (for display).
// - Values are snake_case strings, labels are human-readable.
// - Includes a "Select Level..." option, which is good for dropdowns.
// - Covers a reasonable range of common education levels.
// - 'other' and 'prefer_not_to_say' are good for inclusivity.

// The data seems sound and well-structured for its purpose.
// No dynamic code to refactor here.

export const educationLevels = [
    { value: '', label: 'Select Level...' },
    { value: 'primary_school', label: 'Primary School' },
    { value: 'middle_school', label: 'Middle School' },
    { value: 'high_school', label: 'High School / Secondary School' },
    { value: 'vocational_training', label: 'Vocational Training / Apprenticeship' },
    { value: 'some_college', label: 'Some College (No Degree)' },
    { value: 'associates_degree', label: "Associate's Degree" },
    { value: 'bachelors_degree', label: "Bachelor's Degree" },
    { value: 'masters_degree', label: "Master's Degree" },
    { value: 'doctorate', label: 'Doctorate (PhD, EdD, etc.)' },
    { value: 'professional_degree', label: 'Professional Degree (MD, JD, etc.)' },
    { value: 'other', label: 'Other' },
    { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];