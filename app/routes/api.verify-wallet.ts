// app/routes/api.verify-wallet.ts
import { json } from '@remix-run/cloudflare';
import { Connection, PublicKey } from '@solana/web3.js';
import { parseTokenAccountResp } from '@raydium-io/raydium-sdk-v2';
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { TierLevel } from '~/lib/hooks/useTierAccess';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('api.verify-wallet');

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

export async function loader({
  request,
  context,
}: {
  request: Request;
  context: {
    cloudflare?: {
      env: Record<string, string>;
    };
  };
}) {
  // Get wallet address from query parameters
  const url = new URL(request.url);
  const walletAddress = url.searchParams.get('wallet');
  const model = url.searchParams.get('model');
  const provider = url.searchParams.get('provider');

  if (!walletAddress) {
    // If no wallet address is provided, treat as free tier
    // Only allow access to Google models
    const hasAccess = provider?.toLowerCase() === 'google';

    return json({
      tier: TierLevel.FREE,
      hasAccess,
      balance: '0',
      timestamp: Date.now(),
    });
  }

  try {
    const publicKey = new PublicKey(walletAddress);
    // Use mainnet endpoint from environment or default
    const endpoint =
      context.cloudflare?.env.SOLANA_ENDPOINT ||
      'https://mainnet.helius-rpc.com/?api-key=ca767d51-be57-44d3-b2b1-b370bc1f0234';

    // Hardcoded token mint address (same as in wallet.ts)
    const tokenMintAddress = new PublicKey('66ce7iZ5uqnVbh4Rt5wChHWyVfUvv1LJrBo8o214pump');

    // Get token balance
    const connection = new Connection(endpoint);

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
    let hasAccess = true;
    if (model && provider) {
      hasAccess = isModelAllowedForTier(model, provider, currentTier);
    }

    return json({
      balance: tokenBalance.toString(),
      tier: currentTier,
      hasAccess,
      timestamp: Date.now(),
    });
  } catch (error: any) {
    logger.error('Error verifying wallet balance:', error);
    return json(
      {
        error: `Failed to verify wallet: ${error.message}`,
        hasAccess: false,
      },
      { status: 500 },
    );
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

// Helper function to fetch token account data (copied from wallet.ts)
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
