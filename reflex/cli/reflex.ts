// Headless Reflex CLI: drives the app core without a browser.
// Reads one command per line on stdin, writes one JSON line per command to stdout:
//   ls
//   do register {"username":"ann","password":"secret123"}
//   do add {"title":"Buy milk"}
// Default: in-memory backend fixture, no network.
// `npm run cli -- http://localhost:3000` drives the real backend instead.
import { createInterface } from 'node:readline';
import { httpApi, memoryApi, memorySessions } from '../src/core/api.ts';
import { AppViewModel } from '../src/core/app.view-model.ts';
import { appNode, invoke, ls } from '../src/core/introspection.ts';

const backend = process.argv[2];
if (!backend) {
  // Zero-network guard: fixture mode must never reach the network.
  globalThis.fetch = () => Promise.reject(new Error('Network access is not allowed in fixture mode'));
}

const settle = () => new Promise((r) => setTimeout(r, backend ? 300 : 0)); // let service results come back
const root = appNode(new AppViewModel(backend ? httpApi(backend) : memoryApi(), memorySessions()));
await settle();

for await (const line of createInterface({ input: process.stdin })) {
  const [cmd, action, ...rest] = line.trim().split(' ');
  try {
    if (cmd === 'ls') console.log(JSON.stringify(ls(root)));
    else if (cmd === 'do' && action) {
      invoke(root, action, rest.length ? JSON.parse(rest.join(' ')) : {});
      await settle();
      const { name, state } = ls(root);
      console.log(JSON.stringify({ ok: true, name, state }));
    } else if (cmd) throw new Error('Commands: ls | do <action> [json]');
  } catch (e) {
    console.log(JSON.stringify({ ok: false, error: (e as Error).message }));
  }
}
