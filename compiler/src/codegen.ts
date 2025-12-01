import * as AST from './ast';

export class CodeGenerator {
  private indent = 0;
  private output = '';
  private usesTypeOf = false; // Track if typeof is used
  private stdLibPath = './runtime/std'; // Default relative path

  constructor(options?: { stdLibPath?: string }) {
    if (options?.stdLibPath) {
      this.stdLibPath = options.stdLibPath;
    }
  }

  generate(program: AST.Program): string {
    this.output = '';
    this.indent = 0;
    this.usesTypeOf = false;

    for (const stmt of program.body) {
      this.output += this.generateStatement(stmt);
      this.output += '\n';
    }

    // Prepend typeOf import if needed
    if (this.usesTypeOf) {
      this.output = `import { typeOf as __ljos_typeOf } from "${this.stdLibPath}/core.js";\n` + this.output;
    }

    return this.output;
  }

  private generateStatement(stmt: AST.Statement): string {
    switch (stmt.type) {
      case 'VariableDeclaration':
        return this.generateVariableDeclaration(stmt);
      case 'FunctionDeclaration':
        return this.generateFunctionDeclaration(stmt);
      case 'ClassDeclaration':
        return this.generateClassDeclaration(stmt);
      case 'EnumDeclaration':
        return this.generateEnumDeclaration(stmt);
      case 'ExpressionStatement':
        return this.getIndent() + this.generateExpression(stmt.expression) + ';';
      case 'IfStatement':
        return this.generateIfStatement(stmt);
      case 'ForStatement':
        return this.generateForStatement(stmt);
      case 'WhileStatement':
        return this.generateWhileStatement(stmt);
      case 'DoWhileStatement':
        return this.generateDoWhileStatement(stmt);
      case 'WhenStatement':
        return this.generateWhenStatement(stmt);
      case 'ReturnStatement':
        return this.generateReturnStatement(stmt);
      case 'BreakStatement':
        return this.generateBreakStatement(stmt);
      case 'ContinueStatement':
        return this.getIndent() + 'continue;';
      case 'ThrowStatement':
        return this.getIndent() + `throw ${this.generateExpression(stmt.argument)};`;
      case 'TryStatement':
        return this.generateTryStatement(stmt);
      case 'ImportStatement':
        return this.generateImportStatement(stmt);
      case 'ExportStatement':
        return this.generateExportStatement(stmt);
      case 'TypeAliasDeclaration':
        // Type aliases are compile-time only, emit as comment
        return this.getIndent() + `// type ${stmt.name} = ${this.generateTypeAnnotation(stmt.typeAnnotation)}`;
      case 'BlockStatement':
        return this.generateBlockStatement(stmt);
      case 'DeferStatement':
        return this.generateDeferStatement(stmt);
      case 'UsingStatement':
        return this.generateUsingStatement(stmt);
      default:
        throw new Error(`Unknown statement type: ${(stmt as any).type}`);
    }
  }

  private generateVariableDeclaration(stmt: AST.VariableDeclaration): string {
    const keyword = stmt.kind === 'const' ? 'const' : 'let';
    if (stmt.init) {
      const init = this.generateExpression(stmt.init);
      return this.getIndent() + `${keyword} ${stmt.name} = ${init};`;
    }
    // Declaration without initializer (e.g., class member with type annotation only)
    return this.getIndent() + `${keyword} ${stmt.name};`;
  }

  private generateFunctionDeclaration(stmt: AST.FunctionDeclaration): string {
    const params = stmt.params.map(p => {
      if (p.defaultValue) {
        return `${p.name} = ${this.generateExpression(p.defaultValue)}`;
      }
      return p.name;
    }).join(', ');

    let result = this.getIndent() + `function ${stmt.name}(${params}) `;
    result += this.generateBlockStatement(stmt.body);
    return result;
  }

