/**
 * Discord service for the Agentic Discord bot
 * Handles interactions with the Discord API
 */

import { Client, Events, GatewayIntentBits, Message } from "discord.js";
import { AIService, FunctionCall } from "./ai";
import { CharacterConfig } from "../config/character";
import { BotConfig } from "../config/botConfig";
import { ModerationService } from "./moderation";

export class DiscordService {
  private client: Client;
  private aiService: AIService;
  private character: CharacterConfig;
  private botConfig: BotConfig;
  private moderationService: ModerationService;

  /**
   * Creates a new Discord service instance
   * @param token Discord bot token
   * @param aiService AI service instance
   * @param character Character configuration
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
    this.aiService = aiService;
    this.character = character;
    this.botConfig = botConfig;

    // Initialize the moderation service
    this.moderationService = new ModerationService(this.client);

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
    this.client.on(Events.MessageCreate, this.handleMessage.bind(this));
  }

  /**
   * Handles incoming Discord messages
   * @param message The Discord message
   */
  private async handleMessage(message: Message): Promise<void> {
    // Ignore messages from bots to prevent potential loops
    if (message.author.bot) return;

    // Check if the message starts with the command prefix or mentions the bot
    const isMentioned =
      this.botConfig.allowMentionTrigger &&
      message.mentions.users.has(this.client.user?.id || "");
    // Make command prefix check case-insensitive
    const hasPrefix = message.content
      .toLowerCase()
      .startsWith(this.botConfig.commandPrefix.toLowerCase());

    if (hasPrefix || isMentioned) {
      try {
        // Extract the user's query
        let query = "";
        if (hasPrefix) {
          query = message.content
            .slice(this.botConfig.commandPrefix.length)
            .trim();
        } else {
          // Remove the mention and extract the query
          query = message.content
            .replace(new RegExp(`<@!?${this.client.user?.id}>`), "")
            .trim();
        }

        // If there's no query after the keyword, prompt the user with a greeting
        if (!query) {
          await message.reply(this.character.greetingMessage);
          return;
        }

        // Check if this is a potential moderation command
        const isModerationCommand = this.detectModerationCommand(query);

        // Generate a response using the AI service, enabling moderation tools if needed
        const response = await this.aiService.generateResponse(
          query,
          isModerationCommand
        );

        // Handle function calls if present
        if (response.functionCall) {
          const result = await this.handleFunctionCall(
            response.functionCall,
            message
          );
          if (result && result.trim()) {
            await message.reply(result);
          } else {
            await message.reply("Command executed successfully.");
          }
          return;
        }

        // Reply to the user with the AI-generated response, ensuring it's not empty
        if (response.content && response.content.trim()) {
          await message.reply(response.content);
        } else {
          await message.reply(this.character.errorMessages.general);
        }
      } catch (error) {
        console.error("Error processing message:", error);
        await message.reply(this.character.errorMessages.general);
      }
    }
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

  /**
   * Detects if a query is likely a moderation command
   * @param query The user's query
   * @returns Whether the query appears to be a moderation command
   */
  private detectModerationCommand(query: string): boolean {
    const moderationKeywords = [
      "kick",
      "ban",
      "mute",
      "timeout",
      "remove",
      "moderate",
      "moderation",
      "admin",
      "administrator",
    ];

    // Convert to lowercase for case-insensitive matching
    const lowercaseQuery = query.toLowerCase();

    // Check if any moderation keywords are present in the query
    return moderationKeywords.some((keyword) =>
      lowercaseQuery.includes(keyword)
    );
  }

  /**
   * Handles function calls from the AI service
   * @param functionCall The function call from the AI service
   * @param message The original Discord message
   * @returns Result message
   */
  private async handleFunctionCall(
    functionCall: FunctionCall,
    message: Message
  ): Promise<string> {
    const { name, arguments: args } = functionCall;

    // Get the guild ID from the message
    const guildId = message.guild?.id;
    if (!guildId) return "Error: This command can only be used in a server.";

    // Resolve user ID if a username was provided instead of an ID or mention
    let userId = args.userId;
    if (userId) {
      // Handle mentions properly - this is important for the error case
      // First, check if it's a mention format and extract the ID
      const mentionMatch = userId.match(/<@!?(\d+)>/);
      if (mentionMatch) {
        userId = mentionMatch[1];
      } else {
        // Remove any @ symbol at the beginning if present
        userId = userId.replace(/^@+/, '');
        
        // If it's not a numeric ID, try to find the user by name
        if (!userId.match(/^\d+$/)) {
          const guild = this.client.guilds.cache.get(guildId);
          if (guild) {
            try {
              // Fetch all members if needed
              if (guild.members.cache.size === 0) {
                await guild.members.fetch();
              }

              // Find member by username, display name, or partial match
              const lowerUserId = userId.toLowerCase();
              const member = guild.members.cache.find(m => {
                // Check for exact username match
                if (m.user.username.toLowerCase() === lowerUserId) return true;
                // Check for exact nickname match
                if (m.nickname && m.nickname.toLowerCase() === lowerUserId) return true;
                // Check for partial username match
                if (m.user.username.toLowerCase().includes(lowerUserId)) return true;
                // Check for partial nickname match
                if (m.nickname && m.nickname.toLowerCase().includes(lowerUserId)) return true;
                return false;
              });

              if (member) {
                userId = member.id;
              } else {
                return `Error: Could not find user '${userId}' in this server.`;
              }
            } catch (error) {
              console.error("Error resolving username:", error);
              return `Error: Failed to resolve username '${userId}'.`;
            }
          }
        }
      }
    }

    // Handle different moderation functions
    switch (name) {
      case "kickUser":
        return await this.moderationService.kickUser(
          guildId,
          userId,
          args.reason
        );

      case "banUser":
        return await this.moderationService.banUser(
          guildId,
          userId,
          args.reason,
          args.deleteMessageDays
        );

      case "muteUser":
        return await this.moderationService.muteUser(
          guildId,
          userId,
          args.duration,
          args.reason
        );

      default:
        return `Error: Unknown function '${name}'.`;
    }
  }
}
