/**
 * Discord service for the Agentic Discord bot
 * Handles interactions with the Discord API
 */

import { Client, Events, GatewayIntentBits } from "discord.js";
import { AIService } from "./ai";
import { CharacterConfig } from "../config/character";
import { BotConfig } from "../config/botConfig";
import { ModerationService } from "./moderation";
import { FilterManager } from "./filterManager";
import { MessageHandler } from "./messageHandler";
import { FunctionExecutor } from "./functionExecutor";

export class DiscordService {
  private client: Client;
  private messageHandler: MessageHandler;

  /**
   * Creates a new Discord service instance
   * @param token Discord bot token
   * @param aiService AI service instance
   * @param character Character configuration
   * @param botConfig Bot configuration
   */
  constructor(
    token: string,
    aiService: AIService,
    character: CharacterConfig,
    botConfig: BotConfig
  ) {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });

    // Initialize the moderation service with a new FilterManager
    const filterManager = new FilterManager(this.client);
    const moderationService = new ModerationService(this.client, filterManager);
    
    // Initialize the function executor with the moderation service
    const functionExecutor = new FunctionExecutor(moderationService);
    
    // Initialize the message handler
    this.messageHandler = new MessageHandler(
      aiService,
      character,
      botConfig,
      functionExecutor
    );

    this.setupEventHandlers();
    this.login(token);
  }

  /**
   * Sets up event handlers for Discord events
   */
  private setupEventHandlers(): void {
    // Event handler for when the bot is ready
    this.client.once(Events.ClientReady, (readyClient) => {
      console.log(`Ready! Logged in as ${readyClient.user.tag}`);
    });

    // Event handler for incoming messages
    this.client.on(
      Events.MessageCreate, 
      this.messageHandler.handleMessage.bind(this.messageHandler)
    );
  }

  /**
   * Logs in to Discord with the provided token
   * @param token Discord bot token
   */
  private login(token: string): void {
    this.client.login(token).catch((error) => {
      console.error("Failed to log in to Discord:", error);
      process.exit(1);
    });
  }
}