import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useEffect, type FC } from 'react';
import { updateWalletBalance } from '~/lib/stores/wallet';

// Import the styles
import '@solana/wallet-adapter-react-ui/styles.css';

export const SolanaWalletButton: FC = () => {
  const { publicKey } = useWallet();

  const fetchBalance = async () => {
    console.log('fetching balance');
    if (publicKey) {
      const response = (await fetch(`/api/fetch-balance?wallet=${publicKey.toBase58()}`)) as Record<string, any>;
      if (response.ok && !response.error) {
        const data = await response.json();
        console.log('response', data);
        const { balance } = data as { balance: number };
        updateWalletBalance(balance);
      } else {
        updateWalletBalance(0);
      }
    }
  };

  useEffect(() => {
    if (publicKey) {
      fetchBalance();
    } else {
      updateWalletBalance(0);
    }
  }, [publicKey]);

  return <WalletMultiButton className="p-2" />;
};
