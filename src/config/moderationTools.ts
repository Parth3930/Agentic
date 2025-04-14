/**
 * Moderation tools configuration for the Agentic Discord bot
 * This file defines the function schemas for moderation commands (kick, ban, mute)
 */

/**
 * Function schema for kicking a user from a Discord server
 */
export const kickUserSchema = {
  name: 'kickUser',
  description: 'Kicks a user from the Discord server',
  parameters: {
    type: 'object',
    properties: {
      userId: {
        type: 'string',
        description: 'The Discord user ID or @mention of the user to kick'
      },
      reason: {
        type: 'string',
        description: 'The reason for kicking the user (optional)'
      }
    },
    required: ['userId']
  }
};

/**
 * Function schema for banning a user from a Discord server
 */
export const banUserSchema = {
  name: 'banUser',
  description: 'Bans a user from the Discord server',
  parameters: {
    type: 'object',
    properties: {
      userId: {
        type: 'string',
        description: 'The Discord user ID or @mention of the user to ban'
      },
      reason: {
        type: 'string',
        description: 'The reason for banning the user (optional)'
      },
      deleteMessageDays: {
        type: 'number',
        description: 'Number of days of messages to delete (0-7, optional)'
      }
    },
    required: ['userId']
  }
};

/**
 * Function schema for timing out a user in a Discord server
 */
export const muteUserSchema = {
  name: 'muteUser',
  description: 'Applies a timeout to a user in the Discord server, preventing them from sending messages, adding reactions, joining voice channels, etc.',
  parameters: {
    type: 'object',
    properties: {
      userId: {
        type: 'string',
        description: 'The Discord user ID, @mention, or username of the user to timeout'
      },
      duration: {
        type: 'number',
        description: 'Duration of the timeout in minutes'
      },
      reason: {
        type: 'string',
        description: 'The reason for timing out the user (optional)'
      }
    },
    required: ['userId', 'duration']
  }
};

/**
 * Function schema for managing content filter settings
 */
export const filterSettingsSchema = {
  name: 'filterSettings',
  description: 'Manages the content filter settings for the Discord server',
  parameters: {
    type: 'object',
    properties: {
      enabled: {
        type: 'boolean',
        description: 'Whether to enable or disable the content filter'
      }
    },
    required: ['enabled']
  }
};

/**
 * Function schema for warning users about inappropriate behavior
 */
export const warnUserSchema = {
  name: 'warnUser',
  description: 'Issues a warning to a user about inappropriate behavior',
  parameters: {
    type: 'object',
    properties: {
      userId: {
        type: 'string',
        description: 'The Discord user ID or @mention of the user to warn'
      },
      reason: {
        type: 'string',
        description: 'The reason for warning the user'
      }
    },
    required: ['userId', 'reason']
  }
};

/**
 * Import server management tools
 */
import { serverManagementTools } from './serverManagementTools';

/**
 * Collection of all moderation tool schemas
 */
export const moderationTools = [
  kickUserSchema,
  banUserSchema,
  muteUserSchema,
  filterSettingsSchema,
  warnUserSchema,
  ...serverManagementTools
];