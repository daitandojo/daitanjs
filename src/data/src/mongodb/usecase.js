// app.js
import { config } from 'dotenv';
import { connect, disconnect } from '../database/mongo.js';
import { Question } from '../database/models/Question.js';

config();
const uri = process.env.DB_URI;

async function queryAllQuestions() {
    try {
      const { db, mongoose } = await connect(uri);
      console.log("Connected to database:", db.databaseName);
      const questionsCollection = db.collection("questions");
      console.log("Using collection:", questionsCollection.collectionName);
  
      const count = await questionsCollection.countDocuments();
      console.log("Number of documents in collection:", count);
  
      // Using MongoDB driver
      console.log("Questions in the collection (using MongoDB driver):");
      const cursor = questionsCollection.find({ questionid: { $exists: true } });
      await cursor.forEach(document => {
        console.log(document);
      });
   
      console.log("\nQuestions in the collection (using Mongoose):");
      const questions = await Question.find();
      console.log("QUESTIONS USING MONGOOSE: "+questions.length)
      questions.forEach(question => {
        console.log(question.toObject());
      });
  
      console.log("Mongoose connection details:");
      console.log("Database:", mongoose.connection.db.databaseName);
      console.log("Collections:", await mongoose.connection.db.listCollections().toArray());
  
      console.log("Finished logging all questions.");
  
      // ... rest of the function remains the same
    } catch (error) {
      console.error("An error occurred:", error);
    } finally {
      await disconnect();
    }
  }

queryAllQuestions().catch(console.error);