  private generateClassDeclaration(stmt: AST.ClassDeclaration): string {
    let header = this.getIndent() + `class ${stmt.name}`;
    if (stmt.superClass) {
      header += ` extends ${stmt.superClass.name}`;
    }

    header += ' {\n';
    this.indent++;

    let body = '';
    let hasConstructor = false;
    for (const member of stmt.body) {
      switch (member.type) {
        case 'ConstructorDeclaration': {
          hasConstructor = true;
          const params = member.params.map(p => {
            if (p.defaultValue) {
              return `${p.name} = ${this.generateExpression(p.defaultValue)}`;
            }
            return p.name;
          }).join(', ');
          body += this.generateConstructorWithAbstractCheck(stmt.name, params, member.body, stmt.isAbstract === true) + '\n';
          break;
        }
        case 'MethodDeclaration': {
          if (member.isAbstract) {
            // Do not emit abstract methods
            break;
          }
          if (!member.body) {
            // Non-abstract methods should always have a body; skip defensively if missing
            break;
          }
          const params = member.params.map(p => {
            if (p.defaultValue) {
              return `${p.name} = ${this.generateExpression(p.defaultValue)}`;
            }
            return p.name;
          }).join(', ');
          const staticPrefix = member.isStatic ? 'static ' : '';
          // Use # prefix for private methods (ES2022)
          const methodName = member.accessibility === 'private' ? `#${member.name}` : member.name;
          body += this.getIndent() + `${staticPrefix}${methodName}(${params}) ` + this.generateBlockStatement(member.body) + '\n';
          break;
        }
        case 'FieldDeclaration': {
          const staticPrefix = member.isStatic ? 'static ' : '';
          // Use # prefix for private fields (ES2022)
          const fieldName = member.accessibility === 'private' ? `#${member.name}` : member.name;
          if (member.init) {
            body += this.getIndent() + `${staticPrefix}${fieldName} = ${this.generateExpression(member.init)};\n`;
          } else {
            body += this.getIndent() + `${staticPrefix}${fieldName};\n`;
          }
          break;
        }
      }
    }

    // If abstract class has no explicit constructor, synthesize one with runtime check only
    if (stmt.isAbstract && !hasConstructor) {
      body = this.getIndent() + `constructor() {\n` +
        this.getIndent() + `  if (new.target === ${stmt.name}) { throw new Error("Cannot instantiate abstract class ${stmt.name}"); }\n` +
        this.getIndent() + `}\n` + body;
    }

    this.indent--;
    const footer = this.getIndent() + '}';

    let result = header + body + footer;

    // Member decorators (methods, fields, constructor)
    for (const member of stmt.body) {
      const decorators = (member as any).decorators as AST.Expression[] | undefined;
      if (!decorators || decorators.length === 0) continue;

      let target: string;
      let key: string;

      switch (member.type) {
        case 'ConstructorDeclaration':
          target = stmt.name;
          key = 'constructor';
          break;
        case 'MethodDeclaration':
          target = member.isStatic ? stmt.name : `${stmt.name}.prototype`;
          key = member.name;
          break;
        case 'FieldDeclaration':
          target = member.isStatic ? stmt.name : `${stmt.name}.prototype`;
          key = member.name;
          break;
        default:
          continue;
      }

      for (const dec of decorators) {
        const decExpr = this.generateExpression(dec);
        result += `\n${this.getIndent()}${decExpr}(${target}, "${key}");`;
      }
    }

    // Class decorators
    if (stmt.decorators && stmt.decorators.length > 0) {
      for (const dec of stmt.decorators) {
        const decExpr = this.generateExpression(dec);
        result += `\n${this.getIndent()}${stmt.name} = ${decExpr}(${stmt.name});`;
      }
    }

    return result;
  }

  private generateConstructorWithAbstractCheck(
    className: string,
    params: string,
    body: AST.BlockStatement,
    isAbstract: boolean,
  ): string {
    let result = this.getIndent() + `constructor(${params}) {\n`;
    this.indent++;
    if (isAbstract) {
      result += this.getIndent() + `if (new.target === ${className}) { throw new Error("Cannot instantiate abstract class ${className}"); }\n`;
    }
    for (const s of body.body) {
      result += this.generateStatement(s) + '\n';
    }
    this.indent--;
    result += this.getIndent() + '}';
    return result;
  }

