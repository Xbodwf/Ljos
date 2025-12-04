import * as vscode from 'vscode';
import { SyntaxChecker } from './ljos/checker';
import { KEYWORDS } from './ljos/tokens';
import { initI18n, getMessages, Messages } from './i18n';

// Initialize i18n on module load
let i18nMessages: Messages;

// Get keyword completions with i18n support
function getKeywordCompletions(): { label: string; detail: string; documentation: string; insertText?: string }[] {
  const msgs = i18nMessages.keywords;
  return [
    // Declaration keywords
    { label: 'const', ...msgs.const, insertText: 'const ' },
    { label: 'mut', ...msgs.mut, insertText: 'mut ' },
    { label: 'fn', ...msgs.fn, insertText: 'fn ${1:name}(${2:params}): ${3:ReturnType} {\n\t$0\n}' },
    { label: 'class', ...msgs.class, insertText: 'class ${1:Name} {\n\t$0\n}' },
    { label: 'abstract', ...msgs.abstract, insertText: 'abstract class ${1:Name} {\n\t$0\n}' },
    { label: 'enum', ...msgs.enum, insertText: 'enum ${1:Name} {\n\t$0\n}' },
    { label: 'type', ...msgs.type, insertText: 'type ${1:Name} = $0' },
    { label: 'interface', ...msgs.interface, insertText: 'interface ${1:Name} {\n\t$0\n}' },
    // Control flow
    { label: 'if', ...msgs.if, insertText: 'if (${1:condition}) {\n\t$0\n}' },
    { label: 'else', ...msgs.else },
    { label: 'for', ...msgs.for, insertText: 'for (${1:item} in ${2:iterable}) {\n\t$0\n}' },
    { label: 'while', ...msgs.while, insertText: 'while (${1:condition}) {\n\t$0\n}' },
    { label: 'do', ...msgs.do, insertText: 'do {\n\t$0\n} while (${1:condition})' },
    { label: 'when', ...msgs.when, insertText: 'when (${1:value}) {\n\t${2:pattern} => {\n\t\t$0\n\t}\n}' },
    { label: 'break', ...msgs.break },
    { label: 'continue', ...msgs.continue },
    { label: 'return', ...msgs.return, insertText: 'return $0' },
    // Exception handling
    { label: 'try', ...msgs.try, insertText: 'try {\n\t$0\n} catch (${1:e}) {\n\t\n}' },
    { label: 'catch', ...msgs.catch },
    { label: 'finally', ...msgs.finally },
    { label: 'throw', ...msgs.throw, insertText: 'throw $0' },
    // Class related
    { label: 'extends', ...msgs.extends },
    { label: 'implements', ...msgs.implements },
    { label: 'static', ...msgs.static },
    { label: 'constructor', ...msgs.constructor, insertText: 'constructor(${1:params}) {\n\t$0\n}' },
    { label: 'this', ...msgs.this },
    { label: 'super', ...msgs.super },
    { label: 'new', ...msgs.new, insertText: 'new ${1:ClassName}($0)' },
    // Access modifiers
    { label: 'public', ...msgs.public },
    { label: 'private', ...msgs.private },
    { label: 'protected', ...msgs.protected },
    { label: 'readonly', ...msgs.readonly },
    // Modules
    { label: 'import', ...msgs.import, insertText: 'import { $1 }: "${2:module}"' },
    { label: 'export', ...msgs.export, insertText: 'export ' },
    { label: 'default', ...msgs.default },
    { label: 'as', ...msgs.as },
    // Type operations
    { label: 'typeof', ...msgs.typeof },
    { label: 'instanceof', ...msgs.instanceof },
    { label: 'is', ...msgs.is },
    { label: 'of', ...msgs.of },
    // Async
    { label: 'async', ...msgs.async },
    { label: 'await', ...msgs.await },
    { label: 'go', ...msgs.go },
    { label: 'chan', ...msgs.chan },
    { label: 'yield', ...msgs.yield },
    // Resource management
    { label: 'defer', ...msgs.defer },
    { label: 'using', ...msgs.using },
    // Memory management
    { label: 'move', ...msgs.move },
    { label: 'borrow', ...msgs.borrow },
    // Other
    { label: 'macro', ...msgs.macro },
    { label: 'where', ...msgs.where },
    { label: 'in', ...msgs.in },
    { label: 'void', ...msgs.void },
    { label: 'delete', ...msgs.delete },
    // Literals
    { label: 'true', ...msgs.true },
    { label: 'false', ...msgs.false },
    { label: 'nul', ...msgs.nul },
    { label: 'null', ...msgs.null },
  ];
}

