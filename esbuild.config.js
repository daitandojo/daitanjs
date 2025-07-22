// esbuild.config.js
import esbuild from 'esbuild';
import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';

const ROOT_DIR = process.cwd();
const SCRIPT_VERSION = '4.3.0-final'; // Version for this build script

async function getPackages() {
  const rootPkgPath = path.join(ROOT_DIR, 'package.json');
  const rootPkg = JSON.parse(await fs.readFile(rootPkgPath, 'utf-8'));
  const workspaces = rootPkg.workspaces || [];

  const packagePaths = [];
  for (const workspacePattern of workspaces) {
    const files = await glob(workspacePattern, { cwd: ROOT_DIR, absolute: true });
    packagePaths.push(...files);
  }
  return packagePaths;
}

async function buildPackage(pkgPath) {
  const pkgJsonPath = path.join(pkgPath, 'package.json');
  try {
    const pkg = JSON.parse(await fs.readFile(pkgJsonPath, 'utf-8'));
    const { name, main, module: modulePath } = pkg;

    if (!main && !modulePath) {
      console.log(`[Skip] Skipping ${name}, no main/module entry points.`);
      return;
    }

    // THE DEFINITIVE FIX:
    // Mark ALL dependencies from node_modules as external.
    // This prevents esbuild from bundling them and encountering issues
    // with Node.js built-in modules like 'os', 'util', 'fs', etc.
    const external = [
      ...Object.keys(pkg.dependencies || {}),
      ...Object.keys(pkg.peerDependencies || {}),
    ];
    
    // Add a wildcard for any transitive dependencies.
    // This tells esbuild: "If you see an import that isn't a relative path,
    // leave it as an import/require statement. Do not bundle it."
    external.push('!./*', '!../../*'); // Esbuild needs patterns for non-external

    const entryPoint = path.join(pkgPath, 'src', 'index.js');
    if (!(await fs.stat(entryPoint).catch(() => false))) {
        console.log(`[Skip] Skipping ${name}, no src/index.js found.`);
        return;
    }

    const commonOptions = {
      entryPoints: [entryPoint],
      bundle: true,
      platform: 'node',
      sourcemap: true,
      packages: 'external', // Simplified and powerful way to mark all dependencies as external
    };

    const buildPromises = [];

    // Build CJS
    if (main) {
      buildPromises.push(
        esbuild.build({
          ...commonOptions,
          format: 'cjs',
          outfile: path.join(pkgPath, main),
        })
      );
    }

    // Build ESM
    if (modulePath) {
      buildPromises.push(
        esbuild.build({
          ...commonOptions,
          format: 'esm',
          outfile: path.join(pkgPath, modulePath),
        })
      );
    }
    
    await Promise.all(buildPromises);
    console.log(`  ✅ [Build Success] ${name}`);

  } catch (error) {
    console.error(`  ❌ [Build Failed] for package at ${pkgPath}:`, error);
    throw error; // Stop the entire build process on failure
  }
}

async function main() {
  console.log(`[Build] Build process starting... (Script Version: ${SCRIPT_VERSION})`);
  const startTime = Date.now();
  
  try {
    const packages = await getPackages();
    console.log(`[Info] Found ${packages.length} workspaces to build.`);

    await Promise.all(packages.map(buildPackage));

    const duration = (Date.now() - startTime) / 1000;
    console.log(`\n[Build] All packages built successfully in ${duration.toFixed(2)}s.`);

  } catch (error) {
    console.error('\n💥 A critical error occurred during the build process. Aborting.');
    process.exit(1);
  }
}

// Check if this script is being run directly
if (import.meta.url.startsWith('file://') && process.argv[1] === new URL(import.meta.url).pathname) {
  main();
}