/**
 * Bot configuration for the Agentic Discord bot
 * This file contains general settings for the bot's operation
 */

export interface BotConfig {
  /**
   * The command prefix that triggers the bot
   * Messages starting with this prefix will be processed by the bot
   */
  commandPrefix: string;

  /**
   * Whether to allow @mentions to trigger the bot
   * If true, mentioning the bot will also trigger a response
   */
  allowMentionTrigger: boolean;
  
  /**
   * Whether to use the custom character configuration
   * If false, the default character will be used
   */
  useCustomCharacter: boolean;
}

/**
 * Default bot configuration
 * Modify these values to change the bot's behavior
 */
export const botConfig: BotConfig = {
  commandPrefix: 'agentic',
  allowMentionTrigger: true,
  useCustomCharacter: true
};