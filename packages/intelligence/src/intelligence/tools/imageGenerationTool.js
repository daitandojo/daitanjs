// intelligence/src/intelligence/tools/imageGenerationTool.js
/**
 * @file A DaitanJS tool for generating images using DALL-E.
 * @module @daitanjs/intelligence/tools/imageGenerationTool
 *
 * @description
 * This module exports a LangChain-compatible tool that allows an AI agent to
 * generate images from a text prompt by wrapping the `generateImage` function
 * from the `@daitanjs/senses` package. It provides a structured interface
 * for the agent to specify the prompt, model, size, and other parameters.
 */

import { createDaitanTool } from '../core/toolFactory.js'; // CORRECTED: Import from the new 'core' location
import { z } from 'zod';
import { generateImage } from '@daitanjs/senses';

const ImageGenerationInputSchema = z
  .object({
    prompt: z
      .string()
      .min(1, 'A descriptive prompt is required.')
      .max(4000, 'The prompt for DALL-E 3 cannot exceed 4000 characters.'),
    outputPath: z
      .string()
      .optional()
      .describe(
        "Optional: A local server path to save the image (e.g., './output/image.png'). If not provided, a public URL will be returned instead."
      ),
    model: z.enum(['dall-e-3', 'dall-e-2']).optional().default('dall-e-3'),
    size: z
      .enum(['1024x1024', '1792x1024', '1024x1792', '512x512', '256x256'])
      .optional()
      .default('1024x1024'),
    quality: z
      .enum(['standard', 'hd'])
      .optional()
      .default('standard')
      .describe('For DALL-E 3 only.'),
    style: z
      .enum(['vivid', 'natural'])
      .optional()
      .default('vivid')
      .describe('For DALL-E 3 only.'),
  })
  .strict();

export const imageGenerationTool = createDaitanTool(
  'generate_image',
  `Generates an image from a text prompt using the DALL-E model.
The input must be an object with:
- "prompt" (string): A detailed description of the image to generate.
- "outputPath" (string, optional): A local server file path (including extension, e.g., './images/my_cat.png') to save the image to. If you use this, the tool will return the path.
- "model" (string, optional): "dall-e-3" (default) or "dall-e-2".
- "size" (string, optional): The image dimensions. For DALL-E 3, valid sizes are "1024x1024", "1792x1024", or "1024x1792". For DALL-E 2, valid sizes are "256x256", "512x512", or "1024x1024". Defaults to "1024x1024".
- "quality" (string, optional): For DALL-E 3 only. "standard" or "hd". Defaults to "standard".
- "style" (string, optional): For DALL-E 3 only. "vivid" or "natural". Defaults to "vivid".
If 'outputPath' is not provided, the tool returns a public URL to the generated image.`,
  async (input) => {
    const validatedInput = ImageGenerationInputSchema.parse(input);

    const response_format = validatedInput.outputPath ? 'b64_json' : 'url';

    const result = await generateImage({
      ...validatedInput,
      response_format: response_format,
    });

    if (response_format === 'url') {
      const url = Array.isArray(result.urls) ? result.urls[0] : result.urls;
      return `Image generated successfully. It is available at the following URL: ${url}`;
    } else {
      return `Image generated and saved successfully to the server path: ${result.outputPath}`;
    }
  },
  ImageGenerationInputSchema
);
