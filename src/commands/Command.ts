/**
 * Base interface for all commands
 */

import { Guild, GuildMember } from 'discord.js';

export interface Command {
  name: string;
  description: string;
  category: 'moderation' | 'server' | 'utility';
  execute(guild: Guild, ...args: any[]): Promise<string>;
  checkPermissions(guild: Guild, member: GuildMember): Promise<boolean>;
}