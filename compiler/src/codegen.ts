/**
 * Ljos Code Generator using Babel
 * 
 * This module converts Ljos AST to JavaScript using @babel/types to build
 * a Babel AST, then uses @babel/generator to produce the final JavaScript code.
 * 
 * Original string-based codegen is preserved in codegen.backup.ts
 */

import * as AST from './ast';
import * as t from '@babel/types';
import generate from '@babel/generator';

export class CodeGenerator {
  private usesTypeOf = false;
  private stdLibPath = './runtime/std';

  constructor(options?: { stdLibPath?: string }) {
    if (options?.stdLibPath) {
      this.stdLibPath = options.stdLibPath;
    }
  }

  generate(program: AST.Program): string {
    this.usesTypeOf = false;

    const body: t.Statement[] = [];

    for (const stmt of program.body) {
      const generated = this.generateStatement(stmt);
      if (Array.isArray(generated)) {
        body.push(...generated);
      } else {
        body.push(generated);
      }
    }

    // Prepend typeOf import if needed
    if (this.usesTypeOf) {
      const typeOfImport = t.importDeclaration(
        [t.importSpecifier(t.identifier('__ljos_typeOf'), t.identifier('typeOf'))],
        t.stringLiteral(`${this.stdLibPath}/core.js`)
      );
      body.unshift(typeOfImport);
    }

    const babelAst = t.program(body);
    const output = generate(babelAst, { compact: false });
    return output.code;
  }