  private generateEnumDeclaration(stmt: AST.EnumDeclaration): string {
    const entries = stmt.members.map(m => `${m.name}: "${m.name}"`).join(', ');
    return this.getIndent() + `const ${stmt.name} = { ${entries} };`;
  }

  private generateIfStatement(stmt: AST.IfStatement): string {
    let result = this.getIndent() + `if (${this.generateExpression(stmt.condition)}) `;
    result += this.generateBlockStatement(stmt.consequent);

    if (stmt.alternate) {
      result += ' else ';
      if (stmt.alternate.type === 'IfStatement') {
        // Remove indent for else if
        const elseIf = this.generateIfStatement(stmt.alternate);
        result += elseIf.trimStart();
      } else {
        result += this.generateBlockStatement(stmt.alternate);
      }
    }

    return result;
  }

  private generateForStatement(stmt: AST.ForStatement): string {
    if (stmt.isForIn && stmt.variable && stmt.iterable) {
      // for-in loop -> for...of in JS
      return this.getIndent() + `for (const ${stmt.variable} of ${this.generateExpression(stmt.iterable)}) ` +
        this.generateBlockStatement(stmt.body);
    }

    // Infinite loop
    if (!stmt.init && !stmt.condition && !stmt.update) {
      return this.getIndent() + `while (true) ` + this.generateBlockStatement(stmt.body);
    }

    // Condition-only loop
    if (!stmt.init && stmt.condition && !stmt.update) {
      return this.getIndent() + `while (${this.generateExpression(stmt.condition)}) ` +
        this.generateBlockStatement(stmt.body);
    }

    // Traditional for loop
    let init = '';
    if (stmt.init) {
      if ('type' in stmt.init && stmt.init.type === 'VariableDeclaration') {
        const keyword = stmt.init.kind === 'const' ? 'const' : 'let';
        if (stmt.init.init) {
          init = `${keyword} ${stmt.init.name} = ${this.generateExpression(stmt.init.init)}`;
        } else {
          init = `${keyword} ${stmt.init.name}`;
        }
      } else {
        init = this.generateExpression(stmt.init as AST.Expression);
      }
    }

    const condition = stmt.condition ? this.generateExpression(stmt.condition) : '';
    const update = stmt.update ? this.generateExpression(stmt.update) : '';

    return this.getIndent() + `for (${init}; ${condition}; ${update}) ` +
      this.generateBlockStatement(stmt.body);
  }

  private generateWhileStatement(stmt: AST.WhileStatement): string {
    return this.getIndent() + `while (${this.generateExpression(stmt.condition)}) ` +
      this.generateBlockStatement(stmt.body);
  }

  private generateDoWhileStatement(stmt: AST.DoWhileStatement): string {
    return this.getIndent() + `do ` + this.generateBlockStatement(stmt.body) +
      ` while (${this.generateExpression(stmt.condition)});`;
  }

