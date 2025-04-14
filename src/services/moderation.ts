/**
 * Moderation service for the Agentic Discord bot
 * Handles moderation actions like kick, ban, and mute
 * Also handles server management actions like creating channels and categories
 */

import { Client, GuildMember, User, Guild, TextChannel, PermissionFlagsBits, Role, Collection, ChannelType, CategoryChannel, GuildChannelCreateOptions, ColorResolvable, EmbedBuilder, MessageCreateOptions } from 'discord.js';
import { FilterManager } from './filterManager';

export class ModerationService {
  private client: Client;
  private muteRoles: Map<string, string>;
  private mutedUsers: Map<string, NodeJS.Timeout>;
  private filterManager: FilterManager;

  /**
   * Creates a new moderation service instance
   * @param client Discord client instance
   * @param filterManager FilterManager instance
   */
  constructor(client: Client, filterManager: FilterManager) {
    this.client = client;
    this.muteRoles = new Map();
    this.mutedUsers = new Map();
    this.filterManager = filterManager; // Initialize filterManager
  }

  /**
   * Resolves a user ID or mention to a GuildMember
   * @param guild The guild where the action is taking place
   * @param userIdOrMention User ID, mention string, or username
   * @returns The resolved GuildMember or null if not found
   */
  private async resolveUser(guild: Guild, userIdOrMention: string): Promise<GuildMember | null> {
    // Remove mention formatting if present
    const userId = userIdOrMention.replace(/[<@!>]/g, '');
    
    try {
      // First try direct ID fetch
      if (userId.match(/^\d+$/)) {
        return await guild.members.fetch(userId);
      }
      
      // If not an ID, try to find by username
      const lowerUsername = userId.toLowerCase();
      
      // Fetch all members if needed
      if (guild.members.cache.size === 0) {
        await guild.members.fetch();
      }
      
      // Find member by username, display name, or partial match
      const member = guild.members.cache.find(m => {
        // Check for exact username match
        if (m.user.username.toLowerCase() === lowerUsername) return true;
        // Check for exact nickname match
        if (m.nickname && m.nickname.toLowerCase() === lowerUsername) return true;
        // Check for partial username match
        if (m.user.username.toLowerCase().includes(lowerUsername)) return true;
        // Check for partial nickname match
        if (m.nickname && m.nickname.toLowerCase().includes(lowerUsername)) return true;
        return false;
      });
      
      return member || null;
    } catch (error) {
      console.error(`Failed to resolve user ${userIdOrMention}:`, error);
      return null;
    }
  }

  /**
   * Checks if the bot has permission to perform a moderation action
   * @param guild The guild where the action is taking place
   * @param permission The permission to check
   * @returns Whether the bot has the required permission
   */
  private async checkBotPermission(guild: Guild, permission: bigint): Promise<boolean> {
    const botMember = await guild.members.fetchMe();
    return botMember.permissions.has(permission);
  }

  /**
   * Checks if a user has administrator permissions
   */
  private async checkAdminPermission(guild: Guild, userId: string): Promise<boolean> {
    const member = await guild.members.fetch(userId);
    return member.permissions.has(PermissionFlagsBits.Administrator);
  }

  /**
   * Manages content filter settings for a guild
   */
  async setFilterSettings(guildId: string, userId: string, enabled: boolean): Promise<string> {
    const guild = this.client.guilds.cache.get(guildId);
    if (!guild) return 'Error: I cannot find this server.';

    // Check if user has admin permissions
    if (!await this.checkAdminPermission(guild, userId)) {
      return 'Error: Only administrators can manage filter settings.';
    }

    return await this.filterManager.setFilterEnabled(guildId, enabled);
  }

  /**
   * Issues a warning to a user
   */
  async warnUser(guildId: string, userId: string, reason: string): Promise<string> {
    const guild = this.client.guilds.cache.get(guildId);
    if (!guild) return 'Error: I cannot find this server.';

    return await this.filterManager.warnUser(guildId, userId, reason);
  }

  /**
   * Processes a message for content filtering
   */
  async processMessage(message: any): Promise<void> {
    await this.filterManager.processMessage(message);
  }

