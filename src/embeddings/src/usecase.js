import { 
  generateBatchEmbeddings, 
  generateEmbedding, 
  EmbeddingSearcher
} from './embeddings.js';

import readline from 'readline';

async function getUserInput(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => rl.question(query, (ans) => {
    rl.close();
    resolve(ans);
  }));
}

async function demonstrateEmbeddings() {
  console.log("Demonstrating embeddings functionality...");

  // List of animals
  const animals = ['cat', 'bird', 'ant', 'cow', 'fish', 'shrimp', 'dog', 'elephant', 'tiger', 'giraffe', 'zebra', 'whale', 'penguin', 'koala', 'kangaroo', 'crocodile', 'panda', 'leopard', 'hippopotamus', 'octopus'];

  console.log("Generating embeddings for animals...");
  const animalEmbeddings = await generateBatchEmbeddings(animals);

  // Create a collection of animal objects with their embeddings
  const animalCollection = animals.map((animal, index) => ({
    name: animal,
    embedding: animalEmbeddings[index]
  }));

  // Initialize the EmbeddingSearcher with our animal collection
  const searcher = new EmbeddingSearcher(animalCollection);

  // Ask the user for an animal name
  const userAnimal = await getUserInput("Please enter an animal name: ");

  // Generate an embedding for the user's animal
  console.log(`Generating embedding for '${userAnimal}'...`);
  const userAnimalEmbedding = await generateEmbedding(userAnimal);

  // Search for the most similar animals to the user's animal
  console.log(`Searching for animals similar to '${userAnimal}'...`);
  const results = searcher.search(userAnimalEmbedding, 0.5, 5);

  console.log(`Top 5 animals most similar to '${userAnimal}':`);
  results.forEach((result, index) => {
    console.log(`${index + 1}. ${result.name} (similarity: ${result.sim.toFixed(4)})`);
  });

  // Clean up
  searcher.dispose();
}

demonstrateEmbeddings().catch(console.error);


// QUERY WITH ATLAS

import { config } from 'dotenv';
import { connect, disconnect } from '../database/mongo';
import { Skill } from '../database/models/skill';

config();
const uri = process.env.DB_URI;

async function vectorSearch(queryVector) {
    try {
        const { mongoose } = await connect(uri);

        const pipeline = [
            {
                $search: {
                    knnBeta: {
                        vector: queryVector,
                        path: 'embedding',
                        k: 10  // Number of nearest neighbors to retrieve
                    }
                }
            }
        ];

        const results = await Skill.aggregate(pipeline).exec();
        console.log("Top closest matches:");
        console.log(results);

    } catch (error) {
        console.error("An error occurred during vector search:", error);
    } finally {
        await disconnect();
    }
}

const queryVector = [/* your query vector here */];

vectorSearch(queryVector).catch(console.error);
