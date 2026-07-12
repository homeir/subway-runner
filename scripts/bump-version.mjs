import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const packagePath = join(root, "package.json");
const versionPath = join(root, "src", "version.js");
const mainPath = join(root, "src", "main.js");
const indexPath = join(root, "index.html");

const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
const parts = packageJson.version.split(".").map((part) => Number.parseInt(part, 10));

if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
  throw new Error(`Expected package version like 0.1.0, got ${packageJson.version}`);
}

parts[2] += 1;
packageJson.version = parts.join(".");

await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
await writeFile(versionPath, `export const APP_VERSION = "${packageJson.version}";\n`);

const mainJs = await readFile(mainPath, "utf8");
const nextMainJs = mainJs
  .replace(
    /import \{ APP_VERSION \} from "\.\/version\.js(?:\?v=[^"]+)?";/,
    `import { APP_VERSION } from "./version.js?v=${packageJson.version}";`,
  )
  .replace(
    /import \{ QUESTIONS \} from "\.\/questions\.js(?:\?v=[^"]+)?";/,
    `import { QUESTIONS } from "./questions.js?v=${packageJson.version}";`,
  );
await writeFile(mainPath, nextMainJs);

const indexHtml = await readFile(indexPath, "utf8");
const nextIndexHtml = indexHtml
  .replace(/(<link rel="stylesheet" href="\.\/src\/styles\.css)(?:\?v=[^"]+)?(" \/>)/, `$1?v=${packageJson.version}$2`)
  .replace(/(<div class="version-badge" id="versionBadge">)v[^<]+(<\/div>)/, `$1v${packageJson.version}$2`)
  .replace(/(<script type="module" src="\.\/src\/main\.js)(?:\?v=[^"]+)?("><\/script>)/, `$1?v=${packageJson.version}$2`);
await writeFile(indexPath, nextIndexHtml);

console.log(`Version bumped to ${packageJson.version}`);
