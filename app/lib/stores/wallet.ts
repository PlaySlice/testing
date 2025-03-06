import { atom } from 'nanostores';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { toast } from 'react-toastify';
import { logStore } from './logs';
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { parseTokenAccountResp } from '@raydium-io/raydium-sdk-v2';

interface WalletState {
  balance: string;
  isLoading: boolean;
  lastUpdated: number | null;
}

// Initialize with defaults
const initialWalletState: WalletState = {
  balance: '0',
  isLoading: false,
  lastUpdated: null,
};

export const walletStore = atom<WalletState>(initialWalletState);

/**
 * Fetches the token balance for a connected wallet
 * @param publicKey The public key of the connected wallet
 * @param endpoint The Solana cluster endpoint (defaults to devnet)
 */
export const fetchWalletBalance = async (
  publicKey: PublicKey | null,
  endpoint: string = 'https://api.devnet.solana.com',
): Promise<void> => {
  if (!publicKey) {
    toast.error('Wallet not connected');
    return;
  }

  try {
    walletStore.set({ ...walletStore.get(), isLoading: true });

    // Hardcoded token mint address
    const tokenMintAddress = new PublicKey('66ce7iZ5uqnVbh4Rt5wChHWyVfUvv1LJrBo8o214pump');

    // Get all token accounts for this wallet
    const response = await fetchTokenAccountData(endpoint, publicKey);

    // Default balance to 0
    let mintAccount = response.tokenAccounts.filter(
      (tokenAccount) => tokenAccount.mint.toBase58() === tokenMintAddress.toBase58(),
    );

    let tokenBalance = '0';

    if (mintAccount.length > 0) {
      tokenBalance = (parseFloat(mintAccount[0].amount) / 10 ** 6).toString();
    }
    console.log('tokenBalance', tokenBalance);
    // Update the store with the new balance
    walletStore.set({
      balance: tokenBalance,
      isLoading: false,
      lastUpdated: Date.now(),
    });

    logStore.logInfo('Token balance updated', {
      type: 'wallet',
      message: `Token balance updated: ${tokenBalance}`,
      balance: tokenBalance,
    });
  } catch (error) {
    logStore.logError('Failed to fetch token balance', { error });
    toast.error('Failed to fetch token balance');

    walletStore.set({
      ...walletStore.get(),
      isLoading: false,
    });
  }
};

export async function fetchTokenAccountData(endpoint: string, publicKey: PublicKey) {
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
