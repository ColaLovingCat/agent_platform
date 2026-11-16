import { cpSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['service/server.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: 'dist/service/server.cjs',
  external: ['vite', 'mssql'],
  banner: {
    js: "process.env.NODE_ENV = 'production';",
  },
});

const require = createRequire(path.join(process.cwd(), 'package.json'));
const swaggerSrc = path.dirname(require.resolve('swagger-ui-dist/package.json'));
const swaggerOut = path.resolve('dist/service/swagger-ui');
mkdirSync(swaggerOut, { recursive: true });
for (const file of ['swagger-ui.css', 'swagger-ui-bundle.js', 'swagger-ui.css.map', 'favicon-32x32.png']) {
  cpSync(path.join(swaggerSrc, file), path.join(swaggerOut, file));
}

console.log('Template API written to dist/service/server.cjs');
console.log('Deploy dist/service. Keep dbs/, uploads/, and logs/.');
