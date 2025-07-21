// esbuild.config.js
import { globSync } from 'glob';
import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { builtinModules as nodeBuiltinModules } from 'module';

const rootDir = process.cwd();
const getEnv = (key, defaultValue = null) => process.env[key] || defaultValue;

const SCRIPT_VERSION = '4.1.0-final';

const emptyModuleDir = path.resolve(rootDir, '.esbuild-shims');
if (!fs.existsSync(emptyModuleDir))
  fs.mkdirSync(emptyModuleDir, { recursive: true });
const emptyModulePath = path.join(emptyModuleDir, 'empty-module.js');
if (!fs.existsSync(emptyModulePath))
  fs.writeFileSync(emptyModulePath, 'export {};', 'utf-8');

const logger = {
  start: (message) => console.log('\x1b[36m%s\x1b[0m', '[Build]', message),
  step: (message) => console.log('\x1b[35m%s\x1b[0m', '  ->', message),
  info: (message) => console.info('\x1b[36m%s\x1b[0m', '[Info]', message),
  success: (pkgName) =>
    console.log('\x1b[32m%s\x1b[0m', `  ✅ Built ${pkgName}`),
  skip: (pkgName, reason) =>
    console.log(
      '\x1b[90m%s\x1b[0m',
      `  ➖ Skipping ${pkgName}${reason ? ` (${reason})` : ''}`
    ),
  warn: (message) => console.warn('\x1b[33m%s\x1b[0m', '[WARN]', message),
  error: (pkgNameOrMessage, errorDetails) => {
    const pkgName =
      typeof errorDetails !== 'undefined'
        ? pkgNameOrMessage
        : path.basename(rootDir);
    const details =
      typeof errorDetails !== 'undefined' ? errorDetails : pkgNameOrMessage;
    console.error(
      '\x1b[31m%s\x1b[0m',
      `  ❌ Error ${
        typeof errorDetails !== 'undefined' ? `building ${pkgName}` : ''
      }:`
    );
    if (Array.isArray(details)) {
      details.forEach((detail) => {
        let message = detail.text;
        if (detail.location) {
          message += ` (at ${
            path.relative(rootDir, detail.location.file || '') || 'unknown file'
          }:${detail.location.line}:${detail.location.column})`;
        }
        console.error('\x1b[31m%s\x1b[0m', `    - ${message}`);
        if (detail.notes && detail.notes.length > 0)
          detail.notes.forEach((note) =>
            console.error('\x1b[31m%s\x1b[0m', `      Note: ${note.text}`)
          );
      });
    } else {
      console.error('\x1b[31m%s\x1b[0m', `    ${details.toString()}`);
      if (details.stack && getEnv('DEBUG_BUILD_SCRIPT') === 'true')
        console.error(details.stack);
    }
  },
  summarySuccess: (count, names) =>
    console.log(
      '\x1b[32m%s\x1b[0m',
      `\n📊 Build Summary: ✅ Success: ${count}${
        names && names.length > 0 ? ` (${names.join(', ')})` : ''
      }`
    ),
  summaryWarn: (count, skippedItems) => {
    if (count === 0) return;
    console.warn('\x1b[33m%s\x1b[0m', `\n⚠️ Skipped: ${count}`);
    console.warn('\x1b[33m%s\x1b[0m', 'Skipped Workspaces Details:');
    skippedItems.forEach(({ workspacePath, reason, packageName }) =>
      console.warn(
        '\x1b[33m%s\x1b[0m',
        `  - ${
          packageName || path.relative(rootDir, workspacePath)
        } (${reason})`
      )
    );
  },
  summaryError: (count, failedItems) => {
    if (count === 0) return;
    console.error('\x1b[31m%s\x1b[0m', `\n❌ Failed: ${count}`);
    console.error('\x1b[31m%s\x1b[0m', 'Failed Workspaces Details:');
    failedItems.forEach(({ packageName, error }) =>
      console.error('\x1b[31m%s\x1b[0m', `  - ${packageName}: ${error}`)
    );
  },
  final: (message) => console.log('\x1b[36m%s\x1b[0m', '\n🏁', message),
  debug: (...args) => {
    if (getEnv('DEBUG_BUILD_SCRIPT') === 'true')
      console.debug('\x1b[34m%s\x1b[0m', '[DEBUG]', ...args);
  },
};

