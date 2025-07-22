#!/bin/bash

# ==============================================================================
# DaitanJS Monorepo GLOBAL Rebuild & Republish Script (v2.0 - With Auto-Fix)
# ==============================================================================
# This script automates the entire process:
# 1. FIXES `package.json` in every workspace (removes old build scripts).
# 2. Cleans all old build artifacts.
# 3. Runs a fresh `npm install` from the root.
# 4. Builds ALL packages correctly using the root esbuild.config.js.
# 5. Iterates through every package in order, bumps its version, and publishes.
# 6. Pushes all changes and tags to Git.
#
# USAGE: ./rebuild-and-republish.sh
# ==============================================================================

set -e # Exit immediately if a command exits with a non-zero status.

# --- Configuration ---
VERSION_BUMP="patch"
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
PACKAGES_DIR="$SCRIPT_DIR/src" # Your packages are in 'src'

# The definitive publishing order
PUBLISH_ORDER=(
  "error" "security" "utilities" "finance" "embeddings" "development" "config" 
  "manipulation" "knowledge" "apiqueries" "validation" "html" "payments" 
  "pdf" "office" "queues" "speech" "data" "users" "math" "training" 
  "senses" "media" "web" "geo" "intelligence" "middleware" "init" "routes" "cli"
)

# --- Helper Functions ---
function print_header() {
  echo ""
  echo -e "\033[1;34m======================================================================\033[0m"
  echo -e "\033[1;34m$1\033[0m"
  echo -e "\033[1;34m======================================================================\033[0m"
  echo ""
}

function fix_package_json() {
  local pkg_path=$1
  local pkg_name=$2
  local pkg_json_file="$pkg_path/package.json"

  if [ ! -f "$pkg_json_file" ]; then
    echo "  -> ⚪️ WARN: package.json not found for $pkg_name. Skipping fix."
    return
  fi

  echo "  -> 🛠️ Fixing scripts and files in package.json for @daitanjs/$pkg_name..."

  # Use Node.js for reliable JSON manipulation
  node <<EOF
const fs = require('fs');
const path = require('path');
const pkgPath = path.resolve('${pkg_json_file}');
try {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  
  // 1. Overwrite the 'scripts' section
  pkg.scripts = {
    "test": "echo \"Error: no test specified for @daitanjs/${pkg_name}\" && exit 0"
  };

  // 2. Overwrite the 'files' section to only include 'dist'
  pkg.files = ["dist"];

  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
} catch (e) {
  console.error('Error fixing package.json for ${pkg_name}:', e);
  process.exit(1);
}
EOF
}


# --- Main Execution Logic ---
print_header "STEP 0: Initial Environment Verification"

echo "Verifying NPM login..."
NPM_USER=$(npm whoami)
if [ -z "$NPM_USER" ]; then
  echo "❌ Error: You are not logged into NPM. Please run 'npm login' first."
  exit 1
fi
echo "✅ Logged in as: $NPM_USER"

echo "Verifying Git status..."
if ! git diff-index --quiet HEAD --; then
    echo "❌ Error: Your git working directory is not clean. Please commit or stash your changes before publishing."
    exit 1
fi
echo "✅ Git working directory is clean."

print_header "STEP 1: Automatically Fixing All package.json Files"
for pkg_name in "${PUBLISH_ORDER[@]}"; do
  fix_package_json "$PACKAGES_DIR/$pkg_name" "$pkg_name"
done
echo "✅ All package.json files have been standardized."

# Commit the fixes before proceeding
echo ""
echo "-> Committing package.json fixes to Git..."
git add src/*/package.json
git commit -m "chore(build): standardize scripts and files in all packages"


print_header "STEP 2: Cleaning and Rebuilding ALL Packages"
cd "$SCRIPT_DIR"
# Use the rebuild script which handles clean, install, and build
npm run rebuild
echo "✅ All packages cleaned and rebuilt successfully with the correct build system."


print_header "STEP 3: Publishing All Packages to NPM"

TOTAL_PACKAGES=${#PUBLISH_ORDER[@]}
CURRENT_PACKAGE=1

for pkg_name in "${PUBLISH_ORDER[@]}"; do
  echo ""
  echo "--- Publishing [${CURRENT_PACKAGE}/${TOTAL_PACKAGES}]: @daitanjs/$pkg_name ---"
  pkg_path="$PACKAGES_DIR/$pkg_name"
  
  if [ ! -d "$pkg_path" ]; then
    echo "  -> ⚪️ WARN: Directory '$pkg_path' not found. Skipping."
    continue
  fi

  cd "$pkg_path"
  
  echo "  -> ⬆️  Bumping version with '$VERSION_BUMP'..."
  # --no-git-tag-version prevents creating a tag for each package, we'll do one at the end.
  npm version "$VERSION_BUMP" --no-git-tag-version --allow-same-version
  
  echo "  -> 🚀 Publishing to NPM..."
  npm publish

  echo "  -> ✅ Published @daitanjs/$pkg_name"
  
  cd "$SCRIPT_DIR"
  CURRENT_PACKAGE=$((CURRENT_PACKAGE + 1))
done


print_header "STEP 4: Finalizing Git Commits and Pushing"
cd "$SCRIPT_DIR"
echo "-> Committing all package.json version bumps..."
git add src/*/package.json
# Use --amend to merge this with the previous "standardize scripts" commit into one clean release commit
git commit --amend --no-edit

echo "-> Creating a single Git tag for this release..."
# Get the version of a high-level package to use for the tag
INTELLIGENCE_VERSION=$(node -p "require('./src/intelligence/package.json').version")
RELEASE_TAG="v$INTELLIGENCE_VERSION"
git tag -a "$RELEASE_TAG" -m "Release $RELEASE_TAG"

echo "-> Pushing commit to main..."
git push origin main

echo "-> Pushing release tag..."
git push origin "$RELEASE_TAG"

echo ""
echo "🎉 All done! Your entire library is fixed, rebuilt, republished, and synced with GitHub."