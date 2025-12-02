import * as vscode from 'vscode';
import { SyntaxChecker } from './ljos/checker';
import { KEYWORDS } from './ljos/tokens';

// Ljos 关键字及其描述
const KEYWORD_COMPLETIONS: { label: string; detail: string; documentation: string; insertText?: string }[] = [
  // 声明关键字
  { label: 'const', detail: '常量声明', documentation: '声明一个不可变的常量', insertText: 'const ' },
  { label: 'mut', detail: '变量声明', documentation: '声明一个可变的变量', insertText: 'mut ' },
  { label: 'fn', detail: '函数声明', documentation: '声明一个函数', insertText: 'fn ${1:name}(${2:params}): ${3:ReturnType} {\n\t$0\n}' },
  { label: 'class', detail: '类声明', documentation: '声明一个类', insertText: 'class ${1:Name} {\n\t$0\n}' },
  { label: 'abstract', detail: '抽象类', documentation: '声明一个抽象类', insertText: 'abstract class ${1:Name} {\n\t$0\n}' },
  { label: 'enum', detail: '枚举声明', documentation: '声明一个枚举类型', insertText: 'enum ${1:Name} {\n\t$0\n}' },
  { label: 'type', detail: '类型别名', documentation: '声明一个类型别名', insertText: 'type ${1:Name} = $0' },
  { label: 'interface', detail: '接口声明', documentation: '声明一个接口', insertText: 'interface ${1:Name} {\n\t$0\n}' },
  
  // 控制流
  { label: 'if', detail: '条件语句', documentation: '条件判断语句', insertText: 'if (${1:condition}) {\n\t$0\n}' },
  { label: 'else', detail: '否则分支', documentation: 'if 语句的否则分支' },
  { label: 'for', detail: '循环语句', documentation: 'for 循环', insertText: 'for (${1:item} in ${2:iterable}) {\n\t$0\n}' },
  { label: 'while', detail: 'while 循环', documentation: '当条件为真时循环', insertText: 'while (${1:condition}) {\n\t$0\n}' },
  { label: 'do', detail: 'do-while 循环', documentation: '先执行后判断的循环', insertText: 'do {\n\t$0\n} while (${1:condition})' },
  { label: 'when', detail: '模式匹配', documentation: '类似 switch 的模式匹配语句', insertText: 'when (${1:value}) {\n\t${2:pattern} => {\n\t\t$0\n\t}\n}' },
  { label: 'break', detail: '跳出循环', documentation: '跳出当前循环' },
  { label: 'continue', detail: '继续循环', documentation: '跳过当前迭代，继续下一次循环' },
  { label: 'return', detail: '返回语句', documentation: '从函数返回值', insertText: 'return $0' },
  
  // 异常处理
  { label: 'try', detail: '异常捕获', documentation: '尝试执行可能抛出异常的代码', insertText: 'try {\n\t$0\n} catch (${1:e}) {\n\t\n}' },
  { label: 'catch', detail: '捕获异常', documentation: '捕获并处理异常' },
  { label: 'finally', detail: '最终执行', documentation: '无论是否异常都会执行的代码块' },
  { label: 'throw', detail: '抛出异常', documentation: '抛出一个异常', insertText: 'throw $0' },
  
  // 类相关
  { label: 'extends', detail: '继承', documentation: '继承一个类' },
  { label: 'implements', detail: '实现接口', documentation: '实现一个或多个接口' },
  { label: 'static', detail: '静态成员', documentation: '声明静态成员' },
  { label: 'constructor', detail: '构造函数', documentation: '类的构造函数', insertText: 'constructor(${1:params}) {\n\t$0\n}' },
  { label: 'this', detail: '当前实例', documentation: '引用当前类实例' },
  { label: 'super', detail: '父类引用', documentation: '引用父类' },
  { label: 'new', detail: '创建实例', documentation: '创建类的新实例', insertText: 'new ${1:ClassName}($0)' },
  
  // 访问修饰符
  { label: 'public', detail: '公开访问', documentation: '成员可被外部访问' },
  { label: 'private', detail: '私有访问', documentation: '成员只能在类内部访问' },
  { label: 'protected', detail: '受保护访问', documentation: '成员可被子类访问' },
  { label: 'readonly', detail: '只读', documentation: '成员只能在初始化时赋值' },
  
  // 模块
  { label: 'import', detail: '导入', documentation: '从模块导入', insertText: 'import { $1 }: "${2:module}"' },
  { label: 'export', detail: '导出', documentation: '导出模块成员', insertText: 'export ' },
  { label: 'default', detail: '默认导出', documentation: '模块的默认导出' },
  { label: 'as', detail: '别名', documentation: '导入/导出时使用别名' },
  
  // 类型操作
  { label: 'typeof', detail: '获取类型', documentation: '获取值的类型字符串' },
  { label: 'instanceof', detail: '实例检查', documentation: '检查对象是否是某个类的实例' },
  { label: 'is', detail: '类型检查', documentation: '类型守卫，检查值是否为指定类型' },
  { label: 'of', detail: '类型转换', documentation: '类型断言' },
  
  // 异步
  { label: 'async', detail: '异步函数', documentation: '声明异步函数' },
  { label: 'await', detail: '等待异步', documentation: '等待 Promise 完成' },
  { label: 'go', detail: '协程', documentation: '启动一个协程' },
  { label: 'chan', detail: '通道', documentation: '声明一个通道' },
  { label: 'yield', detail: '生成器', documentation: '生成器函数中产出值' },
  
  // 资源管理
  { label: 'defer', detail: '延迟执行', documentation: '在函数返回前执行' },
  { label: 'using', detail: '资源管理', documentation: '自动管理资源的生命周期' },
  
  // 内存管理
  { label: 'move', detail: '移动语义', documentation: '转移所有权' },
  { label: 'borrow', detail: '借用', documentation: '借用引用' },
  
  // 其他
  { label: 'macro', detail: '宏', documentation: '定义宏' },
  { label: 'where', detail: '类型约束', documentation: '泛型类型约束' },
  { label: 'in', detail: '包含检查', documentation: '检查元素是否在集合中' },
  { label: 'void', detail: '空类型', documentation: '表示无返回值' },
  { label: 'delete', detail: '删除', documentation: '删除对象属性' },
  
  // 字面量
  { label: 'true', detail: '布尔真', documentation: '布尔值 true' },
  { label: 'false', detail: '布尔假', documentation: '布尔值 false' },
  { label: 'nul', detail: '空值', documentation: 'Ljos 的空值' },
  { label: 'null', detail: '空值', documentation: 'JavaScript 兼容的空值' },
];

