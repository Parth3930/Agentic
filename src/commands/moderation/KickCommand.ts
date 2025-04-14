/**
 * Kick command implementation
 */

import { Guild, GuildMember, PermissionFlagsBits } from 'discord.js';
import { BaseModCommand } from './BaseModCommand';

export class KickCommand extends BaseModCommand {
  name = 'kick';
  description = 'Kicks a user from the server';

  async execute(guild: Guild, userId: string, reason?: string): Promise<string> {
    if (!await this.checkBotPermission(guild, PermissionFlagsBits.KickMembers)) {
      return 'Error: I don\'t have permission to kick members.';
    }

    const member = await this.resolveUser(guild, userId);
    if (!member) return `Error: Could not find user ${userId}.`;

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

  async checkPermissions(guild: Guild, member: GuildMember): Promise<boolean> {
    return member.permissions.has(PermissionFlagsBits.KickMembers);
  }
}