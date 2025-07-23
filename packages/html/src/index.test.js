// src/html/src/index.test.js
import {
  createHeading,
  createParagraph,
  createLink,
  createImage,
  createButton,
  createList,
  createCard,
  createTable,
  createAlert,
  createEmailWrapper,
  createEmailHeader,
  createEmailFooter,
  createArticleCardForEmail,
} from './index.js';
import { DaitanInvalidInputError } from '@daitanjs/error';

// Mock the logger to prevent console noise and utility dependencies
jest.mock('@daitanjs/development', () => ({
  getLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
}));
jest.mock('@daitanjs/utilities', () => ({
  truncateString: jest.fn((str) => str),
  isValidURL: jest.fn().mockReturnValue(true),
}));

describe('@daitanjs/html', () => {
  describe('General Components', () => {
    it('createHeading should generate a correct h1 tag by default', () => {
      const html = createHeading({ text: 'Main Title' });
      expect(html).toMatch(/<h1[^>]*>Main Title<\/h1>/);
      expect(html).toContain('font-size:32px;');
    });

    it('createHeading should generate an h3 tag with custom styles and attributes', () => {
      const html = createHeading({
        text: 'Subtitle',
        level: 3,
        customStyles: { color: 'red', 'margin-top': '0' },
        id: 'sub1',
        'data-test': 'heading',
      });
      expect(html).toMatch(/<h3[^>]*>Subtitle<\/h3>/);
      expect(html).toContain('color:red;');
      expect(html).toContain('margin-top:0;');
      expect(html).toContain('id="sub1"');
      expect(html).toContain('data-test="heading"');
    });

    it('createParagraph should generate a p tag with correct text and default styles', () => {
      const html = createParagraph({ text: 'This is a paragraph.' });
      expect(html).toMatch(/<p[^>]*>This is a paragraph.<\/p>/);
      expect(html).toContain('font-size:16px;');
      expect(html).toContain('color:#34495E;');
    });

    it('createLink should generate an anchor tag with href and security attributes for _blank', () => {
      const html = createLink({
        href: 'https://example.com',
        text: 'Visit Us',
      });
      expect(html).toMatch(/<a[^>]*>Visit Us<\/a>/);
      expect(html).toContain('href="https://example.com"');
      expect(html).toContain('target="_blank"');
      expect(html).toContain('rel="noopener noreferrer"');
    });

    it('createImage should generate an img tag with src and alt attributes', () => {
      const html = createImage({
        src: 'image.png',
        alt: 'My Image',
        width: '100',
      });
      expect(html).toMatch(/<img/);
      expect(html).toContain('src="image.png"');
      expect(html).toContain('alt="My Image"');
      expect(html).toContain('width="100"');
      expect(html).toContain('max-width:100%;');
    });

    it('createButton should render as an anchor tag by default', () => {
      const html = createButton({ text: 'Click Me', href: '/path' });
      expect(html).toMatch(/<a[^>]*role="button"[^>]*>Click Me<\/a>/);
      expect(html).toContain('href="/path"');
    });

    it('createButton should render as a button tag when specified', () => {
      const html = createButton({ text: 'Submit', as: 'submit' });
      expect(html).toMatch(/<button[^>]*type="submit"[^>]*>Submit<\/button>/);
    });

    it('createList should generate an unordered list by default', () => {
      const html = createList({ items: ['One', 'Two'] });
      expect(html).toMatch(
        /<ul[^>]*><li[^>]*>One<\/li><li[^>]*>Two<\/li><\/ul>/
      );
    });

    it('createList should generate an ordered list when specified', () => {
      const html = createList({ items: ['First', 'Second'], ordered: true });
      expect(html).toMatch(
        /<ol[^>]*><li[^>]*>First<\/li><li[^>]*>Second<\/li><\/ol>/
      );
    });

    it('createTable should generate a full table structure', () => {
      const html = createTable({
        headers: ['ID', 'Name'],
        rows: [
          ['1', 'Alice'],
          ['2', 'Bob'],
        ],
        caption: 'User List',
      });
      expect(html).toContain('<caption>User List</caption>');
      expect(html).toContain('<thead>');
      expect(html).toContain('<th>ID</th>');
      expect(html).toContain('<th>Name</th>');
      expect(html).toContain('<tbody>');
      expect(html).toContain('<td>1</td>');
      expect(html).toContain('<td>Alice</td>');
    });

    it('createAlert should generate a styled div for an error', () => {
      const html = createAlert({
        message: 'Something went wrong!',
        type: 'error',
      });
      expect(html).toMatch(
        /<div[^>]*role="alert"[^>]*>Something went wrong!<\/div>/
      );
      expect(html).toContain('background-color:#f8d7da;');
      expect(html).toContain('color:#721c24;');
    });

    it('should throw DaitanInvalidInputError for missing required text/content', () => {
      expect(() => createHeading({})).toThrow(DaitanInvalidInputError);
      expect(() => createParagraph({})).toThrow(DaitanInvalidInputError);
      expect(() => createCard({})).toThrow(DaitanInvalidInputError);
    });
  });

  describe('Email Components', () => {
    it('createEmailWrapper should produce a full HTML document structure', () => {
      const html = createEmailWrapper({
        bodyContent: '<p>Hello</p>',
        config: { title: 'Test Email' },
      });
      expect(html).toContain('<!DOCTYPE html');
      expect(html).toContain('<html lang="en"');
      expect(html).toContain('<title>Test Email</title>');
      expect(html).toContain('<p>Hello</p>');
      expect(html).toContain('background-color:#ECEFF1;');
    });

    it('createEmailHeader should include logo and title', () => {
      const html = createEmailHeader({
        logoUrl: 'logo.png',
        title: 'Welcome!',
      });
      expect(html).toContain('<img src="logo.png"');
      expect(html).toMatch(/<h1[^>]*>Welcome!<\/h1>/);
      expect(html).toContain('border-bottom:1px solid #DDDDDD;');
    });

    it('createEmailFooter should include company name and unsubscribe link', () => {
      const html = createEmailFooter({
        companyName: 'My Corp',
        unsubscribeUrl: 'https://example.com/unsubscribe',
      });
      expect(html).toContain('My Corp');
      expect(html).toContain('<a href="https://example.com/unsubscribe"');
      expect(html).toContain(`© ${new Date().getFullYear()}`);
    });

    it('createArticleCardForEmail should generate a card with all article elements', () => {
      const article = {
        link: 'https://example.com/article',
        headline: 'Big News Today',
        summary: 'A summary of the big news.',
        imageUrl: 'image.jpg',
        assessmentText: 'This is highly relevant.',
        source: 'News Inc.',
      };
      const html = createArticleCardForEmail({ article });

      expect(html).toContain('<img src="image.jpg"');
      expect(html).toContain('href="https://example.com/article"');
      expect(html).toContain('Big News Today');
      expect(html).toContain('<strong>Assessment:</strong>');
    });
  });
});
