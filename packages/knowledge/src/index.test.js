// src/knowledge/src/index.test.js
import {
  countryData,
  educationLevels,
  initialUser,
  languageData,
  translationsData, // Note the alias from 'words'
  wikiData,
} from './index.js';

describe('@daitanjs/knowledge', () => {
  describe('countryData', () => {
    it('should be a non-empty array of objects', () => {
      expect(Array.isArray(countryData)).toBe(true);
      expect(countryData.length).toBeGreaterThan(0);
    });

    it('should have a consistent structure for each country object', () => {
      const sampleCountry = countryData.find((c) => c.countryCode === 'US');
      expect(sampleCountry).toBeDefined();
      expect(sampleCountry).toHaveProperty('country');
      expect(sampleCountry).toHaveProperty('countryCode');
      expect(sampleCountry).toHaveProperty('currency');
      expect(sampleCountry).toHaveProperty('languages');
      expect(Array.isArray(sampleCountry.languages)).toBe(true);
    });
  });

  describe('educationLevels', () => {
    it('should be a non-empty array of objects with value and label', () => {
      expect(Array.isArray(educationLevels)).toBe(true);
      expect(educationLevels.length).toBeGreaterThan(0);

      const firstLevel = educationLevels[0];
      expect(firstLevel).toHaveProperty('value');
      expect(firstLevel).toHaveProperty('label');
    });

    it('should include a "Select Level..." option as the first item', () => {
      expect(educationLevels[0].label).toBe('Select Level...');
      expect(educationLevels[0].value).toBe('');
    });
  });

  describe('initialUser', () => {
    it('should be an object with expected default user fields', () => {
      expect(typeof initialUser).toBe('object');
      expect(initialUser).not.toBeNull();
      expect(initialUser).toHaveProperty('userid', '');
      expect(initialUser).toHaveProperty('email', '');
      expect(initialUser).toHaveProperty('language', 'en');
      expect(initialUser).toHaveProperty('root', false);
      expect(Array.isArray(initialUser.requests)).toBe(true);
    });
  });

  describe('languageData', () => {
    it('should be a non-empty array of objects', () => {
      expect(Array.isArray(languageData)).toBe(true);
      expect(languageData.length).toBeGreaterThan(0);
    });

    it('should have a consistent structure for each language object', () => {
      const sampleLanguage = languageData.find((lang) => lang.code === 'en');
      expect(sampleLanguage).toBeDefined();
      expect(sampleLanguage).toHaveProperty('name');
      expect(sampleLanguage).toHaveProperty('nativeName');
      expect(sampleLanguage).toHaveProperty('code');
    });
  });

  describe('translationsData (words)', () => {
    it('should be an object containing translation keys', () => {
      expect(typeof translationsData).toBe('object');
      expect(translationsData).not.toBeNull();
      expect(translationsData).toHaveProperty('Weekdays');
      expect(translationsData).toHaveProperty('MainDisclaimerUser');
    });

    it('should contain translations for multiple languages for a given key', () => {
      const weekdays = translationsData.Weekdays;
      expect(weekdays).toHaveProperty('en');
      expect(weekdays).toHaveProperty('es');
      expect(weekdays).toHaveProperty('de');
      expect(typeof weekdays.en).toBe('string');
    });

    it('should contain pipe-separated strings for weekdays', () => {
      expect(translationsData.Weekdays.en).toContain('|');
      expect(translationsData.Weekdays.en.split('|')).toHaveLength(7);
    });
  });

  describe('wikiData', () => {
    it('should be a placeholder object with expected properties', () => {
      expect(typeof wikiData).toBe('object');
      expect(wikiData).not.toBeNull();
      expect(wikiData).toHaveProperty('placeholder', true);
      expect(wikiData).toHaveProperty('message');
    });
  });
});
