/**
 * Function parser for the Agentic Discord bot
 * Handles parsing of function calls from message content
 */

import { FunctionCall } from "./ai";

export class FunctionParser {
  /**
   * Checks if a message contains a direct function call pattern
   * @param content The message content to check
   * @returns The parsed function call or null if not a function call
   */
  public static parseFunctionCall(content: string): FunctionCall | null {
    console.log(`Attempting to parse function call: ${content}`);
    
    // Check for simple delete messages command
    const deleteMessagesRegex = /^delete\s+(\d+)\s+messages$/i;
    const deleteMatch = content.trim().match(deleteMessagesRegex);
    if (deleteMatch) {
      console.log(`Matched simple delete command, amount: ${deleteMatch[1]}`);
      return {
        name: "deleteMessages",
        arguments: {
          amount: deleteMatch[1]
          // channelId will be added in handleFunctionCall
        }
      };
    }
    
    // First, try to match object notation: functionName({ key: "value", key2: "value2" })
    const objectNotationRegex = /^(\w+)\s*\(\s*\{([^}]+)\}\s*\)$/;
    const objectMatch = content.trim().match(objectNotationRegex);
    
    if (objectMatch) {
      const functionName = objectMatch[1];
      const argsString = objectMatch[2];
      
      console.log(`Matched object notation function: ${functionName}, args: ${argsString}`);
      
      // Parse the arguments
      const args: Record<string, any> = {};
      
      // Match each parameter: key: "value" or key: value
      const paramRegex = /(\w+)\s*:\s*(?:"([^"]*)"|(\S[^,]*))(?:,|$)/g;
      let paramMatch;
      
      while ((paramMatch = paramRegex.exec(argsString)) !== null) {
        const key = paramMatch[1];
        // Use the quoted value if available, otherwise use the unquoted value
        const value = paramMatch[2] !== undefined ? paramMatch[2] : paramMatch[3]?.trim();
        args[key] = value;
      }
      
      console.log(`Parsed arguments:`, args);
      
      return {
        name: functionName,
        arguments: args
      };
    }
    
    // If object notation doesn't match, try the original format: functionName(param1: "value1", param2: "value2")
    const functionCallRegex = /^(\w+)\s*\(([^)]*)\)$/;
    const match = content.trim().match(functionCallRegex);
    
    if (!match) return null;
    
    const functionName = match[1];
    const argsString = match[2];
    
    // If it's a deleteMessages call with just numbers, parse differently
    if (functionName.toLowerCase() === "deletemessages" && argsString.split(",").length <= 2 && !argsString.includes(":")) {
      const params = argsString.split(",").map(p => p.trim());
      // If there's only one parameter, it's the amount
      if (params.length === 1) {
        return {
          name: "deleteMessages",
          arguments: {
            amount: params[0]
            // channelId will be added in handleFunctionCall
          }
        };
      } 
      // If there are two parameters, first is channelId, second is amount
      else if (params.length === 2) {
        return {
          name: "deleteMessages",
          arguments: {
            channelId: params[0],
            amount: params[1]
          }
        };
      }
    }
    
    // Regular parsing for other function calls with named parameters
    const args: Record<string, any> = {};
    
    // Match each parameter: key: "value" or key: value
    const paramRegex = /(\w+)\s*:\s*(?:"([^"]*)"|(\S[^,]*))(?:,|$)/g;
    let paramMatch;
    
    while ((paramMatch = paramRegex.exec(argsString)) !== null) {
      const key = paramMatch[1];
      // Use the quoted value if available, otherwise use the unquoted value
      const value = paramMatch[2] !== undefined ? paramMatch[2] : paramMatch[3]?.trim();
      args[key] = value;
    }
    
    return {
      name: functionName,
      arguments: args
    };
  }
}