  private generateStatement(stmt: AST.Statement): t.Statement | t.Statement[] {
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
        return t.expressionStatement(this.generateExpression(stmt.expression));
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
        return t.continueStatement();
      case 'ThrowStatement':
        return t.throwStatement(this.generateExpression(stmt.argument));
      case 'TryStatement':
        return this.generateTryStatement(stmt);
      case 'ImportStatement':
        return this.generateImportStatement(stmt);
      case 'ExportStatement':
        return this.generateExportStatement(stmt);
      case 'TypeAliasDeclaration':
        // Type aliases are compile-time only, emit nothing
        return t.emptyStatement();
      case 'BlockStatement':
        return this.generateBlockStatementAsStatement(stmt);
      case 'DeferStatement':
        return this.generateDeferStatement(stmt);
      case 'UsingStatement':
        return this.generateUsingStatement(stmt);
      default:
        throw new Error(`Unknown statement type: ${(stmt as any).type}`);
    }
  }

  private generateVariableDeclaration(stmt: AST.VariableDeclaration): t.VariableDeclaration {
    const kind = stmt.kind === 'const' ? 'const' : 'let';
    const id = t.identifier(stmt.name);
    const init = stmt.init ? this.generateExpression(stmt.init) : null;
    return t.variableDeclaration(kind, [t.variableDeclarator(id, init)]);
  }

  private generateFunctionDeclaration(stmt: AST.FunctionDeclaration): t.FunctionDeclaration {
    const params = stmt.params.map(p => this.generateParameter(p));
    const body = this.generateBlockStatement(stmt.body);
    return t.functionDeclaration(t.identifier(stmt.name), params, body);
  }

  private generateParameter(param: AST.Parameter): t.Identifier | t.AssignmentPattern {
    const id = t.identifier(param.name);
    if (param.defaultValue) {
      return t.assignmentPattern(id, this.generateExpression(param.defaultValue));
    }
    return id;
  }

  private generateClassDeclaration(stmt: AST.ClassDeclaration): t.Statement[] {
    const classId = t.identifier(stmt.name);
    const superClass = stmt.superClass ? t.identifier(stmt.superClass.name) : null;
    
    const classBody: t.ClassBody['body'] = [];
    let hasConstructor = false;

    for (const member of stmt.body) {
      switch (member.type) {
        case 'ConstructorDeclaration': {
          hasConstructor = true;
          const params = member.params.map(p => this.generateParameter(p));
          const bodyStmts: t.Statement[] = [];
          
          // Add abstract check if needed
          if (stmt.isAbstract) {
            bodyStmts.push(this.createAbstractCheck(stmt.name));
          }
          
          for (const s of member.body.body) {
            const generated = this.generateStatement(s);
            if (Array.isArray(generated)) {
              bodyStmts.push(...generated);
            } else {
              bodyStmts.push(generated);
            }
          }
          
          classBody.push(t.classMethod('constructor', t.identifier('constructor'), params, t.blockStatement(bodyStmts)));
          break;
        }
        case 'MethodDeclaration': {
          if (member.isAbstract || !member.body) break;
          
          const params = member.params.map(p => this.generateParameter(p));
          const body = this.generateBlockStatement(member.body);
          
          if (member.accessibility === 'private') {
            // Use classPrivateMethod for private methods
            const key = t.privateName(t.identifier(member.name));
            const method = t.classPrivateMethod('method', key, params, body, member.isStatic);
            classBody.push(method);
          } else {
            const method = t.classMethod('method', t.identifier(member.name), params, body, false, member.isStatic);
            classBody.push(method);
          }
          break;
        }
        case 'FieldDeclaration': {
          const value = member.init ? this.generateExpression(member.init) : null;
          
          if (member.accessibility === 'private') {
            // Use classPrivateProperty for private fields
            const key = t.privateName(t.identifier(member.name));
            const prop = t.classPrivateProperty(key, value, [], member.isStatic);
            classBody.push(prop);
          } else {
            const prop = t.classProperty(t.identifier(member.name), value, null, null, false, member.isStatic);
            classBody.push(prop);
          }
          break;
        }
      }
    }

    // If abstract class has no explicit constructor, synthesize one
    if (stmt.isAbstract && !hasConstructor) {
      const abstractCheck = this.createAbstractCheck(stmt.name);
      classBody.unshift(
        t.classMethod('constructor', t.identifier('constructor'), [], t.blockStatement([abstractCheck]))
      );
    }

    const classDecl = t.classDeclaration(classId, superClass, t.classBody(classBody));
    const result: t.Statement[] = [classDecl];

    // Handle member decorators
    for (const member of stmt.body) {
      const decorators = (member as any).decorators as AST.Expression[] | undefined;
      if (!decorators || decorators.length === 0) continue;

      let target: t.Expression;
      let key: string;

      switch (member.type) {
        case 'ConstructorDeclaration':
          target = classId;
          key = 'constructor';
          break;
        case 'MethodDeclaration':
          target = member.isStatic ? classId : t.memberExpression(classId, t.identifier('prototype'));
          key = member.name;
          break;
        case 'FieldDeclaration':
          target = member.isStatic ? classId : t.memberExpression(classId, t.identifier('prototype'));
          key = member.name;
          break;
        default:
          continue;
      }

      for (const dec of decorators) {
        const decExpr = this.generateExpression(dec);
        result.push(t.expressionStatement(
          t.callExpression(decExpr, [target, t.stringLiteral(key)])
        ));
      }
    }

    // Handle class decorators
    if (stmt.decorators && stmt.decorators.length > 0) {
      for (const dec of stmt.decorators) {
        const decExpr = this.generateExpression(dec);
        result.push(t.expressionStatement(
          t.assignmentExpression('=', classId, t.callExpression(decExpr, [classId]))
        ));
      }
    }

    return result;
  }

  private createAbstractCheck(className: string): t.IfStatement {
    return t.ifStatement(
      t.binaryExpression('===', t.metaProperty(t.identifier('new'), t.identifier('target')), t.identifier(className)),
      t.blockStatement([
        t.throwStatement(t.newExpression(t.identifier('Error'), [
          t.stringLiteral(`Cannot instantiate abstract class ${className}`)
        ]))
      ])
    );
  }

  private generateEnumDeclaration(stmt: AST.EnumDeclaration): t.Statement[] {
    const hasAssociatedData = stmt.members.some(m => m.associatedData && m.associatedData.length > 0);
    const result: t.Statement[] = [];

    if (hasAssociatedData) {
      // ADT-style enum with associated data
      const properties: t.ObjectProperty[] = [];

      for (const m of stmt.members) {
        if (m.associatedData && m.associatedData.length > 0) {
          // Factory function for variant with associated data
          const params = m.associatedData.map(p => t.identifier(p.name));
          const returnObj = t.objectExpression([
            t.objectProperty(t.identifier('__enum'), t.stringLiteral(stmt.name)),
            t.objectProperty(t.identifier('__variant'), t.stringLiteral(m.name)),
            ...m.associatedData.map(p => t.objectProperty(t.identifier(p.name), t.identifier(p.name), false, true))
          ]);
          properties.push(t.objectProperty(
            t.identifier(m.name),
            t.arrowFunctionExpression(params, returnObj)
          ));
        } else if (m.value) {
          properties.push(t.objectProperty(t.identifier(m.name), this.generateExpression(m.value)));
        } else {
          properties.push(t.objectProperty(
            t.identifier(m.name),
            t.objectExpression([
              t.objectProperty(t.identifier('__enum'), t.stringLiteral(stmt.name)),
              t.objectProperty(t.identifier('__variant'), t.stringLiteral(m.name))
            ])
          ));
        }
      }

      result.push(t.variableDeclaration('const', [
        t.variableDeclarator(t.identifier(stmt.name), t.objectExpression(properties))
      ]));

      // Add __match helper
      const matchFn = t.arrowFunctionExpression(
        [t.identifier('value'), t.identifier('cases')],
        t.blockStatement([
          t.variableDeclaration('const', [
            t.variableDeclarator(
              t.identifier('handler'),
              t.logicalExpression('||',
                t.memberExpression(t.identifier('cases'), t.memberExpression(t.identifier('value'), t.identifier('__variant')), true),
                t.memberExpression(t.identifier('cases'), t.identifier('_'))
              )
            )
          ]),
          t.ifStatement(
            t.unaryExpression('!', t.identifier('handler')),
            t.throwStatement(t.newExpression(t.identifier('Error'), [
              t.templateLiteral(
                [t.templateElement({ raw: 'Unhandled enum variant: ', cooked: 'Unhandled enum variant: ' }), t.templateElement({ raw: '', cooked: '' }, true)],
                [t.memberExpression(t.identifier('value'), t.identifier('__variant'))]
              )
            ]))
          ),
          t.returnStatement(
            t.conditionalExpression(
              t.binaryExpression('===', t.unaryExpression('typeof', t.identifier('handler')), t.stringLiteral('function')),
              t.callExpression(t.identifier('handler'), [t.identifier('value')]),
              t.identifier('handler')
            )
          )
        ])
      );
      result.push(t.expressionStatement(
        t.assignmentExpression('=', t.memberExpression(t.identifier(stmt.name), t.identifier('__match')), matchFn)
      ));

      // Add __is helper
      const isFn = t.arrowFunctionExpression(
        [t.identifier('value'), t.identifier('variant')],
        t.logicalExpression('&&',
          t.logicalExpression('&&',
            t.identifier('value'),
            t.binaryExpression('===', t.memberExpression(t.identifier('value'), t.identifier('__enum')), t.stringLiteral(stmt.name))
          ),
          t.binaryExpression('===', t.memberExpression(t.identifier('value'), t.identifier('__variant')), t.identifier('variant'))
        )
      );
      result.push(t.expressionStatement(
        t.assignmentExpression('=', t.memberExpression(t.identifier(stmt.name), t.identifier('__is')), isFn)
      ));
    } else {
      // Simple enum
      const properties = stmt.members.map(m => {
        const value = m.value ? this.generateExpression(m.value) : t.stringLiteral(m.name);
        return t.objectProperty(t.identifier(m.name), value);
      });
      result.push(t.variableDeclaration('const', [
        t.variableDeclarator(t.identifier(stmt.name), t.objectExpression(properties))
      ]));
    }

    return result;
  }

  private generateIfStatement(stmt: AST.IfStatement): t.IfStatement {
    const test = this.generateExpression(stmt.condition);
    const consequent = this.generateBlockStatement(stmt.consequent);
    
    let alternate: t.Statement | null = null;
    if (stmt.alternate) {
      if (stmt.alternate.type === 'IfStatement') {
        alternate = this.generateIfStatement(stmt.alternate);
      } else {
        alternate = this.generateBlockStatement(stmt.alternate);
      }
    }
    
    return t.ifStatement(test, consequent, alternate);
  }

  private generateForStatement(stmt: AST.ForStatement): t.Statement {
    if (stmt.isForIn && stmt.variable && stmt.iterable) {
      // for-in loop -> for...of in JS
      return t.forOfStatement(
        t.variableDeclaration('const', [t.variableDeclarator(t.identifier(stmt.variable))]),
        this.generateExpression(stmt.iterable),
        this.generateBlockStatement(stmt.body)
      );
    }

    // Infinite loop
    if (!stmt.init && !stmt.condition && !stmt.update) {
      return t.whileStatement(t.booleanLiteral(true), this.generateBlockStatement(stmt.body));
    }

    // Condition-only loop
    if (!stmt.init && stmt.condition && !stmt.update) {
      return t.whileStatement(this.generateExpression(stmt.condition), this.generateBlockStatement(stmt.body));
    }

    // Traditional for loop
    let init: t.VariableDeclaration | t.Expression | null = null;
    if (stmt.init) {
      if ('type' in stmt.init && stmt.init.type === 'VariableDeclaration') {
        const kind = stmt.init.kind === 'const' ? 'const' : 'let';
        init = t.variableDeclaration(kind as 'const' | 'let', [
          t.variableDeclarator(
            t.identifier(stmt.init.name),
            stmt.init.init ? this.generateExpression(stmt.init.init) : null
          )
        ]);
      } else {
        init = this.generateExpression(stmt.init as AST.Expression);
      }
    }

    const test = stmt.condition ? this.generateExpression(stmt.condition) : null;
    const update = stmt.update ? this.generateExpression(stmt.update) : null;

    return t.forStatement(init, test, update, this.generateBlockStatement(stmt.body));
  }

  private generateWhileStatement(stmt: AST.WhileStatement): t.WhileStatement {
    return t.whileStatement(
      this.generateExpression(stmt.condition),
      this.generateBlockStatement(stmt.body)
    );
  }

  private generateDoWhileStatement(stmt: AST.DoWhileStatement): t.DoWhileStatement {
    return t.doWhileStatement(
      this.generateExpression(stmt.condition),
      this.generateBlockStatement(stmt.body)
    );
  }

  private generateWhenStatement(stmt: AST.WhenStatement): t.SwitchStatement {
    const hasDiscriminant = !!stmt.discriminant;
    const discriminant = hasDiscriminant
      ? this.generateExpression(stmt.discriminant as AST.Expression)
      : t.booleanLiteral(true);

    const cases: t.SwitchCase[] = [];

    for (const caseItem of stmt.cases) {
      let test: t.Expression | null = null;
      
      if (caseItem.pattern.type === 'ElsePattern') {
        test = null; // default case
      } else if (caseItem.pattern.type === 'OrPattern' && hasDiscriminant) {
        // Multiple cases fall through to the same body
        for (let i = 0; i < caseItem.pattern.patterns.length - 1; i++) {
          const p = caseItem.pattern.patterns[i];
          cases.push(t.switchCase(this.generatePatternValue(p), []));
        }
        test = this.generatePatternValue(caseItem.pattern.patterns[caseItem.pattern.patterns.length - 1]);
      } else if (caseItem.pattern.type === 'LiteralPattern') {
        test = this.generateExpression(caseItem.pattern.value);
      } else {
        continue; // Skip unsupported patterns
      }

      const consequent: t.Statement[] = [];
      if ('type' in caseItem.body && caseItem.body.type === 'BlockStatement') {
        for (const s of caseItem.body.body) {
          const generated = this.generateStatement(s);
          if (Array.isArray(generated)) {
            consequent.push(...generated);
          } else {
            consequent.push(generated);
          }
        }
      } else {
        consequent.push(t.expressionStatement(this.generateExpression(caseItem.body as AST.Expression)));
      }
      consequent.push(t.breakStatement());

      cases.push(t.switchCase(test, consequent));
    }

    return t.switchStatement(discriminant, cases);
  }

  private generatePatternValue(pattern: AST.Pattern): t.Expression {
    switch (pattern.type) {
      case 'LiteralPattern':
        return this.generateExpression(pattern.value);
      case 'IdentifierPattern':
        return t.identifier(pattern.name);
      default:
        throw new Error(`Unsupported pattern type: ${pattern.type}`);
    }
  }

  private generateReturnStatement(stmt: AST.ReturnStatement): t.ReturnStatement {
    return t.returnStatement(stmt.argument ? this.generateExpression(stmt.argument) : null);
  }

  private generateBreakStatement(stmt: AST.BreakStatement): t.BreakStatement {
    // Note: break with value is not supported in JS
    return t.breakStatement();
  }

  private generateTryStatement(stmt: AST.TryStatement): t.TryStatement {
    const block = this.generateBlockStatement(stmt.block);
    
    // Combine all handlers into one catch block
    if (stmt.handlers.length === 0) {
      return t.tryStatement(block, null, null);
    }

    const handler = stmt.handlers[0];
    const param = t.identifier(handler.param || '_e');
    
    let catchBody: t.BlockStatement;
    if (handler.typeAnnotation) {
      // Type-specific catch - wrap in if
      const typeCheck = t.binaryExpression(
        'instanceof',
        param,
        t.identifier(this.generateTypeAnnotationString(handler.typeAnnotation))
      );
      catchBody = t.blockStatement([
        t.ifStatement(
          typeCheck,
          this.generateBlockStatement(handler.body),
          t.blockStatement([t.throwStatement(param)])
        )
      ]);
    } else {
      catchBody = this.generateBlockStatement(handler.body);
    }

    return t.tryStatement(block, t.catchClause(param, catchBody), null);
  }

  private generateDeferStatement(stmt: AST.DeferStatement): t.ExpressionStatement {
    let deferredExpr: t.Expression;
    if ('type' in stmt.body && stmt.body.type === 'BlockStatement') {
      const body = this.generateBlockStatement(stmt.body);
      deferredExpr = t.arrowFunctionExpression([], body);
    } else {
      deferredExpr = t.arrowFunctionExpression([], this.generateExpression(stmt.body as AST.Expression));
    }
    
    return t.expressionStatement(
      t.callExpression(
        t.memberExpression(t.identifier('__deferred'), t.identifier('push')),
        [deferredExpr]
      )
    );
  }

  private generateUsingStatement(stmt: AST.UsingStatement): t.TryStatement {
    const bodyStmts: t.Statement[] = [
      t.variableDeclaration('const', [
        t.variableDeclarator(t.identifier(stmt.binding), this.generateExpression(stmt.init))
      ])
    ];
    
    for (const s of stmt.body.body) {
      const generated = this.generateStatement(s);
      if (Array.isArray(generated)) {
        bodyStmts.push(...generated);
      } else {
        bodyStmts.push(generated);
      }
    }

    const finalizer = t.blockStatement([
      t.expressionStatement(
        t.logicalExpression('??',
          t.optionalCallExpression(
            t.optionalMemberExpression(t.identifier(stmt.binding), t.identifier('dispose'), false, true),
            [],
            true
          ),
          t.optionalCallExpression(
            t.optionalMemberExpression(t.identifier(stmt.binding), t.identifier('close'), false, true),
            [],
            true
          )
        )
      )
    ]);

    return t.tryStatement(t.blockStatement(bodyStmts), null, finalizer);
  }

  private generateImportStatement(stmt: AST.ImportStatement): t.ImportDeclaration {
    const specifiers: (t.ImportSpecifier | t.ImportDefaultSpecifier | t.ImportNamespaceSpecifier)[] = [];

    for (const spec of stmt.specifiers) {
      switch (spec.type) {
        case 'default':
          specifiers.push(t.importDefaultSpecifier(t.identifier(spec.local)));
          break;
        case 'named':
          specifiers.push(t.importSpecifier(t.identifier(spec.local), t.identifier(spec.imported)));
          break;
        case 'namespace':
          specifiers.push(t.importNamespaceSpecifier(t.identifier(spec.local)));
          break;
      }
    }

    // Convert Ljos import paths
    let source = stmt.source;
    if (source.startsWith('/std/')) {
      const moduleName = source.slice(5);
      source = `${this.stdLibPath}/${moduleName}.js`;
    }

    return t.importDeclaration(specifiers, t.stringLiteral(source));
  }

  private generateExportStatement(stmt: AST.ExportStatement): t.Statement {
    if (stmt.source) {
      return t.exportAllDeclaration(t.stringLiteral(stmt.source));
    }

    if (stmt.isDefault && stmt.declaration) {
      const decl = this.generateStatement(stmt.declaration);
      if (Array.isArray(decl)) {
        // For class declarations with decorators, export the first one
        const first = decl[0];
        if (t.isFunctionDeclaration(first) || t.isClassDeclaration(first)) {
          return t.exportDefaultDeclaration(first);
        }
        // Fallback: wrap in expression
        return t.exportDefaultDeclaration(t.identifier((first as any).id?.name || 'default'));
      }
      if (t.isFunctionDeclaration(decl) || t.isClassDeclaration(decl)) {
        return t.exportDefaultDeclaration(decl);
      }
      if (t.isExpressionStatement(decl)) {
        return t.exportDefaultDeclaration(decl.expression);
      }
      throw new Error('Cannot export this statement type as default');
    }

    if (stmt.declaration) {
      const decl = this.generateStatement(stmt.declaration);
      if (Array.isArray(decl)) {
        // For complex declarations, export named
        const first = decl[0];
        if (t.isFunctionDeclaration(first) || t.isClassDeclaration(first) || t.isVariableDeclaration(first)) {
          return t.exportNamedDeclaration(first, []);
        }
      }
      if (!Array.isArray(decl) && (t.isFunctionDeclaration(decl) || t.isClassDeclaration(decl) || t.isVariableDeclaration(decl))) {
        return t.exportNamedDeclaration(decl, []);
      }
    }

    return t.emptyStatement();
  }

  private generateBlockStatement(stmt: AST.BlockStatement): t.BlockStatement {
    const body: t.Statement[] = [];
    for (const s of stmt.body) {
      const generated = this.generateStatement(s);
      if (Array.isArray(generated)) {
        body.push(...generated);
      } else {
        body.push(generated);
      }
    }
    return t.blockStatement(body);
  }

  private generateBlockStatementAsStatement(stmt: AST.BlockStatement): t.BlockStatement {
    return this.generateBlockStatement(stmt);
  }

  private generateExpression(expr: AST.Expression): t.Expression {
    switch (expr.type) {
      case 'Literal':
        return this.generateLiteral(expr);
      case 'CharLiteral':
        return t.stringLiteral(expr.value);
      case 'Identifier':
        return t.identifier(expr.name);
      case 'BinaryExpression': {
        let operator = expr.operator;
        // Convert == to === and != to !==
        if (operator === '==') operator = '===';
        else if (operator === '!=') operator = '!==';
        return t.binaryExpression(
          operator as t.BinaryExpression['operator'],
          this.generateExpression(expr.left),
          this.generateExpression(expr.right)
        );
      }
      case 'UnaryExpression':
        return t.unaryExpression(
          expr.operator as t.UnaryExpression['operator'],
          this.generateExpression(expr.argument),
          expr.prefix
        );
      case 'CallExpression':
        return this.generateCallExpression(expr);
      case 'NewExpression':
        return this.generateNewExpression(expr);
      case 'MemberExpression':
        return this.generateMemberExpression(expr);
      case 'ArrayExpression':
        return t.arrayExpression(expr.elements.map(e => this.generateExpression(e)));
      case 'ObjectExpression':
        return this.generateObjectExpression(expr);
      case 'ArrowFunctionExpression':
        return this.generateArrowFunction(expr);
      case 'AssignmentExpression':
        return t.assignmentExpression(
          expr.operator as t.AssignmentExpression['operator'],
          this.generateExpression(expr.left) as t.LVal,
          this.generateExpression(expr.right)
        );
      case 'ConditionalExpression':
        return t.conditionalExpression(
          this.generateExpression(expr.test),
          this.generateExpression(expr.consequent),
          this.generateExpression(expr.alternate)
        );
      case 'LogicalExpression':
        return t.logicalExpression(
          expr.operator,
          this.generateExpression(expr.left),
          this.generateExpression(expr.right)
        );
      case 'TemplateStringExpression':
        return this.generateTemplateString(expr);
      case 'TypeCastExpression':
        return this.generateExpression(expr.expression);
      case 'TypeCheckExpression':
        return this.generateTypeCheck(expr);
      case 'RangeExpression':
        return this.generateRangeExpression(expr);
      case 'GoExpression':
        return t.callExpression(
          t.arrowFunctionExpression([], this.generateExpression(expr.argument), true),
          []
        );
      case 'AwaitExpression':
        return t.awaitExpression(this.generateExpression(expr.argument));
      case 'ChannelExpression':
        return this.generateChannelExpression(expr);
      case 'SendExpression':
        return this.generateSendExpression(expr);
      case 'ReceiveExpression':
        return this.generateReceiveExpression(expr);
      case 'WhenExpression':
        return this.generateWhenExpression(expr);
      case 'IfExpression':
        return this.generateIfExpression(expr);
      case 'TypeofExpression':
        this.usesTypeOf = true;
        return t.callExpression(t.identifier('__ljos_typeOf'), [this.generateExpression(expr.argument)]);
      case 'InstanceofExpression':
        return t.binaryExpression('instanceof', this.generateExpression(expr.left), this.generateExpression(expr.right));
      case 'VoidExpression':
        return t.unaryExpression('void', this.generateExpression(expr.argument));
      case 'DeleteExpression':
        return t.unaryExpression('delete', this.generateExpression(expr.argument));
      case 'ThisExpression':
        return t.thisExpression();
      case 'SuperExpression':
        return t.super();
      case 'YieldExpression':
        return t.yieldExpression(
          expr.argument ? this.generateExpression(expr.argument) : null,
          expr.delegate
        );
      default:
        throw new Error(`Unknown expression type: ${(expr as any).type}`);
    }
  }

  private generateLiteral(expr: AST.Literal): t.Expression {
    if (expr.value === null) return t.nullLiteral();
    if (typeof expr.value === 'boolean') return t.booleanLiteral(expr.value);
    if (typeof expr.value === 'number') return t.numericLiteral(expr.value);
    if (typeof expr.value === 'string') return t.stringLiteral(expr.value);
    return t.nullLiteral();
  }

  private generateCallExpression(expr: AST.CallExpression): t.CallExpression {
    return t.callExpression(
      this.generateExpression(expr.callee),
      expr.arguments.map(a => this.generateExpression(a))
    );
  }

  private generateNewExpression(expr: AST.NewExpression): t.NewExpression {
    return t.newExpression(
      this.generateExpression(expr.callee),
      expr.arguments.map(a => this.generateExpression(a))
    );
  }

  private generateMemberExpression(expr: AST.MemberExpression): t.MemberExpression | t.OptionalMemberExpression {
    const object = this.generateExpression(expr.object);
    const property = this.generateExpression(expr.property);

    if (expr.optional) {
      return t.optionalMemberExpression(object, property, expr.computed, true);
    }
    return t.memberExpression(object, property, expr.computed);
  }

  private generateObjectExpression(expr: AST.ObjectExpression): t.ObjectExpression {
    const properties = expr.properties.map(p => {
      const key = this.generateExpression(p.key);
      const value = this.generateExpression(p.value);
      
      // Check for shorthand
      const shorthand = p.key.type === 'Identifier' && p.value.type === 'Identifier' && p.key.name === p.value.name;
      
      // Computed property if key is not an identifier
      const computed = p.key.type !== 'Identifier';
      
      return t.objectProperty(key, value, computed, shorthand);
    });
    return t.objectExpression(properties);
  }

  private generateArrowFunction(expr: AST.ArrowFunctionExpression): t.ArrowFunctionExpression {
    const params = expr.params.map(p => this.generateParameter(p));
    
    if ('type' in expr.body && expr.body.type === 'BlockStatement') {
      return t.arrowFunctionExpression(params, this.generateBlockStatement(expr.body));
    }
    return t.arrowFunctionExpression(params, this.generateExpression(expr.body as AST.Expression));
  }

  private generateTemplateString(expr: AST.TemplateStringExpression): t.TemplateLiteral {
    const quasis: t.TemplateElement[] = [];
    const expressions: t.Expression[] = [];
    
    let currentString = '';
    
    for (let i = 0; i < expr.parts.length; i++) {
      const part = expr.parts[i];
      if (typeof part === 'string') {
        currentString += part;
      } else {
        quasis.push(t.templateElement({ raw: currentString, cooked: currentString }, false));
        currentString = '';
        expressions.push(this.generateExpression(part));
      }
    }
    
    // Add final quasi
    quasis.push(t.templateElement({ raw: currentString, cooked: currentString }, true));
    
    return t.templateLiteral(quasis, expressions);
  }

  private generateTypeCheck(expr: AST.TypeCheckExpression): t.Expression {
    const value = this.generateExpression(expr.expression);
    const type = expr.typeAnnotation;

    if (type.kind === 'simple') {
      switch (type.name) {
        case 'int':
          return t.logicalExpression('&&',
            t.binaryExpression('===', t.unaryExpression('typeof', value), t.stringLiteral('number')),
            t.callExpression(t.memberExpression(t.identifier('Number'), t.identifier('isInteger')), [value])
          );
        case 'float':
          return t.binaryExpression('===', t.unaryExpression('typeof', value), t.stringLiteral('number'));
        case 'str':
          return t.binaryExpression('===', t.unaryExpression('typeof', value), t.stringLiteral('string'));
        case 'bool':
          return t.binaryExpression('===', t.unaryExpression('typeof', value), t.stringLiteral('boolean'));
        case 'nul':
          return t.binaryExpression('===', value, t.nullLiteral());
        default:
          return t.binaryExpression('instanceof', value, t.identifier(type.name));
      }
    }

    if (type.kind === 'array') {
      return t.callExpression(t.memberExpression(t.identifier('Array'), t.identifier('isArray')), [value]);
    }

    return t.booleanLiteral(true);
  }

  private generateRangeExpression(expr: AST.RangeExpression): t.CallExpression {
    const start = this.generateExpression(expr.start);
    const end = this.generateExpression(expr.end);
    
    const lengthExpr = expr.inclusive
      ? t.binaryExpression('+', t.binaryExpression('-', end, start), t.numericLiteral(1))
      : t.binaryExpression('-', end, start);

    return t.callExpression(
      t.memberExpression(t.identifier('Array'), t.identifier('from')),
      [
        t.objectExpression([t.objectProperty(t.identifier('length'), lengthExpr)]),
        t.arrowFunctionExpression(
          [t.identifier('_'), t.identifier('i')],
          t.binaryExpression('+', start, t.identifier('i'))
        )
      ]
    );
  }

  private generateChannelExpression(expr: AST.ChannelExpression): t.NewExpression {
    const bufferSize = expr.bufferSize ? this.generateExpression(expr.bufferSize) : t.numericLiteral(0);
    return t.newExpression(t.identifier('Channel'), [bufferSize]);
  }

  private generateSendExpression(expr: AST.SendExpression): t.CallExpression {
    return t.callExpression(
      t.memberExpression(this.generateExpression(expr.channel), t.identifier('send')),
      [this.generateExpression(expr.value)]
    );
  }

  private generateReceiveExpression(expr: AST.ReceiveExpression): t.AwaitExpression {
    return t.awaitExpression(
      t.callExpression(
        t.memberExpression(this.generateExpression(expr.channel), t.identifier('receive')),
        []
      )
    );
  }

  private generateWhenExpression(expr: AST.WhenExpression): t.CallExpression {
    const hasDiscriminant = !!expr.discriminant;
    const discriminant = hasDiscriminant
      ? this.generateExpression(expr.discriminant as AST.Expression)
      : t.booleanLiteral(true);

    const cases: t.SwitchCase[] = [];

    for (const caseItem of expr.cases) {
      let test: t.Expression | null = null;
      
      if (caseItem.pattern.type === 'ElsePattern') {
        test = null;
      } else if (caseItem.pattern.type === 'OrPattern' && hasDiscriminant) {
        for (let i = 0; i < caseItem.pattern.patterns.length - 1; i++) {
          cases.push(t.switchCase(this.generatePatternValue(caseItem.pattern.patterns[i]), []));
        }
        test = this.generatePatternValue(caseItem.pattern.patterns[caseItem.pattern.patterns.length - 1]);
      } else if (caseItem.pattern.type === 'LiteralPattern') {
        test = this.generateExpression(caseItem.pattern.value);
      } else {
        continue;
      }

      const consequent: t.Statement[] = [];
      if ('type' in caseItem.body && caseItem.body.type === 'BlockStatement') {
        for (const s of caseItem.body.body) {
          const generated = this.generateStatement(s);
          if (Array.isArray(generated)) {
            consequent.push(...generated);
          } else {
            consequent.push(generated);
          }
        }
      } else {
        consequent.push(t.returnStatement(this.generateExpression(caseItem.body as AST.Expression)));
      }
      consequent.push(t.breakStatement());

      cases.push(t.switchCase(test, consequent));
    }

    const switchStmt = t.switchStatement(discriminant, cases);
    return t.callExpression(
      t.arrowFunctionExpression([], t.blockStatement([switchStmt])),
      []
    );
  }

  private generateIfExpression(expr: AST.IfExpression): t.ConditionalExpression {
    return t.conditionalExpression(
      this.generateExpression(expr.condition),
      this.generateExpression(expr.consequent),
      this.generateExpression(expr.alternate)
    );
  }

  private generateTypeAnnotationString(type: AST.TypeAnnotation): string {
    switch (type.kind) {
      case 'simple':
        return type.name;
      case 'array':
        return `${this.generateTypeAnnotationString(type.elementType)}[]`;
      case 'map':
        return `Map<${this.generateTypeAnnotationString(type.keyType)}, ${this.generateTypeAnnotationString(type.valueType)}>`;
      case 'object':
        if (type.properties.length === 0) return '{}';
        return '{ ' + type.properties.map(prop => {
          const optional = prop.optional ? '?' : '';
          return `${prop.key}${optional}: ${this.generateTypeAnnotationString(prop.type)}`;
        }).join('; ') + ' }';
      case 'tuple':
        return `[${type.elementTypes.map(t => this.generateTypeAnnotationString(t)).join(', ')}]`;
      case 'function':
        return `(${type.paramTypes.map(t => this.generateTypeAnnotationString(t)).join(', ')}) => ${this.generateTypeAnnotationString(type.returnType)}`;
      case 'union':
        return type.types.map(t => this.generateTypeAnnotationString(t)).join(' | ');
      case 'intersection':
        return type.types.map(t => this.generateTypeAnnotationString(t)).join(' & ');
      case 'generic':
        return `${type.name}<${type.typeArguments.map(t => this.generateTypeAnnotationString(t)).join(', ')}>`;
      default: {
        const exhaustiveCheck: never = type;
        return exhaustiveCheck;
      }
    }
  }
}
