import fs from 'node:fs';
import {spawnSync} from 'node:child_process';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const result=spawnSync(process.execPath,[path.join(root,'node_modules/playwright/cli.js'),'install','chromium'],{stdio:'inherit',env:{...process.env,PLAYWRIGHT_BROWSERS_PATH:path.join(root,'.browsers')}});if(result.status===0)fs.writeFileSync(path.join(root,'.browsers/READY'),'Playwright Chromium installed successfully\n');process.exit(result.status??1);