  /**
   * Kicks a user from a Discord server
   * @param guildId The ID of the guild
   * @param userId The user ID or mention to kick
   * @param reason The reason for kicking (optional)
   * @returns Result message
   */
  async kickUser(guildId: string, userId: string, reason?: string): Promise<string> {
    const guild = this.client.guilds.cache.get(guildId);
    if (!guild) return 'Error: I cannot find this server.';

    // Check bot permissions
    if (!await this.checkBotPermission(guild, PermissionFlagsBits.KickMembers)) {
      return 'Error: I don\'t have permission to kick members.';
    }

    // Resolve the user
    const member = await this.resolveUser(guild, userId);
    if (!member) return `Error: Could not find user ${userId}.`;

    // Check if the user can be kicked
    if (!member.kickable) {
      return `Error: I cannot kick ${member.user.username} due to permission hierarchy.`;
    }

    try {
      await member.kick(reason || 'No reason provided');
      return `Successfully kicked ${member.user.username}${reason ? ` for: ${reason}` : ''}.`;
    } catch (error) {
      console.error('Error kicking user:', error);
      return `Error: Failed to kick ${member.user.username}.`;
    }
  }

  /**
   * Bans a user from a Discord server
   * @param guildId The ID of the guild
   * @param userId The user ID or mention to ban
   * @param reason The reason for banning (optional)
   * @param deleteMessageDays Number of days of messages to delete (0-7)
   * @returns Result message
   */
  async banUser(guildId: string, userId: string, reason?: string, deleteMessageDays: number = 0): Promise<string> {
    const guild = this.client.guilds.cache.get(guildId);
    if (!guild) return 'Error: I cannot find this server.';

    // Check bot permissions
    if (!await this.checkBotPermission(guild, PermissionFlagsBits.BanMembers)) {
      return 'Error: I don\'t have permission to ban members.';
    }

    // Resolve the user
    const member = await this.resolveUser(guild, userId);
    if (!member) return `Error: Could not find user ${userId}.`;

    // Check if the user can be banned
    if (!member.bannable) {
      return `Error: I cannot ban ${member.user.username} due to permission hierarchy.`;
    }

    try {
      // Ensure deleteMessageDays is within valid range
      const days = Math.max(0, Math.min(7, deleteMessageDays));
      
      await member.ban({
        deleteMessageSeconds: days * 86400, // Convert days to seconds
        reason: reason || 'No reason provided'
      });
      
      return `Successfully banned ${member.user.username}${reason ? ` for: ${reason}` : ''}.`;
    } catch (error) {
      console.error('Error banning user:', error);
      return `Error: Failed to ban ${member.user.username}.`;
    }
  }

  /**
   * Gets or creates a mute role for a guild
   * @param guild The guild to get/create a mute role for
   * @returns The mute role or null if it couldn't be created
   */
  private async getMuteRole(guild: Guild): Promise<Role | null> {
    // Check if we already have the mute role ID cached
    const cachedRoleId = this.muteRoles.get(guild.id);
    if (cachedRoleId) {
      const role = guild.roles.cache.get(cachedRoleId);
      if (role) return role;
      // If the role doesn't exist anymore, remove it from the cache
      this.muteRoles.delete(guild.id);
    }

    // Look for an existing mute role
    const existingRole = guild.roles.cache.find(role => 
      role.name.toLowerCase() === 'muted' || role.name.toLowerCase() === 'mute');
    
    if (existingRole) {
      this.muteRoles.set(guild.id, existingRole.id);
      return existingRole;
    }

    // Create a new mute role if one doesn't exist
    try {
      // Check if the bot has permission to manage roles
      if (!await this.checkBotPermission(guild, PermissionFlagsBits.ManageRoles)) {
        console.error('Bot does not have permission to manage roles');
        return null;
      }

      const muteRole = await guild.roles.create({
        name: 'Muted',
        color: '#808080',
        reason: 'Role for muted users',
        permissions: []
      });

      // Cache the role ID
      this.muteRoles.set(guild.id, muteRole.id);

      // Set up permissions for all channels
      await this.setupMuteRolePermissions(guild, muteRole);

      return muteRole;
    } catch (error) {
      console.error('Error creating mute role:', error);
      return null;
    }
  }

  /**
   * Sets up permissions for the mute role in all channels
   * @param guild The guild to set up permissions in
   * @param muteRole The mute role to set up permissions for
   */
  private async setupMuteRolePermissions(guild: Guild, muteRole: Role): Promise<void> {
    try {
      // Get all text channels in the guild
      const channels = guild.channels.cache.filter(channel => 
        channel.type === ChannelType.GuildText || 
        channel.type === ChannelType.GuildVoice ||
        channel.type === ChannelType.GuildAnnouncement);

      // Set permissions for each channel
      for (const [_, channel] of channels) {
        await channel.permissionOverwrites.create(muteRole, {
          SendMessages: false,
          AddReactions: false,
          Speak: false,
          Stream: false,
        });
      }
    } catch (error) {
      console.error('Error setting up mute role permissions:', error);
    }
  }