// Get type completions with i18n support
function getTypeCompletions(): { label: string; detail: string; documentation: string }[] {
  const msgs = i18nMessages.types;
  return [
    { label: 'Int', ...msgs.Int },
    { label: 'Float', ...msgs.Float },
    { label: 'Str', ...msgs.Str },
    { label: 'Bool', ...msgs.Bool },
    { label: 'Num', ...msgs.Num },
    { label: 'Byte', ...msgs.Byte },
    { label: 'Char', ...msgs.Char },
    { label: 'Void', ...msgs.Void },
    { label: 'Nul', ...msgs.Nul },
    { label: 'Any', ...msgs.Any },
    // C++ style types
    { label: 'int8', ...msgs.int8 },
    { label: 'int16', ...msgs.int16 },
    { label: 'int32', ...msgs.int32 },
    { label: 'int64', ...msgs.int64 },
    { label: 'uint8', ...msgs.uint8 },
    { label: 'uint16', ...msgs.uint16 },
    { label: 'uint32', ...msgs.uint32 },
    { label: 'uint64', ...msgs.uint64 },
  ];
}

// ljconfig schema property definition
interface ConfigSchemaProperty {
  label: string;
  detail: string;
  documentation: string;
  type: 'string' | 'boolean' | 'object' | 'array' | 'enum';
  enumValues?: string[];
  children?: Record<string, ConfigSchemaProperty>;
}

// Get ljconfig schema with i18n support
function getLjconfigSchema(): Record<string, ConfigSchemaProperty> {
  const cfg = i18nMessages.config;
  return {
    compilerOptions: {
      label: 'compilerOptions',
      ...cfg.compilerOptions,
      type: 'object',
      children: {
        outDir: { label: 'outDir', ...cfg.outDir, type: 'string' },
        rootDir: { label: 'rootDir', ...cfg.rootDir, type: 'string' },
        prelude: { label: 'prelude', ...cfg.prelude, type: 'enum', enumValues: ['none', 'core', 'full'] },
        codegenTarget: { label: 'codegenTarget', ...cfg.codegenTarget, type: 'enum', enumValues: ['js', 'c'] },
        strict: { label: 'strict', ...cfg.strict, type: 'boolean' },
        sourceMap: { label: 'sourceMap', ...cfg.sourceMap, type: 'boolean' },
        declaration: { label: 'declaration', ...cfg.declaration, type: 'boolean' },
        noImplicitAny: { label: 'noImplicitAny', ...cfg.noImplicitAny, type: 'boolean' }
      }
    },
    buildOptions: {
      label: 'buildOptions',
      ...cfg.buildOptions,
      type: 'object',
      children: {
        target: { label: 'target', ...cfg.target, type: 'enum', enumValues: ['node', 'browser', 'llvm', 'gcc'] },
        executableName: { label: 'executableName', ...cfg.executableName, type: 'string' },
        llvmOptions: {
          label: 'llvmOptions',
          ...cfg.llvmOptions,
          type: 'object',
          children: {
            optLevel: { label: 'optLevel', ...cfg.optLevel, type: 'enum', enumValues: ['0', '1', '2', '3', 's', 'z'] },
            keepIntermediates: { label: 'keepIntermediates', ...cfg.keepIntermediates, type: 'boolean' },
            targetTriple: { label: 'targetTriple', ...cfg.targetTriple, type: 'string' }
          }
        },
        gccOptions: {
          label: 'gccOptions',
          ...cfg.gccOptions,
          type: 'object',
          children: {
            optLevel: { label: 'optLevel', ...cfg.optLevel, type: 'enum', enumValues: ['0', '1', '2', '3', 's'] },
            keepIntermediates: { label: 'keepIntermediates', ...cfg.keepIntermediates, type: 'boolean' }
          }
        }
      }
    },
    include: { label: 'include', ...cfg.include, type: 'array' },
    exclude: { label: 'exclude', ...cfg.exclude, type: 'array' },
    extends: { label: 'extends', ...cfg.extends, type: 'string' }
  };
}

