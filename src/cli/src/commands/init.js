// src/cli/src/commands/init.js
/**
 * @file Registers the `init` command for scaffolding a new DaitanJS project,
 *       with AI-powered application generation capabilities.
 * @module @daitanjs/cli/commands/init
 */
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs/promises';
import path from 'path';
import { getLogger, loadEnvironmentFiles } from '@daitanjs/development';
import { initializeConfigManager } from '@daitanjs/config';
import { generateIntelligence } from '@daitanjs/intelligence';

const logger = getLogger('daitan-cli-init');

// --- TEMPLATES ---
const envTemplate = `
# DaitanJS Environment Variables
NODE_ENV=development
LOG_LEVEL=info

# --- LLM API Keys (fill in the ones you use) ---
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GROQ_API_KEY=

# --- LLM Expert Profiles (Optional: Customize your models) ---
DEFAULT_EXPERT_PROFILE=FAST_TASKER
LLM_EXPERT_FAST_TASKER=groq|llama3-8b-8192
LLM_EXPERT_MASTER_CODER=anthropic|claude-3-opus-20240229
`;

const pkgJsonTemplate = (appName) => `{
  "name": "${appName}",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "@daitanjs/init": "latest",
    "@daitanjs/intelligence": "latest"
  }
}
`;

const defaultIndexJsTemplate = `
import { initializeDaitanApp } from '@daitanjs/init';
import { generateIntelligence } from '@daitanjs/intelligence';

const languages = ['English', 'Spanish', 'French', 'German', 'Japanese', 'Italian', 'Portuguese'];

async function main() {
  const app = await initializeDaitanApp({ appName: "MyDaitanApp" });
  app.logger.info("DaitanJS application initialized successfully!");

  try {
    const randomLanguage = languages[Math.floor(Math.random() * languages.length)];
    app.logger.info(\`Requesting an encouraging quote in \${randomLanguage}...\`);

    const { response: quote } = await generateIntelligence({
      prompt: {
        user: \`Give me a short, powerful, and encouraging quote in \${randomLanguage}. Just the quote, no explanation.\`,
      },
      config: {
        response: { format: "text" },
        llm: { target: "FAST_TASKER" },
      },
      metadata: { summary: "Fetch random encouraging quote" },
    });

    console.log('');
    console.log(\`✨ \${quote}\`);
    console.log("   - Let's take on the world!");
    console.log('');

  } catch (error) {
    app.logger.error("Failed to get an encouraging quote from the LLM.", error);
  }
}

main().catch(error => {
  console.error("A fatal error occurred during application startup:", error);
  process.exit(1);
});
`;

const appGeneratorPrompt = (instruction) => `
You are an expert DaitanJS developer. Your task is to write a single, complete, and functional Node.js application script (named index.js) based on a user's instruction.

**User's Instruction:**
"${instruction}"

**Your Constraints & Requirements:**
1.  **Single File:** The entire application logic must be contained within a single \`index.js\` file.
2.  **DaitanJS First:** You MUST use the DaitanJS libraries wherever possible and appropriate. The primary entry point is \`@daitanjs/init\`. Use other modules like \`@daitanjs/intelligence\`, \`@daitanjs/cli\`, \`@daitanjs/data\`, etc., as needed.
3.  **Core Initialization:** The application MUST start by calling \`initializeDaitanApp\` from \`@daitanjs/init\`.
4.  **Clarity and Comments:** The code must be well-commented and clean.
5.  **Completeness:** The generated code must be a fully working example that can be run with \`npm start\`.
6.  **No Placeholders:** Do not use placeholders like \`// your code here\`. Write the complete, functional code.
7.  **Output Format:** Your response MUST be ONLY the JavaScript code for the \`index.js\` file. Do not include any explanations or markdown formatting.
`;

export function registerInitCommands(program) {
  program
    .command('init <appName> [instruction]')
    .description(
      chalk.cyan(
        'Initialize a new DaitanJS project. Optionally, provide an instruction in quotes to generate a custom app with AI.'
      )
    )
    .action(async (appName, instruction) => {
      const projectPath = path.resolve(process.cwd(), appName);
      const spinner = ora(
        `Creating new DaitanJS project in ${chalk.yellow(projectPath)}...`
      ).start();

      let finalIndexJsContent = defaultIndexJsTemplate;

      try {
        if (await fs.stat(projectPath).catch(() => false)) {
          spinner.fail(chalk.red(`Directory "${appName}" already exists.`));
          return;
        }

        if (instruction) {
          spinner.text =
            'Initializing DaitanJS services to generate custom app...';
          loadEnvironmentFiles();
          initializeConfigManager();

          spinner.text = `AI is building your custom app for: "${instruction.substring(
            0,
            40
          )}..."`;

          const { response: generatedCode } = await generateIntelligence({
            prompt: {
              system: {
                persona:
                  'You are an expert DaitanJS developer tasked with writing a single-file Node.js application.',
              },
              user: appGeneratorPrompt(instruction),
            },
            config: {
              response: { format: 'text' },
              llm: { target: 'MASTER_CODER' },
            },
            metadata: { summary: `Generate DaitanJS app for: ${instruction}` },
          });

          finalIndexJsContent = generatedCode
            .replace(/```javascript/g, '')
            .replace(/```/g, '')
            .trim();
          spinner.succeed('Custom application code generated by AI!');
          spinner.start('Scaffolding project files...');
        }

        await fs.mkdir(projectPath, { recursive: true });
        await fs.writeFile(
          path.join(projectPath, '.env'),
          envTemplate.trim(),
          'utf-8'
        );
        await fs.writeFile(
          path.join(projectPath, 'index.js'),
          finalIndexJsContent,
          'utf-8'
        );
        await fs.writeFile(
          path.join(projectPath, 'package.json'),
          pkgJsonTemplate(appName),
          'utf-8'
        );

        spinner.succeed(
          chalk.green('DaitanJS project initialized successfully!')
        );
        console.log(chalk.blue('\n🚀 Next steps:'));
        console.log(`1. ${chalk.cyan(`cd ${appName}`)}`);
        console.log(
          `2. Fill in your API keys in the ${chalk.yellow('.env')} file.`
        );
        console.log(
          `3. Run ${chalk.cyan('npm install')} to install dependencies.`
        );
        console.log(
          `4. Review the generated ${chalk.yellow('index.js')} file.`
        );
        console.log(
          `5. Run ${chalk.cyan('npm start')} to run the application.`
        );
      } catch (error) {
        spinner.fail('Project initialization failed.');
        logger.error('Error during init command:', error);
        await fs
          .rm(projectPath, { recursive: true, force: true })
          .catch(() => {});
      }
    });
}
