import { 
jsonStore, 
jsonQuery, 
jsonExist, 
jsonDelete, 
jsonUpdate 
} from './store.js';
import path from 'path';

function main() {
  const filePath = path.join('/tmp', 'usecase.json');
  
  console.log("=== JSON Store Use Case Demonstration ===");

  console.log("\n1. Storing JSON objects...");
  const objectsToStore = [
      { id: 1, name: "Alice", age: 30, job: "Developer" },
      { id: 2, name: "Bob", age: 25, job: "Designer" },
      { id: 3, name: "Charlie", age: 35, job: "Manager" }
  ];
  objectsToStore.forEach(obj => jsonStore({ obj, filePath }));
  console.log("Stored objects:", objectsToStore);

  console.log("\n2. Querying JSON objects with age greater than 30...");
  const queryResultGt = jsonQuery({
    query: { age: { $gt: 30 } }, 
    filePath
  });
  console.log("Query result (age > 30):", queryResultGt);

  console.log("\n3. Querying JSON objects with name containing 'Ali'...");
  const queryResultLike = jsonQuery({
    query: { name: { $like: 'Ali' } }, 
    filePath
  });
  console.log("Query result (name contains 'Ali'):", queryResultLike);

  console.log("\n4. Checking existence of {id: 2, name: 'Bob', age: 25, job: 'Designer'}...");
  const exists = jsonExist({
    filter: { id: 2, name: "Bob", age: 25, job: "Designer" }, 
    filePath
  });
  console.log("Does it exist?", exists);

  console.log("\n5. Updating JSON objects where {id: 3} with {age: 36}...");
  jsonUpdate({
    filter: { id: 3 }, 
    update: { age: 36 }, 
    filePath
  });
  const updatedQueryResult = jsonQuery({
    filter: { id: 3 }, 
    filePath
  });
  console.log("Updated objects:", updatedQueryResult);

  console.log("\n6. Deleting JSON objects where {job: 'Designer'}...");
  jsonDelete({
    filter: { job: "Designer" }, 
    filePath
  });
  const remainingObjects = jsonQuery({
    filter: {}, 
    filePath
  });
  console.log("Remaining objects after deletion:", remainingObjects);

  console.log("\n=== Use Case Demonstration Completed ===");
}

main();