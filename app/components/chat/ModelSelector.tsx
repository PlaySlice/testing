import type { ProviderInfo } from '~/types/model';
import { useEffect, useState, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import type { ModelInfo } from '~/lib/modules/llm/types';
import { classNames } from '~/utils/classNames';
import { useStore } from '@nanostores/react';
import { walletStore } from '~/lib/stores/wallet';

interface ModelSelectorProps {
  model?: string;
  setModel?: (model: string) => void;
  provider?: ProviderInfo;
  setProvider?: (provider: ProviderInfo) => void;
  modelList: ModelInfo[];
  providerList: ProviderInfo[];
  apiKeys: Record<string, string>;
  modelLoading?: string;
}

export const ModelSelector = ({
  model,
  setModel,
  provider,
  setProvider,
  modelList,
  providerList,
  modelLoading,
}: ModelSelectorProps) => {
  const [modelSearchQuery, setModelSearchQuery] = useState('');
  const [providerSearchQuery, setProviderSearchQuery] = useState('');
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [isProviderDropdownOpen, setIsProviderDropdownOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [focusedProviderIndex, setFocusedProviderIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const providerSearchInputRef = useRef<HTMLInputElement>(null);
  const optionsRef = useRef<(HTMLDivElement | null)[]>([]);
  const providerOptionsRef = useRef<(HTMLDivElement | null)[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const providerDropdownRef = useRef<HTMLDivElement>(null);

  const { providers: enabledProviders } = useStore(walletStore);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsModelDropdownOpen(false);
        setModelSearchQuery('');
      }
      if (providerDropdownRef.current && !providerDropdownRef.current.contains(event.target as Node)) {
        setIsProviderDropdownOpen(false);
        setProviderSearchQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter models based on search query
  const filteredModels = [...modelList]
    .filter((e) => e.provider === provider?.name && e.name)
    .filter(
      (model) =>
        model.label.toLowerCase().includes(modelSearchQuery.toLowerCase()) ||
        model.name.toLowerCase().includes(modelSearchQuery.toLowerCase()),
    );

  // Filter providers based on search query
  const filteredProviders = [...providerList].filter((provider) =>
    provider.name.toLowerCase().includes(providerSearchQuery.toLowerCase()),
  );

  // Reset focused indices when search queries change or dropdowns open/close
  useEffect(() => {
    setFocusedIndex(-1);
  }, [modelSearchQuery, isModelDropdownOpen]);

  useEffect(() => {
    setFocusedProviderIndex(-1);
  }, [providerSearchQuery, isProviderDropdownOpen]);

  // Focus search inputs when dropdowns open
  useEffect(() => {
    if (isModelDropdownOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
    if (isProviderDropdownOpen && providerSearchInputRef.current) {
      providerSearchInputRef.current.focus();
    }
  }, [isModelDropdownOpen, isProviderDropdownOpen]);

  // Handle keyboard navigation for models
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!isModelDropdownOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex((prev) => (prev + 1 >= filteredModels.length ? 0 : prev + 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex((prev) => (prev - 1 < 0 ? filteredModels.length - 1 : prev - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < filteredModels.length) {
          setModel?.(filteredModels[focusedIndex].name);
          setIsModelDropdownOpen(false);
          setModelSearchQuery('');
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsModelDropdownOpen(false);
        setModelSearchQuery('');
        break;
    }
  };

  // Handle keyboard navigation for providers
  const handleProviderKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!isProviderDropdownOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedProviderIndex((prev) => (prev + 1 >= filteredProviders.length ? 0 : prev + 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedProviderIndex((prev) => (prev - 1 < 0 ? filteredProviders.length - 1 : prev - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (focusedProviderIndex >= 0 && focusedProviderIndex < filteredProviders.length) {
          const selectedProvider = filteredProviders[focusedProviderIndex];
          if (enabledProviders.includes(selectedProvider.name)) {
            setProvider?.(selectedProvider);
            const firstModel = modelList.find((m) => m.provider === selectedProvider.name);
            if (firstModel) setModel?.(firstModel.name);
            setIsProviderDropdownOpen(false);
            setProviderSearchQuery('');
          }
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsProviderDropdownOpen(false);
        setProviderSearchQuery('');
        break;
    }
  };

  // Focus the selected options
  useEffect(() => {
    if (focusedIndex >= 0 && optionsRef.current[focusedIndex]) {
      optionsRef.current[focusedIndex]?.scrollIntoView({ block: 'nearest' });
    }
    if (focusedProviderIndex >= 0 && providerOptionsRef.current[focusedProviderIndex]) {
      providerOptionsRef.current[focusedProviderIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [focusedIndex, focusedProviderIndex]);

  // Update enabled providers when cookies change
  useEffect(() => {
    if (providerList.length === 0) return;

    if (provider && !providerList.map((p) => p.name).includes(provider.name)) {
      const firstEnabledProvider = providerList[0];
      setProvider?.(firstEnabledProvider);

      const firstModel = modelList.find((m) => m.provider === firstEnabledProvider.name);
      if (firstModel) {
        setModel?.(firstModel.name);
      }
    }

    // Check if current model is from an enabled provider
    const currentModel = modelList.find((m) => m.name === model);
    if (currentModel && !enabledProviders.includes(currentModel.provider)) {
      const firstEnabledProvider = providerList.find((p) => enabledProviders.includes(p.name));
      if (firstEnabledProvider) {
        setProvider?.(firstEnabledProvider);
        const firstModel = modelList.find((m) => m.provider === firstEnabledProvider.name);
        if (firstModel) {
          setModel?.(firstModel.name);
        }
      }
    }
  }, [providerList, provider, setProvider, modelList, setModel, enabledProviders]);

  if (providerList.length === 0) {
    return (
      <div className="mb-2 p-4 rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-prompt-background text-bolt-elements-textPrimary">
        <p className="text-center">
          No providers are currently enabled. Please enable at least one provider in the settings to start using the
          chat.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-2 flex gap-2 flex-col sm:flex-row">
      <div className="relative flex-1" onKeyDown={handleProviderKeyDown} ref={providerDropdownRef}>
        <div
          className={classNames(
            'w-full p-2 rounded-lg border border-bolt-elements-borderColor',
            'bg-bolt-elements-prompt-background text-bolt-elements-textPrimary',
            'focus-within:outline-none focus-within:ring-2 focus-within:ring-bolt-elements-focus',
            'transition-all cursor-pointer',
            isProviderDropdownOpen ? 'ring-2 ring-bolt-elements-focus' : undefined,
          )}
          onClick={() => setIsProviderDropdownOpen(!isProviderDropdownOpen)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setIsProviderDropdownOpen(!isProviderDropdownOpen);
            }
          }}
          role="combobox"
          aria-expanded={isProviderDropdownOpen}
          aria-controls="provider-listbox"
          aria-haspopup="listbox"
          tabIndex={0}
        >
          <div className="flex items-center justify-between">
            <div className="truncate">{provider?.name || 'Select provider'}</div>
            <div
              className={classNames(
                'i-ph:caret-down w-4 h-4 text-bolt-elements-textSecondary opacity-75',
                isProviderDropdownOpen ? 'rotate-180' : undefined,
              )}
            />
          </div>
        </div>

        {isProviderDropdownOpen && (
          <div
            className="absolute z-10 w-full mt-1 py-1 rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 shadow-lg"
            role="listbox"
            id="provider-listbox"
          >
            <div className="px-2 pb-2">
              <div className="relative">
                <input
                  ref={providerSearchInputRef}
                  type="text"
                  value={providerSearchQuery}
                  onChange={(e) => setProviderSearchQuery(e.target.value)}
                  placeholder="Search providers..."
                  className={classNames(
                    'w-full pl-8 pr-3 py-1.5 rounded-md text-sm',
                    'bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor',
                    'text-bolt-elements-textPrimary placeholder:text-bolt-elements-textTertiary',
                    'focus:outline-none focus:ring-2 focus:ring-bolt-elements-focus',
                    'transition-all',
                  )}
                  onClick={(e) => e.stopPropagation()}
                  role="searchbox"
                  aria-label="Search providers"
                />
                <div className="absolute left-2.5 top-1/2 -translate-y-1/2">
                  <span className="i-ph:magnifying-glass text-bolt-elements-textTertiary" />
                </div>
              </div>
            </div>

            <div
              className={classNames(
                'max-h-60 overflow-y-auto',
                'sm:scrollbar-none',
                '[&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar]:h-2',
                '[&::-webkit-scrollbar-thumb]:bg-bolt-elements-borderColor',
                '[&::-webkit-scrollbar-thumb]:hover:bg-bolt-elements-borderColorHover',
                '[&::-webkit-scrollbar-thumb]:rounded-full',
                '[&::-webkit-scrollbar-track]:bg-bolt-elements-background-depth-2',
                '[&::-webkit-scrollbar-track]:rounded-full',
                'sm:[&::-webkit-scrollbar]:w-1.5 sm:[&::-webkit-scrollbar]:h-1.5',
                'sm:hover:[&::-webkit-scrollbar-thumb]:bg-bolt-elements-borderColor/50',
                'sm:hover:[&::-webkit-scrollbar-thumb:hover]:bg-bolt-elements-borderColor',
                'sm:[&::-webkit-scrollbar-track]:bg-transparent',
              )}
            >
              {filteredProviders.map((providerOption, index) => {
                const isEnabled = enabledProviders.includes(providerOption.name);
                return (
                  <div
                    ref={(el) => (providerOptionsRef.current[index] = el)}
                    key={index}
                    role="option"
                    aria-selected={provider?.name === providerOption.name}
                    className={classNames(
                      'px-3 py-2 text-sm cursor-pointer flex items-center justify-between',
                      'hover:bg-bolt-elements-background-depth-3',
                      isEnabled ? 'text-bolt-elements-textPrimary' : 'text-bolt-elements-textTertiary',
                      'outline-none',
                      provider?.name === providerOption.name || focusedProviderIndex === index
                        ? 'bg-bolt-elements-background-depth-2'
                        : undefined,
                      focusedProviderIndex === index ? 'ring-1 ring-inset ring-bolt-elements-focus' : undefined,
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isEnabled) {
                        setProvider?.(providerOption);
                        const firstModel = modelList.find((m) => m.provider === providerOption.name);
                        if (firstModel) setModel?.(firstModel.name);
                        setIsProviderDropdownOpen(false);
                        setProviderSearchQuery('');
                      }
                    }}
                    tabIndex={focusedProviderIndex === index ? 0 : -1}
                  >
                    <span>{providerOption.name}</span>
                    {!isEnabled && (
                      <div className="tier-lock-indicator flex items-center">
                        <span className="lock-icon text-purple-500 mr-1 i-ph:lock-key-fill" />
                        <span className="upgrade-text text-xs text-purple-400">Upgrade</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="relative flex-1 lg:max-w-[70%]" onKeyDown={handleKeyDown} ref={dropdownRef}>
        <div
          className={classNames(
            'w-full p-2 rounded-lg border border-bolt-elements-borderColor',
            'bg-bolt-elements-prompt-background text-bolt-elements-textPrimary',
            'focus-within:outline-none focus-within:ring-2 focus-within:ring-bolt-elements-focus',
            'transition-all cursor-pointer',
            isModelDropdownOpen ? 'ring-2 ring-bolt-elements-focus' : undefined,
          )}
          onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setIsModelDropdownOpen(!isModelDropdownOpen);
            }
          }}
          role="combobox"
          aria-expanded={isModelDropdownOpen}
          aria-controls="model-listbox"
          aria-haspopup="listbox"
          tabIndex={0}
        >
          <div className="flex items-center justify-between">
            <div className="truncate">{modelList.find((m) => m.name === model)?.label || 'Select model'}</div>
            <div
              className={classNames(
                'i-ph:caret-down w-4 h-4 text-bolt-elements-textSecondary opacity-75',
                isModelDropdownOpen ? 'rotate-180' : undefined,
              )}
            />
          </div>
        </div>

        {isModelDropdownOpen && (
          <div
            className="absolute z-10 w-full mt-1 py-1 rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2  shadow-lg"
            role="listbox"
            id="model-listbox"
          >
            <div className="px-2 pb-2">
              <div className="relative">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={modelSearchQuery}
                  onChange={(e) => setModelSearchQuery(e.target.value)}
                  placeholder="Search models..."
                  className={classNames(
                    'w-full pl-8 pr-3 py-1.5 rounded-md text-sm',
                    'bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor',
                    'text-bolt-elements-textPrimary placeholder:text-bolt-elements-textTertiary',
                    'focus:outline-none focus:ring-2 focus:ring-bolt-elements-focus',
                    'transition-all',
                  )}
                  onClick={(e) => e.stopPropagation()}
                  role="searchbox"
                  aria-label="Search models"
                />
                <div className="absolute left-2.5 top-1/2 -translate-y-1/2">
                  <span className="i-ph:magnifying-glass text-bolt-elements-textTertiary" />
                </div>
              </div>
            </div>

            <div
              className={classNames(
                'max-h-60 overflow-y-auto',
                'sm:scrollbar-none',
                '[&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar]:h-2',
                '[&::-webkit-scrollbar-thumb]:bg-bolt-elements-borderColor',
                '[&::-webkit-scrollbar-thumb]:hover:bg-bolt-elements-borderColorHover',
                '[&::-webkit-scrollbar-thumb]:rounded-full',
                '[&::-webkit-scrollbar-track]:bg-bolt-elements-background-depth-2',
                '[&::-webkit-scrollbar-track]:rounded-full',
                'sm:[&::-webkit-scrollbar]:w-1.5 sm:[&::-webkit-scrollbar]:h-1.5',
                'sm:hover:[&::-webkit-scrollbar-thumb]:bg-bolt-elements-borderColor/50',
                'sm:hover:[&::-webkit-scrollbar-thumb:hover]:bg-bolt-elements-borderColor',
                'sm:[&::-webkit-scrollbar-track]:bg-transparent',
              )}
            >
              {modelLoading === 'all' || modelLoading === provider?.name ? (
                <div className="px-3 py-2 text-sm text-bolt-elements-textTertiary">Loading...</div>
              ) : filteredModels.length === 0 ? (
                <div className="px-3 py-2 text-sm text-bolt-elements-textTertiary">No models found</div>
              ) : (
                filteredModels.map((modelOption, index) => (
                  <div
                    ref={(el) => (optionsRef.current[index] = el)}
                    key={index}
                    role="option"
                    aria-selected={model === modelOption.name}
                    className={classNames(
                      'px-3 py-2 text-sm cursor-pointer',
                      'hover:bg-bolt-elements-background-depth-3',
                      'text-bolt-elements-textPrimary',
                      'outline-none',
                      model === modelOption.name || focusedIndex === index
                        ? 'bg-bolt-elements-background-depth-2'
                        : undefined,
                      focusedIndex === index ? 'ring-1 ring-inset ring-bolt-elements-focus' : undefined,
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      setModel?.(modelOption.name);
                      setIsModelDropdownOpen(false);
                      setModelSearchQuery('');
                    }}
                    tabIndex={focusedIndex === index ? 0 : -1}
                  >
                    {modelOption.label}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
