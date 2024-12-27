import { charSet, charGet, charDel, charCount, charBackup } from './operations.js';

const main = async () => {
  console.log("EXECUTE STORAGE:")
  await charSet(['Color', 'Car'], 'Red');
  console.log("EXECUTE QUERY:")
  const result = await charGet(['Car']);
  console.log("RESULT:")
  console.log(result);
  console.log(result[0].value)
}

main();