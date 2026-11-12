/**
 * Storage interface used by the engine. implemented by the obsidian plugin (vault)
 * and by the web client (http api of the web server).
 *
 * prompt:
 *   can it have an alternative interfaece for when obsidian is not available? like a webpage?
 *   but based on the same "backend"
 *   git suits me well / a vps / should cover both
 */
import type { LogEntry } from './types';

export interface Storage
{
  // paths of all deck files
  deckPaths(): Promise<string[]>;
  read(path: string): Promise<string>;
  // read-modify-write of one file; fn gets the current text and returns the new one
  modify(path: string, fn: (text: string) => string): Promise<void>;
  // all review log entries of all devices
  readLogs(): Promise<LogEntry[]>;
  // append to this device's log
  appendLog(entry: LogEntry): Promise<void>;
}

export interface SchedulerParams
{
  request_retention: number;
  maximum_interval: number;
}
