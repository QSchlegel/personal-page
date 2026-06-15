/**
 * Anthropic (Claude API) adapter implementing LlmProvider.
 *
 *  - chatStructured → messages.create with output_config.format (json_schema),
 *    then validates with the Zod schema (mirrors the OpenAI provider's contract).
 *  - chatStream     → messages.stream; text_delta → text chunks, tool_use blocks
 *    accumulated from input_json_delta → tool_call chunks.
 *  - Tools are mapped to Claude's input_schema with strict: true.
 *  - No temperature/top_p (removed on Opus 4.8); effort via output_config,
 *    adaptive thinking when ChatRequest.thinking is set.
 *
 * The newer request fields (output_config, thinking) are attached behind a
 * localized cast so the adapter compiles across @anthropic-ai/sdk versions; the
 * server is the source of truth for their semantics.
 */
import Anthropic from '@anthropic-ai/sdk';
import { z, type ZodType } from 'zod';
import type {
  ChatCompletionResult,
  ChatMessage,
  ChatRequest,
  ChatStreamChunk,
  CompletedToolCall,
  EffortLevel,
  FinishReason,
  LlmHealth,
  LlmProvider,
  StructuredResult,
  TokenUsage,
} from '../providers';

export interface AnthropicAdapterOptions {
  /** Provide a pre-configured client, or an apiKey to construct one. */
  client?: Anthropic;
  apiKey?: string;
  /** Model used for the health check. Defaults to the request model. */
  healthModel?: string;
}

/** Request fields layered on top of the SDK's param type (version-robust). */
interface OutputConfig {
  effort?: EffortLevel;
  format?: { type: 'json_schema'; name: string; schema: Record<string, unknown> };
}
type Extensions = { output_config?: OutputConfig; thinking?: { type: 'adaptive' } };

const STRUCTURED_MAX_TOKENS = 2048;

export class AnthropicAdapter implements LlmProvider {
  private readonly client: Anthropic;
  private readonly healthModel?: string;

  constructor(opts: AnthropicAdapterOptions = {}) {
    this.client = opts.client ?? new Anthropic(opts.apiKey ? { apiKey: opts.apiKey } : {});
    this.healthModel = opts.healthModel;
  }

