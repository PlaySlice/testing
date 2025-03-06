import { useEffect, useMemo } from 'react';
import { useStore } from '@nanostores/react';
import { walletStore } from '../stores/wallet';

export enum TierLevel {
  FREE = 'free',
  TIER1 = 'tier1',
  TIER2 = 'tier2',
  TIER3 = 'tier3',
  WHALE = 'whale',
}

// Define the token thresholds for each tier
const TIER_THRESHOLDS = {
  [TierLevel.FREE]: 0,
  [TierLevel.TIER1]: 100000,
  [TierLevel.TIER2]: 350000,
  [TierLevel.TIER3]: 1000000,
  [TierLevel.WHALE]: 10000000,
};

// Define features for each tier
const TIER_FEATURES = {
  [TierLevel.FREE]: {
    models: ['Google Gemini'],
    responseTime: 'Basic',
    support: 'Community',
    features: 'Standard',
  },
  [TierLevel.TIER1]: {
    models: ['Google Gemini', 'OpenRouter DeepSeek'],
    responseTime: 'Faster',
    support: 'Priority',
    features: 'Enhanced',
  },
  [TierLevel.TIER2]: {
    models: ['Google Gemini', 'OpenRouter DeepSeek', 'Claude 3.7'],
    responseTime: 'Fast',
    support: 'Premium',
    features: 'Advanced',
    wordCount: 'Limited monthly',
  },
  [TierLevel.TIER3]: {
    models: 'All AI models',
    responseTime: 'Priority',
    support: 'VIP',
    features: 'Advanced',
    wordCount: 'Higher monthly limit',
  },
  [TierLevel.WHALE]: {
    models: 'Unlimited access to all models',
    responseTime: 'Fastest priority',
    support: 'Direct developer support',
    features: 'Early access',
    wordCount: 'No limits',
    extras: ['Exclusive Alpha Whale group access'],
  },
};

export function useTierAccess() {
  const walletState = useStore(walletStore);

  // Determine the current tier based on token balance
  const currentTier = useMemo(() => {
    const balance = parseFloat(walletState.balance || '0');

    if (balance >= TIER_THRESHOLDS[TierLevel.WHALE]) {
      return TierLevel.WHALE;
    } else if (balance >= TIER_THRESHOLDS[TierLevel.TIER3]) {
      return TierLevel.TIER3;
    } else if (balance >= TIER_THRESHOLDS[TierLevel.TIER2]) {
      return TierLevel.TIER2;
    } else if (balance >= TIER_THRESHOLDS[TierLevel.TIER1]) {
      return TierLevel.TIER1;
    } else {
      return TierLevel.FREE;
    }
  }, [walletState.balance]);

  // Get features for the current tier
  const features = useMemo(() => {
    return TIER_FEATURES[currentTier];
  }, [currentTier]);

  return {
    currentTier,
    features,
    tiers: TIER_THRESHOLDS,
    isLoading: walletState.isLoading,
  };
}

export default useTierAccess;