// 内置类型补全
const TYPE_COMPLETIONS: { label: string; detail: string; documentation: string }[] = [
  { label: 'Int', detail: '整数类型', documentation: '32位有符号整数' },
  { label: 'Float', detail: '浮点类型', documentation: '64位浮点数' },
  { label: 'Str', detail: '字符串类型', documentation: 'UTF-8 字符串' },
  { label: 'Bool', detail: '布尔类型', documentation: '布尔值 true 或 false' },
  { label: 'Num', detail: '数字类型', documentation: '通用数字类型' },
  { label: 'Byte', detail: '字节类型', documentation: '8位无符号整数' },
  { label: 'Char', detail: '字符类型', documentation: 'Unicode 字符' },
  { label: 'Void', detail: '空类型', documentation: '无返回值' },
  { label: 'Nul', detail: '空值类型', documentation: '空值类型' },
  { label: 'Any', detail: '任意类型', documentation: '任意类型，跳过类型检查' },
];

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
        
        // Get the text before cursor to determine context
        const lineText = document.lineAt(position.line).text;
        const textBeforeCursor = lineText.substring(0, position.character);
        
        // Check if we're after a colon (type annotation context)
        const isTypeContext = /:\s*\w*$/.test(textBeforeCursor) || 
                             /\)\s*:\s*\w*$/.test(textBeforeCursor);
        
        // Add keyword completions
        for (const kw of KEYWORD_COMPLETIONS) {
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
        
        // Add type completions (higher priority in type context)
        for (const type of TYPE_COMPLETIONS) {
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
