// File: linkWorkspaces.js

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

/**
 * Root directory of the monorepo.
 * Assumes this script is run from the monorepo's root directory.
 */
const rootDir = process.cwd();

/**
 * Path to the root package.json.
 */
const rootPackageJsonPath = path.join(rootDir, 'package.json');

/**
 * Links all workspaces globally using `npm link`.
 * Assumes that workspaces are now located under the 'src' directory.
 */
const linkWorkspaces = async () => {
  try {
    // Read and parse the root package.json
    if (!fs.existsSync(rootPackageJsonPath)) {
      throw new Error(`Root package.json not found at ${rootPackageJsonPath}`);
    }

    const rootPackageJson = JSON.parse(fs.readFileSync(rootPackageJsonPath, 'utf-8'));

    if (!rootPackageJson.workspaces || !Array.isArray(rootPackageJson.workspaces)) {
      throw new Error('No workspaces defined in root package.json');
    }

    // Iterate over each workspace defined in package.json
    for (const workspace of rootPackageJson.workspaces) {
      // Construct the absolute path to the workspace
      const workspacePath = path.join(rootDir, 'src', workspace); // **Amended Line**

      // Check if the workspace directory exists
      if (!fs.existsSync(workspacePath)) {
        console.warn(`⚠️  Workspace not found: ${workspace} at ${workspacePath}`);
        continue;
      }

      // Path to the workspace's package.json
      const packageJsonPath = path.join(workspacePath, 'package.json');

      // Check if package.json exists in the workspace
      if (!fs.existsSync(packageJsonPath)) {
        console.warn(`⚠️  package.json not found in workspace: ${workspace} at ${packageJsonPath}`);
        continue;
      }

      // Read and parse the workspace's package.json
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      // Ensure the workspace has a "name" field
      if (!packageJson.name) {
        console.warn(`⚠️  Missing "name" field in package.json of workspace: ${workspace}`);
        continue;
      }

      // Log the linking process
      console.log(`🔗 Linking workspace: ${packageJson.name} at ${workspacePath}`);

      // Execute `npm link` in the workspace directory
      try {
        execSync(`npm link`, { cwd: workspacePath, stdio: 'inherit' });
        console.log(`✅ Successfully linked workspace: ${packageJson.name}`);
      } catch (error) {
        console.error(`❌ Failed to link workspace: ${packageJson.name} - ${error.message}`);
      }
    }

    console.log('✅ All workspaces processed for global linking.');
  } catch (error) {
    console.error(`❌ Error linking workspaces: ${error.message}`);
    process.exit(1); // Exit with failure code
  }
};

// Invoke the linkWorkspaces function
linkWorkspaces();