  private generateWhenStatement(stmt: AST.WhenStatement): string {
    // Always generate as switch
    const hasDiscriminant = !!stmt.discriminant;
    const discriminant = hasDiscriminant
      ? this.generateExpression(stmt.discriminant as AST.Expression)
      : 'true';

    let result = this.getIndent() + `switch (${discriminant}) {\n`;
    this.indent++;

    for (const caseItem of stmt.cases) {
      if (caseItem.pattern.type === 'ElsePattern') {
        result += this.getIndent() + 'default: {\n';
      } else if (caseItem.pattern.type === 'OrPattern' && hasDiscriminant) {
        for (const p of caseItem.pattern.patterns) {
          result += this.getIndent() + `case ${this.generatePatternValue(p)}:\n`;
        }
        result += this.getIndent() + '{\n';
      } else if (caseItem.pattern.type === 'LiteralPattern') {
        const caseExpr = hasDiscriminant
          ? this.generateExpression(caseItem.pattern.value)
          : this.generateExpression(caseItem.pattern.value); // condition expression when no discriminant
        result += this.getIndent() + `case ${caseExpr}: {\n`;
      } else {
        // Complex pattern - not yet supported in switch lowering
        result += this.getIndent() + `/* complex pattern */\n`;
        continue;
      }

      this.indent++;
      if ('type' in caseItem.body && caseItem.body.type === 'BlockStatement') {
        for (const s of caseItem.body.body) {
          result += this.generateStatement(s) + '\n';
        }
      } else {
        result += this.getIndent() + this.generateExpression(caseItem.body as AST.Expression) + ';\n';
      }
      result += this.getIndent() + 'break;\n';
      this.indent--;
      result += this.getIndent() + '}\n';
    }

    this.indent--;
    result += this.getIndent() + '}';
    return result;
  }

  private generateWhenAsIfElse(stmt: AST.WhenStatement): string {
    let result = '';
    let first = true;

    for (const caseItem of stmt.cases) {
      const prefix = first ? 'if' : ' else if';
      first = false;

      if (caseItem.pattern.type === 'ElsePattern') {
        result += ' else ';
      } else {
        const condition = this.generatePatternCondition(caseItem.pattern, caseItem.guard);
        result += this.getIndent() + `${prefix} (${condition}) `;
      }

      if ('type' in caseItem.body && caseItem.body.type === 'BlockStatement') {
        result += this.generateBlockStatement(caseItem.body);
      } else {
        result += `{ ${this.generateExpression(caseItem.body as AST.Expression)}; }`;
      }
    }

    return result;
  }

  private generatePatternValue(pattern: AST.Pattern): string {
    switch (pattern.type) {
      case 'LiteralPattern':
        return this.generateExpression(pattern.value);
      case 'IdentifierPattern':
        return pattern.name;
      default:
        return '/* unsupported pattern */';
    }
  }

  private generatePatternCondition(pattern: AST.Pattern, guard?: AST.Expression): string {
    let condition = '';

    switch (pattern.type) {
      case 'LiteralPattern':
        condition = this.generateExpression(pattern.value);
        break;
      case 'IdentifierPattern':
        condition = 'true';
        break;
      case 'TypePattern':
        condition = `typeof ${pattern.name} === '${this.typeToJsType(pattern.typeAnnotation)}'`;
        break;
      default:
        condition = 'true';
    }

    if (guard) {
      condition += ` && (${this.generateExpression(guard)})`;
    }

    return condition;
  }

  private typeToJsType(type: AST.TypeAnnotation): string {
    if (type.kind === 'simple') {
      switch (type.name) {
        case 'int':
        case 'float':
          return 'number';
        case 'str':
          return 'string';
        case 'bool':
          return 'boolean';
        default:
          return 'object';
      }
    }
    return 'object';
  }

  private generateReturnStatement(stmt: AST.ReturnStatement): string {
    if (stmt.argument) {
      return this.getIndent() + `return ${this.generateExpression(stmt.argument)};`;
    }
    return this.getIndent() + 'return;';
  }

  private generateBreakStatement(stmt: AST.BreakStatement): string {
    if (stmt.argument) {
      // break with value - need to handle specially
      // In JS, we can't break with a value, so we need to use a different approach
      return this.getIndent() + `/* break with value */ break;`;
    }
    return this.getIndent() + 'break;';
  }

