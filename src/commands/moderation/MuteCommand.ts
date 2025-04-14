/**
 * Mute command implementation
 */

import { Guild, GuildMember, PermissionFlagsBits } from 'discord.js';
import { BaseModCommand } from './BaseModCommand';

export class MuteCommand extends BaseModCommand {
  name = 'mute';
  description = 'Mutes a user in the server';

  async execute(guild: Guild, userId: string, duration: number, reason?: string): Promise<string> {
    if (!await this.checkBotPermission(guild, PermissionFlagsBits.ModerateMembers)) {
      return 'Error: I don\'t have permission to timeout members.';
    }

    const member = await this.resolveUser(guild, userId);
    if (!member) return `Error: Could not find user '${userId}' in this server.`;

    if (!member.moderatable) {
      return `Error: I cannot timeout ${member.user.username} due to permission hierarchy.`;
    }

    try {
      const timeoutDuration = duration * 60 * 1000;
      await member.timeout(timeoutDuration, reason || 'No reason provided');
      
      return `Successfully timed out ${member.user.username} for ${duration} minute(s)${reason ? ` for: ${reason}` : ''}.`;
    } catch (error) {
      console.error('Error timing out user:', error);
      return `Error: Failed to timeout ${member.user.username}.`;
    }
  }

  async checkPermissions(guild: Guild, member: GuildMember): Promise<boolean> {
    return member.permissions.has(PermissionFlagsBits.ModerateMembers);
  }
}