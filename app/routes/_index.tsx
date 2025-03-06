import { json, type MetaFunction } from '@remix-run/cloudflare';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { ClientOnly } from 'remix-utils/client-only';
import { BaseChat } from '~/components/chat/BaseChat';
import { Header } from '~/components/header/Header';
import BackgroundRays from '~/components/ui/BackgroundRays';
import { SolanaWalletProvider } from '~/components/ui/SolanaWalletProvider.client';

import '@solana/wallet-adapter-react-ui/styles.css';

export const meta: MetaFunction = () => {
  return [{ title: 'ez1' }, { name: 'description', content: 'Dream it, Build it.' }];
};

export const loader = () => json({});

/**
 * Landing page component for Bolt
 * Note: Settings functionality should ONLY be accessed through the sidebar menu.
 * Do not add settings button/panel to this landing page as it was intentionally removed
 * to keep the UI clean and consistent with the design system.
 */
export default function Index() {
  const network = WalletAdapterNetwork.Mainnet;

  return (
    <div className="flex flex-col h-full w-full bg-bolt-elements-background-depth-1">
      <ClientOnly fallback={<div>Loading wallet connect...</div>}>
        {() => (
          <SolanaWalletProvider network={network}>
            {/* Your app content here */}
            <Header />
            <main className="flex flex-col items-center justify-center flex-grow w-full relative overflow-hidden">
              <div className="absolute inset-0 overflow-hidden">
                <BackgroundRays />
              </div>
              <BaseChat />
            </main>
          </SolanaWalletProvider>
        )}
      </ClientOnly>
    </div>
  );
}
