import chalk from 'chalk';
import { generateOpeningPhrase } from './agents/openingphrase';
import { generateNewElement } from './agents/choreographer';
import { generateSupervision } from './agents/coach';

const STALENESS_THRESHOLD = 80;
const MAX_TURNS = 80;
const GOAL_ACHIEVEMENT_THRESHOLDS = {
  FULL: 94,
  SUBSTANTIAL: 70,
  MODERATE: 50,
};

class Conversation {
  constructor({
    participants = [],
    setting = 'default setting',
    observedAs = 'a helpful conversation',
    mood = 'neutral',
    language = 'English',
    currentSpeaker = null,
    topic = 'default topic',
    stageProps = [],
    nonVerbalActionsHistory = [],
    model = 'gpt-4o-mini',
    temperature = 1.0,
  }) {
    this.participants = participants;
    this.setting = setting;
    this.observedAs = observedAs;
    this.language = language;
    this.currentSpeaker = currentSpeaker;
    this.topic = topic;
    this.mood = mood;
    this.model = model;
    this.temperature = temperature;
    this.stageProps = stageProps;
    this.lastSpeaker = null;
    this.conversationHistory = [];
    this.nonVerbalActionsHistory = [];
    this.contextHistory = [];
    this.turn = 0;
  }

  async start() {
    await this.initializeConversation();

    while (this.canContinueConversation()) {
      const nextParticipant = this.selectNextParticipant();
      if (!nextParticipant) break;

      console.log('=======================');
      this.currentSpeaker = nextParticipant;
      await this.processTurn(nextParticipant);

      if (this.isGoalAchieved()) break;
    }

    this.endConversation();
  }

  async initializeConversation() {
    this.currentSpeaker = this.selectNextParticipant();
    const res = await generateOpeningPhrase(this);
    console.log(`Current speaker: ${this.currentSpeaker.name}`);
    console.log(res.openingPhrase);
    this.addToConversationHistory(this.currentSpeaker, res.openingPhrase);
  }

  getParticipantsDescription() {
    return this.participants
      .filter((p) => p.name !== this.currentSpeaker.name)
      .map((p) => `${p.name}, whose personality is ${p.personality}`)
      .join('; ');
  }

  canContinueConversation() {
    return true; // this.turn < MAX_TURNS;
  }

  selectNextParticipant() {
    const availableParticipants = this.getAvailableParticipants();
    if (availableParticipants.length === 0) {
      console.log(chalk.red('No available participants. Ending conversation.'));
      return null;
    }
    return this.randomChoice(availableParticipants);
  }

  getAvailableParticipants() {
    return this.participants.filter((p) => {
      return p !== this.lastSpeaker && p.canParticipate(this.setting);
    });
  }

  randomChoice(array) {
    return array[Math.floor(Math.random() * array.length)];
  }

  async processTurn(participant) {
    try {
      const hint = await this.superviseConversation();
      participant.hintFromOutside = hint;
      const response = await participant.respond(this);

      participant.checkAchievement(response);
      participant.updateInnerWorld(this, response);

      console.log('--------------------------');
      console.log(
        `${participant.name} (${response.objectives_achieved}): ${response.answer}`,
      );

      this.addToConversationHistory(participant, response.answer);
      this.addToNonVerbalActionsHistory(participant, response.actions);

      const context = await generateNewElement(this);
      this.contextHistory.push(context);
      this.updateConversationContext(context);
      this.lastSpeaker = participant;
      this.turn++;
    } catch (error) {
      this.handleTurnError(participant, error);
    }
  }

  async superviseConversation() {
    console.log(`Current speaker: ${this.currentSpeaker.name}`);
    const res = await generateSupervision(this);
    this.staleness = res.staleness;
    this.supervisorAnalysis = res.analysis;
    this.currentSpeaker.hintFromOutside = res.hintForCurrentSpeaker;
    console.log(chalk.green('Staleness score:', res.staleness));
    console.log(chalk.green('Psychologist:', res.analysis));
    console.log(chalk.green('Hint:', res.hintForCurrentSpeaker));
    console.log(chalk.green('Laws:', res.whichRobertGreenLaws));

    if (res.staleness > STALENESS_THRESHOLD) {
      console.log(
        chalk.yellow('Conversation becoming stale. Introducing new element.'),
      );
      const newContext = await this.introduceNewElement();
      if (newContext) {
        this.updateConversationContext(newContext);
      }
    }

    return res.hintForCurrentSpeaker;
  }

