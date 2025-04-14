/**
 * Function executor for the Agentic Discord bot
 * Handles execution of function calls from the AI service
 */

import { Message } from "discord.js";
import { FunctionCall } from "./ai";
import { ModerationService } from "./moderation";

export class FunctionExecutor {
  private moderationService: ModerationService;

  /**
   * Creates a new function executor instance
   * @param moderationService Moderation service instance
   */
  constructor(moderationService: ModerationService) {
    this.moderationService = moderationService;
  }

  /**
   * Handles function calls from the AI service
   * @param functionCall The function call from the AI service
   * @param message The original Discord message
   * @returns Result message
   */
  public async handleFunctionCall(
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
          const guild = message.client.guilds.cache.get(guildId);
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