import words from './words';

export function languageArray(language = 'en') {
  return Object.keys(words[language]).map(key => ({
    key,
    name: words[language][key],
    englishName: words['en'][key]
  }));
}

export function getLanguageKeys() {
  return languageArray().map(lang => lang.key);
}
