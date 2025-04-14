/**
 * Ban command implementation
 */

import { Guild, GuildMember, PermissionFlagsBits } from 'discord.js';
import { BaseModCommand } from './BaseModCommand';

export class BanCommand extends BaseModCommand {
  name = 'ban';
  description = 'Bans a user from the server';

  async execute(guild: Guild, userId: string, reason?: string, deleteMessageDays: number = 0): Promise<string> {
    if (!await this.checkBotPermission(guild, PermissionFlagsBits.BanMembers)) {
      return 'Error: I don\'t have permission to ban members.';
    }

    const member = await this.resolveUser(guild, userId);
    if (!member) return `Error: Could not find user ${userId}.`;

    if (!member.bannable) {
      return `Error: I cannot ban ${member.user.username} due to permission hierarchy.`;
    }

    try {
      const days = Math.max(0, Math.min(7, deleteMessageDays));
      
      await member.ban({
        deleteMessageSeconds: days * 86400,
        reason: reason || 'No reason provided'
      });
      
      return `Successfully banned ${member.user.username}${reason ? ` for: ${reason}` : ''}.`;
    } catch (error) {
      console.error('Error banning user:', error);
      return `Error: Failed to ban ${member.user.username}.`;
    }
  }

  async checkPermissions(guild: Guild, member: GuildMember): Promise<boolean> {
    return member.permissions.has(PermissionFlagsBits.BanMembers);
  }
}