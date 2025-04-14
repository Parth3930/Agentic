/**
 * Server management tools configuration for the Agentic Discord bot
 * This file defines the function schemas for server management commands
 * (create/delete channels, categories, messages, and embeds)
 */

/**
 * Function schema for creating a category in a Discord server
 */
export const createCategorySchema = {
  name: 'createCategory',
  description: 'Creates a new category in the Discord server',
  parameters: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'The name of the category to create'
      },
      position: {
        type: 'number',
        description: 'The position of the category (optional)'
      }
    },
    required: ['name']
  }
};

/**
 * Function schema for creating a channel in a Discord server
 */
export const createChannelSchema = {
  name: 'createChannel',
  description: 'Creates a new channel in the Discord server',
  parameters: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'The name of the channel to create'
      },
      type: {
        type: 'string',
        description: 'The type of channel to create (text, voice, announcement)',
        enum: ['text', 'voice', 'announcement']
      },
      categoryId: {
        type: 'string',
        description: 'The ID of the category to place the channel in (optional)'
      },
      topic: {
        type: 'string',
        description: 'The topic of the channel (optional, text channels only)'
      }
    },
    required: ['name', 'type']
  }
};

/**
 * Function schema for deleting a channel in a Discord server
 */
export const deleteChannelSchema = {
  name: 'deleteChannel',
  description: 'Deletes a channel from the Discord server',
  parameters: {
    type: 'object',
    properties: {
      channelId: {
        type: 'string',
        description: 'The ID or name of the channel to delete'
      },
      reason: {
        type: 'string',
        description: 'The reason for deleting the channel (optional)'
      }
    },
    required: ['channelId']
  }
};

/**
 * Function schema for deleting messages in a Discord channel
 */
export const deleteMessagesSchema = {
  name: 'deleteMessages',
  description: 'Deletes multiple messages from a channel in the Discord server',
  parameters: {
    type: 'object',
    properties: {
      channelId: {
        type: 'string',
        description: 'The ID or name of the channel to delete messages from'
      },
      amount: {
        type: 'number',
        description: 'The number of messages to delete (1-100)'
      },
      reason: {
        type: 'string',
        description: 'The reason for deleting the messages (optional)'
      }
    },
    required: ['channelId', 'amount']
  }
};

/**
 * Function schema for creating an embed message in a Discord channel
 */
export const createEmbedSchema = {
  name: 'createEmbed',
  description: 'Creates an embed message in a Discord channel',
  parameters: {
    type: 'object',
    properties: {
      channelId: {
        type: 'string',
        description: 'The ID or name of the channel to send the embed to'
      },
      title: {
        type: 'string',
        description: 'The title of the embed'
      },
      description: {
        type: 'string',
        description: 'The description of the embed'
      },
      color: {
        type: 'string',
        description: 'The color of the embed in hex format (e.g., #FF0000) (optional)'
      },
      fields: {
        type: 'array',
        description: 'Fields to add to the embed (optional)',
        items: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'The name of the field'
            },
            value: {
              type: 'string',
              description: 'The value of the field'
            },
            inline: {
              type: 'boolean',
              description: 'Whether the field should be displayed inline'
            }
          },
          required: ['name', 'value']
        }
      },
      footer: {
        type: 'string',
        description: 'The footer text of the embed (optional)'
      },
      image: {
        type: 'string',
        description: 'The URL of an image to display in the embed (optional)'
      },
      thumbnail: {
        type: 'string',
        description: 'The URL of a thumbnail to display in the embed (optional)'
      }
    },
    required: ['channelId', 'title', 'description']
  }
};

/**
 * Collection of all server management tool schemas
 */
export const serverManagementTools = [
  createCategorySchema,
  createChannelSchema,
  deleteChannelSchema,
  deleteMessagesSchema,
  createEmbedSchema
];