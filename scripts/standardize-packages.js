// scripts/standardize-packages.js (version 1.0.0)
/**
 * @file A script to standardize all package.json files in the monorepo for Turborepo compliance.
 * @description
 * This script performs the following actions on every package within the `packages/*` directory:
 * 1. Reads the existing package.json.
 * 2. Overwrites the `scripts` object with a standardized set for `clean`, `build`, `watch`, and `test`.
 * 3. Standardizes the `files` array to `["dist"]`.
 * 4. Removes redundant `devDependencies` that are now managed at the root level.
 * 5. Rewrites the package.json file with the standardized content.
 * This ensures all packages are "lean" and can be orchestrated by Turborepo from the root.
 */

import fs from 'fs/promises';
import path from 'path';

const PACKAGES_DIR = path.resolve(process.cwd(), 'packages');
const DEV_DEPS_TO_REMOVE = [
  '@babel/cli',
  '@babel/core',
  '@babel/plugin-transform-runtime',
  '@babel/preset-env',
  'rimraf',
  'jest',
  'babel-jest',
];

async function standardizePackage(pkgName) {
  const pkgDir = path.join(PACKAGES_DIR, pkgName);
  const pkgJsonPath = path.join(pkgDir, 'package.json');

  try {
    const pkgJsonStat = await fs.stat(pkgJsonPath).catch(() => null);
    if (!pkgJsonStat) {
      console.log(`🟡 Skipping: No package.json found for "${pkgName}".`);
      return;
    }

    console.log(`🔵 Processing: @daitanjs/${pkgName}`);

    const pkgContent = await fs.readFile(pkgJsonPath, 'utf8');
    const pkg = JSON.parse(pkgContent);
    let hasChanged = false;

    // 1. Standardize scripts
    const newScripts = {
      clean: 'rimraf dist',
      build: 'babel src --out-dir dist --extensions ".js" --source-maps inline',
      watch: 'babel src --out-dir dist --extensions ".js" --source-maps inline --watch',
      test: `echo "Error: no test specified for @daitanjs/${pkgName}" && exit 0`,
    };

    if (JSON.stringify(pkg.scripts) !== JSON.stringify(newScripts)) {
      pkg.scripts = newScripts;
      hasChanged = true;
    }

    // 2. Standardize files array
    const newFiles = ['dist'];
    if (JSON.stringify(pkg.files) !== JSON.stringify(newFiles)) {
      pkg.files = newFiles;
      hasChanged = true;
    }

    // 3. Remove root-level devDependencies
    if (pkg.devDependencies) {
      let devDepsChanged = false;
      DEV_DEPS_TO_REMOVE.forEach((dep) => {
        if (pkg.devDependencies[dep]) {
          delete pkg.devDependencies[dep];
          devDepsChanged = true;
        }
      });
      if (devDepsChanged) {
        hasChanged = true;
      }
      if (Object.keys(pkg.devDependencies).length === 0) {
        delete pkg.devDependencies;
      }
    }

    if (hasChanged) {
      await fs.writeFile(pkgJsonPath, JSON.stringify(pkg, null, 2) + '\n');
      console.log(`✅ Updated: @daitanjs/${pkgName} is now Turbo-compliant.`);
    } else {
      console.log(`⚪️ No changes needed for @daitanjs/${pkgName}.`);
    }
  } catch (error) {
    console.error(`❌ Error processing @daitanjs/${pkgName}: ${error.message}`);
  }
}

async function main() {
  console.log('🚀 Starting standardization of all DaitanJS packages...');
  const packages = await fs.readdir(PACKAGES_DIR);
  for (const pkgName of packages) {
    const pkgPath = path.join(PACKAGES_DIR, pkgName);
    const stat = await fs.stat(pkgPath);
    if (stat.isDirectory()) {
      await standardizePackage(pkgName);
    }
  }
  console.log('\n🎉 Standardization complete. Your packages are now lean and ready for Turborepo.');
  console.log("Next steps: Run 'npm install' from the root, then 'npm run watch' to start developing.");
}

main().catch(console.error);