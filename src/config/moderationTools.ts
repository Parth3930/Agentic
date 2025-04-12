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
 * Collection of all moderation tool schemas
 */
export const moderationTools = [
  kickUserSchema,
  banUserSchema,
  muteUserSchema
];