  private generateTryStatement(stmt: AST.TryStatement): string {
    let result = this.getIndent() + 'try ' + this.generateBlockStatement(stmt.block);

    for (const handler of stmt.handlers) {
      const param = handler.param || '_e';
      result += ` catch (${param}) `;
      
      if (handler.typeAnnotation) {
        // Type-specific catch - wrap in if
        result += '{\n';
        this.indent++;
        result += this.getIndent() + `if (${param} instanceof ${this.generateTypeAnnotation(handler.typeAnnotation)}) `;
        result += this.generateBlockStatement(handler.body);
        result += '\n' + this.getIndent() + 'else { throw ' + param + '; }\n';
        this.indent--;
        result += this.getIndent() + '}';
      } else {
        result += this.generateBlockStatement(handler.body);
      }
    }

    return result;
  }

  private generateDeferStatement(stmt: AST.DeferStatement): string {
    // In JavaScript, we simulate defer using a deferred array and finally block
    // For simplicity, we'll generate a comment and the deferred code
    // A more complete implementation would wrap the containing function
    let deferredCode: string;
    if ('type' in stmt.body && stmt.body.type === 'BlockStatement') {
      deferredCode = this.generateBlockStatement(stmt.body);
    } else {
      deferredCode = this.generateExpression(stmt.body as AST.Expression);
    }
    
    // Generate as a deferred callback registration
    return this.getIndent() + `__deferred.push(() => ${deferredCode});`;
  }

  private generateUsingStatement(stmt: AST.UsingStatement): string {
    // using (resource = init) { body } -> try { const resource = init; body } finally { resource.dispose?.() }
    let result = this.getIndent() + 'try {\n';
    this.indent++;
    result += this.getIndent() + `const ${stmt.binding} = ${this.generateExpression(stmt.init)};\n`;
    
    for (const s of stmt.body.body) {
      result += this.generateStatement(s) + '\n';
    }
    
    this.indent--;
    result += this.getIndent() + `} finally {\n`;
    this.indent++;
    result += this.getIndent() + `${stmt.binding}?.dispose?.() ?? ${stmt.binding}?.close?.();\n`;
    this.indent--;
    result += this.getIndent() + '}';
    
    return result;
  }

  private generateImportStatement(stmt: AST.ImportStatement): string {
    const specifiers = stmt.specifiers.map(spec => {
      switch (spec.type) {
        case 'default':
          return spec.local;
        case 'named':
          return spec.imported === spec.local ? spec.local : `${spec.imported} as ${spec.local}`;
        case 'namespace':
          return `* as ${spec.local}`;
      }
    });

    // Handle different import styles
    const hasDefault = stmt.specifiers.some(s => s.type === 'default');
    const hasNamed = stmt.specifiers.some(s => s.type === 'named');
    const hasNamespace = stmt.specifiers.some(s => s.type === 'namespace');

    let importClause = '';
    if (hasDefault) {
      const defaultSpec = stmt.specifiers.find(s => s.type === 'default')!;
      importClause = defaultSpec.local;
    }
    if (hasNamed) {
      const namedSpecs = stmt.specifiers.filter(s => s.type === 'named') as { type: 'named'; imported: string; local: string }[];
      const namedPart = '{ ' + namedSpecs.map(s => s.imported === s.local ? s.local : `${s.imported} as ${s.local}`).join(', ') + ' }';
      importClause = importClause ? `${importClause}, ${namedPart}` : namedPart;
    }
    if (hasNamespace) {
      const nsSpec = stmt.specifiers.find(s => s.type === 'namespace')!;
      importClause = `* as ${nsSpec.local}`;
    }

    // Convert Ljos import paths
    let source = stmt.source;
    if (source.startsWith('/std/')) {
      // Standard library - map to runtime/std/*.js
      const moduleName = source.slice(5); // Remove '/std/'
      source = `${this.stdLibPath}/${moduleName}.js`;
    }

    return this.getIndent() + `import ${importClause} from "${source}";`;
  }

  private generateExportStatement(stmt: AST.ExportStatement): string {
    if (stmt.source) {
      return this.getIndent() + `export * from "${stmt.source}";`;
    }

    if (stmt.isDefault && stmt.declaration) {
      return this.getIndent() + `export default ${this.generateStatement(stmt.declaration).trim()};`;
    }

    if (stmt.declaration) {
      const decl = this.generateStatement(stmt.declaration);
      return this.getIndent() + `export ${decl.trimStart()}`;
    }

    return '';
  }

