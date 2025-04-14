/**
 * Base class for moderation commands
 */

import { Guild, GuildMember, PermissionFlagsBits } from 'discord.js';
import { Command } from '../Command';

export abstract class BaseModCommand implements Command {
  abstract name: string;
  abstract description: string;
  category: 'moderation' = 'moderation';

  abstract execute(guild: Guild, ...args: any[]): Promise<string>;

  /**
   * Resolves a user ID or mention to a GuildMember
   */
  protected async resolveUser(guild: Guild, userIdOrMention: string): Promise<GuildMember | null> {
    const userId = userIdOrMention.replace(/[<@!>]/g, '');
    
    try {
      if (userId.match(/^\d+$/)) {
        return await guild.members.fetch(userId);
      }
      
      const lowerUsername = userId.toLowerCase();
      
      if (guild.members.cache.size === 0) {
        await guild.members.fetch();
      }
      
      const member = guild.members.cache.find(m => {
        if (m.user.username.toLowerCase() === lowerUsername) return true;
        if (m.nickname && m.nickname.toLowerCase() === lowerUsername) return true;
        if (m.user.username.toLowerCase().includes(lowerUsername)) return true;
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
   * Checks if the bot has required permissions
   */
  protected async checkBotPermission(guild: Guild, permission: bigint): Promise<boolean> {
    const botMember = await guild.members.fetchMe();
    return botMember.permissions.has(permission);
  }

  /**
   * Checks if a user has administrator permissions
   */
  async checkPermissions(guild: Guild, member: GuildMember): Promise<boolean> {
    return member.permissions.has(PermissionFlagsBits.Administrator);
  }
}