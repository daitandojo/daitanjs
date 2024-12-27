import CSVSQL from './csvsql.js';

const PEOPLE_CSV = `
id,name,age,gender,city,occupation,salary
1,John Smith,35,Male,New York,Engineer,85000
2,Emma Johnson,28,Female,Los Angeles,Teacher,55000
3,Michael Brown,42,Male,Chicago,Manager,95000
4,Sophia Davis,31,Female,Houston,Designer,65000
5,William Wilson,39,Male,Phoenix,Accountant,75000
6,Olivia Taylor,26,Female,Philadelphia,Nurse,60000
7,James Anderson,45,Male,San Antonio,Lawyer,110000
8,Ava Thomas,33,Female,San Diego,Marketing Specialist,70000
9,Robert Jackson,37,Male,Dallas,Sales Representative,80000
10,Isabella White,29,Female,San Jose,Software Developer,90000
11,David Harris,41,Male,Austin,Project Manager,100000
12,Mia Martin,27,Female,Jacksonville,HR Coordinator,58000
13,Joseph Thompson,36,Male,San Francisco,Data Analyst,88000
14,Charlotte Garcia,32,Female,Indianapolis,Financial Advisor,82000
15,Daniel Martinez,44,Male,Columbus,Business Consultant,105000
16,Amelia Robinson,30,Female,Fort Worth,Psychologist,72000
17,Christopher Clark,38,Male,Charlotte,Architect,92000
18,Emily Rodriguez,25,Female,Seattle,Journalist,59000
19,Andrew Lewis,43,Male,Denver,Operations Manager,98000
20,Abigail Lee,34,Female,Washington,Research Scientist,86000
`;

async function main() {
  const db = new CSVSQL();
  await db.initialize();

  console.log("1. Listing available tables:");
  const tables = await db.listTables();
  console.log(tables);

  console.log("\n2. Loading 'people' table:");
  await db.loadTable('people');

  console.log("\n3. Getting 'people' table info:");
  const peopleInfo = db.getTableInfo('people');
  console.log(peopleInfo);

  console.log("\nDebug: First few records in 'people' table:");
  console.log(db.tables['people'].data.slice(0, 5));

  console.log("\n4. Querying all males from 'people' table:");
  const menQuery = "SELECT * FROM people WHERE gender = 'Male'";
  console.log("Debug: Parsed query:", db._parseQuery(menQuery));
  const menResult = db.query(menQuery);
  console.log(menResult);
  
  console.log("\n5. Querying all males from 'people' table, sorted by age:");
  const menSortedQuery = "SELECT id, name, age, city, occupation, salary FROM people WHERE gender = 'Male' ORDER BY age ASC";
  const menSortedResult = db.query(menSortedQuery);
  console.log(menSortedResult);  

  console.log("\n6. Saving query result as 'men' table:");
  await db.saveQueryResult(menResult, 'men');

  console.log("\n7. Loading 'men' table:");
  await db.loadTable('men');

  console.log("\n8. Getting 'men' table info:");
  const menInfo = db.getTableInfo('men');
  console.log(menInfo);

  console.log("\n9. Querying men with salary > 90000:");
  const highEarnersQuery = "SELECT name, age, occupation, salary FROM men WHERE salary > 90000 ORDER BY salary DESC";
  const highEarnersResult = db.query(highEarnersQuery);
  console.log(highEarnersResult);

  console.log("\n10. Inserting a new record into 'people' table:");
  db.query(`INSERT INTO people VALUES {"id": "21", "name": "Noah King", "age": "29", "gender": "Male", "city": "Boston", "occupation": "Data Scientist", "salary": "95000"}`);

  console.log("\n11. Updating 'people' table:");
  await db.saveTable('people');

  console.log("\n12. Deleting records with age < 30 from 'men' table:");
  db.query("DELETE FROM men WHERE age < 30");

  console.log("\n13. Updating 'men' table:");
  await db.saveTable('men');

  console.log("\n14. Final 'men' table info:");
  const finalMenInfo = db.getTableInfo('men');
  console.log(finalMenInfo);

  console.log("\n15. Listing all tables again:");
  const finalTables = await db.listTables();
  console.log(finalTables);
}

main().catch(console.error);
