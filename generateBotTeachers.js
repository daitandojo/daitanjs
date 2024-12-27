import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const rootDir = path.resolve('./');
const srcDir = path.join(rootDir, 'src');
const instructionFile = path.join(rootDir, 'instructionSourcePackToSummary.txt');
const instructionPostFile = path.join(rootDir, 'instructionPost.txt');
const concatenatedBotTeacherFile = path.join(rootDir, 'botTeacher.txt');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;


const readFile = async (filePath) => {
    try {
        return await fs.promises.readFile(filePath, 'utf-8');
    } catch (error) {
        console.error(`Error reading file ${filePath}: ${error.message}`);
        return '';
    }
};

const callOpenAIApi = async (instruction) => {
    let retries = 3;
    let delay = 1000; // Start with 1 second

    while (retries > 0) {
        try {
            const response = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${OPENAI_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "gpt-4o-mini",
                    messages: [
                        { role: "system", content: "You are an assistant designed to process bot instructions." },
                        { role: "user", content: instruction }
                    ]
                })
            });

            if (!response.ok) {
                if (response.status === 429) {
                    console.warn(`Rate limited. Retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    delay *= 2; // Exponential backoff
                    retries -= 1;
                    continue;
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data.choices[0].message.content;
        } catch (error) {
            if (retries <= 0) {
                console.error(`Error calling OpenAI API after retries: ${error.message}`);
                return null;
            }
            console.warn(`Retrying due to error: ${error.message}`);
        }
    }
};

const writeToFile = async (filePath, content) => {
    try {
        await fs.promises.writeFile(filePath, content, 'utf-8');
        console.log(`✅ Written to file: ${filePath}`);
    } catch (error) {
        console.error(`Error writing to file ${filePath}: ${error.message}`);
    }
};

const processSourcePacks = async () => {
    const subdirs = await fs.promises.readdir(srcDir, { withFileTypes: true });

    for (const dirent of subdirs) {
        if (dirent.isDirectory()) {
            const subdirPath = path.join(srcDir, dirent.name);
            const sourcePackPath = path.join(subdirPath, 'sourcePack.txt');
            const botTeacherPath = path.join(subdirPath, 'botTeacher.txt');

            if (!fs.existsSync(sourcePackPath)) {
                console.log(`Skipping ${subdirPath}: sourcePack.txt not found.`);
                continue;
            }

            if (fs.existsSync(botTeacherPath)) {
                console.log(`Skipping ${subdirPath}: botTeacher.txt already exists.`);
                continue;
            }

            console.log(`Processing ${sourcePackPath}...`);
            const instructionContent = await readFile(instructionFile);
            const sourcePackContent = await readFile(sourcePackPath);
            const combinedContent = `${instructionContent}\n\n${sourcePackContent}`;

            try {
                const response = await callOpenAIApi(combinedContent);

                if (response) {
                    await writeToFile(botTeacherPath, response);
                } else {
                    console.log(`Failed to process ${sourcePackPath}`);
                }
            } catch (error) {
                console.error(`Error processing ${sourcePackPath}: ${error.message}`);
            }

            await new Promise(resolve => setTimeout(resolve, 2000)); // Avoid hitting API rate limits
        }
    }
};

const concatenateBotTeachers = async () => {
    const subdirs = await fs.promises.readdir(srcDir, { withFileTypes: true });
    let consolidatedContent = '';

    for (const dirent of subdirs) {
        if (dirent.isDirectory()) {
            const botTeacherPath = path.join(srcDir, dirent.name, 'botTeacher.txt');

            if (fs.existsSync(botTeacherPath)) {
                console.log(`Reading from ${botTeacherPath}...`);
                const fileContent = await readFile(botTeacherPath);
                consolidatedContent += `\n=== ${dirent.name} ===\n${fileContent}\n`;
            }
        }
    }

    const instructionPostContent = await readFile(instructionPostFile);
    consolidatedContent += `\n\n${instructionPostContent}`;

    await writeToFile(concatenatedBotTeacherFile, consolidatedContent);
};

const main = async () => {
    await processSourcePacks();
    await concatenateBotTeachers();
};

main().catch((error) => {
    console.error(`Failed to process source packs: ${error.message}`);
});
