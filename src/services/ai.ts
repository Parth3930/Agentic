/**
 * AI service for the Agentic Discord bot
 * Handles interactions with the Mistral AI API
 */

import { Mistral } from '@mistralai/mistralai';
import { CharacterConfig } from '../config/character';
import { moderationTools } from '../config/moderationTools';
import { ChatCompletionResponse, Tool } from '@mistralai/mistralai/models/components';

export interface FunctionCall {
  name: string;
  arguments: Record<string, any>;
}

export interface AIResponse {
  content: string;
  functionCall?: FunctionCall;
}

export class AIService {
  private mistralClient: Mistral;
  private character: CharacterConfig;
  private tools: Tool[];

  /**
   * Creates a new AI service instance
   * @param apiKey Mistral API key
   * @param character Character configuration
   */
  constructor(apiKey: string, character: CharacterConfig) {
    this.mistralClient = new Mistral({ apiKey });
    this.character = character;
    this.tools = moderationTools.map(tool => ({
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      }
    })) as Tool[];
  }

  /**
   * Generates a response using the Mistral AI API
   * @param query The user's input query
   * @param enableModeration Whether to enable moderation tools
   * @returns AI-generated response with optional function call
   */
  async generateResponse(query: string, enableModeration: boolean = false): Promise<AIResponse> {
    try {
      const requestOptions = {
        model: this.character.model,
        messages: [
          { role: 'system', content: this.character.systemPrompt },
          { role: 'user', content: query }
        ],
      };
      
      // Add tools if moderation is enabled
      if (enableModeration) {
        Object.assign(requestOptions, { tools: this.tools });
      }
      
      const chatResponse = await this.mistralClient.chat.complete({
        ...requestOptions,
        messages: requestOptions.messages.map(msg => ({
          ...msg,
          role: msg.role as "system" | "user" | "assistant" | "tool"
        }))
      });
      
      return this.processResponse(chatResponse);
    } catch (error) {
      console.error('Error generating AI response:', error);
      return { content: this.character.errorMessages.aiFailure };
    }
  }
  
  /**
   * Processes the raw response from Mistral AI
   * @param chatResponse The response from Mistral AI
   * @returns Processed AI response with optional function call
   */
  private processResponse(chatResponse: ChatCompletionResponse): AIResponse {
    const choice = chatResponse.choices?.[0];
    if (!choice) return { content: 'No response generated' };
    
    const message = choice.message;
    const content = Array.isArray(message.content) ? message.content.join('') : message.content ?? 'No response generated';
    
    // Check if there's a tool call in the response
    if (message.toolCalls && message.toolCalls.length > 0) {
      const toolCall = message.toolCalls[0];
      let args = {};
      
      try {
        args = JSON.parse(toolCall.function.arguments as string);
      } catch (error) {
        console.error('Error parsing function arguments:', error);
      }
      
      return {
        content,
        functionCall: {
          name: toolCall.function.name,
          arguments: args
        }
      };
    }
    
    return { content };
  }
}