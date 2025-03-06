import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { createDataStream, generateId } from 'ai';
import { MAX_RESPONSE_SEGMENTS, MAX_TOKENS, type FileMap } from '~/lib/.server/llm/constants';
import { CONTINUE_PROMPT } from '~/lib/common/prompts/prompts';
import { streamText, type Messages, type StreamingOptions } from '~/lib/.server/llm/stream-text';
import SwitchableStream from '~/lib/.server/llm/switchable-stream';
import type { IProviderSetting } from '~/types/model';
import { createScopedLogger } from '~/utils/logger';
import { getFilePaths, selectContext } from '~/lib/.server/llm/select-context';
import type { ContextAnnotation, ProgressAnnotation } from '~/types/context';
import { WORK_DIR } from '~/utils/constants';
import { createSummary } from '~/lib/.server/llm/create-summary';
import { extractPropertiesFromMessage } from '~/lib/.server/llm/utils';
import { Connection, PublicKey } from '@solana/web3.js';
import { parseTokenAccountResp } from '@raydium-io/raydium-sdk-v2';
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { TierLevel } from '~/lib/hooks/useTierAccess';

// Define the token thresholds for each tier - keep in sync with useTierAccess.ts
const TIER_THRESHOLDS = {
  [TierLevel.FREE]: 0,
  [TierLevel.TIER1]: 100000,
  [TierLevel.TIER2]: 350000,
  [TierLevel.TIER3]: 1000000,
  [TierLevel.WHALE]: 10000000,
};

// Define model restrictions for each tier
const TIER_MODEL_ACCESS = {
  [TierLevel.FREE]: ['Google'],
  [TierLevel.TIER1]: ['Google', 'Deepseek'],
  [TierLevel.TIER2]: ['Google', 'Deepseek', 'Anthropic'],
  [TierLevel.TIER3]: [], // Empty array means all models are allowed
  [TierLevel.WHALE]: [], // Empty array means all models are allowed
};

export async function action(args: ActionFunctionArgs) {
  return chatAction(args);
}

const logger = createScopedLogger('api.chat');

function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};

  const items = cookieHeader.split(';').map((cookie) => cookie.trim());

  items.forEach((item) => {
    const [name, ...rest] = item.split('=');

    if (name && rest) {
      const decodedName = decodeURIComponent(name.trim());
      const decodedValue = decodeURIComponent(rest.join('=').trim());
      cookies[decodedName] = decodedValue;
    }
  });

  return cookies;
}

