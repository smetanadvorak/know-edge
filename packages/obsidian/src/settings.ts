/**
 * Plugin settings and settings tab.
 * device name is stored in local storage (not in data.json), because data.json is synced between devices.
 *
 * prompt:
 *   5. ok, what gui can we get?  (settings: device name, fsrs parameters, folders)
 */
import { PluginSettingTab, Setting, type App } from 'obsidian';
import type KnowEdgePlugin from './main';

export interface KnowEdgeSettings
{
  deck_folder: string;
  log_folder: string;
  request_retention: number;
  maximum_interval: number;
}

export const DEFAULT_SETTINGS: KnowEdgeSettings = {
  deck_folder: 'decks',
  log_folder: 'know-edge-logs',
  request_retention: 0.9,
  maximum_interval: 36500,
};

export class KnowEdgeSettingTab extends PluginSettingTab
{
  constructor(app: App, private plugin: KnowEdgePlugin)
  {
    super(app, plugin);
  }

  display(): void
  {
    const { containerEl } = this;
    containerEl.empty();
    const settings = this.plugin.settings;

    new Setting(containerEl)
      .setName('Deck folder')
      .setDesc('Every markdown file in this folder is a deck.')
      .addText((t) => t.setValue(settings.deck_folder).onChange(async (v) =>
      {
        settings.deck_folder = v.trim();
        await this.plugin.saveSettings();
      }));

    new Setting(containerEl)
      .setName('Log folder')
      .setDesc('Review logs, one file per device.')
      .addText((t) => t.setValue(settings.log_folder).onChange(async (v) =>
      {
        settings.log_folder = v.trim();
        await this.plugin.saveSettings();
      }));

    new Setting(containerEl)
      .setName('Device name')
      .setDesc('Unique per device. Names this device\'s log file. Not synced.')
      .addText((t) => t.setValue(this.plugin.device).onChange((v) => this.plugin.setDevice(v.trim())));

    new Setting(containerEl)
      .setName('Requested retention')
      .setDesc('FSRS target recall probability, 0.7–0.99.')
      .addText((t) => t.setValue(String(settings.request_retention)).onChange(async (v) =>
      {
        settings.request_retention = Number(v);
        await this.plugin.saveSettings();
      }));

    new Setting(containerEl)
      .setName('Maximum interval (days)')
      .addText((t) => t.setValue(String(settings.maximum_interval)).onChange(async (v) =>
      {
        settings.maximum_interval = Number(v);
        await this.plugin.saveSettings();
      }));
  }
}
