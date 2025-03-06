import React from 'react';
import { useStore } from '@nanostores/react';
import { walletStore } from '~/lib/stores/wallet';
import { classNames } from '~/utils/classNames';
import { useTierAccess, TierLevel } from '~/lib/hooks/useTierAccess';

interface TierProps {
  name: string;
  tokenAmount: string;
  description: string;
  features: string[];
  isActive: boolean;
  isPremium?: boolean;
  onClick: () => void;
  showUpgrade: boolean;
  upgradeCost?: number;
}

const Tier: React.FC<TierProps> = ({
  name,
  tokenAmount,
  description,
  features,
  isActive,
  isPremium,
  onClick,
  showUpgrade,
  upgradeCost,
}) => {
  const handlePurchaseClick = () => {
    if (!isActive) {
      window.open(
        'https://raydium.io/swap/?inputMint=sol&outputMint=66ce7iZ5uqnVbh4Rt5wChHWyVfUvv1LJrBo8o214pump',
        '_blank',
      );
    } else {
      onClick();
    }
  };

  return (
    <div
      className={classNames(
        'flex flex-col rounded-xl p-6 transition-all duration-300 relative overflow-hidden',
        'border-2',
        isActive
          ? 'border-purple-500 shadow-lg shadow-purple-500/20 scale-[1.02]'
          : 'border-bolt-elements-borderColor shadow-md hover:shadow-lg hover:border-purple-400/50',
        isPremium
          ? 'bg-gradient-to-br from-bolt-elements-background-depth-2 to-purple-950/20'
          : 'bg-bolt-elements-background-depth-2',
      )}
    >
      {isPremium && (
        <div className="absolute top-0 right-0">
          <div className="bg-purple-600 text-white text-xs font-bold py-1 px-3 transform rotate-45 translate-x-[18px] translate-y-[-10px] shadow-md">
            WHALE ACCESS
          </div>
        </div>
      )}

      <div className="mb-4">
        <h3 className="text-xl font-bold text-bolt-elements-textPrimary">{name}</h3>
        <div className="mt-2">
          <span className="text-2xl font-bold text-bolt-elements-textPrimary">{tokenAmount}</span>
          <span className="text-bolt-elements-textSecondary ml-1"> $EZ</span>
        </div>
        <p className="text-sm text-bolt-elements-textSecondary mt-2">{description}</p>
      </div>

      <div className="flex-1">
        <ul className="space-y-3">
          {features.map((feature, index) => (
            <li key={index} className="flex items-start text-sm">
              <div className="text-purple-500 mt-0.5 mr-2 i-ph:check-circle-fill" />
              <span className="text-bolt-elements-textSecondary">{feature}</span>
            </li>
          ))}
        </ul>
      </div>

      {(isActive || showUpgrade) && (
        <button
          onClick={handlePurchaseClick}
          className={classNames(
            'mt-5 py-2 px-4 w-full rounded-lg font-medium text-sm transition-colors',
            isActive
              ? 'bg-purple-600 text-white hover:bg-purple-700'
              : 'text-purple-500 bg-transparent border-2 border-purple-500 hover:bg-purple-500 hover:text-white',
          )}
        >
          {isActive ? (
            'Continue'
          ) : (
            <div className="flex items-center justify-center">
              <span>Purchase</span>
              {/* <div className="ml-2 h-4 w-4 bg-purple-400 rounded-full opacity-70">EZ1 Logo Placeholder</div> */}
            </div>
          )}
        </button>
      )}
    </div>
  );
};

const formatTokenAmount = (amount: number): string => {
  return new Intl.NumberFormat('en-US').format(amount);
};

export interface SubscriptionTiersProps {
  onContinue: () => void;
}

export const SubscriptionTiers: React.FC<SubscriptionTiersProps> = ({ onContinue }) => {
  const walletState = useStore(walletStore);
  const { currentTier, tiers, features } = useTierAccess();

  const calculateUpgradeCost = (targetTier: TierLevel): number => {
    const currentBalance = parseFloat(walletState.balance || '0');
    return tiers[targetTier] - currentBalance;
  };

  const tierData = [
    {
      level: TierLevel.FREE,
      name: 'Free',
      tokenAmount: formatTokenAmount(0),
      description: 'Basic access with Google AI',
      features: ['Access to Google AI models', 'Basic response time', 'Community support', 'Standard features'],
      isActive: currentTier === TierLevel.FREE,
      showUpgrade: false,
      onClick: () => currentTier === TierLevel.FREE && onContinue(),
    },
    {
      level: TierLevel.TIER1,
      name: 'Tier 1',
      tokenAmount: formatTokenAmount(100000),
      description: 'Enhanced AI access with Deepseek',
      features: [
        'All Free tier features',
        'Google & Deepseek models',
        'Faster response time',
        'Priority support',
        'Enhanced features',
      ],
      isActive: currentTier === TierLevel.TIER1,
      showUpgrade: currentTier === TierLevel.FREE,
      upgradeCost: calculateUpgradeCost(TierLevel.TIER1),
      onClick: () => currentTier === TierLevel.TIER1 && onContinue(),
    },
    {
      level: TierLevel.TIER2,
      name: 'Tier 2',
      tokenAmount: formatTokenAmount(350000),
      description: 'Advanced access with Anthropic models',
      features: [
        'All Tier 1 features',
        'Anthropic Claude models',
        'Limited monthly word count',
        'Advanced configurations',
        'Premium support',
      ],
      isActive: currentTier === TierLevel.TIER2,
      showUpgrade: currentTier === TierLevel.FREE || currentTier === TierLevel.TIER1,
      upgradeCost: calculateUpgradeCost(TierLevel.TIER2),
      onClick: () => currentTier === TierLevel.TIER2 && onContinue(),
    },
    {
      level: TierLevel.TIER3,
      name: 'Tier 3',
      tokenAmount: formatTokenAmount(1000000),
      description: 'Premium access to all models',
      features: [
        'Access to all AI providers',
        'Higher monthly word limit',
        'Priority processing',
        'VIP support',
        'Advanced features',
      ],
      isActive: currentTier === TierLevel.TIER3,
      showUpgrade: currentTier !== TierLevel.WHALE,
      upgradeCost: calculateUpgradeCost(TierLevel.TIER3),
      onClick: () => currentTier === TierLevel.TIER3 && onContinue(),
    },
    {
      level: TierLevel.WHALE,
      name: 'Whale',
      tokenAmount: formatTokenAmount(10000000),
      description: 'Ultimate unlimited access',
      features: [
        'Unlimited access to all providers',
        'No word count limits',
        'Fastest processing priority',
        'Exclusive Alpha Whale group access',
        'Direct developer support',
        'Early access to new features',
      ],
      isActive: currentTier === TierLevel.WHALE,
      showUpgrade: currentTier !== TierLevel.WHALE,
      upgradeCost: calculateUpgradeCost(TierLevel.WHALE),
      isPremium: true,
      onClick: () => currentTier === TierLevel.WHALE && onContinue(),
    },
  ];

  return (
    <div className="w-full h-full overflow-auto">
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-bolt-elements-textPrimary mb-3">Choose Your Access Tier</h2>
          <p className="text-bolt-elements-textSecondary max-w-xl mx-auto">
            Unlock premium AI models and exclusive features.
            <br /> Your current balance:
            <span className="font-bold text-purple-500 ml-1">
              {formatTokenAmount(parseFloat(walletState.balance || '0'))}
            </span>
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          {tierData.map((tier, index) => (
            <Tier key={index} {...tier} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default SubscriptionTiers;
