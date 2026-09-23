'use client';

import { BlockGroupItem } from '@/blocks/types';
import { createContext, PropsWithChildren, useContext } from 'react';
import { DEFAULT_SLASH_COMMANDS } from './extensions/slash-command/default-slash-commands';

export const DEFAULT_PLACEHOLDER_URL = 'https://example.com/';

export type MailyContextType = {
  placeholderUrl?: string;
  blocks?: BlockGroupItem[];
  onImageUpload?: (file: Blob) => Promise<string>;
  allowedMimeTypes?: string[];
  onPickImage?: () => Promise<string | null>;
  isLibraryImage?: (src: string) => boolean;
};

export const MailyContext = createContext<MailyContextType>({
  placeholderUrl: DEFAULT_PLACEHOLDER_URL,
  blocks: DEFAULT_SLASH_COMMANDS,
});

type MailyProviderProps = PropsWithChildren<MailyContextType>;

export function MailyProvider(props: MailyProviderProps) {
  const { children, ...defaultValues } = props;

  return (
    <MailyContext.Provider value={defaultValues}>
      {children}
    </MailyContext.Provider>
  );
}

export function useMailyContext() {
  const values = useContext(MailyContext);
  if (!values) {
    throw new Error('Missing MailyContext.Provider in the component tree');
  }

  return values;
}