async function chatAction({ context, request }: ActionFunctionArgs) {
  const { messages, files, promptId, contextOptimization, walletAddress, model, provider } = await request.json<{
    messages: Messages;
    files: any;
    promptId?: string;
    contextOptimization: boolean;
    walletAddress?: string;
    model?: string;
    provider?: string;
  }>();

  // Validate wallet and check tier access if wallet address is provided
  if (model && provider) {
    try {
      let hasAccess = false;
      let tier = TierLevel.FREE;

      if (walletAddress) {
        // If wallet address is provided, verify tier access
        const publicKey = new PublicKey(walletAddress);
        // Use generic property access to avoid type errors
        const endpoint = 'https://mainnet.helius-rpc.com/?api-key=ca767d51-be57-44d3-b2b1-b370bc1f0234';

        // Verify tier access
        const result = await verifyTierAccess(publicKey, model, provider, endpoint);
        hasAccess = result.hasAccess;
        tier = result.tier;
      } else {
        // If no wallet address, treat as free tier
        // Only allow access to Google models
        hasAccess = provider.toLowerCase() === 'google';
        tier = TierLevel.FREE;
      }

      if (!hasAccess) {
        // Return a simple error response
        return new Response(
          JSON.stringify({
            error: `Your wallet does not have access to the ${model} model. Please upgrade to a higher tier.`,
          }),
          {
            status: 403,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        );
      }

      // Log tier access
      logger.debug(`Wallet ${walletAddress} with tier ${tier} accessing model ${model}`);
    } catch (error) {
      // If there's an error verifying the wallet, log it but continue with the request
      // This ensures the API still works even if wallet verification fails
      logger.error('Error verifying wallet tier access:', error);
    }
  }

  const cookieHeader = request.headers.get('Cookie');
  const apiKeys = JSON.parse(parseCookies(cookieHeader || '').apiKeys || '{}');
  const providerSettings: Record<string, IProviderSetting> = JSON.parse(
    parseCookies(cookieHeader || '').providers || '{}',
  );

  const stream = new SwitchableStream();

  const cumulativeUsage = {
    completionTokens: 0,
    promptTokens: 0,
    totalTokens: 0,
  };
  const encoder: TextEncoder = new TextEncoder();
  let progressCounter: number = 1;

  try {
    const totalMessageContent = messages.reduce((acc, message) => acc + message.content, '');
    logger.debug(`Total message length: ${totalMessageContent.split(' ').length}, words`);

    let lastChunk: string | undefined = undefined;

    const dataStream = createDataStream({
      async execute(dataStream) {
        const filePaths = getFilePaths(files || {});
        let filteredFiles: FileMap | undefined = undefined;
        let summary: string | undefined = undefined;
        let messageSliceId = 0;

        if (messages.length > 3) {
          messageSliceId = messages.length - 3;
        }

        if (filePaths.length > 0 && contextOptimization) {
          logger.debug('Generating Chat Summary');
          dataStream.writeData({
            type: 'progress',
            label: 'summary',
            status: 'in-progress',
            order: progressCounter++,
            message: 'Analysing Request',
          } satisfies ProgressAnnotation);

          // Create a summary of the chat
          console.log(`Messages count: ${messages.length}`);

          summary = await createSummary({
            messages: [...messages],
            env: context.cloudflare?.env,
            apiKeys,
            providerSettings,
            promptId,
            contextOptimization,
            onFinish(resp) {
              if (resp.usage) {
                logger.debug('createSummary token usage', JSON.stringify(resp.usage));
                cumulativeUsage.completionTokens += resp.usage.completionTokens || 0;
                cumulativeUsage.promptTokens += resp.usage.promptTokens || 0;
                cumulativeUsage.totalTokens += resp.usage.totalTokens || 0;
              }
            },
          });
          dataStream.writeData({
            type: 'progress',
            label: 'summary',
            status: 'complete',
            order: progressCounter++,
            message: 'Analysis Complete',
          } satisfies ProgressAnnotation);

          dataStream.writeMessageAnnotation({
            type: 'chatSummary',
            summary,
            chatId: messages.slice(-1)?.[0]?.id,
          } as ContextAnnotation);

          // Update context buffer
          logger.debug('Updating Context Buffer');
          dataStream.writeData({
            type: 'progress',
            label: 'context',
            status: 'in-progress',
            order: progressCounter++,
            message: 'Determining Files to Read',
          } satisfies ProgressAnnotation);

          // Select context files
          console.log(`Messages count: ${messages.length}`);
          filteredFiles = await selectContext({
            messages: [...messages],
            env: context.cloudflare?.env,
            apiKeys,
            files,
            providerSettings,
            promptId,
            contextOptimization,
            summary,
            onFinish(resp) {
              if (resp.usage) {
                logger.debug('selectContext token usage', JSON.stringify(resp.usage));
                cumulativeUsage.completionTokens += resp.usage.completionTokens || 0;
                cumulativeUsage.promptTokens += resp.usage.promptTokens || 0;
                cumulativeUsage.totalTokens += resp.usage.totalTokens || 0;
              }
            },
          });

          if (filteredFiles) {
            logger.debug(`files in context : ${JSON.stringify(Object.keys(filteredFiles))}`);
          }

          dataStream.writeMessageAnnotation({
            type: 'codeContext',
            files: Object.keys(filteredFiles).map((key) => {
              let path = key;

              if (path.startsWith(WORK_DIR)) {
                path = path.replace(WORK_DIR, '');
              }

              return path;
            }),
          } as ContextAnnotation);

          dataStream.writeData({
            type: 'progress',
            label: 'context',
            status: 'complete',
            order: progressCounter++,
            message: 'Code Files Selected',
          } satisfies ProgressAnnotation);

          // logger.debug('Code Files Selected');
        }

        // Stream the text
        const options: StreamingOptions = {
          toolChoice: 'none',
          onFinish: async ({ text: content, finishReason, usage }) => {
            logger.debug('usage', JSON.stringify(usage));

            if (usage) {
              cumulativeUsage.completionTokens += usage.completionTokens || 0;
              cumulativeUsage.promptTokens += usage.promptTokens || 0;
              cumulativeUsage.totalTokens += usage.totalTokens || 0;
            }

            if (finishReason !== 'length') {
              dataStream.writeMessageAnnotation({
                type: 'usage',
                value: {
                  completionTokens: cumulativeUsage.completionTokens,
                  promptTokens: cumulativeUsage.promptTokens,
                  totalTokens: cumulativeUsage.totalTokens,
                },
              });
              dataStream.writeData({
                type: 'progress',
                label: 'response',
                status: 'complete',
                order: progressCounter++,
                message: 'Response Generated',
              } satisfies ProgressAnnotation);
              await new Promise((resolve) => setTimeout(resolve, 0));

              // stream.close();
              return;
            }

            if (stream.switches >= MAX_RESPONSE_SEGMENTS) {
              throw Error('Cannot continue message: Maximum segments reached');
            }

            const switchesLeft = MAX_RESPONSE_SEGMENTS - stream.switches;

            logger.info(`Reached max token limit (${MAX_TOKENS}): Continuing message (${switchesLeft} switches left)`);

            const lastUserMessage = messages.filter((x) => x.role == 'user').slice(-1)[0];
            const { model, provider } = extractPropertiesFromMessage(lastUserMessage);
            messages.push({ id: generateId(), role: 'assistant', content });
            messages.push({
              id: generateId(),
              role: 'user',
              content: `[Model: ${model}]\n\n[Provider: ${provider}]\n\n${CONTINUE_PROMPT}`,
            });

            const result = await streamText({
              messages,
              env: context.cloudflare?.env,
              options,
              apiKeys,
              files,
              providerSettings,
              promptId,
              contextOptimization,
              contextFiles: filteredFiles,
              summary,
              messageSliceId,
            });

            result.mergeIntoDataStream(dataStream);

            (async () => {
              for await (const part of result.fullStream) {
                if (part.type === 'error') {
                  const error: any = part.error;
                  logger.error(`${error}`);

                  return;
                }
              }
            })();

            return;
          },
        };

        dataStream.writeData({
          type: 'progress',
          label: 'response',
          status: 'in-progress',
          order: progressCounter++,
          message: 'Generating Response',
        } satisfies ProgressAnnotation);

        const result = await streamText({
          messages,
          env: context.cloudflare?.env,
          options,
          apiKeys,
          files,
          providerSettings,
          promptId,
          contextOptimization,
          contextFiles: filteredFiles,
          summary,
          messageSliceId,
        });

        (async () => {
          for await (const part of result.fullStream) {
            if (part.type === 'error') {
              const error: any = part.error;
              logger.error(`${error}`);

              return;
            }
          }
        })();
        result.mergeIntoDataStream(dataStream);
      },
      onError: (error: any) => `Custom error: ${error.message}`,
    }).pipeThrough(
      new TransformStream({
        transform: (chunk, controller) => {
          if (!lastChunk) {
            lastChunk = ' ';
          }

          if (typeof chunk === 'string') {
            if (chunk.startsWith('g') && !lastChunk.startsWith('g')) {
              controller.enqueue(encoder.encode(`0: "<div class=\\"__boltThought__\\">"\n`));
            }

            if (lastChunk.startsWith('g') && !chunk.startsWith('g')) {
              controller.enqueue(encoder.encode(`0: "</div>\\n"\n`));
            }
          }

          lastChunk = chunk;

          let transformedChunk = chunk;

          if (typeof chunk === 'string' && chunk.startsWith('g')) {
            let content = chunk.split(':').slice(1).join(':');

            if (content.endsWith('\n')) {
              content = content.slice(0, content.length - 1);
            }

            transformedChunk = `0:${content}\n`;
          }

          // Convert the string stream to a byte stream
          const str = typeof transformedChunk === 'string' ? transformedChunk : JSON.stringify(transformedChunk);
          controller.enqueue(encoder.encode(str));
        },
      }),
    );

    return new Response(dataStream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        Connection: 'keep-alive',
        'Cache-Control': 'no-cache',
        'Text-Encoding': 'chunked',
      },
    });
  } catch (error: any) {
    logger.error(error);

    if (error.message?.includes('API key')) {
      throw new Response('Invalid or missing API key', {
        status: 401,
        statusText: 'Unauthorized',
      });
    }

    throw new Response(null, {
      status: 500,
      statusText: 'Internal Server Error',
    });
  }
}

