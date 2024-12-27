import { construct } from '../../intelligence/promptConstruction';
import { generateIntelligence } from '../../intelligence/generate';

export async function generateOpeningPhrase(conversation) {

  const instruction = createInstruction(conversation);

  const messages = construct({ 
    instruction,
  });

  const response = await generateIntelligence({
    model: conversation.model,
    messages,
    temperature: conversation.temperature
  });

  return response;
}

const createInstruction = (con) => {
  
  const participants = con.participants;
  const speaker = con.currentSpeaker;

  return `
    For a conversation between ${participants.length} people you
    are asked to provide an opening phrase for the initial speaker,
    ${speaker.name}. 
    
    The conversation takes place in ${con.language}.
    
    The opening phrase should be engaging 
    and set the stage for a natural discussion. The goal of the
    conversation is ${con.goal}, and the intention of your opening
    phrase is to set the conversation up to achieve this goal as
    soon and efficient as possible.

    ${speaker.name} is a ${speaker.role}, 
    is a ${speaker.personality} person, and their intention
    with the conversation is ${speaker.intention}. Their normal
    speaking style is ${speaker.speakingStyle}.

    In his opening phrase, ${speaker.name} addresses
    the other ${participants.length -1} participants in the 
    conversation, which are: ${participants.filter(p => p !== speaker)
      .map(p => `${p.name} (personality: ${p.personality}, intention: ${p.intention})`).join(', ')}.

    The topic of the conversation is ${con.topic} and the general mood
    is ${con.mood}. The direction in which the conversation will go
    is ${con.direction}. The setting in which the conversation takes place
    is described as "${con.setting}. 

    In the settings there are some props which you may or may not address
    in the opening phrase. You may in the opening phrase refer 
    to these, ${con.stageProps.join(', ')}, as these have 
    come up in the preparations.
    
    At all times, respond in ${con.language} STRICTLY in the following JSON format:
    { "openingPhrase": "string" }.

    ** IT IS VITAL YOU ONLY ANSWER IN JSON FORMAT.
    ** Responses must include double quotes around keys and string values.
    ** Escape any apostrophes or other non-parsable characters with a backslash (\'). 
    
  `;
} 