  private generateBlockStatement(stmt: AST.BlockStatement): string {
    let result = '{\n';
    this.indent++;

    for (const s of stmt.body) {
      result += this.generateStatement(s) + '\n';
    }

    this.indent--;
    result += this.getIndent() + '}';
    return result;
  }

  private generateExpression(expr: AST.Expression): string {
    switch (expr.type) {
      case 'Literal':
        return this.generateLiteral(expr);
      case 'Identifier':
        return expr.name;
      case 'BinaryExpression': {
        // Convert == to === and != to !== for JavaScript
        let operator = expr.operator;
        if (operator === '==') operator = '===';
        else if (operator === '!=') operator = '!==';
        return `(${this.generateExpression(expr.left)} ${operator} ${this.generateExpression(expr.right)})`;
      }
      case 'UnaryExpression':
        return expr.prefix
          ? `${expr.operator}${this.generateExpression(expr.argument)}`
          : `${this.generateExpression(expr.argument)}${expr.operator}`;
      case 'CallExpression':
        return this.generateCallExpression(expr);
      case 'NewExpression':
        return this.generateNewExpression(expr);
      case 'MemberExpression':
        return this.generateMemberExpression(expr);
      case 'ArrayExpression':
        return `[${expr.elements.map(e => this.generateExpression(e)).join(', ')}]`;
      case 'ObjectExpression':
        return this.generateObjectExpression(expr);
      case 'ArrowFunctionExpression':
        return this.generateArrowFunction(expr);
      case 'AssignmentExpression':
        return `${this.generateExpression(expr.left)} ${expr.operator} ${this.generateExpression(expr.right)}`;
      case 'ConditionalExpression':
        return `(${this.generateExpression(expr.test)} ? ${this.generateExpression(expr.consequent)} : ${this.generateExpression(expr.alternate)})`;
      case 'LogicalExpression':
        return `(${this.generateExpression(expr.left)} ${expr.operator} ${this.generateExpression(expr.right)})`;
      case 'TemplateStringExpression':
        return this.generateTemplateString(expr);
      case 'TypeCastExpression':
        // Type cast - just return the expression (runtime cast)
        return this.generateExpression(expr.expression);
      case 'TypeCheckExpression':
        return this.generateTypeCheck(expr);
      case 'RangeExpression':
        return this.generateRangeExpression(expr);
      case 'GoExpression':
        // Go expression -> Promise/async
        return `(async () => ${this.generateExpression(expr.argument)})()`;
      case 'AwaitExpression':
        return `await ${this.generateExpression(expr.argument)}`;
      case 'ChannelExpression':
        return this.generateChannelExpression(expr);
      case 'SendExpression':
        return this.generateSendExpression(expr);
      case 'ReceiveExpression':
        return this.generateReceiveExpression(expr);
      case 'WhenExpression':
        return this.generateWhenExpression(expr);
      case 'TypeofExpression':
        this.usesTypeOf = true;
        return `__ljos_typeOf(${this.generateExpression(expr.argument)})`;
      case 'InstanceofExpression':
        return `(${this.generateExpression(expr.left)} instanceof ${this.generateExpression(expr.right)})`;
      case 'VoidExpression':
        return `void ${this.generateExpression(expr.argument)}`;
      case 'DeleteExpression':
        return `delete ${this.generateExpression(expr.argument)}`;
      case 'ThisExpression':
        return 'this';
      case 'SuperExpression':
        return 'super';
      case 'YieldExpression':
        if (expr.delegate) {
          return expr.argument ? `yield* ${this.generateExpression(expr.argument)}` : 'yield*';
        }
        return expr.argument ? `yield ${this.generateExpression(expr.argument)}` : 'yield';
      default:
        throw new Error(`Unknown expression type: ${(expr as any).type}`);
    }
  }