// 检查文件是否是 ljconfig 配置文件
function isLjConfigFile(document: vscode.TextDocument): boolean {
  const fileName = document.fileName;
  const baseName = fileName.split(/[\\/]/).pop() || '';
  
  // 检查文件名模式: ljconfig.*.json 或 ljconfig.*.lj 或 ljconfig.json 或 ljconfig.lj
  const isConfigFileName = /^ljconfig(\.[^.]+)?\.(json|lj)$/.test(baseName);
  if (!isConfigFileName) return false;
  
  // 如果是 .lj 文件，检查第一行是否有 #/ljos/:package:config
  if (baseName.endsWith('.lj')) {
    const firstLine = document.lineAt(0).text.trim();
    if (firstLine !== '#/ljos/:package:config') return false;
    
    // 检查是否导入了 /std/config
    const text = document.getText();
    if (!text.includes('/std/config')) return false;
  }
  
  return true;
}

// 获取当前光标在配置对象中的路径
function getConfigPath(document: vscode.TextDocument, position: vscode.Position): string[] {
  const text = document.getText();
  const offset = document.offsetAt(position);
  
  // 简单的路径解析：查找光标前的属性名
  const path: string[] = [];
  let depth = 0;
  let currentKey = '';
  let inString = false;
  let stringChar = '';
  
  for (let i = 0; i < offset; i++) {
    const char = text[i];
    
    if (inString) {
      if (char === stringChar && text[i - 1] !== '\\') {
        inString = false;
      }
      continue;
    }
    
    if (char === '"' || char === "'") {
      inString = true;
      stringChar = char;
      continue;
    }
    
    if (char === '{') {
      if (currentKey) {
        path.push(currentKey);
        currentKey = '';
      }
      depth++;
    } else if (char === '}') {
      depth--;
      if (path.length > 0) path.pop();
    } else if (char === ':' && depth > 0) {
      // 找到键值对的冒号，记录当前键
      const beforeColon = text.substring(0, i).trim();
      const keyMatch = beforeColon.match(/([a-zA-Z_][a-zA-Z0-9_]*)\s*$/);
      if (keyMatch) {
        currentKey = keyMatch[1];
      }
    } else if (char === ',' || char === '\n') {
      currentKey = '';
    }
  }
  
  return path;
}

// Get config completions with i18n support
function getConfigCompletions(path: string[]): vscode.CompletionItem[] {
  const completions: vscode.CompletionItem[] = [];
  
  let schema: Record<string, ConfigSchemaProperty> = getLjconfigSchema();
  
  // 根据路径导航到正确的 schema 位置
  for (const key of path) {
    const prop = schema[key];
    if (prop && prop.children) {
      schema = prop.children;
    } else {
      return completions; // 路径无效
    }
  }
  
  // 生成补全项
  for (const [key, prop] of Object.entries(schema)) {
    const item = new vscode.CompletionItem(key, vscode.CompletionItemKind.Property);
    item.detail = prop.detail;
    item.documentation = new vscode.MarkdownString(prop.documentation);
    
    // 根据类型生成插入文本
    if (prop.type === 'object') {
      item.insertText = new vscode.SnippetString(`${key}: {\n\t$0\n}`);
    } else if (prop.type === 'array') {
      item.insertText = new vscode.SnippetString(`${key}: [$0]`);
    } else if (prop.type === 'boolean') {
      item.insertText = new vscode.SnippetString(`${key}: \${1|true,false|}`);
    } else if (prop.type === 'enum' && prop.enumValues) {
      const choices = prop.enumValues.map(v => `"${v}"`).join(',');
      item.insertText = new vscode.SnippetString(`${key}: \${1|${choices}|}`);
    } else {
      item.insertText = new vscode.SnippetString(`${key}: "$0"`);
    }
    
    completions.push(item);
  }
  
  return completions;
}

let diagnosticCollection: vscode.DiagnosticCollection;
const checkerCache = new Map<string, SyntaxChecker>();

