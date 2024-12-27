import { construct } from '../../intelligence/promptConstruction';
import { generateIntelligence } from '../../intelligence/generate';

export const generateNewElement = async (conversation) => {
  
  const instruction = generateNewElementInstruction(conversation);

  const messages = construct({ instruction });

  try {
    return await generateIntelligence({ 
      model: conversation.model,
      messages,
      temperature: conversation.temperature
    });
  } catch (error) {
    console.error("Error introducing new element:", error);
    return null;
  }
}

const generateNewElementInstruction = (con) => {

  return `
    The conversation in ${con.language} about ${con.topic} seems to be getting stale. 
    The current setting is "${con.setting}" and the available props are: ${con.stageProps.join(', ')}.
    
    Please suggest a new element to introduce into the conversation which can
    help push forward the current speaker's objective ${con.currentSpeaker.objective}.
    
    This could be something external, it can also be an action by one 
    of the participants that clearly pushes the conversation towards 
    the speaker's objective.

    It should provide opportunities for the participants to engage in new ways.

    Respond STRICTLY in the following JSON format:
    {
      "elementType": "string", // e.g., "event", "topic", "prop", "action", "setting"
      "description": "string", // A brief description of the new element
      "impact": "string" // How this might affect the conversation and move it towards ${con.currentSpeaker.name}'s objective of ${con.currentSpeaker.objective}.
    }

    ** IT IS VITAL THAT YOU ONLY ANSWER IN PARSABLE JSON FORMAT.
    ** Responses must include double quotes around keys and string values.
    ** Escape any apostrophes or other non-parsable characters with a backslash (\'). 

  `;
}
