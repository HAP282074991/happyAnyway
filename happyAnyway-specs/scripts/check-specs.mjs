import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
for (const path of ['AGENTS.md','README.md','rules/requirements.md','rules/specification.md','rules/change-management.md','product/overview.md','product/roadmap.md','contracts/index.md','delivery/status.md']) {
  if (!existsSync(join(root,path))) throw new Error('Missing: '+path);
}
function walk(dir) {
  for (const entry of readdirSync(dir,{withFileTypes:true})) {
    if(entry.name === '.git' || entry.isSymbolicLink()) continue;
    const path=join(dir,entry.name);
    if(entry.isDirectory()) walk(path);
    else if(entry.name.endsWith('.md')) {
      for(const match of readFileSync(path,'utf8').matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
        const target=match[1].split('#')[0];
        if(target && !/^[a-zA-Z]+:/.test(target) && !existsSync(resolve(dirname(path),target))) throw new Error('Broken link: '+path+' -> '+target);
      }
    }
  }
}
walk(root);
console.log('PASS: specification files and local links; business approval is not checked.');
