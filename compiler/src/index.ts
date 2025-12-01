// Ljos Compiler - Main Entry Point

export { Lexer, LexerError } from './lexer';
export { Parser, ParserError } from './parser';
export { CodeGenerator } from './codegen';
export { Compiler } from './compiler';
export type { CompileResult, CompilerError, CompilerWarning } from './compiler';
export * as AST from './ast';
export { Token, TokenType, KEYWORDS } from './tokens';

// Configuration
export { loadConfig, defineConfig, findConfigFile, getProjectRoot, DEFAULT_CONFIG } from './config';
export type { LjosConfig, CompilerOptions } from './config';

// Project compilation
export { ProjectCompiler, initProject, isLjosProject } from './project';
export type { ProjectCompileResult } from './project';
