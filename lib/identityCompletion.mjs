// Fixed metadata vocabulary only; never model text, response IDs, headers or keys.
const stops=['end_turn','max_tokens','refusal','stop_sequence','tool_use','pause_turn','model_context_window_exceeded'];
const tokenCount=value=>Number.isSafeInteger(value)&&value>=0&&value<=10000000?value:null;
export function safeIdentityCompletion(message,status){
 const content=Array.isArray(message?.content)?message.content:[];
 return {mechanism:'json_schema',httpStatus:Number.isInteger(status)&&status>=100&&status<=599?status:null,stopReason:stops.includes(message?.stop_reason)?message.stop_reason:'unknown',
  transport:message&&typeof message==='object'&&!Array.isArray(message)&&Array.isArray(message.content)?'message_object':'invalid_message',
  contentBlocks:Math.min(content.length,32),textBlocks:Math.min(content.filter(b=>b?.type==='text').length,32),
  unexpectedBlocks:Math.min(content.filter(b=>b?.type!=='text').length,32),
  usage:{inputTokens:tokenCount(message?.usage?.input_tokens),outputTokens:tokenCount(message?.usage?.output_tokens),cacheCreationInputTokens:tokenCount(message?.usage?.cache_creation_input_tokens),cacheReadInputTokens:tokenCount(message?.usage?.cache_read_input_tokens)}};
}