  /**
   * Schedules a user to be unmuted after a duration
   * @param guildId The ID of the guild
   * @param userId The ID of the user to unmute
   * @param duration Duration in minutes before unmuting
   */
  private scheduleUnmute(guildId: string, userId: string, duration: number): void {
    // Clear any existing timeout for this user
    const existingTimeout = this.mutedUsers.get(`${guildId}-${userId}`);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Schedule the unmute
    const timeout = setTimeout(async () => {
      await this.unmuteUser(guildId, userId);
      this.mutedUsers.delete(`${guildId}-${userId}`);
    }, duration * 60 * 1000);

    // Store the timeout
    this.mutedUsers.set(`${guildId}-${userId}`, timeout);
  }

  /**
   * Unmutes a user in a Discord server
   * @param guildId The ID of the guild
   * @param userId The user ID to unmute
   * @returns Result message
   */
  private async unmuteUser(guildId: string, userId: string): Promise<string> {
    const guild = this.client.guilds.cache.get(guildId);
    if (!guild) return 'Error: I cannot find this server.';

    // Get the mute role
    const muteRole = await this.getMuteRole(guild);
    if (!muteRole) return 'Error: Could not find or create mute role.';

    // Resolve the user
    const member = await this.resolveUser(guild, userId);
    if (!member) return `Error: Could not find user ${userId}.`;

    try {
      // Remove the mute role
      await member.roles.remove(muteRole);
      return `Successfully unmuted ${member.user.username}.`;
    } catch (error) {
      console.error('Error unmuting user:', error);
      return `Error: Failed to unmute ${member.user.username}.`;
    }
  }

  /**
   * Mutes a user in a Discord server by applying a timeout
   * @param guildId The ID of the guild
   * @param userId The user ID or mention to mute
   * @param duration Duration of the timeout in minutes
   * @param reason The reason for timing out (optional)
   * @returns Result message
   */
  async muteUser(guildId: string, userId: string, duration: number, reason?: string): Promise<string> {
    const guild = this.client.guilds.cache.get(guildId);
    if (!guild) return 'Error: I cannot find this server.';

    // Check bot permissions
    if (!await this.checkBotPermission(guild, PermissionFlagsBits.ModerateMembers)) {
      return 'Error: I don\'t have permission to timeout members.';
    }

    // Resolve the user
    const member = await this.resolveUser(guild, userId);
    if (!member) return `Error: Could not find user '${userId}' in this server.`;

    // Check if the user can be moderated
    if (!member.moderatable) {
      return `Error: I cannot timeout ${member.user.username} due to permission hierarchy.`;
    }

    try {
      // Apply timeout to the user (convert minutes to milliseconds)
      const timeoutDuration = duration * 60 * 1000;
      await member.timeout(timeoutDuration, reason || 'No reason provided');
      
      // No need to schedule unmute as Discord handles this automatically
      
      return `Successfully timed out ${member.user.username} for ${duration} minute(s)${reason ? ` for: ${reason}` : ''}.`;
    } catch (error) {
      console.error('Error timing out user:', error);
      return `Error: Failed to timeout ${member.user.username}.`;
    }
  }

  /**
   * Resolves a channel ID or name to a channel
   * @param guild The guild where the action is taking place
   * @param channelIdOrName Channel ID or name
   * @returns The resolved channel or null if not found
   */
  private async resolveChannel(guild: Guild, channelIdOrName: string): Promise<TextChannel | CategoryChannel | null> {
    try {
      // First try direct ID fetch
      if (channelIdOrName.match(/^\d+$/)) {
        const channel = await guild.channels.fetch(channelIdOrName);
        if (channel && (channel.type === ChannelType.GuildText || 
                       channel.type === ChannelType.GuildVoice || 
                       channel.type === ChannelType.GuildCategory || 
                       channel.type === ChannelType.GuildAnnouncement)) {
          return channel as TextChannel | CategoryChannel;
        }
      }
      
      // If not an ID, try to find by name
      const lowerName = channelIdOrName.toLowerCase();
      
      // Find channel by name or partial match
      const channel = guild.channels.cache.find(c => {
        // Check for exact name match
        if (c.name.toLowerCase() === lowerName) return true;
        // Check for partial name match
        if (c.name.toLowerCase().includes(lowerName)) return true;
        return false;
      });
      
      if (channel && (channel.type === ChannelType.GuildText || 
                     channel.type === ChannelType.GuildVoice || 
                     channel.type === ChannelType.GuildCategory || 
                     channel.type === ChannelType.GuildAnnouncement)) {
        return channel as TextChannel | CategoryChannel;
      }
      
      return null;
    } catch (error) {
      console.error(`Failed to resolve channel ${channelIdOrName}:`, error);
      return null;
    }
  }

