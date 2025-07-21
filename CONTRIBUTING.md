      
// CONTRIBUTING.md
# Contributing to DaitanJS

First off, thank you for considering contributing to DaitanJS! It's people like you that make open source such a great community. We welcome any type of contribution, not only code. You can help with:

*   **Reporting a bug**
*   **Discussing the current state of the code**
*   **Submitting a fix**
*   **Proposing new features**
*   **Becoming a maintainer**

## Development Setup

To get started with the DaitanJS monorepo, you'll need to have [Node.js](https://nodejs.org/) (preferably a recent LTS version) and [npm](https://www.npmjs.com/) installed.

1.  **Fork & Clone:** Fork the repository on GitHub and then clone your fork locally.
    ```bash
    git clone https://github.com/your-username/daitanjs.git
    cd daitanjs
    ```

2.  **Install Dependencies:** Navigate to the root of the monorepo and run `npm install`. This will install all dependencies for all packages in the monorepo and set up the `lerna` or `npm` workspace symlinks.
    ```bash
    npm install
    ```

3.  **Build All Packages:** Many packages depend on others within the monorepo. It's essential to build all packages to ensure their `dist` directories are populated with the correct ESM and CJS modules. Run the build script from the root `package.json`.
    ```bash
    npm run build
    ```
    (Note: This assumes a root-level build script exists that orchestrates building all packages. If not, you may need to `cd` into each `packages/*` directory and run `npm run build`.)

4.  **Set Up Environment Variables:** Create a `.env` file in the root of the project. Copy the contents from `ENVIRONMENT_VARIABLES.md` and fill in the necessary API keys and configuration values for the packages you intend to work on.

## Coding Style

To maintain a consistent codebase, we use **ESLint** and **Prettier**.

*   **ESLint** helps us find and fix problems in our JavaScript code.
*   **Prettier** is an opinionated code formatter that enforces a consistent style.

Before committing your code, please run the linter and formatter to ensure your changes adhere to our style guidelines. Most code editors can be configured to do this automatically on save. The configurations can be found in `.eslintrc.json` and `.prettierrc.json` at the root of the repository.

```bash
# Run the linter (assuming a root script is configured)
npm run lint

# Format all files (assuming a root script is configured)
npm run format

    

IGNORE_WHEN_COPYING_START
Use code with caution. Markdown
IGNORE_WHEN_COPYING_END
Branching Strategy

We use a simple branching strategy based on GitHub Flow:

    Create a new branch from main for your feature, bugfix, or documentation update.

    Use a descriptive branch name, such as feat/add-new-utility or fix/resolve-import-bug.

    Commit your changes to this branch.

Submitting a Pull Request

When you're ready to contribute your changes:

    Push your feature branch to your fork on GitHub.

    Open a Pull Request (PR) from your branch to the main branch of the main DaitanJS repository.

    In your PR description, please provide a clear and concise summary of the changes you've made. If your PR addresses an existing GitHub Issue, be sure to link it (e.g., "Closes #123").

    Ensure all CI checks (tests, linting) are passing.

    A maintainer will review your PR, provide feedback if necessary, and merge it once it's ready.

Reporting Bugs or Suggesting Features

The best way to report a bug or suggest a new feature is to open an issue on our GitHub Issues page.

When reporting a bug, please include:

    A clear and descriptive title.

    The version of DaitanJS you are using.

    A description of the steps to reproduce the bug.

    The expected behavior and what actually happened.

    Any relevant error messages or stack traces.

Thank you again for your contribution!