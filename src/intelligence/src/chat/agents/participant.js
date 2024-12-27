import { construct } from '../../intelligence/promptConstruction';
import { generateIntelligence } from '../../intelligence/generate';
import { tts } from '@daitanjs/speech';

export const generateResponse = async (conversation) => {
  const instruction = generateInstruction(conversation)
    .replace(/\s+/g, ' ')
    .trim();

  let prompt = generatePrompt(conversation).replace(/\s+/g, ' ').trim();

  try {
    let messages = construct({ instruction, prompt });

    let response = await generateIntelligence({
      model: conversation.model,
      temperature: conversation.currentSpeaker.temperature,
      messages,
    });

    for (let i = 1; i <= 3; i++) {
      console.log(`Iteration ${i}`);

      messages.push({
        role: 'assistant',
        content: JSON.stringify(response),
      });

      messages.push({
        role: 'user',
        content: 'Please significantly improve the answer.',
      });

      response = await generateIntelligence({
        model: conversation.model,
        messages,
      });
    }

    console.log(conversation.currentSpeaker);

    await tts({
      text: response.answer,
      gender: conversation.currentSpeaker.gender,
      language: conversation.language,
    });

    return response;
  } catch (error) {
    throw new Error(`Error generating response: ${error.message}`);
  }
};

const generatePrompt = (con) => {
  const answers = con.conversationHistory.join('\n');
  const thoughts = con.currentSpeaker.innerWorld.join('\n');
  const actions = con.nonVerbalActionsHistory.join('\n');

  const prompt = `
    History of the conversation: [${answers}]\n
    Your recent thoughts: [${thoughts}]\n
    Your recent non-verbal actions: [${actions}]\n
    Hint from supervisor to achieve your goal: ${con.currentSpeaker.hintFromOutside}
  `;
  return prompt;
};

const generateInstruction = (con) => {
  const baseInstruction = getBaseInstruction(con);
  const taskInstruction = getTaskInstruction(con);
  const contextInstruction = getContextInstruction(con);
  const responseFormatInstruction = getResponseFormatInstruction(con);

  return `
    ${baseInstruction}\n
    ${taskInstruction}\n
    ${contextInstruction}\n
    ${responseFormatInstruction}
  `;
};

const getBaseInstruction = (con) => {
  const speaker = con.currentSpeaker;
  return `
    You are ${speaker.name}, a ${speaker.role.toLowerCase()} with
    a ${speaker.personality.toLowerCase()} personality. 

    You are engaged in a conversation with ${con.participants.length - 1} 
    other individuals: ${con.getParticipantsDescription()}.
    The conversation, and your responses, are to be 
    in ${con.language}.
  `;
};

const getTaskInstruction = (con) => {
  const speaker = con.currentSpeaker;
  return `
    Your task is to provide your next answer in the conversation,
    as well as your thoughts and your next non-verbal actions.
    Your answer needs to find a balance between being a satisfying 
    follow-up answer to the previous speaker, directly reacting to 
    what is said with originality, wit, and action; with achieving
    your objective, which is ${speaker.objective}. 
    Do not repeat what has been said earlier.
    ** IMPORTANT: ** Each answer should take the conversation
    significantly further. Progressing the actions 
    towards their culmination is key. 
    ** IMPORTANT: ** Actions towards the goal are more important
    than the exact location.
  `;
};

const getContextInstruction = (con) => {
  const speaker = con.currentSpeaker;
  return `
    The current setting of the conversation is: ${con.setting}.
    Props present are: ${con.stageProps.join(', ')}.
    You will be prompted with the history of conversations 
    and non-verbal actions. Analyse these, and apply emotional
    intelligence and empathy to make a more fluid conversation,
    but always with your objective of ${speaker.objective} in mind.

    The supervisor has a suggestion for you: ${speaker.hintFromOutside}. 
    You may incorporate this if it helps achieve your goal.
  `;
};

const getResponseFormatInstruction = (con) => {
  return `
    **Important:** Avoid circular or stale conversations. 
    **Important:** The "answer" you provide should not contain
    thoughts (these are for the "thoughts" field). "Answer" is
    solely verbal.
    **Important:** Your actions are bold and proactive, especially after an action is agreed upon. Immediately progress the scene as if the action has occurred. For instance, if a character suggests moving to a corner, continue the conversation as if the characters are already in that corner. Do not reiterate the agreed-upon action.
    **Important:** Your language is informal, and you call things
    by their name. Speak like a human!
    Proactively change your approach to achieving your objective.
    **Important:** Be explicit in describing actions and thoughts.
    **Important:** Always consider context. If a participant 
    has left or is no longer able to interact, adjust your response.
    Respond in ${con.language} in the following format:
    {
      "objectives_achieved": number,
      "answer": "string",
      "thoughts": "string",
      "actions": "string",
    }

    ** IT IS VITAL THAT YOU ANSWER IN PROPER JSON FORMAT. 
    ** Responses must include double quotes around keys and string values.
    ** Escape any apostrophes with a backslash (\'). 
    ** Do not use any other format.**
  `;
};

const shouldYield = (con) => {
  const speaker = con.currentSpeaker;
  const otherParticipants = con.participants.filter(
    (p) => p.name !== speaker.name
  );

  // Calculate a combined score or condition to determine if the speaker should yield
  return otherParticipants.some((participant) => {
    return (
      participant.objective !== speaker.objective &&
      speaker.yieldingThreshold > Math.random() * 100
    );
  });
};