// Helper function to verify tier access
async function verifyTierAccess(
  publicKey: PublicKey,
  model: string,
  provider: string,
  endpoint: string,
): Promise<{ tier: TierLevel; hasAccess: boolean }> {
  try {
    // Hardcoded token mint address (same as in wallet.ts)
    const tokenMintAddress = new PublicKey('66ce7iZ5uqnVbh4Rt5wChHWyVfUvv1LJrBo8o214pump');

    // Get token balance
    const tokenAccountData = await fetchTokenAccountData(endpoint, publicKey);

    const mintAccount = tokenAccountData.tokenAccounts.filter(
      (tokenAccount) => tokenAccount.mint.toBase58() === tokenMintAddress.toBase58(),
    );

    let tokenBalance = 0;
    if (mintAccount.length > 0) {
      tokenBalance = parseFloat(mintAccount[0].amount) / 10 ** 6;
    }

    // Determine tier based on balance
    let currentTier;
    if (tokenBalance >= TIER_THRESHOLDS[TierLevel.WHALE]) {
      currentTier = TierLevel.WHALE;
    } else if (tokenBalance >= TIER_THRESHOLDS[TierLevel.TIER3]) {
      currentTier = TierLevel.TIER3;
    } else if (tokenBalance >= TIER_THRESHOLDS[TierLevel.TIER2]) {
      currentTier = TierLevel.TIER2;
    } else if (tokenBalance >= TIER_THRESHOLDS[TierLevel.TIER1]) {
      currentTier = TierLevel.TIER1;
    } else {
      currentTier = TierLevel.FREE;
    }

    // Check if model access is allowed
    const hasAccess = isModelAllowedForTier(model, provider, currentTier);

    return { tier: currentTier, hasAccess };
  } catch (error) {
    logger.error('Error verifying wallet tier access:', error);
    throw error;
  }
}