  private generateLiteral(expr: AST.Literal): string {
    if (expr.value === null) return 'null';
    if (typeof expr.value === 'string') return JSON.stringify(expr.value);
    return String(expr.value);
  }

  private generateCallExpression(expr: AST.CallExpression): string {
    const callee = this.generateExpression(expr.callee);
    const args = expr.arguments.map(a => this.generateExpression(a)).join(', ');
    // No built-in function mappings - all functions must be imported from std
    return `${callee}(${args})`;
  }

  private generateNewExpression(expr: AST.NewExpression): string {
    const callee = this.generateExpression(expr.callee);
    const args = expr.arguments.map(a => this.generateExpression(a)).join(', ');
    return `new ${callee}(${args})`;
  }

  private generateMemberExpression(expr: AST.MemberExpression): string {
    const object = this.generateExpression(expr.object);
    const operator = expr.optional ? '?.' : '.';

    if (expr.computed) {
      return expr.optional
        ? `${object}?.[${this.generateExpression(expr.property)}]`
        : `${object}[${this.generateExpression(expr.property)}]`;
    }

    return `${object}${operator}${this.generateExpression(expr.property)}`;
  }

  private generateObjectExpression(expr: AST.ObjectExpression): string {
    if (expr.properties.length === 0) return '{}';

    const props = expr.properties.map(p => {
      const key = this.generateExpression(p.key);
      const value = this.generateExpression(p.value);
      // If key is an identifier, use shorthand if possible
      if (p.key.type === 'Identifier' && p.value.type === 'Identifier' && p.key.name === p.value.name) {
        return key;
      }
      // If key is an identifier, use it directly, otherwise use computed property
      if (p.key.type === 'Identifier') {
        return `${key}: ${value}`;
      }
      return `[${key}]: ${value}`;
    });

    return `{ ${props.join(', ')} }`;
  }

  private generateArrowFunction(expr: AST.ArrowFunctionExpression): string {
    const params = expr.params.map(p => {
      if (p.defaultValue) {
        return `${p.name} = ${this.generateExpression(p.defaultValue)}`;
      }
      return p.name;
    }).join(', ');

    if ('type' in expr.body && expr.body.type === 'BlockStatement') {
      return `(${params}) => ${this.generateBlockStatement(expr.body)}`;
    }

    return `(${params}) => ${this.generateExpression(expr.body as AST.Expression)}`;
  }

