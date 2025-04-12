/**
 * Moderation service for the Agentic Discord bot
 * Handles moderation actions like kick, ban, and mute
 */

import { Client, GuildMember, User, Guild, TextChannel, PermissionFlagsBits, Role, Collection, ChannelType } from 'discord.js';

export class ModerationService {
  private client: Client;
  private muteRoles: Map<string, string>; // Map of guild ID to mute role ID
  private mutedUsers: Map<string, NodeJS.Timeout>; // Map of user IDs to their unmute timeouts

  /**
   * Creates a new moderation service instance
   * @param client Discord client instance
   */
  constructor(client: Client) {
    this.client = client;
    this.muteRoles = new Map();
    this.mutedUsers = new Map();
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
}