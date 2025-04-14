/**
 * Message handler for the Agentic Discord bot
 * Handles processing of incoming Discord messages
 */

import { Message } from "discord.js";
import { AIService, FunctionCall } from "./ai";
import { CharacterConfig } from "../config/character";
import { BotConfig } from "../config/botConfig";
import { FunctionParser } from "./functionParser";
import { FunctionExecutor } from "./functionExecutor";

export class MessageHandler {
  private aiService: AIService;
  private character: CharacterConfig;
  private botConfig: BotConfig;
  private functionExecutor: FunctionExecutor;

  /**
   * Creates a new message handler instance
   * @param aiService AI service instance
   * @param character Character configuration
   * @param botConfig Bot configuration
   * @param functionExecutor Function executor instance
   */
  constructor(
    aiService: AIService,
    character: CharacterConfig,
    botConfig: BotConfig,
    functionExecutor: FunctionExecutor
  ) {
    this.aiService = aiService;
    this.character = character;
    this.botConfig = botConfig;
    this.functionExecutor = functionExecutor;
  }

  /**
   * Handles incoming Discord messages
   * @param message The Discord message
   */
  public async handleMessage(message: Message): Promise<void> {
    // Ignore messages from bots to prevent potential loops
    if (message.author.bot) return;

    // Check if the message starts with the command prefix or mentions the bot
    const isMentioned =
      this.botConfig.allowMentionTrigger &&
      message.mentions.users.has(message.client.user?.id || "");
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
            .replace(new RegExp(`<@!?${message.client.user?.id}>`), "")
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
        const directFunctionCall = FunctionParser.parseFunctionCall(query);
        if (directFunctionCall) {
          console.log(`Direct function call detected: ${directFunctionCall.name}`, directFunctionCall.arguments);
          
          // For message deletion, use current channel if not specified
          if (directFunctionCall.name.toLowerCase() === "deletemessages" && !directFunctionCall.arguments.channelId) {
            directFunctionCall.arguments.channelId = message.channel.id;
          }
          
          const result = await this.functionExecutor.handleFunctionCall(directFunctionCall, message);
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
          
          const result = await this.functionExecutor.handleFunctionCall(deleteFunction, message);
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
          
          const result = await this.functionExecutor.handleFunctionCall(
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
}