const detectWorkspaces = () => {
  const packageJsonPath = path.join(rootDir, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    logger.error('Root package.json not found.');
    throw new Error('❌ No root package.json found');
  }
  const packageJsonData = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  const workspacePatterns = packageJsonData.workspaces || [];
  if (workspacePatterns.length === 0) {
    logger.warn('No "workspaces" array. Building current dir if package.');
    if (
      fs.existsSync(path.join(rootDir, 'package.json')) &&
      fs.existsSync(path.join(rootDir, 'src', 'index.js'))
    )
      return [rootDir];
    logger.info('Root is not a buildable package, or no workspaces defined.');
    return [];
  }

  logger.debug(`Found "workspaces" patterns:`, workspacePatterns);
  const resolvedWorkspaces = workspacePatterns.flatMap((pattern) =>
    globSync(path.join(rootDir, pattern).replace(/\\/g, '/'), {
      absolute: true,
      cwd: rootDir,
      onlyDirectories: true,
    }).filter((dir) => fs.existsSync(path.join(dir, 'package.json')))
  );

  if (resolvedWorkspaces.length === 0)
    logger.warn(
      'Workspace patterns defined, but no actual package directories found.'
    );
  else
    logger.debug(
      `Filtered to actual packages:`,
      resolvedWorkspaces.map((p) => path.relative(rootDir, p))
    );
  return resolvedWorkspaces;
};

