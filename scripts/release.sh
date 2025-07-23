#!/bin/bash
# scripts/release.sh (version 1.0.0)

# ==============================================================================
# DaitanJS Monorepo Release Script (v1.0 - Powered by Changesets)
# ==============================================================================
# This script automates the entire release process for the monorepo.
# It ensures all steps are performed in the correct order for a safe release.
#
# WORKFLOW:
# 1. Pre-flight Checks: Verifies the Git working directory is clean.
# 2. Build: Runs a full `turbo build` to ensure all packages are buildable.
# 3. Version: Bumps package versions and updates changelogs using changeset data.
# 4. Commit & Tag: Commits the version changes and lets Changesets create Git tags.
# 5. Publish: Publishes the newly versioned packages to NPM.
# 6. Push: Pushes the release commit and all tags to the remote repository.
#
# USAGE: npm run release
# ==============================================================================

set -e # Exit immediately on any error

# --- Helper Functions ---
print_header() {
  echo ""
  echo -e "\033[1;35m======================================================================\033[0m"
  echo -e "\033[1;35m$1\033[0m"
  echo -e "\033[1;35m======================================================================\033[0m"
  echo ""
}

# --- Main Execution Logic ---

print_header "STEP 1: PRE-FLIGHT CHECKS"

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
  echo "❌ Error: Your working directory is not clean. Please commit or stash your changes before running a release."
  exit 1
fi
echo "✅ Git working directory is clean."

# Check NPM login status
echo "Verifying NPM login..."
NPM_USER=$(npm whoami)
if [ -z "$NPM_USER" ]; then
  echo "❌ Error: Not logged into NPM. Please run 'npm login' first."
  exit 1
fi
echo "✅ Logged in to NPM as: $NPM_USER"

print_header "STEP 2: BUILDING ALL PACKAGES"
npm run build
echo "✅ All packages built successfully."

print_header "STEP 3: VERSIONING PACKAGES"
# This command consumes the markdown files in .changeset/,
# bumps versions in package.json files, and updates CHANGELOG.md files.
npx changeset version
echo "✅ Package versions bumped and changelogs updated."

print_header "STEP 4: PUBLISHING TO NPM"
# This command publishes the packages that were versioned in the previous step to npm.
# It also creates the git tags for each published package.
npx changeset publish
echo "✅ Published packages to NPM and created git tags."

print_header "STEP 5: SYNCING WITH GITHUB"
# Add all the changed files (package.json, CHANGELOG.md) to git
git add .

# We need to check if `changeset version` actually made changes before committing.
# If there were no changesets to apply, the working directory will still be clean.
if ! git diff-index --quiet HEAD --; then
  echo "-> Found version updates. Committing release..."
  # The commit message is standard for Changesets.
  git commit -m "chore(release): version packages"
  echo "-> Pushing release commit to main..."
  git push origin main
else
  echo "-> No package versions were changed. Nothing to commit."
fi

echo "-> Pushing all release tags to GitHub..."
git push --follow-tags

echo ""
echo "🎉 RELEASE COMPLETE! All changes have been published to NPM and pushed to GitHub."