export const getWords = ({ words, language }) => {
  const result = {};
  for (const key in words) {
    if (words[key][language]) {
      result[key] = words[key][language];
    } else {
      result[key] = words[key].en;
    }
  }
  return result;
};