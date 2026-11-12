/**
 * Entry point of the know-edge web app.
 *
 * prompt:
 *   can it have an alternative interfaece for when obsidian is not available? like a webpage?
 *   but based on the same "backend"
 *   if sync via github, can i host there too?  1. yes  3. let's batch
 */
import 'katex/dist/katex.min.css';
import '@know-edge/ui/styles.css';
import './web.css';
import { mount } from 'svelte';
import App from './App.svelte';

mount(App, { target: document.getElementById('app')! });
