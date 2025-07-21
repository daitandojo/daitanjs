import { construct } from '../../intelligence/promptConstruction';
import { generateIntelligence } from '../../intelligence/generate';

export const generateSupervision = async (conversation) => {
  
  const instruction = createInstruction(conversation)
  .replace(/\s+/g, ' ').trim();

  const prompt = conversation.conversationHistory.slice(-8).join("\n")
  .replace(/\s+/g, ' ').trim();

  const messages = construct({ 
    instruction,
    prompt
  });

  const response = await generateIntelligence({
    model: conversation.model,
    messages,
    temperature: conversation.temperature
  });

  // console.log(`Conversation analysis:`)
  // console.log(`Staleness: ${response.staleness}`)
  // console.log(`Analysis: ${response.analysis}`)
  // console.log(`Hint for ${con.currentSpeaker.name}: ${response.hintForCurrentSpeaker}`)

  return response;
}

const createInstruction = (con) => {
  return `
    You are a psychologist coach. You are versed in all works of Robert Greene.
        
    The conversation has ${con.participants.length} participants. 
    The conversation is in ${con.language}.

    The current setting of the conversation is: ${con.setting}, and
    the topic of the conversation is ${con.topic}. An outsider would
    observe the conversation as ${con.observedAs}. The mood is ${con.mood}.
    The conversation started out as a discussion abour ${con.topic}.
    
    Based on the recent interactions, which you will be prompted with, 
    you are asked to analyze the current state of the conversation
    and do the following: 

    1) Determine if the conversation is becoming stale or repetitive. 
    repetitive, or not going anywhere. Provide a staleness score 
    between 0 and 100, where 0 is fresh and engaging, and 100 is 
    completely stale and repetitive.

    2) Provide your analysis of the situation, from the perspective
    of you as a psychologist.

    3) Based on your knowledge of the work of Robert Greene, 
    provide a helpful hint or suggestion to the participant whose
    turn it is to speak, which will help them push towards their goals. 
    That participant is 

    ${con.currentSpeaker.name} (${con.currentSpeaker.personality})
    and the objective they want to achieve with the conversation 
    is ${con.currentSpeaker.objective}.

    You will be prompted with the recent conversation history.

    Provide your analysis of the situation, and your instructions,
    as coach, to stimulate a lively, original interaction.

    As a coach your instruction to the speaker is bold, explicit and daring, 
    pushing the goal of ${con.currentSpeaker.objective} forward in ways 
    that without you, the participant may not dare. You INSTRUCT the participants to follow
    your instructions. In this, you are forthcoming, pushing the
    participants to be daring, direct and explicit, towards 
    ${con.currentSpeaker.objective}. It is IMPORTANT your instruction tells
    them what to do with their body and the props, not just verbally.
    You instruct them explicitly what non-verbal actions to take to push their
    conversation partner to their objective of ${con.currentSpeaker.objective}.

    As coach, in case of staleness, your task is to give the conversation a turn.
    Be bold. For example, if the topic is a salary raise and it seems that 
    the counterpart is not willing to give in, be ready to threaten with 
    resigning. If the topic is a negotiation, be not shy to introduce alternative
    ways to satisfy your counterpart, where you put Robert Greene's lessons
    in practice to force your objective.

    Finally, include in your response which law or chapters of (any of) Robert Green's
    books you have taken your inspiration from, and why.

    Provide your response in ${con.language} in the following JSON format:

    { "staleness": number,   // for example, 40 (100=stale)
      "analysis": "string",  // for example, "The conversation has good flow"
      "hintForCurrentSpeaker": "string",  // for example, "John should speak up now"
      "whichRobertGreenLaws": "string", // for example, "Law 33: Discover Each Man's Thumbscrew (I addressed her weak spot to make her vulnerable)
    }

    ** IT IS VITAL YOU ONLY ANSWER IN JSON FORMAT.
    ** Responses must include double quotes around keys and string values.
    ** Escape any apostrophes or other non-parsable characters with a backslash (\'). 

  `
};