  /**
   * Creates a new category in a Discord server
   * @param guildId The ID of the guild
   * @param name The name of the category
   * @param position The position of the category (optional)
   * @returns Result message
   */
  async createCategory(guildId: string, name: string, position?: number): Promise<string> {
    const guild = this.client.guilds.cache.get(guildId);
    if (!guild) return 'Error: I cannot find this server.';

    // Check bot permissions
    if (!await this.checkBotPermission(guild, PermissionFlagsBits.ManageChannels)) {
      return 'Error: I don\'t have permission to manage channels.';
    }

    try {
      const options: GuildChannelCreateOptions = { name };
      if (position !== undefined) options.position = position;

      await guild.channels.create({
        ...options,
        type: ChannelType.GuildCategory
      });

      return `Successfully created category '${name}'.`;
    } catch (error) {
      console.error('Error creating category:', error);
      return `Error: Failed to create category '${name}'.`;
    }
  }

  /**
   * Creates a new channel in a Discord server
   * @param guildId The ID of the guild
   * @param name The name of the channel
   * @param type The type of channel (text, voice, announcement)
   * @param categoryId The ID of the category to place the channel in (optional)
   * @param topic The topic of the channel (optional, text channels only)
   * @returns Result message
   */
  async createChannel(guildId: string, name: string, type: string, categoryId?: string, topic?: string): Promise<string> {
    console.log(`Creating channel: name=${name}, type=${type}, categoryId=${categoryId || 'none'}, guildId=${guildId}`);
const guild = this.client.guilds.cache.get(guildId);
if (!guild) {
  console.error(`Guild not found with ID: ${guildId}`);
  return 'Error: I cannot find this server.';
}

// Check bot permissions
const hasPermission = await this.checkBotPermission(guild, PermissionFlagsBits.ManageChannels);
console.log(`Bot has ManageChannels permission: ${hasPermission}`);
if (!hasPermission) {
  return 'Error: I don\'t have permission to manage channels.';
}

// Resolve channel type
let channelType: ChannelType;
switch (type.toLowerCase()) {
  case 'text':
    channelType = ChannelType.GuildText;
    break;
  case 'voice':
    channelType = ChannelType.GuildVoice;
    break;
  case 'announcement':
    channelType = ChannelType.GuildAnnouncement;
    break;
  default:
    return `Error: Invalid channel type '${type}'. Valid types are: text, voice, announcement.`;
}

// Resolve category if provided
let parent: CategoryChannel | null = null;
if (categoryId) {
  const category = await this.resolveChannel(guild, categoryId);
  if (!category) {
    return `Error: Could not find category '${categoryId}'.`;
  }
  if (category.type !== ChannelType.GuildCategory) {
    return `Error: '${categoryId}' is not a category.`;
  }
  parent = category as CategoryChannel;
}

try {
  console.log(`Attempting to create channel with options: name=${name}, type=${channelType}`);
  
  // Create the channel with the correct options format
  const channel = await guild.channels.create({
    name,
    type: channelType,
    parent: parent || undefined,
    topic: topic && (channelType === ChannelType.GuildText || channelType === ChannelType.GuildAnnouncement) ? topic : undefined
  });

  console.log(`Successfully created channel: ${channel.name} (${channel.id})`);
  return `Successfully created ${type} channel '${name}'${parent ? ` in category '${parent.name}'` : ''}.`;
} catch (error) {
  console.error('Error creating channel:', error);
  // Provide more detailed error information
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  return `Error: Failed to create channel '${name}'. Reason: ${errorMessage}`;
}
  }

  /**
   * Deletes a channel from a Discord server
   * @param guildId The ID of the guild
   * @param channelId The ID or name of the channel to delete
   * @param reason The reason for deleting the channel (optional)
   * @returns Result message
   */
  async deleteChannel(guildId: string, channelId: string, reason?: string): Promise<string> {
    const guild = this.client.guilds.cache.get(guildId);
    if (!guild) return 'Error: I cannot find this server.';

    // Check bot permissions
    if (!await this.checkBotPermission(guild, PermissionFlagsBits.ManageChannels)) {
      return 'Error: I don\'t have permission to manage channels.';
    }

    // Resolve the channel
    const channel = await this.resolveChannel(guild, channelId);
    if (!channel) return `Error: Could not find channel '${channelId}'.`;

    try {
      const channelName = channel.name;
      await channel.delete(reason || 'No reason provided');
      return `Successfully deleted channel '${channelName}'.`;
    } catch (error) {
      console.error('Error deleting channel:', error);
      return `Error: Failed to delete channel '${channel.name}'.`;
    }
  }

