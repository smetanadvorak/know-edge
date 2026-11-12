<!--
  Asks the passphrase that decrypts the stored token.

  prompt:
    how is token handled and stored?
    yes (encrypt the token with a passphrase + "forget token" button)
-->
<script lang="ts">
  let { onUnlock }: { onUnlock: (passphrase: string) => void } = $props();

  let passphrase = $state('');

  function focus(node: HTMLElement)
  {
    node.focus();
  }
</script>

<form class="ke-settings" onsubmit={(e) => { e.preventDefault(); onUnlock(passphrase); passphrase = ''; }}>
  <h3>Unlock</h3>
  <label>
    Passphrase
    <input type="password" bind:value={passphrase} autocomplete="current-password" use:focus />
  </label>
  <button class="mod-cta" type="submit" disabled={!passphrase}>Unlock</button>
</form>
