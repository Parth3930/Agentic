/**
 * Main entry point for the Agentic Discord bot
 * Initializes services and starts the bot
 */

import { AIService } from './services/ai';
import { DiscordService } from './services/discord';
import { defaultCharacter } from './config/character';
import { customCharacter } from './config/customCharacter';
import { botConfig } from './config/botConfig';

// Load environment variables
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;

// Validate environment variables
if (!DISCORD_TOKEN) {
  console.error('Missing DISCORD_TOKEN environment variable');
  process.exit(1);
}

if (!MISTRAL_API_KEY) {
  console.error('Missing MISTRAL_API_KEY environment variable');
  process.exit(1);
}

// Select character configuration based on botConfig setting
const characterConfig = botConfig.useCustomCharacter ? customCharacter : defaultCharacter;

// Initialize services
const aiService = new AIService(MISTRAL_API_KEY, characterConfig);

// Start Discord bot
new DiscordService(DISCORD_TOKEN, aiService, characterConfig, botConfig);

console.log(`${characterConfig.name} bot is starting up with prefix '${botConfig.commandPrefix}'...`);
console.log(`Using ${botConfig.useCustomCharacter ? 'custom' : 'default'} character configuration.`);