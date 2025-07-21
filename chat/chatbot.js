import dotenv from 'dotenv';
import path from 'path';

class Chatbot {
  constructor({
    name,
    role,
    gender,
    personality = 'enthusiastic',
    transparency = true,
    objective = 'have a good conversation',
    achieved = 0,
    speakingStyle = 'concise',
    innerWorld = [
      "I'm ready to start this conversation and achieve my objective.",
    ],
    hintFromOutside = 'No thoughts from outside yet.',
    knowledgeBase = {},
    maxInnerWoldSize = 8,
    currentLocation = null,
    model = 'gpt-4o-mini',
    temperature = 1.0,
    yieldingThreshold = 50, // New property to determine the likelihood of yielding
  }) {
    if (!name || !role) {
      throw new Error('Name and role are required for a Chatbot');
    }
    this.name = name;
    this.role = role;
    this.gender = gender;
    this.personality = personality;
    this.transparency = transparency;
    this.objective = objective;
    this.achieved = achieved;
    this.speakingStyle = speakingStyle;
    this.innerWorld = innerWorld;
    this.hintFromOutside = hintFromOutside;
    this.knowledgeBase = knowledgeBase;
    this.maxInnerWoldSize = maxInnerWoldSize;
    this.currentLocation = currentLocation;
    this.model = model;
    this.temperature = temperature;
    this.yieldingThreshold = yieldingThreshold; // Initialize the new property
  }

  async respond(con) {
    // Determine if the bot should yield based on the threshold
    if (Math.random() * 100 < this.yieldingThreshold) {
      console.log(`${this.name} is considering yielding...`);
      con.currentSpeaker = this; // Ensure the current speaker is set to this chatbot
      con.shouldYield = true; // Add a flag to the conversation indicating yielding intent
    } else {
      con.shouldYield = false; // No yielding this time
    }
    const response = await generateResponse(con);
    this.checkAchievement(response);
    this.updateInnerWorld(con, response);
    return response;
  }

  checkAchievement(response) {
    this.achieved = response.objectives_achieved;
    if (this.achieved === 100) {
      console.log('GOAL ACHIEVED');
    }
  }

  updateInnerWorld(con, response) {
    this.innerWorld.push(response.thoughts);
    if (this.innerWorld.length > this.maxInnerWoldSize) {
      this.innerWorld.shift();
    }
  }

  canParticipate(setting) {
    return true;
  }
}

export { Chatbot };
