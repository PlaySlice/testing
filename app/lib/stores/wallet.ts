import { map } from 'nanostores';

export enum TierLevel {
  FREE = 'free',
  TIER1 = 'tier1',
  TIER2 = 'tier2',
  TIER3 = 'tier3',
  WHALE = 'whale',
}

export const TIER_THRESHOLDS = {
  [TierLevel.FREE]: 0,
  [TierLevel.TIER1]: 100000,
  [TierLevel.TIER2]: 350000,
  [TierLevel.TIER3]: 1000000,
  [TierLevel.WHALE]: 10000000,
};

// Centralized model access per tier
export const TIER_MODEL_ACCESS = {
  [TierLevel.FREE]: ['Google', 'Mistral'],
  [TierLevel.TIER1]: ['Google', 'Mistral', 'OpenRouter'],
  [TierLevel.TIER2]: ['Google', 'Mistral', 'OpenRouter', 'OpenAI'],
  [TierLevel.TIER3]: [
    'Google',
    'Deepseek',
    'Anthropic',
    'AmazonBedrock',
    'Cohere',
    'Github',
    'Groq',
    'HuggingFace',
    'Hyperbolic',
    'Mistral',
    'OpenAI',
    'OpenRouter',
    'Perplexity',
    'Together',
    'xAI',
  ],
  [TierLevel.WHALE]: [
    'Google',
    'Deepseek',
    'Anthropic',
    'AmazonBedrock',
    'Cohere',
    'Github',
    'Groq',
    'HuggingFace',
    'Hyperbolic',
    'Mistral',
    'OpenAI',
    'OpenRouter',
    'Perplexity',
    'Together',
    'xAI',
    'Ollama',
  ],
};

export const walletStore = map({
  balance: 0,
  providers: ['Google'],
  tier: TierLevel.FREE,
  showSubscriptionTiers: false,
});

export const updateWalletBalance = (balance: number) => {
  let tier = TierLevel.FREE;

  if (balance >= TIER_THRESHOLDS[TierLevel.WHALE]) {
    tier = TierLevel.WHALE;
  } else if (balance >= TIER_THRESHOLDS[TierLevel.TIER3]) {
    tier = TierLevel.TIER3;
  } else if (balance >= TIER_THRESHOLDS[TierLevel.TIER2]) {
    tier = TierLevel.TIER2;
  } else if (balance >= TIER_THRESHOLDS[TierLevel.TIER1]) {
    tier = TierLevel.TIER1;
  }

  const providers = [...TIER_MODEL_ACCESS[tier]];

  walletStore.set({ ...walletStore.get(), balance, tier, providers });
};

export const setShowSubscriptionTiers = (show: boolean) => {
  walletStore.set({ ...walletStore.get(), showSubscriptionTiers: show });
};
