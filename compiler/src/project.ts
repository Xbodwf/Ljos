/**
 * Ljos Project Compiler
 * 
 * Handles project-based compilation similar to tsc with tsconfig.json
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync, spawn } from 'node:child_process';
import { Compiler, CompileResult, CompilerError } from './compiler';
import { LjosConfig, CompilerOptions, BuildOptions, loadConfig, getProjectRoot, findConfigFile } from './config';

// ============ Glob Pattern Matching ============

/**
 * Simple glob pattern matching
 * Supports: *, **, ?, [abc], [!abc]
 */
function matchGlob(pattern: string, filePath: string): boolean {
  // Normalize paths
  const normalizedPath = filePath.replace(/\\/g, '/');
  const normalizedPattern = pattern.replace(/\\/g, '/');
  
  // Convert glob to regex
  let regexStr = '^';
  let i = 0;
  
  while (i < normalizedPattern.length) {
    const char = normalizedPattern[i];
    
    if (char === '*') {
      if (normalizedPattern[i + 1] === '*') {
        // ** matches any path segment
        if (normalizedPattern[i + 2] === '/') {
          regexStr += '(?:[^/]*/)*';
          i += 3;
        } else {
          regexStr += '.*';
          i += 2;
        }
      } else {
        // * matches any character except /
        regexStr += '[^/]*';
        i++;
      }
    } else if (char === '?') {
      regexStr += '[^/]';
      i++;
    } else if (char === '[') {
      // Character class
      let j = i + 1;
      let classStr = '[';
      if (normalizedPattern[j] === '!') {
        classStr += '^';
        j++;
      }
      while (j < normalizedPattern.length && normalizedPattern[j] !== ']') {
        classStr += normalizedPattern[j];
        j++;
      }
      classStr += ']';
      regexStr += classStr;
      i = j + 1;
    } else if (char === '.') {
      regexStr += '\\.';
      i++;
    } else {
      regexStr += char;
      i++;
    }
  }
  
  regexStr += '$';
  
  try {
    const regex = new RegExp(regexStr);
    return regex.test(normalizedPath);
  } catch {
    return false;
  }
}

/**
 * Check if a file matches any of the patterns
 */
function matchesPatterns(filePath: string, patterns: string[]): boolean {
  return patterns.some(pattern => matchGlob(pattern, filePath));
}

// ============ File Discovery ============

/**
 * Recursively find all .lj files in a directory
 */
function findLjFiles(dir: string, baseDir: string = dir): string[] {
  const files: string[] = [];
  
  if (!fs.existsSync(dir)) {
    return files;
  }
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      // Skip common directories
      if (entry.name === 'node_modules' || entry.name === '.git') {
        continue;
      }
      files.push(...findLjFiles(fullPath, baseDir));
    } else if (entry.isFile() && entry.name.endsWith('.lj')) {
      // Store relative path from base
      files.push(path.relative(baseDir, fullPath));
    }
  }
  
  return files;
}

/**
 * Get files to compile based on include/exclude patterns
 */
function getFilesToCompile(
  projectRoot: string,
  include: string[],
  exclude: string[]
): string[] {
  // Find all .lj files
  const allFiles = findLjFiles(projectRoot);
  
  // Filter by include patterns
  let includedFiles = allFiles.filter(file => matchesPatterns(file, include));
  
  // Filter out excluded files
  includedFiles = includedFiles.filter(file => !matchesPatterns(file, exclude));
  
  return includedFiles;
}

// ============ Project Compilation Result ============

export interface ProjectCompileResult {
  success: boolean;
  filesCompiled: number;
  filesFailed: number;
  errors: Array<{
    file: string;
    errors: CompilerError[];
  }>;
  outputFiles: string[];
  duration: number;
}

// ============ Project Compiler ============

export class ProjectCompiler {
  private config: LjosConfig;
  private projectRoot: string;
  private compiler: Compiler;

  constructor(configPath?: string) {
    this.config = loadConfig(configPath);
    this.projectRoot = getProjectRoot(configPath);
    this.compiler = new Compiler(this.config.compilerOptions);
  }

