// app/routes/api.verify-wallet.ts
import { json } from '@remix-run/cloudflare';
import { Connection, PublicKey } from '@solana/web3.js';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('api.fetch-balance');

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
  let balance = 0;

  if (!walletAddress) {
    return json({
      balance,
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
    const connection = new Connection(endpoint);
    const tokenAccounts = await connection.getTokenAccountsByOwner(publicKey, {
      mint: tokenMintAddress,
    });

    if (tokenAccounts.value.length === 0) {
      console.log('No token accounts found for this user and mint.');
      return json({
        balance: 0,
      });
    }

    const accountInfo = await connection.getParsedAccountInfo(tokenAccounts.value[0].pubkey);
    const data = accountInfo.value?.data as any;
    if (data && data.program === 'spl-token' && data.parsed.type === 'account') {
      const tokenAmount = data.parsed.info.tokenAmount;
      balance = parseFloat(tokenAmount.amount) / Math.pow(10, tokenAmount.decimals);
    }

    return json({
      balance,
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
