/**
 * Command registry to manage all available commands
 */

import { Command } from './Command';
import { KickCommand } from './moderation/KickCommand';
import { BanCommand } from './moderation/BanCommand';
import { MuteCommand } from './moderation/MuteCommand';

export class CommandRegistry {
  private static instance: CommandRegistry;
  private commands: Map<string, Command>;

  private constructor() {
    this.commands = new Map();
    this.registerCommands();
  }

  public static getInstance(): CommandRegistry {
    if (!CommandRegistry.instance) {
      CommandRegistry.instance = new CommandRegistry();
    }
    return CommandRegistry.instance;
  }

  private registerCommands(): void {
    // Register moderation commands
    const moderationCommands = [
      new KickCommand(),
      new BanCommand(),
      new MuteCommand()
    ];

    for (const command of moderationCommands) {
      this.commands.set(command.name, command);
    }
  }

  public getCommand(name: string): Command | undefined {
    return this.commands.get(name);
  }

  public getAllCommands(): Command[] {
    return Array.from(this.commands.values());
  }

  public getCommandsByCategory(category: string): Command[] {
    return this.getAllCommands().filter(cmd => cmd.category === category);
  }
}