  /**
   * Get the project configuration
   */
  getConfig(): LjosConfig {
    return this.config;
  }

  /**
   * Get the project root directory
   */
  getProjectRoot(): string {
    return this.projectRoot;
  }

  /**
   * Compile the entire project
   */
  compile(): ProjectCompileResult {
    const startTime = Date.now();
    const result: ProjectCompileResult = {
      success: true,
      filesCompiled: 0,
      filesFailed: 0,
      errors: [],
      outputFiles: [],
      duration: 0,
    };

    // Get files to compile
    const include = this.config.include || ['**/*.lj'];
    const exclude = this.config.exclude || ['node_modules', 'dist'];
    const files = getFilesToCompile(this.projectRoot, include, exclude);

    if (files.length === 0) {
      console.log('No files to compile');
      result.duration = Date.now() - startTime;
      return result;
    }

    console.log(`Compiling ${files.length} file(s)...`);

    // Compile each file
    for (const file of files) {
      const inputPath = path.join(this.projectRoot, file);
      const outputPath = this.getOutputPath(file);
      
      const compileResult = this.compiler.compileToFile(inputPath, outputPath);
      
      if (compileResult.success) {
        result.filesCompiled++;
        result.outputFiles.push(outputPath);
        console.log(`  ✓ ${file}`);
      } else {
        result.filesFailed++;
        result.success = false;
        result.errors.push({
          file: inputPath,
          errors: compileResult.errors,
        });
        console.log(`  ✗ ${file}`);
        for (const error of compileResult.errors) {
          console.log(`    ${error.message}`);
        }
      }
    }

    // Copy runtime/std to output directory
    // Always copy since code may explicitly import from std
    this.copyRuntimeStd();

    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * Copy runtime/std directory to output directory
   */
  private copyRuntimeStd(): void {
    const outDir = this.config.compilerOptions?.outDir || './dist';
    const rootDir = this.config.compilerOptions?.rootDir || './src';
    
    // Runtime std is relative to the compiler installation
    const compilerDir = path.dirname(__dirname);
    const runtimeStdSrc = path.join(compilerDir, 'runtime', 'std');
    
    // Destination is outDir/rootDir/runtime/std (to match import paths)
    const runtimeStdDest = path.join(this.projectRoot, outDir, rootDir, 'runtime', 'std');
    
    if (!fs.existsSync(runtimeStdSrc)) {
      // Try alternative location (when running from src with ts-node)
      const altSrc = path.join(compilerDir, '..', 'runtime', 'std');
      if (fs.existsSync(altSrc)) {
        this.copyDirRecursive(altSrc, runtimeStdDest);
      }
      return;
    }
    
    this.copyDirRecursive(runtimeStdSrc, runtimeStdDest);
  }

  /**
   * Recursively copy a directory
   */
  private copyDirRecursive(src: string, dest: string): void {
    if (!fs.existsSync(src)) {
      return;
    }
    
    fs.mkdirSync(dest, { recursive: true });
    
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      
      if (entry.isDirectory()) {
        this.copyDirRecursive(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  /**
   * Compile a single file within the project context
   */
  compileFile(filePath: string): CompileResult {
    const absolutePath = path.resolve(this.projectRoot, filePath);
    const outputPath = this.getOutputPath(filePath);
    return this.compiler.compileToFile(absolutePath, outputPath);
  }

  /**
   * Watch project for changes and recompile
   */
  watch(callback?: (result: ProjectCompileResult) => void): void {
    console.log('Watching for changes...\n');
    
    // Initial compile
    const initialResult = this.compile();
    callback?.(initialResult);
    
    // Get files to watch
    const include = this.config.include || ['**/*.lj'];
    const exclude = this.config.exclude || ['node_modules', 'dist'];
    const files = getFilesToCompile(this.projectRoot, include, exclude);
    
    // Watch each file
    const watchers: fs.FSWatcher[] = [];
    
    for (const file of files) {
      const fullPath = path.join(this.projectRoot, file);
      try {
        const watcher = fs.watch(fullPath, (eventType) => {
          if (eventType === 'change') {
            console.log(`\nFile changed: ${file}`);
            const result = this.compileFile(file);
            if (result.success) {
              console.log(`  ✓ Compiled ${file}`);
            } else {
              console.log(`  ✗ Failed to compile ${file}`);
              for (const error of result.errors) {
                console.log(`    ${error.message}`);
              }
            }
          }
        });
        watchers.push(watcher);
      } catch (e) {
        console.warn(`Warning: Could not watch ${file}`);
      }
    }
    
    // Also watch for new files in the project
    const rootWatcher = fs.watch(this.projectRoot, { recursive: true }, (eventType, filename) => {
      if (filename && filename.endsWith('.lj')) {
        const relativePath = filename.replace(/\\/g, '/');
        if (matchesPatterns(relativePath, include) && !matchesPatterns(relativePath, exclude)) {
          console.log(`\nNew/changed file detected: ${filename}`);
          const result = this.compile();
          callback?.(result);
        }
      }
    });
    watchers.push(rootWatcher);
    
    // Handle cleanup
    process.on('SIGINT', () => {
      console.log('\nStopping watch mode...');
      for (const watcher of watchers) {
        watcher.close();
      }
      process.exit(0);
    });
  }

  /**
   * Build the project (compile + optional packaging)
   */
  build(): ProjectCompileResult {
    // First compile
    const compileResult = this.compile();
    
    if (!compileResult.success) {
      return compileResult;
    }
    
    // Check build target
    const buildOptions = this.config.buildOptions;
    if (buildOptions?.target === 'pkg') {
      console.log('\nPackaging with pkg...');
      this.packageWithPkg(buildOptions);
    } else if (buildOptions?.target === 'bundle') {
      console.log('\nBundling...');
      this.bundle(buildOptions);
    }
    
    return compileResult;
  }

  /**
   * Package the compiled JS as executable using pkg
   */
  private packageWithPkg(buildOptions: BuildOptions): void {
    const outDir = this.config.compilerOptions?.outDir || './dist';
    const entry = buildOptions.entry || path.join(outDir, 'main.js');
    const execName = buildOptions.executableName || 'app';
    const targets = buildOptions.pkgTargets || ['host'];
    
    const entryPath = path.join(this.projectRoot, entry);
    const bundlePath = path.join(this.projectRoot, outDir, '_bundle.cjs');
    
    // First, bundle with esbuild to create a single CJS file (pkg requires CJS)
    try {
      console.log('  Bundling with esbuild...');
      execSync(`npx esbuild "${entryPath}" --bundle --platform=node --format=cjs --outfile="${bundlePath}"`, {
        cwd: this.projectRoot,
        stdio: 'pipe',
      });
      console.log('  ✓ Bundled to _bundle.cjs');
    } catch (error) {
      console.error('  ✗ Failed to bundle with esbuild');
      throw error;
    }
    
    // Build pkg command using the bundled file
    const pkgArgs = [
      bundlePath,
      '--output', path.join(this.projectRoot, outDir, execName),
      '--targets', targets.join(','),
    ];
    
    // Add compression if specified
    if (buildOptions.pkgOptions?.compress) {
      pkgArgs.push('--compress', buildOptions.pkgOptions.compress);
    }
    
    // Add assets if specified
    if (buildOptions.pkgOptions?.assets) {
      for (const asset of buildOptions.pkgOptions.assets) {
        pkgArgs.push('--assets', asset);
      }
    }
    
    try {
      console.log(`  Running: npx pkg ${pkgArgs.join(' ')}`);
      execSync(`npx pkg ${pkgArgs.join(' ')}`, {
        cwd: this.projectRoot,
        stdio: 'inherit',
      });
      console.log(`  ✓ Packaged to ${path.join(outDir, execName)}`);
      
      // Clean up bundle file
      fs.unlinkSync(bundlePath);
    } catch (error) {
      console.error('  ✗ Failed to package with pkg');
      console.error('    Make sure pkg is installed: npm install -g pkg');
      throw error;
    }
  }

  /**
   * Bundle all JS files into a single file
   */
  private bundle(buildOptions: BuildOptions): void {
    const outDir = this.config.compilerOptions?.outDir || './dist';
    const entry = buildOptions.entry || path.join(outDir, 'main.js');
    const bundleName = buildOptions.executableName || 'bundle.js';
    
    try {
      // Use esbuild for bundling
      execSync('npx esbuild --version', { stdio: 'ignore' });
      
      const esbuildArgs = [
        path.join(this.projectRoot, entry),
        '--bundle',
        '--platform=node',
        '--format=esm',
        `--outfile=${path.join(this.projectRoot, outDir, bundleName)}`,
      ];
      
      console.log(`  Running: npx esbuild ${esbuildArgs.join(' ')}`);
      execSync(`npx esbuild ${esbuildArgs.join(' ')}`, {
        cwd: this.projectRoot,
        stdio: 'inherit',
      });
      console.log(`  ✓ Bundled to ${path.join(outDir, bundleName)}`);
    } catch (error) {
      console.error('  ✗ Failed to bundle');
      console.error('    Make sure esbuild is installed: npm install -D esbuild');
      throw error;
    }
  }

  /**
   * Get the output path for a source file
   */
  private getOutputPath(relativePath: string): string {
    const outDir = this.config.compilerOptions?.outDir || './dist';
    const rootDir = this.config.compilerOptions?.rootDir || '.';
    
    // Remove rootDir prefix if present
    let outputRelative = relativePath;
    if (relativePath.startsWith(rootDir)) {
      outputRelative = relativePath.slice(rootDir.length);
      if (outputRelative.startsWith('/') || outputRelative.startsWith('\\')) {
        outputRelative = outputRelative.slice(1);
      }
    }
    
    // Change extension to .js
    const parsed = path.parse(outputRelative);
    const jsFile = path.join(parsed.dir, `${parsed.name}.js`);
    
    return path.join(this.projectRoot, outDir, jsFile);
  }
}

// ============ CLI Integration ============

/**
 * Initialize a new Ljos project with default config
 */
export function initProject(projectDir: string = process.cwd(), format: 'json' | 'lj' = 'json'): void {
  const configFileName = format === 'lj' ? 'ljconfig.lj' : 'ljconfig.json';
  const configPath = path.join(projectDir, configFileName);
  
  if (fs.existsSync(configPath)) {
    throw new Error(`Config file already exists: ${configPath}`);
  }
  
  if (format === 'json') {
    const config: LjosConfig = {
      compilerOptions: {
        outDir: './dist',
        rootDir: './src',
        target: 'es2022',
        module: 'esm',
        sourceMap: true,
        prelude: 'none',
      },
      include: ['src/**/*.lj'],
      exclude: ['node_modules', 'dist'],
    };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
  } else {
    const ljConfig = `# Ljos Project Configuration
# See: https://ljos.dev/docs/config

import { defineConfig } : "/std/config"

export default defineConfig({
  compilerOptions: {
    outDir: "./dist",
    rootDir: "./src",
    target: "es2022",
    module: "esm",
    sourceMap: true,
    prelude: "none"
  },
  include: ["src/**/*.lj"],
  exclude: ["node_modules", "dist"]
})
`;
    fs.writeFileSync(configPath, ljConfig, 'utf-8');
  }
  
  // Create src directory if it doesn't exist
  const srcDir = path.join(projectDir, 'src');
  if (!fs.existsSync(srcDir)) {
    fs.mkdirSync(srcDir, { recursive: true });
  }
  
  // Create a sample main.lj file
  const mainFile = path.join(srcDir, 'main.lj');
  if (!fs.existsSync(mainFile)) {
    const mainContent = `# Ljos Project Entry Point

import { println } : "/std/io"

fn main() {
  println("Hello, Ljos!")
}

main()
`;
    fs.writeFileSync(mainFile, mainContent, 'utf-8');
  }
  
  console.log(`Initialized Ljos project with ${configFileName}`);
  console.log(`  Created: ${configPath}`);
  console.log(`  Created: ${mainFile}`);
}

/**
 * Check if we're in a Ljos project (has config file)
 */
export function isLjosProject(dir: string = process.cwd()): boolean {
  return findConfigFile(dir) !== null;
}