  async *chatStream(req: ChatRequest, signal?: AbortSignal): AsyncIterable<ChatStreamChunk> {
    const { system, messages } = toAnthropicMessages(req.messages);
    const params = {
      model: req.model,
      max_tokens: req.maxTokens ?? 1024,
      messages,
      ...(system ? { system } : {}),
      ...(req.tools ? { tools: toAnthropicTools(req.tools) } : {}),
      ...this.extensions(req),
    };

    const stream = this.client.messages.stream(params as Anthropic.MessageStreamParams, { signal });

    const toolSlots = new Map<number, CompletedToolCall>();
    for await (const event of stream) {
      if (event.type === 'content_block_start' && event.content_block.type === 'tool_use') {
        toolSlots.set(event.index, { id: event.content_block.id, name: event.content_block.name, arguments: '' });
      } else if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          if (event.delta.text) yield { type: 'text', delta: event.delta.text };
        } else if (event.delta.type === 'input_json_delta') {
          const slot = toolSlots.get(event.index);
          if (slot) slot.arguments += event.delta.partial_json;
        }
      }
    }

    const final = await stream.finalMessage();
    for (const call of toolSlots.values()) yield { type: 'tool_call', call };
    yield { type: 'finish', reason: mapStopReason(final.stop_reason), usage: usageOf(final.usage) };
  }

  async chatCompletion(req: ChatRequest, signal?: AbortSignal): Promise<ChatCompletionResult> {
    const { system, messages } = toAnthropicMessages(req.messages);
    const params = {
      model: req.model,
      max_tokens: req.maxTokens ?? 1024,
      messages,
      ...(system ? { system } : {}),
      ...(req.tools ? { tools: toAnthropicTools(req.tools) } : {}),
      ...this.extensions(req),
    };

    const message = await this.client.messages.create(params as Anthropic.MessageCreateParamsNonStreaming, {
      signal,
    });

    let text = '';
    const toolCalls: CompletedToolCall[] = [];
    for (const block of message.content) {
      if (block.type === 'text') text += block.text;
      else if (block.type === 'tool_use') {
        toolCalls.push({ id: block.id, name: block.name, arguments: JSON.stringify(block.input) });
      }
    }

    return {
      text,
      toolCalls,
      usage: usageOf(message.usage),
      finishReason: mapStopReason(message.stop_reason),
    };
  }

  async chatStructured<T>(
    req: ChatRequest,
    schema: ZodType<T>,
    schemaName: string,
    signal?: AbortSignal,
  ): Promise<StructuredResult<T>> {
    const jsonSchema = z.toJSONSchema(schema as ZodType<unknown>) as Record<string, unknown>;
    const { system, messages } = toAnthropicMessages(req.messages);

    const attempt = async (msgs: Anthropic.MessageParam[]): Promise<StructuredResult<T>> => {
      const params = {
        model: req.model,
        max_tokens: req.maxTokens ?? STRUCTURED_MAX_TOKENS,
        messages: msgs,
        ...(system ? { system } : {}),
        output_config: {
          ...(req.effort ? { effort: req.effort } : {}),
          format: { type: 'json_schema' as const, name: schemaName, schema: jsonSchema },
        },
      };
      const message = await this.client.messages.create(
        params as Anthropic.MessageCreateParamsNonStreaming,
        { signal },
      );
      const raw = message.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');
      const value = schema.parse(JSON.parse(raw));
      return { value, usage: usageOf(message.usage) };
    };

    try {
      return await attempt(messages);
    } catch (error) {
      if (signal?.aborted) throw error;
      return attempt([
        ...messages,
        {
          role: 'user',
          content: `Your last response was not valid JSON for schema "${schemaName}". Respond with valid JSON only.`,
        },
      ]);
    }
  }

  async health(): Promise<LlmHealth> {
    try {
      const model = this.healthModel;
      if (model) await this.client.models.retrieve(model);
      else await this.client.models.list();
      return { ok: true, models: model ? [model] : [] };
    } catch (error) {
      return { ok: false, models: [], error: String(error) };
    }
  }

  private extensions(req: ChatRequest): Extensions {
    const ext: Extensions = {};
    if (req.effort) ext.output_config = { effort: req.effort };
    if (req.thinking) ext.thinking = { type: 'adaptive' };
    return ext;
  }
}

function toAnthropicTools(tools: ChatRequest['tools']): Anthropic.Tool[] {
  return (tools ?? []).map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.parameters as Anthropic.Tool.InputSchema,
    strict: true,
  })) as Anthropic.Tool[];
}

/** Split our flat ChatMessage[] into Claude's `system` string + user/assistant turns. */
function toAnthropicMessages(messages: ChatMessage[]): {
  system?: string;
  messages: Anthropic.MessageParam[];
} {
  const systemParts: string[] = [];
  const out: Anthropic.MessageParam[] = [];

  for (const message of messages) {
    if (message.role === 'system') {
      systemParts.push(message.content);
      continue;
    }
    if (message.role === 'tool') {
      out.push({
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: message.toolCallId ?? '', content: message.content }],
      });
      continue;
    }
    if (message.role === 'assistant' && message.toolCalls?.length) {
      const content: Anthropic.ContentBlockParam[] = [];
      if (message.content) content.push({ type: 'text', text: message.content });
      for (const call of message.toolCalls) {
        content.push({ type: 'tool_use', id: call.id, name: call.name, input: safeParse(call.arguments) });
      }
      out.push({ role: 'assistant', content });
      continue;
    }
    out.push({ role: message.role, content: message.content });
  }

  return { system: systemParts.length ? systemParts.join('\n\n') : undefined, messages: out };
}

function safeParse(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
}

function usageOf(usage: Anthropic.Usage | undefined): TokenUsage | undefined {
  if (!usage) return undefined;
  return { promptTokens: usage.input_tokens ?? 0, completionTokens: usage.output_tokens ?? 0 };
}

function mapStopReason(reason: string | null): FinishReason {
  switch (reason) {
    case 'end_turn':
    case 'stop_sequence':
      return 'stop';
    case 'tool_use':
      return 'tool_calls';
    case 'max_tokens':
      return 'length';
    default:
      return 'unknown';
  }
}