  async updateConversationState(participant, response) {
    this.addToConversationHistory(participant, response.answer);
    this.addToNonVerbalActionsHistory(participant, response.actions);
    const context = await generateNewElement(this);
    this.contextHistory.push(context);
    this.updateConversationContext(context);
    this.lastSpeaker = participant;
  }

  addToConversationHistory(speaker, message) {
    this.conversationHistory.push(`${speaker.name}: ${message}`);
  }

  addToNonVerbalActionsHistory(speaker, actions) {
    this.nonVerbalActionsHistory.push(`${speaker.name}: ${actions}`);
  }

  displayTurnInfo(participant, response) {
    console.log(
      chalk.blue(`${this.conversationHistory.length} items in conversation.`),
    );
    console.log('\n' + chalk.yellow(`${participant.name}: ${response.answer}`));
    console.log(chalk.blue(response.actions));
    console.log(chalk.green(`Intentions achieved: ${participant.achieved}%`));
  }

  handleTurnError(participant, error) {
    console.error(`Error for ${participant.name}:`, error);
    console.log(
      chalk.red('Skipping to the next participant due to the error.'),
    );
  }

  async introduceNewElement() {
    const response = await generateNewElement(this);
    console.log(chalk.cyan(`Introducing new element: ${response.description}`));
    return this.updateContextWithNewElement(response);
  }

  updateContextWithNewElement(response) {
    switch (response.elementType) {
      case 'event':
      case 'action':
        this.conversationHistory.push(`[Narrator]: ${response.description}`);
        break;
      case 'topic':
        this.references.push(response.description);
        break;
      case 'prop':
        this.stageProps.push(response.description);
        break;
      case 'setting':
        // this.setting = response.description;
        break;
    }

    return {
      setting: this.setting,
      stageProps: this.stageProps,
      references: this.references,
    };
  }

  updateConversationContext(context) {
    // Object.assign(this, context);
  }

  isGoalAchieved() {
    const averageAchievement =
      this.participants.reduce((sum, p) => sum + p.achieved, 0) /
      this.participants.length;
    return averageAchievement >= GOAL_ACHIEVEMENT_THRESHOLDS.FULL;
  }

  endConversation() {
    console.log(chalk.magenta('Conversation ended.'));

    const summary = this.summarizeConversation();
    console.log(chalk.yellow('Conversation Summary:'));
    console.log(summary);

    const goalAchievement = this.assessGoalAchievement();
    console.log(
      chalk.green(`Goal Achievement: ${goalAchievement.percentage}%`),
    );
    console.log(chalk.green(`Assessment: ${goalAchievement.assessment}`));

    const participantFeedback = this.getParticipantFeedback();
    console.log(chalk.blue('Participant Feedback:'));
    participantFeedback.forEach((feedback) => {
      console.log(chalk.blue(`${feedback.name}: ${feedback.thoughts}`));
    });

    this.saveConversationLog();
  }

  summarizeConversation() {
    const totalMessages = this.conversationHistory.length;
    const keyEvents = this.conversationHistory.filter((msg) =>
      msg.startsWith('[Narrator]'),
    );
    return (
      `This conversation had ${totalMessages} exchanges between ${this.participants.length} participants. ` +
      `The main topic was "${this.topic}". ` +
      `Key events: ${keyEvents.join('. ')}`
    );
  }

  assessGoalAchievement() {
    const averageAchievement =
      this.participants.reduce((sum, p) => sum + (p.achieved || 0), 0) /
      this.participants.length;
    let assessment;
    if (averageAchievement >= GOAL_ACHIEVEMENT_THRESHOLDS.FULL) {
      assessment = `Goal fully achieved. Average achievement ${averageAchievement}. Excellent progress!`;
    } else if (averageAchievement >= GOAL_ACHIEVEMENT_THRESHOLDS.SUBSTANTIAL) {
      assessment = 'Substantial progress towards the goal. Good job!';
    } else if (averageAchievement >= GOAL_ACHIEVEMENT_THRESHOLDS.MODERATE) {
      assessment = "Moderate progress. There's room for improvement.";
    } else {
      assessment = 'Limited progress. The goal was not adequately addressed.';
    }
    return { percentage: averageAchievement, assessment };
  }

  getParticipantFeedback() {
    return this.participants.map((p) => ({
      name: p.name,
      thoughts: `I felt the conversation was ${this.randomChoice(['productive', 'challenging', 'interesting', 'enlightening'])}.`,
    }));
  }

  saveConversationLog() {
    console.log(chalk.grey('Conversation log saved.'));
    // Implement actual logic to save the conversation log to a file or database
  }
}

export { Conversation };
