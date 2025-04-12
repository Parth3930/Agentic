/**
 * Filter Manager Service for the Agentic Discord bot
 * Handles content filtering and warning management
 */

import { Client, Guild, GuildMember, TextChannel } from 'discord.js';
import * as fs from 'fs/promises';
import * as path from 'path';

interface FilterSettings {
  enabled: boolean;
  warnings: {
    [userId: string]: {
      count: number;
      lastWarning: number;
    };
  };
}

export class FilterManager {
  private client: Client;
  private settings: Map<string, FilterSettings>;
  private settingsPath: string;
  private readonly WARNING_THRESHOLD = 3;
  private readonly WARNING_RESET_TIME = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  private readonly TIMEOUT_DURATION = 10; // minutes

  constructor(client: Client) {
    this.client = client;
    this.settings = new Map();
    this.settingsPath = path.join(process.cwd(), 'data', 'filterSettings.json');
    this.loadSettings();
  }

  private async loadSettings() {
    try {
      const data = await fs.readFile(this.settingsPath, 'utf-8');
      const settings = JSON.parse(data);
      Object.entries(settings).forEach(([guildId, setting]) => {
        this.settings.set(guildId, setting as FilterSettings);
      });
    } catch (error) {
      // If file doesn't exist, create directory
      await fs.mkdir(path.dirname(this.settingsPath), { recursive: true });
      await this.saveSettings();
    }
  }

  private async saveSettings() {
    const settings = Object.fromEntries(this.settings.entries());
    await fs.writeFile(this.settingsPath, JSON.stringify(settings, null, 2));
  }

  async setFilterEnabled(guildId: string, enabled: boolean): Promise<string> {
    const settings = this.settings.get(guildId) || {
      enabled: false,
      warnings: {}
    };

    settings.enabled = enabled;
    this.settings.set(guildId, settings);
    await this.saveSettings();

    return `Content filter has been ${enabled ? 'enabled' : 'disabled'} for this server.`;
  }

  isFilterEnabled(guildId: string): boolean {
    return this.settings.get(guildId)?.enabled || false;
  }

  async warnUser(guildId: string, userId: string, reason: string): Promise<string> {
    const settings = this.settings.get(guildId);
    if (!settings) return 'Error: Server settings not found.';

    const guild = this.client.guilds.cache.get(guildId);
    if (!guild) return 'Error: Server not found.';

    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return 'Error: User not found.';

    // Initialize or update user warnings
    if (!settings.warnings[userId]) {
      settings.warnings[userId] = { count: 0, lastWarning: Date.now() };
    }

    const warning = settings.warnings[userId];
    const timeSinceLastWarning = Date.now() - warning.lastWarning;

    // Reset warnings if enough time has passed
    if (timeSinceLastWarning >= this.WARNING_RESET_TIME) {
      warning.count = 0;
    }

    warning.count++;
    warning.lastWarning = Date.now();

    await this.saveSettings();

    // If user has reached warning threshold, timeout them
    if (warning.count >= this.WARNING_THRESHOLD) {
      try {
        await member.timeout(this.TIMEOUT_DURATION * 60 * 1000, 'Multiple warnings for inappropriate behavior');
        warning.count = 0; // Reset count after timeout
        await this.saveSettings();
        return `${member.user.username} has been timed out for ${this.TIMEOUT_DURATION} minutes due to multiple warnings.`;
      } catch (error) {
        console.error('Error timing out user:', error);
        return `Warning issued to ${member.user.username}, but I couldn't apply timeout due to permissions.`;
      }
    }

    return `Warning issued to ${member.user.username}: ${reason}. This is warning ${warning.count}/${this.WARNING_THRESHOLD}.`;
  }

  async processMessage(message: any): Promise<void> {
    if (!message.guild || message.author.bot) return;

    const settings = this.settings.get(message.guild.id);
    if (!settings?.enabled) return;

    // Simple profanity check - replace with more sophisticated detection
    const profanityRegex = /\b(bad|rude|offensive)\b/i; // Example regex - replace with actual profanity list
    if (profanityRegex.test(message.content)) {
      await this.warnUser(
        message.guild.id,
        message.author.id,
        'Using inappropriate language'
      );
      await message.reply('Please keep the conversation respectful.');
    }
  }
}