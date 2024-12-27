import { construct, generateIntelligence } from '@daitan/intelligence';

const runExample = async () => {
  try {
    // Define sample input
    const instruction =
      'You are a helpful assistant, who always gives an example phrase from which the meaning of the given term is very clear. It should not be a definition, but rather a phrase from every day life which illustrates the meaning well.';
    const prompt = 'Coward';
    const shotsInput = ['Dark', 'Dry'];
    const shotsOutput = [
      'He was slightly afraid when he walked through the dark forest. He wanted to get out of there as soon as possible, took his bike and rushed away. When he got home he rested in peace.',
      'He did not want to get out of the house before his hair had dried. Therefore he took the hair dryer and putting it on the highest level dried his hair as quickly as possible. When he was done he threw himself into the party.',
    ];

    // Construct messages
    const messages = construct({
      instruction,
      prompt,
      shotsInput,
      shotsOutput,
    });

    // Generate intelligence
    const response = await generateIntelligence({
      model: 'gpt-4o-mini',
      summary: 'A summary of the input text.',
      messages,
      temperature: 1.1,
      max_tokens: 150,
    });
  } catch (error) {
    console.error('Error occurred:', error.message);
  }
};

runExample();
