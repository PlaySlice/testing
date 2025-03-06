import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { type FC } from 'react';

// Import the styles
import '@solana/wallet-adapter-react-ui/styles.css';

export const SolanaWalletButton: FC = () => {
  return <WalletMultiButton className="p-2" />;
};