const getPackageInfo = (workspacePath) => {
  const packageJsonPath = path.join(workspacePath, 'package.json');
  if (!fs.existsSync(packageJsonPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  } catch (e) {
    logger.warn(
      `Could not parse package.json in ${path.relative(
        rootDir,
        workspacePath
      )}: ${e.message}`
    );
    return null;
  }
};

const resolveBuildOrder = (workspaces) => {
  const workspacePaths = workspaces.map((ws) => path.resolve(ws));
  const packageMap = new Map();
  const adj = new Map();
  const inDegree = new Map();
  workspacePaths.forEach((ws) => {
    const pkg = getPackageInfo(ws);
    if (pkg?.name) packageMap.set(pkg.name, ws);
    adj.set(ws, []);
    inDegree.set(ws, 0);
  });
  workspacePaths.forEach((ws) => {
    const pkg = getPackageInfo(ws);
    if (!pkg) return;
    const dependencies = [
      ...Object.keys(pkg.dependencies || {}),
      ...Object.keys(pkg.peerDependencies || {}),
    ];
    dependencies.forEach((depName) => {
      const depWsPath = packageMap.get(depName);
      if (depWsPath && workspacePaths.includes(depWsPath)) {
        adj.get(depWsPath).push(ws);
        inDegree.set(ws, (inDegree.get(ws) || 0) + 1);
      }
    });
  });
  const queue = workspacePaths.filter((ws) => (inDegree.get(ws) || 0) === 0);
  const buildOrder = [];
  while (queue.length > 0) {
    const u = queue.shift();
    buildOrder.push(u);
    (adj.get(u) || []).forEach((v) => {
      inDegree.set(v, (inDegree.get(v) || 0) - 1);
      if ((inDegree.get(v) || 0) === 0) queue.push(v);
    });
  }
  if (buildOrder.length !== workspacePaths.length) {
    const notBuilt = workspacePaths.filter((ws) => !buildOrder.includes(ws));
    const errorMessage = 'Circular dependency detected. Cannot build.';
    logger.error(errorMessage);
    logger.error(
      'Not included:',
      notBuilt.map((p) => getPackageInfo(p)?.name || path.relative(rootDir, p))
    );
    throw new Error(errorMessage);
  }
  return buildOrder;
};

const buildWorkspace = async (workspacePath, results, isWatchMode = false) => {
  const packageJson = getPackageInfo(workspacePath);
  if (!packageJson) {
    results.skipped.push({
      workspacePath,
      packageName: path.basename(workspacePath),
      reason: 'No/Malformed package.json',
    });
    logger.skip(path.basename(workspacePath), 'No/Malformed package.json');
    return;
  }
  const packageName = packageJson.name || path.relative(rootDir, workspacePath);

  const mainSrcEntryPoint = path.join(workspacePath, 'src', 'index.js');
  const browserSrcEntryPoint = path.join(
    workspacePath,
    'src',
    'index.browser.js'
  );
  const distDir = path.join(workspacePath, 'dist');

  if (!fs.existsSync(mainSrcEntryPoint)) {
    results.skipped.push({
      workspacePath,
      packageName,
      reason: 'No src/index.js',
    });
    logger.skip(packageName, 'No src/index.js');
    return;
  }
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  const dependencies = Object.keys(packageJson.dependencies || {});
  const peerDependencies = Object.keys(packageJson.peerDependencies || {});
  const commonExternalDependencies = [
    ...dependencies,
    ...peerDependencies,
    'dotenv',
  ];
  const knownWorkspacePackages = (detectWorkspaces() || [])
    .map((ws) => getPackageInfo(ws)?.name)
    .filter(Boolean);

  const alwaysExternalForNode = [
    // Heavy Node-specific libs
    'typescript',
    'esbuild',
    'playwright-core',
    'puppeteer',
    '@puppeteer/browsers',
    'mongodb',
    'mongoose',
    'bson',
    'sharp',
    'onnxruntime-node',
    'firebase-admin',
    '@google-cloud/firestore',
    'node-forge',
    'jwks-rsa',
    '@fastify/busboy',
    'officegen',
    'readable-stream',
    'readable-stream/transform',
    'readable-stream/passthrough',
    'cosmiconfig',

    // Libs with problematic internal requires
    'uuid',
    'punycode',
    'openai',
    'tiktoken',
    'mock-aws-s3',
    'aws-sdk',
    'nock',
    '@mapbox/node-pre-gyp',
    'nodemailer', // <<< THE FINAL, DEFINITIVE FIX IS HERE

    // Externalize the entire LangChain ecosystem as a best practice
    'langchain',
    'langsmith',
    '@langchain/core',
    '@langchain/community',
    '@langchain/openai',
    '@langchain/anthropic',
    '@langchain/langgraph',
    '@langchain/redis',
  ];

  const nodeExternalPackages = [
    ...new Set([
      ...commonExternalDependencies,
      ...knownWorkspacePackages.filter((pkg) => pkg !== packageName),
      ...alwaysExternalForNode,
      ...nodeBuiltinModules,
      ...nodeBuiltinModules.map((m) => `node:${m}`),
    ]),
  ];

  const buildConfigs = [];

  buildConfigs.push({
    entryPoints: [mainSrcEntryPoint],
    format: 'cjs',
    outfile: path.join(distDir, path.basename(packageJson.main || 'index.cjs')),
    platform: 'node',
    target: 'node18',
    external: nodeExternalPackages,
    define: {
      'process.env.NODE_ENV': `"${process.env.NODE_ENV || 'development'}"`,
    },
    alias: {},
    mainFields: ['main', 'module'],
    conditions: ['node', 'require', 'default'],
    buildTypeSuffix: 'Node CJS',
  });

  buildConfigs.push({
    entryPoints: [mainSrcEntryPoint],
    format: 'esm',
    outfile: path.join(
      distDir,
      path.basename(packageJson.module || 'index.js')
    ),
    platform: 'node',
    target: 'node18',
    external: nodeExternalPackages,
    alias: {},
    mainFields: ['module', 'main'],
    conditions: ['node', 'import', 'default'],
    buildTypeSuffix: 'Node ESM',
  });

  const browserDistPathSpec =
    packageJson.browser || packageJson.exports?.['.']?.browser;
  if (browserDistPathSpec) {
    const browserEntryFile = fs.existsSync(browserSrcEntryPoint)
      ? browserSrcEntryPoint
      : mainSrcEntryPoint;
    if (fs.existsSync(browserEntryFile)) {
      const browserAliasMap = {};
      const allNodeModulesToAliasToEmpty = [
        ...nodeBuiltinModules,
        ...nodeBuiltinModules.map((m) => `node:${m}`),
        ...alwaysExternalForNode,
        'child_process',
        'fs',
        'path',
        'crypto',
        'stream',
        'zlib',
        'http',
        'https',
        'net',
        'tls',
        'os',
        'util',
        'assert',
        'events',
        'tty',
        'dgram',
        'dns',
        'readline',
        'repl',
        'vm',
        'worker_threads',
      ];
      allNodeModulesToAliasToEmpty.forEach((mod) => {
        browserAliasMap[mod] = emptyModulePath;
      });
      [
        'node:_http_agent',
        'node:_http_client',
        'node:_tls_wrap',
        'node:assert/strict',
        'chromium-bidi/lib/cjs/bidiMapper/BidiMapper',
        'chromium-bidi/lib/cjs/cdp/CdpConnection',
        '@google-cloud/firestore/build/src/path',
      ].forEach((mod) => (browserAliasMap[mod] = emptyModulePath));

      buildConfigs.push({
        entryPoints: [browserEntryFile],
        format: 'esm',
        outfile: path.join(distDir, path.basename(browserDistPathSpec)),
        platform: 'browser',
        target: 'es2020',
        external: peerDependencies,
        alias: browserAliasMap,
        mainFields: ['browser', 'module', 'main'],
        conditions: ['browser', 'import', 'default'],
        buildTypeSuffix: 'Browser ESM',
      });
    } else {
      logger.skip(
        packageName,
        `Browser output declared, but entry ${path.relative(
          rootDir,
          browserEntryFile
        )} not found`
      );
    }
  }

  const validBuildConfigs = buildConfigs.filter((cfg) =>
    fs.existsSync(cfg.entryPoints[0])
  );
  if (validBuildConfigs.length === 0) {
    results.skipped.push({
      workspacePath,
      packageName,
      reason: 'No valid entry points for any build format.',
    });
    logger.skip(packageName, 'No valid entry points found.');
    return;
  }

  let workspaceHasError = false;
  const buildRunPromises = [];
  const watchContexts = [];

  for (const config of validBuildConfigs) {
    let currentExternalPackages = [...(config.external || [])];
    if (
      packageName === '@daitanjs/intelligence' &&
      config.platform === 'node' &&
      config.format === 'esm'
    ) {
      const intelligenceSpecificExternals = [
        'form-data',
        'combined-stream',
        'proxy-from-env',
        'follow-redirects',
        'debug',
        'iconv-lite',
        'safer-buffer',
        'whatwg-encoding',
        'undici',
        'kind-of',
        'merge-deep',
        'puppeteer-extra',
        'puppeteer-extra-plugin',
        'puppeteer-extra-plugin-stealth',
      ];
      currentExternalPackages.push(...intelligenceSpecificExternals);
      currentExternalPackages = [...new Set(currentExternalPackages)];
    }

    const esbuildOptions = {
      entryPoints: config.entryPoints,
      bundle: true,
      sourcemap: true,
      minify: false,
      format: config.format,
      platform: config.platform,
      target: config.target,
      outfile: config.outfile,
      external: currentExternalPackages,
      alias: config.alias,
      mainFields: config.mainFields,
      conditions: config.conditions,
      logLevel: 'silent',
      allowOverwrite: true,
      banner: {
        js: `// DaitanJS Build | Package: ${packageName} | Type: ${
          config.buildTypeSuffix
        } | Build Time: ${new Date().toISOString()} | Script Version: ${SCRIPT_VERSION}`,
      },
      plugins: [
        {
          name: 'node-native-module-externalizer',
          setup(build) {
            if (config.platform === 'node')
              build.onResolve({ filter: /\.node$/ }, (args) => ({
                path: args.path,
                external: true,
              }));
          },
        },
      ],
    };

    if (isWatchMode) {
      try {
        const ctx = await esbuild.context(esbuildOptions);
        watchContexts.push({ ctx, config });
      } catch (error) {
        if (!workspaceHasError) {
          results.failed.push({
            workspacePath,
            packageName,
            error: `Context creation failed for ${
              config.buildTypeSuffix
            }: ${error.toString()}`,
          });
          workspaceHasError = true;
        }
        logger.error(
          `${packageName} (${config.buildTypeSuffix}) context creation`,
          error.errors || error.toString()
        );
      }
    } else {
      buildRunPromises.push(
        esbuild
          .build(esbuildOptions)
          .then(() => {
            logger.debug(
              `Successfully built: ${packageName} (${
                config.buildTypeSuffix
              }) -> ${path.relative(rootDir, config.outfile)}`
            );
          })
          .catch((error) => {
            if (!workspaceHasError) {
              results.failed.push({
                workspacePath,
                packageName,
                error: `Build failed for ${
                  config.buildTypeSuffix
                }: ${error.toString()}`,
              });
              workspaceHasError = true;
            }
            logger.error(
              `${packageName} (${config.buildTypeSuffix})`,
              error.errors || error.toString()
            );
            throw error;
          })
      );
    }
  }

  if (isWatchMode) {
    if (!workspaceHasError && watchContexts.length > 0) {
      watchContexts.forEach(async ({ ctx, config }) => {
        try {
          await ctx.watch();
          logger.debug(
            `👀 Watching ${packageName} (${config.buildTypeSuffix})`
          );
        } catch (watchError) {
          if (!workspaceHasError) {
            results.failed.push({
              workspacePath,
              packageName,
              error: watchError.toString(),
            });
            workspaceHasError = true;
          }
          logger.error(
            `${packageName} (${config.buildTypeSuffix}) watch setup failed`,
            watchError.errors || watchError.toString()
          );
        }
      });
      if (!workspaceHasError && !results.success.includes(packageName))
        results.success.push(packageName);
    } else if (watchContexts.length === 0 && !workspaceHasError) {
      logger.skip(packageName, 'No valid build configurations for watching.');
      if (!results.skipped.find((s) => s.packageName === packageName))
        results.skipped.push({
          workspacePath,
          packageName,
          reason: 'No valid build configurations for watching.',
        });
    }
  } else {
    try {
      await Promise.all(buildRunPromises);
      if (!workspaceHasError && !results.success.includes(packageName)) {
        results.success.push(packageName);
        logger.success(packageName);
      }
    } catch (error) {
      /* Errors already logged */
    }
  }
};

const main = async () => {
  const isWatch = process.argv.includes('--watch');
  const watchInitialDelay = isWatch ? 1500 : 0;

  if (isWatch)
    logger.start(
      `Build process starting in WATCH mode (initial build after ${
        watchInitialDelay / 1000
      }s)...`
    );
  else
    logger.start(
      `Build process starting... (Script Version: ${SCRIPT_VERSION})`
    );
  if (watchInitialDelay > 0)
    await new Promise((resolve) => setTimeout(resolve, watchInitialDelay));

  try {
    logger.step('Detecting workspaces...');
    const workspaces = detectWorkspaces();
    if (workspaces.length === 0) {
      logger.info('No workspaces. Exiting.');
      return;
    }
    logger.info(`Found ${workspaces.length} workspaces.`);

    logger.step('Resolving build order...');
    const buildOrder = resolveBuildOrder(workspaces);
    const packageNamesInOrder = buildOrder.map(
      (ws) => getPackageInfo(ws)?.name || path.basename(ws)
    );
    logger.info(`Order: ${packageNamesInOrder.join(' ➔ ')}`);

    const results = { success: [], failed: [], skipped: [] };
    for (const workspace of buildOrder) {
      await buildWorkspace(workspace, results, isWatch);
      if (results.failed.length > 0) {
        logger.error('Build process stopped due to an error.');
        break;
      }
    }

    if (!isWatch) {
      logger.summarySuccess(results.success.length, results.success);
      logger.summaryWarn(results.skipped.length, results.skipped);
      logger.summaryError(results.failed.length, results.failed);
      logger.final('Build process completed.');
      process.exitCode = results.failed.length > 0 ? 1 : 0;
    } else {
      logger.final(
        'Initial build complete. Watch mode active. Press Ctrl+C to stop.'
      );
    }
  } catch (error) {
    logger.error('Fatal Error in build script:', error.message);
    logger.debug(error.stack);
    process.exitCode = 1;
  }
};

main();