// Helper function to check if model is allowed for tier
function isModelAllowedForTier(modelName: string, providerName: string, tier: TierLevel): boolean {
  // Higher tiers (TIER3 and WHALE) have access to all models
  if (tier === TierLevel.TIER3 || tier === TierLevel.WHALE) {
    return true;
  }

  // For specific tiers, check against allowed providers
  const allowedProviders = TIER_MODEL_ACCESS[tier];

  // If allowedProviders is empty, all models are allowed for this tier
  if (!allowedProviders || allowedProviders.length === 0) {
    return true;
  }

  // Normalize the provider name for comparison
  const normalizedProviderName = providerName.toLowerCase();

  // Check if the provider is allowed for this tier
  return allowedProviders.some((allowedProvider) => normalizedProviderName.includes(allowedProvider.toLowerCase()));
}

// Helper function to fetch token account data
async function fetchTokenAccountData(endpoint: string, publicKey: PublicKey) {
  const connection = new Connection(endpoint);

  const solAccountResp = await connection.getAccountInfo(publicKey);
  const tokenAccountResp = await connection.getTokenAccountsByOwner(publicKey, {
    programId: TOKEN_PROGRAM_ID,
  });
  const token2022Resp = await connection.getTokenAccountsByOwner(publicKey, {
    programId: TOKEN_2022_PROGRAM_ID,
  });
  const tokenAccountData = parseTokenAccountResp({
    owner: publicKey,
    solAccountResp,
    tokenAccountResp: {
      context: tokenAccountResp.context,
      value: [...tokenAccountResp.value, ...token2022Resp.value],
    },
  });
  return tokenAccountData;
}
