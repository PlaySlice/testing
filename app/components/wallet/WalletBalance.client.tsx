import React from 'react';
import { useStore } from '@nanostores/react';
import { walletStore, fetchWalletBalance } from '~/lib/stores/wallet';
import { useWallet } from '@solana/wallet-adapter-react';
import { clusterApiUrl } from '@solana/web3.js';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { classNames } from '~/utils/classNames';
import { useTierAccess, TierLevel } from '~/lib/hooks/useTierAccess';

export const WalletBalance: React.FC = () => {
  const walletState = useStore(walletStore);
  const { publicKey } = useWallet();
  const { currentTier } = useTierAccess();

  const handleRefresh = async () => {
    if (publicKey) {
      const network = WalletAdapterNetwork.Devnet;
      const endpoint = clusterApiUrl(network);
      await fetchWalletBalance(publicKey, endpoint);
    }
  };

  const getTierBadgeColor = () => {
    switch (currentTier) {
      case TierLevel.WHALE:
        return 'bg-purple-600 text-white';
      case TierLevel.TIER3:
        return 'bg-purple-500 text-white';
      case TierLevel.TIER2:
        return 'bg-blue-500 text-white';
      case TierLevel.TIER1:
        return 'bg-green-500 text-white';
      default:
        return 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const getTierName = () => {
    switch (currentTier) {
      case TierLevel.WHALE:
        return 'Whale';
      case TierLevel.TIER3:
        return 'Tier 3';
      case TierLevel.TIER2:
        return 'Tier 2';
      case TierLevel.TIER1:
        return 'Tier 1';
      default:
        return 'Free';
    }
  };

  return (
    <div className="flex items-center gap-2 mr-4">
      {/* Tier Badge */}
      <div className={classNames('px-2 py-1 rounded-full text-xs font-semibold', getTierBadgeColor())}>
        {getTierName()}
      </div>

      {/* Balance Display */}
      <div
        className={classNames(
          'px-3 py-1 rounded-lg flex items-center gap-2 text-sm font-medium',
          'bg-bolt-elements-surface border border-bolt-elements-borderColor',
        )}
      >
        <div className="i-ph:coin-duotone text-yellow-500" />
        <span className="text-bolt-elements-textPrimary">
          {walletState.isLoading ? <span className="animate-pulse">Loading...</span> : `${walletState.balance} EZ1`}
        </span>
        <button
          onClick={handleRefresh}
          className="transition-transform hover:rotate-180 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary"
          disabled={walletState.isLoading}
          title="Refresh balance"
        >
          <div className={classNames('i-ph:arrows-clockwise', { 'animate-spin': walletState.isLoading })} />
        </button>
      </div>
    </div>
  );
};

export default WalletBalance;