  /**
   * Deletes multiple messages from a channel in a Discord server
   * @param guildId The ID of the guild
   * @param channelId The ID or name of the channel to delete messages from
   * @param amount The number of messages to delete (1-100)
   * @param reason The reason for deleting the messages (optional)
   * @returns Result message
   */
  async deleteMessages(guildId: string, channelId: string, amount: number, reason?: string): Promise<string> {
    const guild = this.client.guilds.cache.get(guildId);
    if (!guild) return 'Error: I cannot find this server.';

    // Check bot permissions
    if (!await this.checkBotPermission(guild, PermissionFlagsBits.ManageMessages)) {
      return 'Error: I don\'t have permission to manage messages.';
    }

    // Validate amount
    if (amount < 1 || amount > 100) {
      return 'Error: Amount must be between 1 and 100.';
    }

    // Resolve the channel
    const channel = await this.resolveChannel(guild, channelId);
    if (!channel) return `Error: Could not find channel '${channelId}'.`;
    
    // Ensure it's a text channel
    if (channel.type !== ChannelType.GuildText) {
      return `Error: '${channel.name}' is not a text channel.`;
    }

    try {
      const textChannel = channel as TextChannel;
      const messages = await textChannel.bulkDelete(amount, true);
      return `Successfully deleted ${messages.size} message(s) from '${textChannel.name}'.`;
    } catch (error) {
      console.error('Error deleting messages:', error);
      // Handle specific error for messages older than 14 days
      if (error instanceof Error && error.message.includes('14 days')) {
        return 'Error: Cannot delete messages older than 14 days.';
      }
      return `Error: Failed to delete messages from '${channel.name}'.`;
    }
  }

  /**
   * Creates an embed message in a Discord channel
   * @param guildId The ID of the guild
   * @param channelId The ID or name of the channel to send the embed to
   * @param title The title of the embed
   * @param description The description of the embed
   * @param color The color of the embed in hex format (optional)
   * @param fields Fields to add to the embed (optional)
   * @param footer The footer text of the embed (optional)
   * @param image The URL of an image to display in the embed (optional)
   * @param thumbnail The URL of a thumbnail to display in the embed (optional)
   * @returns Result message
   */
  async createEmbed(
    guildId: string, 
    channelId: string, 
    title: string, 
    description: string, 
    color?: string,
    fields?: Array<{name: string, value: string, inline?: boolean}>,
    footer?: string,
    image?: string,
    thumbnail?: string
  ): Promise<string> {
    const guild = this.client.guilds.cache.get(guildId);
    if (!guild) return 'Error: I cannot find this server.';

    // Check bot permissions
    if (!await this.checkBotPermission(guild, PermissionFlagsBits.SendMessages)) {
      return 'Error: I don\'t have permission to send messages.';
    }

    // Resolve the channel
    const channel = await this.resolveChannel(guild, channelId);
    if (!channel) return `Error: Could not find channel '${channelId}'.`;
    
    // Ensure it's a text channel
    if (channel.type !== ChannelType.GuildText) {
      return `Error: '${channel.name}' is not a text channel.`;
    }

    try {
      const textChannel = channel as TextChannel;
      
      // Create the embed
      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description);
      
      // Set color if provided
      if (color) {
        try {
          embed.setColor(color as ColorResolvable);
        } catch (error) {
          console.warn('Invalid color format, using default color:', error);
        }
      }
      
      // Add fields if provided
      if (fields && fields.length > 0) {
        fields.forEach(field => {
          embed.addFields({
            name: field.name,
            value: field.value,
            inline: field.inline || false
          });
        });
      }
      
      // Set footer if provided
      if (footer) {
        embed.setFooter({ text: footer });
      }
      
      // Set image if provided
      if (image) {
        embed.setImage(image);
      }
      
      // Set thumbnail if provided
      if (thumbnail) {
        embed.setThumbnail(thumbnail);
      }
      
      // Set timestamp
      embed.setTimestamp();
      
      // Send the embed
      const messageOptions: MessageCreateOptions = { embeds: [embed] };
      await textChannel.send(messageOptions);
      
      return `Successfully sent embed message to '${textChannel.name}'.`;
    } catch (error) {
      console.error('Error creating embed:', error);
      return `Error: Failed to send embed message to '${channel.name}'.`;
    }
  }
}