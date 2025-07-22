#!/bin/bash

# ==============================================================================
# DaitanJS Monorepo Republishing Script
# ==============================================================================
# This script automates the process of versioning and publishing all @daitanjs
# packages to NPM in the correct topological (dependency) order.
#
# USAGE:
# 1. Make sure you are logged into npm (`npm login`).
# 2. Make sure you have committed all your changes to git.
# 3. Run the script from the root of the monorepo: ./republish.sh
#
# By default, it performs a 'patch' version bump. You can change this by
# editing the VERSION_BUMP variable below.
# ==============================================================================

set -e # Exit immediately if a command exits with a non-zero status.

# --- Configuration ---
# Change this to "minor" or "major" if needed.
VERSION_BUMP="patch"

# Get the directory of the script to reliably find the packages directory
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
PACKAGES_DIR="$SCRIPT_DIR/src" # Your packages are in 'src'

# Define the publishing order, from foundational to high-level.
# This is the most critical part of the script.
PUBLISH_ORDER=(
  # Group 1: Foundational
  "error"
  "security"
  "utilities"
  "finance"
  "embeddings"

  # Group 2: Core Services
  "development"
  "config"
  "manipulation"
  "knowledge"

  # Group 3: Application-Level
  "apiqueries"
  "validation"
  "html"
  "payments"
  "pdf"
  "office"
  "queues"
  "speech"

  # Group 4: Data Abstractions
  "data"
  "users"
  "math"
  "training"

  # Group 5: High-Level Integrations
  "senses"
  "media"
  "web"
  "geo"

  # Group 6: Top-Level Frameworks
  "intelligence"
  "middleware"
  "init"
  "routes"
  "cli"
)

# --- Helper Functions ---
function print_header() {
  echo ""
  echo "======================================================================"
  echo "$1"
  echo "======================================================================"
  echo ""
}

function process_package() {
  local pkg_name=$1
  local pkg_path="$PACKAGES_DIR/$pkg_name"

  if [ ! -d "$pkg_path" ]; then
    echo "❌ WARNING: Directory for package '$pkg_name' not found at '$pkg_path'. Skipping."
    return
  fi

  print_header "Processing package: @daitanjs/$pkg_name"

  cd "$pkg_path"

  # Step 1: Versioning
  echo "  -> Bumping version with '$VERSION_BUMP'..."
  npm version "$VERSION_BUMP"

  # Step 2: Publishing
  # The `prepare` script was removed, so the central `npm run build` should be run before this script.
  # If not, you might need to build here. Assuming build is already done.
  echo "  -> Publishing to NPM..."
  npm publish

  echo "  ✅ Successfully published @daitanjs/$pkg_name"

  cd "$SCRIPT_DIR" # Return to the root directory for the next iteration
}

# --- Main Execution Logic ---
print_header "Starting DaitanJS Monorepo Republish Process"

echo "Verifying NPM login..."
NPM_USER=$(npm whoami)
if [ -z "$NPM_USER" ]; then
  echo "❌ Error: You are not logged into NPM. Please run 'npm login' first."
  exit 1
fi
echo "✅ Logged in as: $NPM_USER"
echo ""

echo "Verifying Git status..."
if ! git diff-index --quiet HEAD --; then
    echo "❌ Error: Your git working directory is not clean. Please commit or stash your changes before publishing."
    exit 1
fi
echo "✅ Git working directory is clean."
echo ""

echo "Rebuilding all packages to ensure they are up-to-date..."
cd "$SCRIPT_DIR"
npm run build
echo ""


TOTAL_PACKAGES=${#PUBLISH_ORDER[@]}
CURRENT_PACKAGE=1

for pkg in "${PUBLISH_ORDER[@]}"; do
  echo ""
  echo "--- [Package $CURRENT_PACKAGE / $TOTAL_PACKAGES] ---"
  process_package "$pkg"
  CURRENT_PACKAGE=$((CURRENT_PACKAGE + 1))
done

print_header "All packages have been published successfully!"

echo "Pushing final commits and all new version tags to GitHub..."
cd "$SCRIPT_DIR"
git push origin main
git push --tags

echo ""
echo "✅ All done! Your libraries are updated on NPM and GitHub."