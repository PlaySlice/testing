import { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useTierAccess, TierLevel } from './useTierAccess';

interface ModelAccessState {
  hasAccess: boolean;
  isLoading: boolean;
  error: Error | null;
  verifiedTier: TierLevel | null;
}

interface WalletVerificationResponse {
  hasAccess: boolean;
  tier: TierLevel;
  balance?: string;
  error?: string;
  timestamp?: number;
}

/**
 * Hook to verify if the user's wallet has access to a specific model
 * @param modelName - The name of the model to check access for
 * @param providerName - The provider name of the model
 * @returns Access state including whether the user has access, loading state, and any errors
 */
export function useModelAccess(modelName: string, providerName: string) {
  const { publicKey } = useWallet();
  const { currentTier } = useTierAccess();
  const [state, setState] = useState<ModelAccessState>({
    hasAccess: false,
    isLoading: true,
    error: null,
    verifiedTier: null,
  });

  useEffect(() => {
    // Default to client-side check if not connected
    if (!publicKey) {
      // Use client-side tier check
      setState({
        hasAccess: true, // Default to allowing access if not connected
        isLoading: false,
        error: null,
        verifiedTier: currentTier,
      });
      return;
    }

    // Verify access on the backend
    async function verifyAccess() {
      try {
        setState((prev) => ({ ...prev, isLoading: true }));

        // At this point publicKey is non-null since we checked above
        const walletAddress = publicKey?.toString();
        if (!walletAddress) {
          throw new Error('Wallet address is not available');
        }

        const response = await fetch(
          `/api/verify-wallet?wallet=${walletAddress}&model=${modelName}&provider=${providerName}`,
        );

        if (!response.ok) {
          throw new Error('Failed to verify wallet access');
        }

        const data = (await response.json()) as WalletVerificationResponse;

        setState({
          hasAccess: data.hasAccess,
          isLoading: false,
          error: null,
          verifiedTier: data.tier,
        });
      } catch (error) {
        console.error('Error verifying model access:', error);

        // Fallback to client-side check if backend check fails
        setState({
          hasAccess: true, // Default to allowing in case of error
          isLoading: false,
          error: error instanceof Error ? error : new Error('Unknown error'),
          verifiedTier: currentTier,
        });
      }
    }

    verifyAccess();
  }, [publicKey, modelName, providerName, currentTier]);

  return state;
}

export default useModelAccess;
