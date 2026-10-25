import { mount } from 'svelte';
import App from './App.svelte';
import './styles/global.css';

const target = document.getElementById('app');
if (target === null) {
  throw new Error('The #app mount point is missing from index.html.');
}

export default mount(App, { target });
