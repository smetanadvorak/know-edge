/**
 * Web app configuration, kept in the browser's local storage (per browser, never committed).
 *
 * prompt:
 *   if sync via github, can i host there too?
 *   1. yes (github pages + github api, no server)  3. let's batch
 *   how is token handled and stored?  yes (encrypt the token with a passphrase + "forget token" button)
 */
import { newId } from '@know-edge/core';
import type { EncryptedToken } from './token_crypto';

export interface WebConfig
{
  owner: string;
  repo: string;
  branch: string;
  // fine-grained token (contents read/write on the vault repo only), encrypted with a passphrase
  token_enc: EncryptedToken | null;
  deck_folder: string;
  log_folder: string;
  // names this browser's log file: <log_folder>/log-<device>.jsonl
  device: string;
  request_retention: number;
  maximum_interval: number;
}

const CONFIG_KEY = 'know-edge-config';

export function defaultConfig(): WebConfig
{
  return {
    owner: '',
    repo: '',
    branch: 'main',
    token_enc: null,
    deck_folder: 'decks',
    log_folder: 'know-edge-logs',
    device: 'web-' + newId(new Set()),
    request_retention: 0.9,
    maximum_interval: 36500,
  };
}

export function loadConfig(): WebConfig
{
  const raw = localStorage.getItem(CONFIG_KEY);
  const config = { ...defaultConfig(), ...(raw ? JSON.parse(raw) : {}) };
  // drop a plain token left by an older version; it has to be entered again with a passphrase
  const had_plain_token = 'token' in config;
  delete config.token;
  // keep the generated device name stable
  if (!raw || had_plain_token) saveConfig(config);
  return config;
}

export function saveConfig(config: WebConfig): void
{
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

export function isConfigured(config: WebConfig): boolean
{
  return Boolean(config.owner && config.repo && config.branch && config.token_enc);
}
