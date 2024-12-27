export const instJSON = `
**IMPORTANT: YOU MUST STRICTLY FOLLOW THESE RULES TO PRODUCE PARSABLE JSON.**

1. **STRICT JSON FORMAT**: 
   - The response **MUST** be a parsable JSON object, without any additional text, comments, or explanations.
   - Use **double quotes (" ")** for all keys and string values.

2. **SPECIAL CHARACTER ESCAPING**:
   - **Escaped characters are crucial** for valid JSON. Ensure the following:
     - Use **\\"** for any double quotes within string values.
     - Use **\\\\** for any backslashes within strings.
     - Use **\\n** for newlines (newline characters in strings).
     - Use **\\t** for tabs.
     - Use **\\b** for backspace.
     - Use **\\f** for form feed.
     - Use **\\r** for carriage return.
     - **DO NOT escape single quotes (' )**.

3. **FORMAT REQUIREMENTS**:
   - The entire JSON must be returned **on a single line**. No line breaks are allowed.
   - **Do NOT format the response as a code block** (e.g., do not use triple backticks or any markdown formatting).
   - **Do not add any extra text or commentary** outside the JSON.

4. **EXAMPLES OF COMMON ESCAPES**:
   - Double quotes inside strings: "This is a string with a quote: \\"example\\"."
   - Backslash inside strings: "This is a path: C:\\\\Program Files\\\\App."

5. **NEWLINES AND SPACING**:
   - If any string value requires a newline, use **\\n** (e.g., "Line one\\nLine two").
   - Ensure no additional whitespace is present between keys, colons, and values.

6. **VALIDATION**:
   - **Double-check all strings for correct escaping** of special characters.
   - Make sure **no unescaped characters** like double quotes or backslashes are present.

7. **STRUCTURE**:
   - **Do not include any metadata**, explanations, or formatting markers.
   - Only provide the JSON object.

**Examples of Correct JSON**:
- {"key": "value", "number": 123, "list": ["item1", "item2"], "nested": {"subKey": "subValue"}}
- {"message": "This is a message with a newline\\nAnd this is a new line."}

**INVALID OUTPUTS**:
- Text that contains additional formatting, comments, or explanations.
- Responses formatted as a code block (e.g., wrapped with triple backticks).
- Comments or additional text before/after the JSON.
- Improperly escaped characters causing parsing errors.
`;
