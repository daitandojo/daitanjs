import fs from 'fs';
import path from 'path';
import { format } from 'util';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve('/home/mark/Repos/.env') });

const defaultPath = path.join('/tmp', 'jsonStore.json');

function log(level, message) {
    if (process.env.EXTENSIVE_LOGGING) {
        console.log(`[${new Date().toISOString()}] [${level}] ${message}`);
    }
}

function ensureFileExists({ filePath }) {
    try {
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, '\n');
            console.log("Created new file")
            log('INFO', `Created new file: ${filePath}`);
        }
        return true;
    } catch (error) {
        log('ERROR', `Failed to ensure file exists: ${format(error)}`);
        throw new Error('Unable to ensure file existence.');
    }
}

function readJSONsFromFile({ filePath }) {
    try {
        const data = fs.readFileSync(filePath, 'utf-8').trim();
        if (!data) return [];
        
        return data.split('\n').reduce((acc, line, index) => {
            if (line.trim()) { // Ensure line is not empty
                try {
                    const jsonObject = JSON.parse(line);
                    acc.push(jsonObject);
                } catch (error) {
                    console.error(`Reading from ${filePath}: Error parsing JSON at line ${index + 1}: ${line}`);
                    console.error(`Reading from ${filePath}: Error message: ${error.message}`);
                }
            }
            return acc;
        }, []);
    } catch (error) {
        console.error(`Error reading file ${filePath}:`, error);
        return [];
    }
}

function extractField(objects, field = 'topic', count = 20) {
return objects
    .slice(-count) // Get the last `count` objects
    .map(o => o[field]) // Extract the specified field from each article
    .filter(Boolean); // Remove any undefined or empty fields
}

function matchesQuery(obj, query) {
    return Object.keys(query).every(key => {
        const value = query[key];
        const fieldValue = obj[key];
        
        if (typeof value === 'object' && value !== null) {
            if ('$eq' in value) return fieldValue === value.$eq;
            if ('$gt' in value) return fieldValue > value.$gt;
            if ('$lt' in value) return fieldValue < value.$lt;
            if ('$like' in value && typeof fieldValue === 'string') return fieldValue.includes(value.$like);
        } else {
            return fieldValue === value; // default to equality check
        }
    });
}

function jsonStore({
    object, 
    filePath = defaultPath
}) {
    try {
        ensureFileExists({ filePath });
        const jsonString = JSON.stringify(object);
        fs.appendFileSync(filePath, jsonString + '\n');
        log('INFO', `Object stored: ${jsonString}`);
    } catch (error) {
        log('ERROR', `Failed to store object: ${format(error)}`);
        throw new Error('Unable to store the JSON object.');
    }
}

function jsonQuery({
    query, 
    filePath = defaultPath
}) {
    try {
        ensureFileExists({ filePath });
        const data = fs.readFileSync(filePath, 'utf-8').trim();
        if (!data) {
            log('INFO', `File is empty: ${filePath}`);
            return [];
        }

        const jsonObjects = data.split('\n').filter(line => line.trim()).map(line => {
            try {
                return JSON.parse(line);
            } catch (error) {
                log('ERROR', `Invalid JSON on line: ${line}`);
                return null;
            }
        }).filter(obj => obj !== null);

        const result = jsonObjects.filter(obj => matchesQuery(obj, query));

        log('INFO', `Query result: ${JSON.stringify(result)}`);
        return result;
    } catch (error) {
        log('ERROR', `Failed to query objects: ${format(error)}`);
        throw new Error('Unable to query the JSON objects.');
    }
}

function jsonExist({
    object, 
    filePath = defaultPath
}) {
    try {
        ensureFileExists({ filePath });
        const exists = jsonQuery(object, filePath).length > 0;
        log('INFO', `Object exists: ${exists}`);
        return exists;
    } catch (error) {
        log('ERROR', `Failed to check object existence: ${format(error)}`);
        throw new Error('Unable to check if the JSON object exists.');
    }
}

function jsonDelete({
    query, 
    filePath = defaultPath
}) {
    try {
        ensureFileExists({ filePath });
        const data = fs.readFileSync(filePath, 'utf-8').trim();
        if (!data) {
            log('INFO', `File is empty, nothing to delete: ${filePath}`);
            return;
        }

        const jsonObjects = data.split('\n').filter(line => line.trim()).map(line => {
            try {
                return JSON.parse(line);
            } catch (error) {
                log('ERROR', `Invalid JSON on line: ${line}`);
                return null;
            }
        }).filter(obj => obj !== null);

        const filteredObjects = jsonObjects.filter(obj => !matchesQuery(obj, query));

        fs.writeFileSync(filePath, filteredObjects.map(obj => JSON.stringify(obj)).join('\n') + '\n');
        log('INFO', `Objects matching query deleted: ${JSON.stringify(query)}`);
    } catch (error) {
        log('ERROR', `Failed to delete objects: ${format(error)}`);
        throw new Error('Unable to delete the JSON objects.');
    }
}

function jsonUpdate({
    query, 
    updates, 
    filePath = defaultPath
}) {
    try {
        ensureFileExists({ filePath });
        const data = fs.readFileSync(filePath, 'utf-8').trim();
        if (!data) {
            log('INFO', `File is empty, nothing to update: ${filePath}`);
            return;
        }

        const jsonObjects = data.split('\n').filter(line => line.trim()).map(line => {
            try {
                return JSON.parse(line);
            } catch (error) {
                log('ERROR', `Invalid JSON on line: ${line}`);
                return null;
            }
        }).filter(obj => obj !== null);

        const updatedObjects = jsonObjects.map(obj => {
            if (matchesQuery(obj, query)) {
                return { ...obj, ...updates };
            }
            return obj;
        });

        fs.writeFileSync(filePath, updatedObjects.map(obj => JSON.stringify(obj)).join('\n') + '\n');
        log('INFO', `Objects matching query updated: ${JSON.stringify(query)}, updates: ${JSON.stringify(updates)}`);
    } catch (error) {
        log('ERROR', `Failed to update objects: ${format(error)}`);
        throw new Error('Unable to update the JSON objects.');
    }
}

export {
    jsonStore,
    jsonQuery,
    jsonExist,
    jsonDelete,
    jsonUpdate,
    readJSONsFromFile,
    extractField
};
