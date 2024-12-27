import dotenv from 'dotenv';
import url from 'url';
import path from 'path';

dotenv.config({ path: path.resolve('/home/mark/Repos/.env') });

const googleApiKey = process.env.GOOGLE_API_KEY;
const googleSearchCx = process.env.GOOGLE_SEARCH_CX;
const endpoint = 'https://www.googleapis.com/customsearch/v1';

const isWebPage = (link) => {
  const parsedUrl = url.parse(link);
  const ext = path.extname(parsedUrl.pathname).toLowerCase();
  const excludedExtensions = ['.docx', '.pdf', '.doc', '.xls', '.xlsx', '.ppt', '.pptx', '.txt'];
  return !excludedExtensions.includes(ext);
};

export const googleSearch = async ({ query }) => {
  console.log(`Performing Google Custom Search for: "${query}"`);
  try {
    const response = await fetch(`${endpoint}?key=${googleApiKey}&cx=${googleSearchCx}&q=${query}&fileType=html`, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    const filteredItems = data.items?.filter(item => isWebPage(item.link)) || [];
    console.log(`Retrieved ${filteredItems.length} web page results`);

    return filteredItems.map((item) => ({
      title: item.title,
      link: item.link,
      snippet: item.snippet,
    }));
  } catch (error) {
    console.error(`Error searching Google: ${error.message}`);
    return [];
  }
};