  private generateTemplateString(expr: AST.TemplateStringExpression): string {
    let result = '`';
    for (const part of expr.parts) {
      if (typeof part === 'string') {
        result += part.replace(/`/g, '\\`').replace(/\$/g, '\\$');
      } else {
        result += '${' + this.generateExpression(part) + '}';
      }
    }
    result += '`';
    return result;
  }

  private generateTypeCheck(expr: AST.TypeCheckExpression): string {
    const value = this.generateExpression(expr.expression);
    const type = expr.typeAnnotation;

    if (type.kind === 'simple') {
      switch (type.name) {
        case 'int':
          return `(typeof ${value} === 'number' && Number.isInteger(${value}))`;
        case 'float':
          return `typeof ${value} === 'number'`;
        case 'str':
          return `typeof ${value} === 'string'`;
        case 'bool':
          return `typeof ${value} === 'boolean'`;
        case 'nul':
          return `${value} === null`;
        default:
          return `${value} instanceof ${type.name}`;
      }
    }

    if (type.kind === 'array') {
      return `Array.isArray(${value})`;
    }

    return `true /* type check for ${this.generateTypeAnnotation(type)} */`;
  }

  private generateRangeExpression(expr: AST.RangeExpression): string {
    const start = this.generateExpression(expr.start);
    const end = this.generateExpression(expr.end);
    // Generate a range array
    return `Array.from({ length: ${end} - ${start}${expr.inclusive ? ' + 1' : ''} }, (_, i) => ${start} + i)`;
  }

  private generateChannelExpression(expr: AST.ChannelExpression): string {
    // Generate a channel using a simple async queue implementation
    const bufferSize = expr.bufferSize ? this.generateExpression(expr.bufferSize) : '0';
    return `new Channel(${bufferSize})`;
  }

  private generateSendExpression(expr: AST.SendExpression): string {
    const channel = this.generateExpression(expr.channel);
    const value = this.generateExpression(expr.value);
    return `${channel}.send(${value})`;
  }

  private generateReceiveExpression(expr: AST.ReceiveExpression): string {
    const channel = this.generateExpression(expr.channel);
    return `await ${channel}.receive()`;
  }

  private generateWhenExpression(expr: AST.WhenExpression): string {
    const stmt: AST.WhenStatement = {
      type: 'WhenStatement',
      discriminant: expr.discriminant,
      cases: expr.cases,
    };

    const hasDiscriminant = !!expr.discriminant;
    const discriminant = hasDiscriminant
      ? this.generateExpression(expr.discriminant as AST.Expression)
      : 'true';

    let result = '(() => {\n';
    result += `switch (${discriminant}) {\n`;

    for (const caseItem of stmt.cases) {
      if (caseItem.pattern.type === 'ElsePattern') {
        result += 'default: {\n';
      } else if (caseItem.pattern.type === 'OrPattern' && hasDiscriminant) {
        for (const p of caseItem.pattern.patterns) {
          result += `case ${this.generatePatternValue(p)}:\n`;
        }
        result += '{\n';
      } else if (caseItem.pattern.type === 'LiteralPattern') {
        const caseExpr = hasDiscriminant
          ? this.generateExpression(caseItem.pattern.value)
          : this.generateExpression(caseItem.pattern.value); // condition expression when no discriminant
        result += `case ${caseExpr}: {\n`;
      } else {
        result += '/* complex pattern not supported in when-expression switch */\n';
        continue;
      }

      if ('type' in caseItem.body && caseItem.body.type === 'BlockStatement') {
        // Require explicit return inside the block
        for (const s of caseItem.body.body) {
          result += this.generateStatement(s) + '\n';
        }
      } else {
        const valueExpr = this.generateExpression(caseItem.body as AST.Expression);
        result += `return ${valueExpr};\n`;
      }
      result += 'break;\n';
      result += '}\n';
    }

    result += '}\n';
    result += '})()';
    return result;
  }

  private generateTypeAnnotation(type: AST.TypeAnnotation): string {
    switch (type.kind) {
      case 'simple':
        return type.name;
      case 'array':
        return `${this.generateTypeAnnotation(type.elementType)}[]`;
      case 'map':
        return `Map<${this.generateTypeAnnotation(type.keyType)}, ${this.generateTypeAnnotation(type.valueType)}>`;
      case 'object':
        if (type.properties.length === 0) {
          return '{}';
        }
        return '{ ' + type.properties.map(prop => {
          const optional = prop.optional ? '?' : '';
          return `${prop.key}${optional}: ${this.generateTypeAnnotation(prop.type)}`;
        }).join('; ') + ' }';
      case 'tuple':
        return `[${type.elementTypes.map(t => this.generateTypeAnnotation(t)).join(', ')}]`;
      case 'function':
        return `(${type.paramTypes.map(t => this.generateTypeAnnotation(t)).join(', ')}) => ${this.generateTypeAnnotation(type.returnType)}`;
      case 'union':
        return type.types.map(t => this.generateTypeAnnotation(t)).join(' | ');
      case 'intersection':
        return type.types.map(t => this.generateTypeAnnotation(t)).join(' & ');
      case 'generic':
        return `${type.name}<${type.typeArguments.map(t => this.generateTypeAnnotation(t)).join(', ')}>`;
      default: {
        const exhaustiveCheck: never = type;
        return exhaustiveCheck;
      }
    }
  }

  private getIndent(): string {
    return '  '.repeat(this.indent);
  }
}
