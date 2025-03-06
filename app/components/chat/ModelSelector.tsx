import { useWallet } from '@solana/wallet-adapter-react';
import type { KeyboardEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { TierLevel, useTierAccess } from '~/lib/hooks/useTierAccess';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { ProviderInfo } from '~/types/model';
import { classNames } from '~/utils/classNames';

// Define the interface for the wallet verification response
interface WalletVerificationResponse {
  hasAccess: boolean;
  tier: TierLevel;
  balance?: string;
  error?: string;
  timestamp?: number;
}

interface ModelSelectorProps {
  model?: string;
  setModel?: (model: string) => void;
  provider?: ProviderInfo;
  setProvider?: (provider: ProviderInfo) => void;
  modelList: ModelInfo[];
  providerList: ProviderInfo[];
  apiKeys: Record<string, string>;
  modelLoading?: string;
  onAccessChange?: (hasAccess: boolean) => void;
}

export const ModelSelector = ({
  model,
  setModel,
  provider,
  setProvider,
  modelList,
  providerList,
  modelLoading,
  onAccessChange,
}: ModelSelectorProps) => {
  const [modelSearchQuery, setModelSearchQuery] = useState('');
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const optionsRef = useRef<(HTMLDivElement | null)[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get wallet and tier information for model access
  const { publicKey } = useWallet();
  const { currentTier } = useTierAccess();

  // Pre-compute model access information at the component level
  const [modelAccessMap, setModelAccessMap] = useState<Record<string, { hasAccess: boolean; isLoading: boolean }>>({});

  // Fetch access status for all models when provider changes
  useEffect(() => {
    console.log('All models (unfiltered):', modelList);

    if (!provider) {
      // If no provider, treat all models as accessible
      const defaultAccess = modelList.reduce(
        (acc, model) => {
          acc[`${model.provider}:${model.name}`] = { hasAccess: true, isLoading: false };
          return acc;
        },
        {} as Record<string, { hasAccess: boolean; isLoading: boolean }>,
      );

      setModelAccessMap(defaultAccess);
      console.log('No provider, default access map:', defaultAccess);
      return;
    }

    if (!publicKey) {
      // If no wallet is connected, only allow access to free tier models (Google)
      const freeAccess = modelList.reduce(
        (acc, model) => {
          // Only Google models are accessible in free tier
          const hasAccess = model.provider.toLowerCase() === 'google';
          acc[`${model.provider}:${model.name}`] = { hasAccess, isLoading: false };
          return acc;
        },
        {} as Record<string, { hasAccess: boolean; isLoading: boolean }>,
      );

      setModelAccessMap(freeAccess);
      console.log('No wallet connected, free tier access map:', freeAccess);

      // Notify parent about access status for current model
      if (model && onAccessChange) {
        const modelInfo = modelList.find((m) => m.name === model && m.provider === provider.name);
        if (modelInfo) {
          const modelKey = `${modelInfo.provider}:${modelInfo.name}`;
          const hasAccess = modelInfo.provider.toLowerCase() === 'google';
          onAccessChange(hasAccess);
        }
      }

      return;
    }

    // Only check models for the current provider
    const providerModels = modelList.filter((m) => m.provider === provider.name);

    // Initialize with loading state
    const initialState = providerModels.reduce(
      (acc, model) => {
        acc[`${model.provider}:${model.name}`] = { hasAccess: false, isLoading: true };
        return acc;
      },
      {} as Record<string, { hasAccess: boolean; isLoading: boolean }>,
    );

    setModelAccessMap(initialState);

    // Fetch access for each model
    const checkModelAccess = async () => {
      if (!publicKey) return;

      const walletAddress = publicKey.toString();
      const accessPromises = providerModels.map(async (modelInfo) => {
        try {
          const response = await fetch(
            `/api/verify-wallet?wallet=${walletAddress}&model=${modelInfo.name}&provider=${modelInfo.provider}`,
          );

          if (!response.ok) {
            throw new Error('Failed to verify access');
          }

          const data = (await response.json()) as WalletVerificationResponse;

          return {
            modelKey: `${modelInfo.provider}:${modelInfo.name}`,
            hasAccess: data.hasAccess,
            isLoading: false,
          };
        } catch (error) {
          console.error('Error checking model access:', error);
          return {
            modelKey: `${modelInfo.provider}:${modelInfo.name}`,
            hasAccess: true, // Default to allowing in case of error
            isLoading: false,
          };
        }
      });

      const results = await Promise.all(accessPromises);

      setModelAccessMap((prev) => {
        const newMap = { ...prev };
        results.forEach((result) => {
          newMap[result.modelKey] = {
            hasAccess: result.hasAccess,
            isLoading: result.isLoading,
          };
        });
        return newMap;
      });

      // Return results for the .then() handler
      return results;
    };

    // When results come back, log them
    checkModelAccess();
  }, [provider, publicKey, modelList]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsModelDropdownOpen(false);
        setModelSearchQuery('');
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

  // Render a model option with tier access indicators - now using pre-computed access data
  const renderModelOption = (modelInfo: ModelInfo, isSelected: boolean, isFocused: boolean) => {
    const modelKey = `${modelInfo.provider}:${modelInfo.name}`;
    const { hasAccess = true, isLoading = false } = modelAccessMap[modelKey] || { hasAccess: true, isLoading: false };

    // Log model info when rendering
    console.log(`Rendering model ${modelInfo.name}:`, {
      modelKey,
      hasAccess,
      isLoading,
      isSelected,
      isFocused,
    });

    return (
      <div
        className={classNames(
          'px-4 py-2 transition-colors',
          isSelected || isFocused ? 'bg-bolt-elements-background-depth-3' : '',
          !hasAccess && !isLoading ? 'opacity-50' : '',
          // Only show cursor-pointer for models that are accessible or still loading
          hasAccess || isLoading ? 'cursor-pointer' : 'cursor-not-allowed',
        )}
        onClick={hasAccess || isLoading ? undefined : (e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm text-bolt-elements-textPrimary">{modelInfo.label}</span>
          {!hasAccess && !isLoading && (
            <div className="tier-lock-indicator flex items-center">
              <span className="lock-icon text-purple-500 mr-1 i-ph:lock-key-fill" />
              <span className="upgrade-text text-xs text-purple-400">Upgrade</span>
            </div>
          )}
          {isLoading && <span className="text-xs text-gray-400">Verifying...</span>}
        </div>
      </div>
    );
  };

  // Reset focused index when search query changes or dropdown opens/closes
  useEffect(() => {
    setFocusedIndex(-1);
  }, [modelSearchQuery, isModelDropdownOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isModelDropdownOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isModelDropdownOpen]);

  // Handle keyboard navigation
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!isModelDropdownOpen) {
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex((prev) => {
          const next = prev + 1;

          if (next >= filteredModels.length) {
            return 0;
          }

          return next;
        });
        break;

      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex((prev) => {
          const next = prev - 1;

          if (next < 0) {
            return filteredModels.length - 1;
          }

          return next;
        });
        break;

      case 'Enter':
        e.preventDefault();

        if (focusedIndex >= 0 && focusedIndex < filteredModels.length) {
          const selectedModel = filteredModels[focusedIndex];

          // Check if user has access to this model before proceeding
          const modelKey = `${selectedModel.provider}:${selectedModel.name}`;
          const { hasAccess = true, isLoading = false } = modelAccessMap[modelKey] || {
            hasAccess: true,
            isLoading: false,
          };

          console.log(
            `Model selected via keyboard: ${selectedModel.name}, hasAccess: ${hasAccess}, isLoading: ${isLoading}`,
          );

          // Only select the model and close dropdown if user has access or if still loading
          if (hasAccess || isLoading) {
            setModel?.(selectedModel.name);
            setIsModelDropdownOpen(false);
            setModelSearchQuery('');
          } else {
            console.log('Keyboard model selection prevented - user does not have access:', selectedModel.name);
          }
        }

        break;

      case 'Escape':
        e.preventDefault();
        setIsModelDropdownOpen(false);
        setModelSearchQuery('');
        break;

      case 'Tab':
        if (!e.shiftKey && focusedIndex === filteredModels.length - 1) {
          setIsModelDropdownOpen(false);
        }

        break;
    }
  };

  // Focus the selected option
  useEffect(() => {
    if (focusedIndex >= 0 && optionsRef.current[focusedIndex]) {
      optionsRef.current[focusedIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [focusedIndex]);

  // Update enabled providers when cookies change
  useEffect(() => {
    // If current provider is disabled, switch to first enabled provider
    if (providerList.length === 0) {
      return;
    }

    if (provider && !providerList.map((p) => p.name).includes(provider.name)) {
      const firstEnabledProvider = providerList[0];
      setProvider?.(firstEnabledProvider);

      // Also update the model to the first available one for the new provider
      const firstModel = modelList.find((m) => m.provider === firstEnabledProvider.name);

      if (firstModel) {
        setModel?.(firstModel.name);
      }
    }
  }, [providerList, provider, setProvider, modelList, setModel]);

  // Add logging when a model is selected
  const handleModelSelect = (selectedModel: string) => {
    if (setModel) {
      const modelInfo = modelList.find((m) => m.name === selectedModel);
      if (modelInfo) {
        const modelKey = `${modelInfo.provider}:${modelInfo.name}`;
        const { hasAccess = true, isLoading = false } = modelAccessMap[modelKey] || {
          hasAccess: true,
          isLoading: false,
        };

        console.log('Model selected:', {
          name: selectedModel,
          provider: modelInfo.provider,
          key: modelKey,
          hasAccess,
          isLoading,
          fullAccessMap: modelAccessMap,
        });

        // Only set the model if the user has access or if access is still being verified
        if (hasAccess || isLoading) {
          setModel(selectedModel);
        } else {
          console.log('Model selection prevented - user does not have access:', selectedModel);
        }
      } else {
        setModel(selectedModel);
      }
    }
  };

  // Add more comprehensive model access logging
  useEffect(() => {
    // Log the current model access map whenever it changes
    console.log('Model access map updated:', modelAccessMap);

    // If there's a currently selected model, log its access status
    if (model && provider) {
      const modelInfo = modelList.find((m) => m.name === model && m.provider === provider.name);
      if (modelInfo) {
        const modelKey = `${modelInfo.provider}:${modelInfo.name}`;
        const accessStatus = modelAccessMap[modelKey];
        console.log('Current selected model access status:', {
          model,
          provider: provider.name,
          modelKey,
          accessStatus,
          found: !!accessStatus,
        });

        // Notify the parent component about the access state
        if (onAccessChange) {
          const hasAccess = accessStatus?.hasAccess ?? true;
          onAccessChange(hasAccess);
        }
      }
    }
  }, [modelAccessMap, model, provider, modelList, onAccessChange]);

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
      <select
        value={provider?.name ?? ''}
        onChange={(e) => {
          const newProvider = providerList.find((p: ProviderInfo) => p.name === e.target.value);

          if (newProvider && setProvider) {
            setProvider(newProvider);
          }

          const firstModel = [...modelList].find((m) => m.provider === e.target.value);

          if (firstModel && setModel) {
            setModel(firstModel.name);
          }
        }}
        className="flex-1 p-2 rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-prompt-background text-bolt-elements-textPrimary focus:outline-none focus:ring-2 focus:ring-bolt-elements-focus transition-all"
      >
        {providerList.map((provider: ProviderInfo) => (
          <option key={provider.name} value={provider.name}>
            {provider.name}
          </option>
        ))}
      </select>

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
                      'px-3 py-2',
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

                      // Check if user has access to this model before proceeding
                      const modelKey = `${modelOption.provider}:${modelOption.name}`;
                      const { hasAccess = true, isLoading = false } = modelAccessMap[modelKey] || {
                        hasAccess: true,
                        isLoading: false,
                      };

                      console.log(
                        `Model clicked: ${modelOption.name}, hasAccess: ${hasAccess}, isLoading: ${isLoading}`,
                      );

                      // Only select the model and close dropdown if user has access or if still loading
                      if (hasAccess || isLoading) {
                        handleModelSelect(modelOption.name);
                        setIsModelDropdownOpen(false);
                        setModelSearchQuery('');
                      } else {
                        console.log('Model selection prevented - user does not have access:', modelOption.name);
                      }
                    }}
                    tabIndex={focusedIndex === index ? 0 : -1}
                  >
                    {renderModelOption(modelOption, model === modelOption.name, focusedIndex === index)}
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
