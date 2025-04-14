/**
 * Discord service for the Agentic Discord bot
 * Handles interactions with the Discord API
 */

import { Client, Events, GatewayIntentBits, Message } from "discord.js";
import { AIService, FunctionCall } from "./ai";
import { CharacterConfig } from "../config/character";
import { BotConfig } from "../config/botConfig";
import { ModerationService } from "./moderation";
import { FilterManager } from "./filterManager";

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

    // Initialize the moderation service with a new FilterManager
    const filterManager = new FilterManager(this.client);
    this.moderationService = new ModerationService(this.client, filterManager);

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
   * Checks if a message contains a direct function call pattern
   * @param content The message content to check
   * @returns The parsed function call or null if not a function call
   */
  private parseFunctionCall(content: string): FunctionCall | null {
    console.log(`Attempting to parse function call: ${content}`);
    
    // Check for simple delete messages command
    const deleteMessagesRegex = /^delete\s+(\d+)\s+messages$/i;
    const deleteMatch = content.trim().match(deleteMessagesRegex);
    if (deleteMatch) {
      console.log(`Matched simple delete command, amount: ${deleteMatch[1]}`);
      return {
        name: "deleteMessages",
        arguments: {
          amount: deleteMatch[1]
          // channelId will be added in handleFunctionCall
        }
      };
    }
    
    // First, try to match object notation: functionName({ key: "value", key2: "value2" })
    const objectNotationRegex = /^(\w+)\s*\(\s*\{([^}]+)\}\s*\)$/;
    const objectMatch = content.trim().match(objectNotationRegex);
    
    if (objectMatch) {
      const functionName = objectMatch[1];
      const argsString = objectMatch[2];
      
      console.log(`Matched object notation function: ${functionName}, args: ${argsString}`);
      
      // Parse the arguments
      const args: Record<string, any> = {};
      
      // Match each parameter: key: "value" or key: value
      const paramRegex = /(\w+)\s*:\s*(?:"([^"]*)"|([^,]+))(?:,|$)/g;
      let paramMatch;
      
      while ((paramMatch = paramRegex.exec(argsString)) !== null) {
        const key = paramMatch[1];
        // Use the quoted value if available, otherwise use the unquoted value
        const value = paramMatch[2] !== undefined ? paramMatch[2] : paramMatch[3].trim();
        args[key] = value;
      }
      
      console.log(`Parsed arguments:`, args);
      
      return {
        name: functionName,
        arguments: args
      };
    }
    
    // If object notation doesn't match, try the original format: functionName(param1: "value1", param2: "value2")
    const functionCallRegex = /^(\w+)\s*\(([^)]*)\)$/;
    const match = content.trim().match(functionCallRegex);
    
    if (!match) return null;
    
    const functionName = match[1];
    const argsString = match[2];
    
    // If it's a deleteMessages call with just numbers, parse differently
    if (functionName.toLowerCase() === "deletemessages" && argsString.split(",").length <= 2 && !argsString.includes(":")) {
      const params = argsString.split(",").map(p => p.trim());
      // If there's only one parameter, it's the amount
      if (params.length === 1) {
        return {
          name: "deleteMessages",
          arguments: {
            amount: params[0]
            // channelId will be added in handleFunctionCall
          }
        };
      } 
      // If there are two parameters, first is channelId, second is amount
      else if (params.length === 2) {
        return {
          name: "deleteMessages",
          arguments: {
            channelId: params[0],
            amount: params[1]
          }
        };
      }
    }
    
    // Regular parsing for other function calls with named parameters
    const args: Record<string, any> = {};
    
    // Match each parameter: key: "value" or key: value
    const paramRegex = /(\w+)\s*:\s*(?:"([^"]*)"|([^,]+))(?:,|$)/g;
    let paramMatch;
    
    while ((paramMatch = paramRegex.exec(argsString)) !== null) {
      const key = paramMatch[1];
      // Use the quoted value if available, otherwise use the unquoted value
      const value = paramMatch[2] !== undefined ? paramMatch[2] : paramMatch[3].trim();
      args[key] = value;
    }
    
    return {
      name: functionName,
      arguments: args
    };
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
        
        // Check if the query starts with "agentic" and remove it (common user pattern)
        if (query.toLowerCase().startsWith("agentic")) {
          query = query.slice(7).trim();
        }
        
        // Check if the query is a direct function call
        const directFunctionCall = this.parseFunctionCall(query);
        if (directFunctionCall) {
          console.log(`Direct function call detected: ${directFunctionCall.name}`, directFunctionCall.arguments);
          
          // For message deletion, use current channel if not specified
          if (directFunctionCall.name.toLowerCase() === "deletemessages" && !directFunctionCall.arguments.channelId) {
            directFunctionCall.arguments.channelId = message.channel.id;
          }
          
          const result = await this.handleFunctionCall(directFunctionCall, message);
          console.log(`Function call result: ${result}`);
          if (result && result.trim()) {
            await message.reply(result);
          } else {
            await message.reply("Command executed successfully.");
          }
          return;
        }

        // Check for natural language delete messages command
        const deleteRegex = /delete\s+(\d+)\s+messages/i;
        const deleteMatch = query.match(deleteRegex);
        if (deleteMatch) {
          const amount = parseInt(deleteMatch[1]);
          
          // Validate amount before proceeding
          if (isNaN(amount) || amount <= 0) {
            await message.reply("Error: Amount must be a positive number");
            return;
          }
          
          const deleteFunction: FunctionCall = {
            name: "deleteMessages",
            arguments: {
              channelId: message.channel.id,
              amount: amount.toString()
            }
          };
          
          const result = await this.handleFunctionCall(deleteFunction, message);
          console.log(`Delete messages result: ${result}`);
          if (result && result.trim()) {
            await message.reply(result);
          } else {
            await message.reply(`Successfully deleted ${amount} messages from this channel.`);
          }
          return;
        }

        // Check if this is a potential moderation or server management command
        const isModerationCommand = this.detectModerationCommand(query);

        // Generate a response using the AI service, enabling appropriate tools
        const response = await this.aiService.generateResponse(
          query,
          isModerationCommand,  // Enable moderation tools
          isModerationCommand   // Also enable server management tools
        );

        // Handle function calls if present
        if (response.functionCall) {
          // For message deletion, use current channel if not specified
          if (response.functionCall.name.toLowerCase() === "deletemessages" && !response.functionCall.arguments.channelId) {
            response.functionCall.arguments.channelId = message.channel.id;
          }
          
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
   * Detects if a query is likely a moderation or server management command
   * @param query The user's query
   * @returns Whether the query appears to be a moderation or server management command
   */
  private detectModerationCommand(query: string): boolean {
    const moderationKeywords = [
      // Moderation keywords
      "kick",
      "ban",
      "mute",
      "timeout",
      "remove",
      "moderate",
      "moderation",
      "admin",
      "administrator",
      // Server management keywords
      "create",
      "channel",
      "category",
      "delete",
      "message",
      "embed",
      "server",
      "manage",
      "setup",
      "purge"
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

    // Log the function call for debugging
    console.log(`Executing function: ${name}`, args);

    // Handle different moderation and server management functions
    switch (name.toLowerCase()) {  // Make case insensitive
      // Moderation functions
      case "kickuser":
        return await this.moderationService.kickUser(
          guildId,
          userId,
          args.reason
        );

      case "banuser":
        return await this.moderationService.banUser(
          guildId,
          userId,
          args.reason,
          args.deleteMessageDays
        );

      case "muteuser":
        return await this.moderationService.muteUser(
          guildId,
          userId,
          args.duration,
          args.reason
        );

      case "filtersettings":
        return await this.moderationService.setFilterSettings(
          guildId,
          message.author.id,
          args.enabled
        );

      case "warnuser":
        return await this.moderationService.warnUser(
          guildId,
          userId,
          args.reason
        );

      // Server management functions
      case "createcategory":
        return await this.moderationService.createCategory(
          guildId,
          args.name,
          args.position
        );

      case "createchannel":
        console.log("Creating channel with args:", args);
        console.log("Resolved guild ID:", guildId);
        
        // Validate required parameters
        if (!args.name) {
          console.error('Missing required parameter: name');
          return "Error: Channel name is required";
        }

        // Validate channel type
        const channelType = args.type ? args.type.toLowerCase() : 'text';
        if (!['text', 'voice', 'announcement'].includes(channelType)) {
          console.error('Invalid channel type:', args.type);
          return `Error: Invalid channel type '${args.type}'. Valid types are: text, voice, announcement.`;
        }

        try {
          return await this.moderationService.createChannel(
            guildId,
            args.name.trim(),
            channelType,
            args.categoryId,
            args.topic
          );
        } catch (error) {
          console.error("Error in createChannel function call:", error);
          return `Error: Failed to create channel. ${error instanceof Error ? error.message : 'Unknown error'}`;
        }

      case "deletechannel":
        return await this.moderationService.deleteChannel(
          guildId,
          args.channelId,
          args.reason
        );

      case "deletemessages":
        console.log("Deleting messages with args:", args);
        
        // Use current channel if not specified
        const channelId = args.channelId || message.channel.id;
        
        // Validate amount parameter
        const amount = parseInt(args.amount);
        if (isNaN(amount) || amount <= 0) {
          return "Error: Amount must be a positive number";
        }
        
        try {
          // If amount is greater than 100, handle it in chunks
          if (amount > 100) {
            // Limit to a reasonable maximum to prevent abuse
            const maxToDelete = Math.min(amount, 1000);
            const chunks = Math.ceil(maxToDelete / 100);
            let totalDeleted = 0;
            
            await message.reply(`Attempting to delete ${maxToDelete} messages in ${chunks} batches. This may take a moment...`);
            
            for (let i = 0; i < chunks && totalDeleted < maxToDelete; i++) {
              const batchSize = Math.min(100, maxToDelete - totalDeleted);
              const result = await this.moderationService.deleteMessages(
                guildId,
                channelId,
                batchSize,
                args.reason || "Requested by user"
              );
              
              // Extract the number of messages deleted from the result
              const deletedMatch = result.match(/Successfully deleted (\d+) message/);
              if (deletedMatch) {
                totalDeleted += parseInt(deletedMatch[1]);
              } else if (result.includes("Error")) {
                // Stop if we hit an error
                return `Partially completed. Deleted ${totalDeleted} messages. Stopped due to: ${result}`;
              }
            }
            
            return `Successfully deleted ${totalDeleted} message(s) from the channel.`;
          } else {
            // Handle normal case (100 or fewer messages)
            return await this.moderationService.deleteMessages(
              guildId,
              channelId,
              amount,
              args.reason || "Requested by user"
            );
          }
        } catch (error) {
          console.error("Error in deleteMessages function call:", error);
          return `Error: Failed to delete messages. ${error instanceof Error ? error.message : 'Unknown error'}`;
        }

      case "createembed":
        return await this.moderationService.createEmbed(
          guildId,
          args.channelId || message.channel.id,  // Use current channel if not specified
          args.title,
          args.description,
          args.color,
          args.fields,
          args.footer,
          args.image,
          args.thumbnail
        );

      default:
        return `Error: Unknown function '${name}'.`;
    }
  }
}