<!--
  Settings form: vault repo, token (+ passphrase to encrypt it), folders, device name, fsrs parameters.
  token field empty = keep the stored token. "Forget token" removes the stored token.

  prompt:
    if sync via github, can i host there too?
    1. yes (github pages + github api, no server)
    how is token handled and stored?
    yes (encrypt the token with a passphrase + "forget token" button)
-->
<script lang="ts">
  import type { WebConfig } from './config';

  let { config, onSave, onForget }: {
    config: WebConfig;
    // new_token / passphrase are null when the stored token is kept
    onSave: (config: WebConfig, new_token: string | null, passphrase: string | null) => void;
    onForget: () => void;
  } = $props();

  let draft = $state({ ...config });
  let token = $state('');
  let passphrase = $state('');
  let passphrase_check = $state('');

  const has_token = $derived(config.token_enc !== null);
  const problem = $derived.by(() =>
  {
    if (!draft.owner || !draft.repo || !draft.branch) return 'Owner, repository and branch are required.';
    if (!token && !has_token) return 'Token is required.';
    if (token && passphrase.length < 8) return 'Passphrase: at least 8 characters.';
    if (token && passphrase !== passphrase_check) return 'Passphrases do not match.';
    return '';
  });

  function submit(e: SubmitEvent)
  {
    e.preventDefault();
    if (problem) return;
    onSave({ ...draft }, token || null, token ? passphrase : null);
    token = '';
    passphrase = '';
    passphrase_check = '';
  }
</script>

<form class="ke-settings" onsubmit={submit}>
  <h3>Vault repository</h3>
  <label>Owner <input bind:value={draft.owner} placeholder="github user or org" /></label>
  <label>Repository <input bind:value={draft.repo} /></label>
  <label>Branch <input bind:value={draft.branch} /></label>
  <label>
    Token
    <input type="password" bind:value={token} autocomplete="off" placeholder={has_token ? 'stored (leave empty to keep)' : ''} />
    <small>Fine-grained token, only this repo, permission "Contents: read and write", with an expiry date.</small>
  </label>
  {#if token}
    <label>
      Passphrase
      <input type="password" bind:value={passphrase} autocomplete="new-password" />
      <small>Encrypts the token in this browser. Asked once per page load. Not recoverable: if lost, enter the token again.</small>
    </label>
    <label>Repeat passphrase <input type="password" bind:value={passphrase_check} autocomplete="new-password" /></label>
  {/if}
  {#if has_token}
    <button type="button" onclick={onForget}>Forget token</button>
  {/if}

  <h3>Folders</h3>
  <label>Deck folder <input bind:value={draft.deck_folder} /></label>
  <label>Log folder <input bind:value={draft.log_folder} /></label>
  <label>
    Device name
    <input bind:value={draft.device} />
    <small>Unique per browser. Names this browser's log file.</small>
  </label>

  <h3>FSRS</h3>
  <label>Requested retention <input type="number" step="0.01" min="0.7" max="0.99" bind:value={draft.request_retention} /></label>
  <label>Maximum interval (days) <input type="number" min="1" bind:value={draft.maximum_interval} /></label>

  {#if problem}<small class="ke-settings-problem">{problem}</small>{/if}
  <button class="mod-cta" type="submit" disabled={Boolean(problem)}>Save</button>
</form>
