import { createServer } from './server.ts';

const port = Number(process.env['PORT'] ?? 3000);
createServer(process.env['DB_PATH'] ?? 'todos.db').listen(port, () => console.log(`API on http://localhost:${port}`));