function getChecker(uri: string): SyntaxChecker {
  let checker = checkerCache.get(uri);
  if (!checker) {
    checker = new SyntaxChecker();
    checkerCache.set(uri, checker);
  }
  return checker;
}

export function activate(context: vscode.ExtensionContext) {
  // Initialize i18n
  initI18n();
  i18nMessages = getMessages();
  
  // Create diagnostic collection
  diagnosticCollection = vscode.languages.createDiagnosticCollection('ljos');
  context.subscriptions.push(diagnosticCollection);

  // Register hover provider
  context.subscriptions.push(
    vscode.languages.registerHoverProvider('ljos', {
      provideHover(document, position) {
        const checker = getChecker(document.uri.toString());
        const hoverInfo = checker.getHoverInfo(position.line + 1, position.character + 1);
        
        if (hoverInfo) {
          const markdown = new vscode.MarkdownString(hoverInfo.content);
          markdown.isTrusted = true;
          return new vscode.Hover(markdown);
        }
        return null;
      }
    })
  );

  // Register definition provider (Go to Definition)
  context.subscriptions.push(
    vscode.languages.registerDefinitionProvider('ljos', {
      provideDefinition(document, position) {
        // Ensure document is validated first
        validateDocument(document);
        
        const checker = getChecker(document.uri.toString());
        const definition = checker.getDefinition(position.line + 1, position.character + 1);
        
        if (definition && definition.file && definition.line > 0) {
          const uri = definition.file === document.uri.fsPath 
            ? document.uri 
            : vscode.Uri.file(definition.file);
          return new vscode.Location(
            uri,
            new vscode.Position(definition.line - 1, definition.column - 1)
          );
        }
        return null;
      }
    })
  );

  // Register reference provider (Find All References)
  context.subscriptions.push(
    vscode.languages.registerReferenceProvider('ljos', {
      provideReferences(document, position, context) {
        // Ensure document is validated first
        validateDocument(document);
        
        const checker = getChecker(document.uri.toString());
        const references = checker.getReferences(position.line + 1, position.character + 1);
        
        return references.map(ref => {
          const uri = ref.file === document.uri.fsPath 
            ? document.uri 
            : vscode.Uri.file(ref.file);
          return new vscode.Location(
            uri,
            new vscode.Position(ref.line - 1, ref.column - 1)
          );
        });
      }
    })
  );

  // Register completion provider
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider('ljos', {
      provideCompletionItems(document, position, token, context) {
        const completions: vscode.CompletionItem[] = [];
        
        // Check if this is a ljconfig file - provide config-specific completions
        if (isLjConfigFile(document)) {
          const configPath = getConfigPath(document, position);
          return getConfigCompletions(configPath);
        }
        
        // Get the text before cursor to determine context
        const lineText = document.lineAt(position.line).text;
        const textBeforeCursor = lineText.substring(0, position.character);
        
        // Check if we're after a dot (member access context)
        const dotMatch = textBeforeCursor.match(/(\w+)\.\s*(\w*)$/);
        if (dotMatch) {
          const objectName = dotMatch[1];
          const checker = getChecker(document.uri.toString());
          const symbols = checker.getSymbols?.() || [];
          
          // Find the symbol
          const sym = symbols.find(s => s.name === objectName);
          if (sym) {
            // Check if it's an enum - provide enum member completions
            if (sym.type.kind === 'enum') {
              const enumType = sym.type as any;
              for (const [memberName, memberInfo] of enumType.members) {
                const item = new vscode.CompletionItem(memberName, vscode.CompletionItemKind.EnumMember);
                if (memberInfo.isCallable && memberInfo.associatedData) {
                  item.detail = `${objectName}.${memberName}(...)`;
                  item.insertText = new vscode.SnippetString(`${memberName}($0)`);
                } else {
                  item.detail = `${objectName}.${memberName}`;
                }
                item.sortText = `a_${memberName}`;
                completions.push(item);
              }
              return completions;
            }
            
            // Check if it's a class - provide class member completions
            if (sym.type.kind === 'class') {
              const classType = sym.type as any;
              for (const [memberName, memberInfo] of classType.members) {
                const kind = memberInfo.isMethod 
                  ? vscode.CompletionItemKind.Method 
                  : vscode.CompletionItemKind.Property;
                const item = new vscode.CompletionItem(memberName, kind);
                item.sortText = `a_${memberName}`;
                completions.push(item);
              }
              return completions;
            }
          }
        }
        
        // Check if we're after a colon (type annotation context)
        const isTypeContext = /:\s*\w*$/.test(textBeforeCursor) || 
                             /\)\s*:\s*\w*$/.test(textBeforeCursor);
        
        // Add keyword completions (with i18n)
        for (const kw of getKeywordCompletions()) {
          const item = new vscode.CompletionItem(kw.label, vscode.CompletionItemKind.Keyword);
          item.detail = kw.detail;
          item.documentation = new vscode.MarkdownString(kw.documentation);
          if (kw.insertText) {
            item.insertText = new vscode.SnippetString(kw.insertText);
          }
          // Lower priority for keywords in type context
          item.sortText = isTypeContext ? `z_${kw.label}` : `a_${kw.label}`;
          completions.push(item);
        }
        
        // Add type completions (higher priority in type context, with i18n)
        for (const type of getTypeCompletions()) {
          const item = new vscode.CompletionItem(type.label, vscode.CompletionItemKind.TypeParameter);
          item.detail = type.detail;
          item.documentation = new vscode.MarkdownString(type.documentation);
          // Higher priority in type context
          item.sortText = isTypeContext ? `a_${type.label}` : `z_${type.label}`;
          completions.push(item);
        }
        
        // Add symbols from checker (variables, functions, classes)
        const checker = getChecker(document.uri.toString());
        const symbols = checker.getSymbols?.() || [];
        for (const sym of symbols) {
          let kind: vscode.CompletionItemKind;
          switch (sym.kind) {
            case 'function': kind = vscode.CompletionItemKind.Function; break;
            case 'class': kind = vscode.CompletionItemKind.Class; break;
            case 'enum': kind = vscode.CompletionItemKind.Enum; break;
            case 'variable': kind = sym.isConst ? vscode.CompletionItemKind.Constant : vscode.CompletionItemKind.Variable; break;
            case 'type': kind = vscode.CompletionItemKind.TypeParameter; break;
            default: kind = vscode.CompletionItemKind.Variable;
          }
          const item = new vscode.CompletionItem(sym.name, kind);
          if (sym.documentation) {
            item.documentation = new vscode.MarkdownString(sym.documentation);
          }
          completions.push(item);
        }
        
        return completions;
      }
    }, '.', ':') // Trigger on dot and colon
  );

  // Check document on open
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((document) => {
      if (document.languageId === 'ljos') {
        validateDocument(document);
      }
    })
  );

  // Check document on change
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document.languageId === 'ljos') {
        validateDocument(event.document);
      }
    })
  );

  // Check document on save
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((document) => {
      if (document.languageId === 'ljos') {
        validateDocument(document);
      }
    })
  );

  // Clean up cache when document is closed
  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument((document) => {
      checkerCache.delete(document.uri.toString());
    })
  );

  // Check all open documents on activation
  vscode.workspace.textDocuments.forEach((document) => {
    if (document.languageId === 'ljos') {
      validateDocument(document);
    }
  });
}

function validateDocument(document: vscode.TextDocument): void {
  const text = document.getText();
  const checker = getChecker(document.uri.toString());
  const results = checker.check(text, document.uri.fsPath);

  const diagnostics: vscode.Diagnostic[] = results.map((info) => {
    const range = new vscode.Range(
      new vscode.Position(info.line - 1, info.column - 1),
      new vscode.Position(info.endLine - 1, info.endColumn - 1)
    );

    const severity =
      info.severity === 'error'
        ? vscode.DiagnosticSeverity.Error
        : info.severity === 'warning'
        ? vscode.DiagnosticSeverity.Warning
        : vscode.DiagnosticSeverity.Information;

    const diagnostic = new vscode.Diagnostic(range, info.message, severity);
    diagnostic.source = 'ljos';
    diagnostic.code = info.code;
    return diagnostic;
  });

  diagnosticCollection.set(document.uri, diagnostics);
}

export function deactivate(): void {
  if (diagnosticCollection) {
    diagnosticCollection.dispose();
  }
  checkerCache.clear();
}
