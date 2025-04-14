/**
 * New moderation service that uses the command registry
 */

import { Client, Guild, GuildMember } from 'discord.js';
import { FilterManager } from './filterManager';
import { CommandRegistry } from '../commands/CommandRegistry';

export class ModerationService {
  private client: Client;
  private filterManager: FilterManager;
  private commandRegistry: CommandRegistry;

  constructor(client: Client, filterManager: FilterManager) {
    this.client = client;
    this.filterManager = filterManager;
    this.commandRegistry = CommandRegistry.getInstance();
  }

  async setFilterSettings(guildId: string, userId: string, enabled: boolean): Promise<string> {
    const guild = this.client.guilds.cache.get(guildId);
    if (!guild) return 'Error: I cannot find this server.';
    return await this.filterManager.setFilterEnabled(guildId, enabled);
  }

  async warnUser(guildId: string, userId: string, reason: string): Promise<string> {
    const guild = this.client.guilds.cache.get(guildId);
    if (!guild) return 'Error: I cannot find this server.';
    return await this.filterManager.warnUser(guildId, userId, reason);
  }

  async processMessage(message: any): Promise<void> {
    await this.filterManager.processMessage(message);
  }

  async kickUser(guildId: string, userId: string, reason?: string): Promise<string> {
    const guild = this.client.guilds.cache.get(guildId);
    if (!guild) return 'Error: I cannot find this server.';

    const kickCommand = this.commandRegistry.getCommand('kick');
    if (!kickCommand) return 'Error: Kick command not found.';

    return await kickCommand.execute(guild, userId, reason);
  }

  async banUser(guildId: string, userId: string, reason?: string, deleteMessageDays: number = 0): Promise<string> {
    const guild = this.client.guilds.cache.get(guildId);
    if (!guild) return 'Error: I cannot find this server.';

    const banCommand = this.commandRegistry.getCommand('ban');
    if (!banCommand) return 'Error: Ban command not found.';

    return await banCommand.execute(guild, userId, reason, deleteMessageDays);
  }

  async muteUser(guildId: string, userId: string, duration: number, reason?: string): Promise<string> {
    const guild = this.client.guilds.cache.get(guildId);
    if (!guild) return 'Error: I cannot find this server.';

    const muteCommand = this.commandRegistry.getCommand('mute');
    if (!muteCommand) return 'Error: Mute command not found.';

    return await muteCommand.execute(guild, userId, duration, reason);
  }
}