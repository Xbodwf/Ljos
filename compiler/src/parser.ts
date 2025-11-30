import { Token, TokenType } from './tokens';
import { Lexer } from './lexer';
import * as AST from './ast';

export class ParserError extends Error {
  constructor(message: string, public token: Token) {
    super(`Parser Error at ${token.line}:${token.column}: ${message}`);
    this.name = 'ParserError';
  }
}

export class Parser {
  private tokens: Token[];
  private current = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parse(): AST.Program {
    const body: AST.Statement[] = [];
    
    while (!this.isAtEnd()) {
      const stmt = this.declaration();
      if (stmt) body.push(stmt);
    }

    return { type: 'Program', body };
  }

  private declaration(): AST.Statement | null {
    try {
      let decorators: AST.Expression[] | undefined;
      if (this.check(TokenType.AT)) {
        decorators = this.decorators();
      }

      if (this.check(TokenType.IMPORT)) return this.importStatement();
      if (this.check(TokenType.EXPORT)) return this.exportStatement();
      if (this.check(TokenType.ABSTRACT) || this.check(TokenType.CLASS)) return this.classDeclaration(decorators);
      if (this.check(TokenType.ENUM)) return this.enumDeclaration();
      if (this.check(TokenType.FN)) return this.functionDeclaration();
      if (this.check(TokenType.CONST) || this.check(TokenType.MUT)) return this.variableDeclaration();
      if (this.check(TokenType.TYPE)) return this.typeAliasDeclaration();
      return this.statement();
    } catch (error) {
      this.synchronize();
      throw error;
    }
  }

  private importStatement(): AST.ImportStatement {
    this.advance(); // consume 'import'
    
    const specifiers: AST.ImportSpecifier[] = [];
    
    if (this.check(TokenType.LBRACE)) {
      // Named imports: import { a, b } from "mod"
      this.advance();
      do {
        const imported = this.consume(TokenType.IDENTIFIER, 'Expected identifier').value;
        let local = imported;
        if (this.match(TokenType.AS)) {
          local = this.consume(TokenType.IDENTIFIER, 'Expected identifier').value;
        }
        specifiers.push({ type: 'named', imported, local });
      } while (this.match(TokenType.COMMA));
      this.consume(TokenType.RBRACE, "Expected '}'");
    } else if (this.check(TokenType.STAR)) {
      // Namespace import: import * as ns from "mod"
      this.advance();
      this.consume(TokenType.AS, "Expected 'as'");
      const local = this.consume(TokenType.IDENTIFIER, 'Expected identifier').value;
      specifiers.push({ type: 'namespace', local });
    } else {
      // Default import: import mod from "mod"
      const local = this.consume(TokenType.IDENTIFIER, 'Expected identifier').value;
      specifiers.push({ type: 'default', local });
    }

    this.consume(TokenType.COLON, "Expected ':'");
    const source = this.consume(TokenType.STRING, 'Expected string literal').value;

    return { type: 'ImportStatement', specifiers, source };
  }

  private exportStatement(): AST.ExportStatement {
    this.advance(); // consume 'export'

    if (this.match(TokenType.DEFAULT)) {
      const declaration = this.expression();
      return { type: 'ExportStatement', declaration: { type: 'ExpressionStatement', expression: declaration }, isDefault: true };
    }

    if (this.match(TokenType.STAR)) {
      this.consume(TokenType.COLON, "Expected ':'");
      const source = this.consume(TokenType.STRING, 'Expected string literal').value;
      return { type: 'ExportStatement', source };
    }

    const declaration = this.declaration();
    if (!declaration) {
      throw new ParserError('Expected declaration after export', this.peek());
    }
    return { type: 'ExportStatement', declaration };
  }

  private functionDeclaration(isExported = false): AST.FunctionDeclaration {
    this.advance(); // consume 'fn'
    
    const name = this.consume(TokenType.IDENTIFIER, 'Expected function name').value;

    let typeParameters: string[] | undefined;
    if (this.match(TokenType.LT)) {
      typeParameters = [];
      do {
        const paramName = this.consume(TokenType.IDENTIFIER, 'Expected type parameter name').value;
        typeParameters.push(paramName);
      } while (this.match(TokenType.COMMA));
      this.consume(TokenType.GT, "Expected '>'");
    }

    this.consume(TokenType.LPAREN, "Expected '('");
    
    const params = this.parameterList();
    
    this.consume(TokenType.RPAREN, "Expected ')'");

    let returnType: AST.TypeAnnotation | undefined;
    if (this.match(TokenType.COLON)) {
      returnType = this.typeAnnotation();
    }

    const body = this.blockStatement();

    return { type: 'FunctionDeclaration', name, typeParameters, params, returnType, body, isExported };
  }

  private classDeclaration(decorators?: AST.Expression[]): AST.ClassDeclaration {
    let isAbstract = false;
    if (this.check(TokenType.ABSTRACT)) {
      this.advance(); // consume 'abstract'
      isAbstract = true;
    }

    this.consume(TokenType.CLASS, "Expected 'class'");
    const name = this.consume(TokenType.IDENTIFIER, 'Expected class name').value;

    let superClass: AST.Identifier | undefined;
    if (this.match(TokenType.EXTENDS)) {
      const superName = this.consume(TokenType.IDENTIFIER, 'Expected superclass name').value;
      superClass = { type: 'Identifier', name: superName };
    }

    let implementsList: AST.Identifier[] | undefined;
    if (this.match(TokenType.IMPLEMENTS)) {
      implementsList = [];
      do {
        const ifaceName = this.consume(TokenType.IDENTIFIER, 'Expected interface name').value;
        implementsList.push({ type: 'Identifier', name: ifaceName });
      } while (this.match(TokenType.COMMA));
    }

    this.consume(TokenType.LBRACE, "Expected '{' after class header");

    const body: AST.ClassMember[] = [];
    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      let memberDecorators: AST.Expression[] | undefined;
      if (this.check(TokenType.AT)) {
        memberDecorators = this.decorators();
      }

      let isStatic = false;
      if (this.match(TokenType.STATIC)) {
        isStatic = true;
      }

      if (this.check(TokenType.ABSTRACT)) {
        this.advance(); // consume 'abstract'
        this.consume(TokenType.FN, "Expected 'fn' after 'abstract' in class body");
        body.push(this.abstractMethodDeclaration(isStatic, memberDecorators));
      } else if (this.check(TokenType.FN)) {
        body.push(this.methodDeclaration(isStatic, memberDecorators));
      } else if (this.check(TokenType.CONST) || this.check(TokenType.MUT)) {
        body.push(this.fieldDeclaration(isStatic, memberDecorators));
      } else if (this.check(TokenType.CONSTRUCTOR)) {
        body.push(this.constructorDeclaration(memberDecorators));
      } else {
        throw new ParserError('Unexpected token in class body', this.peek());
      }
    }

    this.consume(TokenType.RBRACE, "Expected '}' after class body");

    return { type: 'ClassDeclaration', name, isAbstract, superClass, implements: implementsList, body, decorators };
  }

  private methodDeclaration(isStatic: boolean, decorators?: AST.Expression[]): AST.MethodDeclaration {
    this.advance(); // consume 'fn'
    const name = this.consume(TokenType.IDENTIFIER, 'Expected method name').value;

    this.consume(TokenType.LPAREN, "Expected '('");
    const params = this.parameterList();
    this.consume(TokenType.RPAREN, "Expected ')'");

    let returnType: AST.TypeAnnotation | undefined;
    if (this.match(TokenType.COLON)) {
      returnType = this.typeAnnotation();
    }

    const body = this.blockStatement();
    return { type: 'MethodDeclaration', name, params, returnType, body, isStatic, decorators };
  }

  private abstractMethodDeclaration(isStatic: boolean, decorators?: AST.Expression[]): AST.MethodDeclaration {
    const name = this.consume(TokenType.IDENTIFIER, 'Expected method name').value;

    this.consume(TokenType.LPAREN, "Expected '('");
    const params = this.parameterList();
    this.consume(TokenType.RPAREN, "Expected ')'");

    let returnType: AST.TypeAnnotation | undefined;
    if (this.match(TokenType.COLON)) {
      returnType = this.typeAnnotation();
    }

    // Optional semicolon after abstract method signature
    this.match(TokenType.SEMICOLON);

    return { type: 'MethodDeclaration', name, params, returnType, isStatic, isAbstract: true, decorators };
  }

  private fieldDeclaration(isStatic: boolean, decorators?: AST.Expression[]): AST.FieldDeclaration {
    const kind = this.advance().type === TokenType.CONST ? 'const' : 'mut';
    const name = this.consume(TokenType.IDENTIFIER, 'Expected field name').value;

    let typeAnnotation: AST.TypeAnnotation | undefined;
    if (this.match(TokenType.COLON)) {
      typeAnnotation = this.typeAnnotation();
    }

    let init: AST.Expression | undefined;
    if (this.match(TokenType.ASSIGN)) {
      init = this.assignmentExpression();
    }

    return { type: 'FieldDeclaration', name, kind, typeAnnotation, init, isStatic, decorators };
  }

  private constructorDeclaration(decorators?: AST.Expression[]): AST.ConstructorDeclaration {
    this.consume(TokenType.CONSTRUCTOR, "Expected 'constructor'");
    this.consume(TokenType.LPAREN, "Expected '('");
    const params = this.parameterList();
    this.consume(TokenType.RPAREN, "Expected ')'");

    const body = this.blockStatement();
    return { type: 'ConstructorDeclaration', params, body, decorators };
  }

  private decorators(): AST.Expression[] {
    const decorators: AST.Expression[] = [];
    while (this.match(TokenType.AT)) {
      const nameToken = this.consume(TokenType.IDENTIFIER, 'Expected decorator name');
      let expr: AST.Expression = { type: 'Identifier', name: nameToken.value };

      if (this.match(TokenType.LPAREN)) {
        const args: AST.Expression[] = [];
        if (!this.check(TokenType.RPAREN)) {
          do {
            args.push(this.assignmentExpression());
          } while (this.match(TokenType.COMMA));
        }
        this.consume(TokenType.RPAREN, "Expected ')' after decorator arguments");
        expr = { type: 'CallExpression', callee: expr, arguments: args };
      }

      decorators.push(expr);
    }
    return decorators;
  }

  private enumDeclaration(): AST.EnumDeclaration {
    this.advance(); // consume 'enum'
    const name = this.consume(TokenType.IDENTIFIER, 'Expected enum name').value;

    this.consume(TokenType.LBRACE, "Expected '{' after enum name");
    const members: { name: string }[] = [];

    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      const memberName = this.consume(TokenType.IDENTIFIER, 'Expected enum member name').value;
      members.push({ name: memberName });

      if (!this.match(TokenType.COMMA)) {
        break;
      }
    }

    this.consume(TokenType.RBRACE, "Expected '}' after enum members");
    return { type: 'EnumDeclaration', name, members };
  }

  private parameterList(): AST.Parameter[] {
    const params: AST.Parameter[] = [];
    
    if (!this.check(TokenType.RPAREN)) {
      do {
        const name = this.consume(TokenType.IDENTIFIER, 'Expected parameter name').value;
        let typeAnnotation: AST.TypeAnnotation | undefined;
        let defaultValue: AST.Expression | undefined;

        if (this.match(TokenType.COLON)) {
          typeAnnotation = this.typeAnnotation();
        }

        if (this.match(TokenType.ASSIGN)) {
          defaultValue = this.expression();
        }

        params.push({ name, typeAnnotation, defaultValue });
      } while (this.match(TokenType.COMMA));
    }

    return params;
  }

  private variableDeclaration(): AST.VariableDeclaration {
    const kind = this.advance().type === TokenType.CONST ? 'const' : 'mut';
    const name = this.consume(TokenType.IDENTIFIER, 'Expected variable name').value;

    let typeAnnotation: AST.TypeAnnotation | undefined;
    if (this.match(TokenType.COLON)) {
      typeAnnotation = this.typeAnnotation();
    }

    let init: AST.Expression | undefined;
    if (this.match(TokenType.ASSIGN)) {
      init = this.assignmentExpression();
    } else if (!typeAnnotation) {
      // Must have either type annotation or initializer
      throw new ParserError("Expected '=' or type annotation", this.peek());
    }

    return { type: 'VariableDeclaration', kind, name, typeAnnotation, init };
  }

  private typeAliasDeclaration(): AST.TypeAliasDeclaration {
    this.advance(); // consume 'type'
    const name = this.consume(TokenType.IDENTIFIER, 'Expected type name').value;

    let typeParameters: string[] | undefined;
    if (this.match(TokenType.LT)) {
      typeParameters = [];
      do {
        const paramName = this.consume(TokenType.IDENTIFIER, 'Expected type parameter name').value;
        typeParameters.push(paramName);
      } while (this.match(TokenType.COMMA));
      this.consume(TokenType.GT, "Expected '>'");
    }

    this.consume(TokenType.ASSIGN, "Expected '='");
    const typeAnnotation = this.typeAnnotation();
    return { type: 'TypeAliasDeclaration', name, typeParameters, typeAnnotation };
  }

  private statement(): AST.Statement {
    if (this.check(TokenType.IF)) return this.ifStatement();
    if (this.check(TokenType.FOR)) return this.forStatement();
    if (this.check(TokenType.WHILE)) return this.whileStatement();
    if (this.check(TokenType.DO)) return this.doWhileStatement();
    if (this.check(TokenType.WHEN)) return this.whenStatement();
    if (this.check(TokenType.RETURN)) return this.returnStatement();
    if (this.check(TokenType.BREAK)) return this.breakStatement();
    if (this.check(TokenType.CONTINUE)) return this.continueStatement();
    if (this.check(TokenType.THROW)) return this.throwStatement();
    if (this.check(TokenType.TRY)) return this.tryStatement();
    if (this.check(TokenType.DEFER)) return this.deferStatement();
    if (this.check(TokenType.USING)) return this.usingStatement();
    if (this.check(TokenType.LBRACE)) return this.blockStatement();
    
    return this.expressionStatement();
  }

  private ifStatement(): AST.IfStatement {
    this.advance(); // consume 'if'
    this.consume(TokenType.LPAREN, "Expected '('");
    const condition = this.expression();
    this.consume(TokenType.RPAREN, "Expected ')'");
    
    const consequent = this.blockStatement();
    
    let alternate: AST.IfStatement | AST.BlockStatement | undefined;
    if (this.match(TokenType.ELSE)) {
      if (this.check(TokenType.LPAREN)) {
        // else (condition) { ... } - treated as else if
        this.consume(TokenType.LPAREN, "Expected '('");
        const elseCondition = this.expression();
        this.consume(TokenType.RPAREN, "Expected ')'");
        const elseConsequent = this.blockStatement();
        
        let elseAlternate: AST.IfStatement | AST.BlockStatement | undefined;
        if (this.match(TokenType.ELSE)) {
          if (this.check(TokenType.LPAREN)) {
            elseAlternate = this.ifStatement();
          } else {
            elseAlternate = this.blockStatement();
          }
        }
        
        alternate = {
          type: 'IfStatement',
          condition: elseCondition,
          consequent: elseConsequent,
          alternate: elseAlternate
        };
      } else if (this.check(TokenType.IF)) {
        alternate = this.ifStatement();
      } else {
        alternate = this.blockStatement();
      }
    }

    return { type: 'IfStatement', condition, consequent, alternate };
  }

  private whileStatement(): AST.WhileStatement {
    this.advance(); // consume 'while'
    this.consume(TokenType.LPAREN, "Expected '('");
    const condition = this.expression();
    this.consume(TokenType.RPAREN, "Expected ')'");
    const body = this.blockStatement();
    return { type: 'WhileStatement', condition, body };
  }

  private doWhileStatement(): AST.DoWhileStatement {
    this.advance(); // consume 'do'
    const body = this.blockStatement();
    this.consume(TokenType.WHILE, "Expected 'while'");
    this.consume(TokenType.LPAREN, "Expected '('");
    const condition = this.expression();
    this.consume(TokenType.RPAREN, "Expected ')'");
    return { type: 'DoWhileStatement', body, condition };
  }

  private forStatement(): AST.ForStatement {
    this.advance(); // consume 'for'

    // Infinite loop: for { ... }
    if (this.check(TokenType.LBRACE)) {
      const body = this.blockStatement();
      return { type: 'ForStatement', body, isForIn: false };
    }

    this.consume(TokenType.LPAREN, "Expected '('");

    // Check for for-in loop: for (x in iterable)
    if (this.check(TokenType.IDENTIFIER) && this.peekNext()?.type === TokenType.IN) {
      const variable = this.consume(TokenType.IDENTIFIER, 'Expected identifier').value;
      this.consume(TokenType.IN, "Expected 'in'");
      const iterable = this.expression();
      this.consume(TokenType.RPAREN, "Expected ')'");
      const body = this.blockStatement();
      return { type: 'ForStatement', variable, iterable, body, isForIn: true };
    }

    // Traditional for loop or condition loop
    let init: AST.VariableDeclaration | AST.Expression | undefined;
    let condition: AST.Expression | undefined;
    let update: AST.Expression | undefined;

    // Check if it's a simple condition loop: for (condition)
    if (!this.check(TokenType.SEMICOLON) && !this.check(TokenType.CONST) && !this.check(TokenType.MUT)) {
      const expr = this.assignmentExpression();
      if (this.check(TokenType.RPAREN)) {
        // Simple condition loop - but need to handle comma as logical AND here
        // Re-parse with full expression if needed
        this.consume(TokenType.RPAREN, "Expected ')'");
        const body = this.blockStatement();
        return { type: 'ForStatement', condition: expr, body, isForIn: false };
      }
      // It's the init part of traditional for
      init = expr as AST.Expression;
    } else if (this.check(TokenType.CONST) || this.check(TokenType.MUT)) {
      init = this.variableDeclaration();
    }

    this.consume(TokenType.SEMICOLON, "Expected ';'");

    if (!this.check(TokenType.SEMICOLON)) {
      condition = this.assignmentExpression();
    }

    this.consume(TokenType.SEMICOLON, "Expected ';'");

    if (!this.check(TokenType.RPAREN)) {
      update = this.assignmentExpression();
    }

    this.consume(TokenType.RPAREN, "Expected ')'");
    const body = this.blockStatement();

    return { type: 'ForStatement', init, condition, update, body, isForIn: false };
  }

  private whenStatement(): AST.WhenStatement {
    this.advance(); // consume 'when'

    const { discriminant, cases } = this.parseWhenBody(true);

    return { type: 'WhenStatement', discriminant, cases };
  }

  private whenExpression(): AST.WhenExpression {
    this.advance(); // consume 'when'

    const { discriminant, cases } = this.parseWhenBody(false);

    return { type: 'WhenExpression', discriminant, cases };
  }

  private parseWhenBody(allowBlockWithoutArrow: boolean): { discriminant?: AST.Expression; cases: AST.WhenCase[] } {
    let discriminant: AST.Expression | undefined;
    if (this.match(TokenType.LPAREN)) {
      discriminant = this.expression();
      this.consume(TokenType.RPAREN, "Expected ')'");
    }

    this.consume(TokenType.LBRACE, "Expected '{'");
    
    const cases: AST.WhenCase[] = [];
    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      let pattern: AST.Pattern;
      let guard: AST.Expression | undefined;

      if (discriminant) {
        // With discriminant: parse patterns
        pattern = this.pattern();
        
        if (this.match(TokenType.WHERE)) {
          guard = this.expression();
        }
      } else {
        // Without discriminant: parse expressions as conditions
        if (this.match(TokenType.ELSE)) {
          pattern = { type: 'ElsePattern' };
        } else {
          // Parse the condition expression
          const condExpr = this.assignmentExpression();
          // Wrap it as a literal pattern for code generation
          pattern = { type: 'LiteralPattern', value: condExpr };
        }
      }

      let body: AST.Expression | AST.BlockStatement;

      // For when *statements*, allow omitting '=>' when the body is a block: pattern { ... }
      if (allowBlockWithoutArrow && this.check(TokenType.LBRACE)) {
        body = this.blockStatement();
      } else {
        this.consume(TokenType.ARROW, "Expected '=>'");

        if (this.check(TokenType.LBRACE)) {
          body = this.blockStatement();
        } else {
          body = this.assignmentExpression();
        }
      }

      cases.push({ pattern, guard, body });

      // Optional comma between cases
      if (this.match(TokenType.COMMA)) {
        continue;
      }
    }

    this.consume(TokenType.RBRACE, "Expected '}'");

    return { discriminant, cases };
  }

  private pattern(): AST.Pattern {
    // else pattern
    if (this.match(TokenType.ELSE)) {
      return { type: 'ElsePattern' };
    }

    // Array pattern
    if (this.check(TokenType.LBRACKET)) {
      this.advance();
      const elements: AST.Pattern[] = [];
      if (!this.check(TokenType.RBRACKET)) {
        do {
          elements.push(this.pattern());
        } while (this.match(TokenType.COMMA));
      }
      this.consume(TokenType.RBRACKET, "Expected ']'");
      return { type: 'ArrayPattern', elements };
    }

    // Object pattern
    if (this.check(TokenType.LBRACE)) {
      this.advance();
      const properties: { key: string; value: AST.Pattern }[] = [];
      if (!this.check(TokenType.RBRACE)) {
        do {
          const key = this.consume(TokenType.IDENTIFIER, 'Expected property name').value;
          this.consume(TokenType.COLON, "Expected ':'");
          const value = this.pattern();
          properties.push({ key, value });
        } while (this.match(TokenType.COMMA));
      }
      this.consume(TokenType.RBRACE, "Expected '}'");
      return { type: 'ObjectPattern', properties };
    }

    // Literal or identifier pattern with possible type check
    const expr = this.primary();
    
    // Type pattern: n is int
    if (this.match(TokenType.IS)) {
      const typeAnnotation = this.typeAnnotation();
      const name = (expr as AST.Identifier).name;
      return { type: 'TypePattern', name, typeAnnotation };
    }

    // Or pattern: 1 | 2 | 3
    if (this.check(TokenType.PIPE)) {
      const patterns: AST.Pattern[] = [this.exprToPattern(expr)];
      while (this.match(TokenType.PIPE)) {
        patterns.push(this.exprToPattern(this.primary()));
      }
      return { type: 'OrPattern', patterns };
    }

    return this.exprToPattern(expr);
  }

  private exprToPattern(expr: AST.Expression): AST.Pattern {
    if (expr.type === 'Identifier') {
      return { type: 'IdentifierPattern', name: expr.name };
    }
    if (expr.type === 'Literal') {
      return { type: 'LiteralPattern', value: expr };
    }
    throw new ParserError('Invalid pattern', this.peek());
  }

  private returnStatement(): AST.ReturnStatement {
    this.advance(); // consume 'return'
    let argument: AST.Expression | undefined;
    
    if (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      argument = this.expression();
    }

    return { type: 'ReturnStatement', argument };
  }

  private breakStatement(): AST.BreakStatement {
    this.advance(); // consume 'break'
    let argument: AST.Expression | undefined;
    
    // Don't try to parse expression if we're at a switch boundary (case/default) or block end
    if (!this.check(TokenType.RBRACE) && !this.check(TokenType.CASE) && 
        !this.check(TokenType.DEFAULT) && !this.isAtEnd()) {
      argument = this.expression();
    }

    return { type: 'BreakStatement', argument };
  }

  private continueStatement(): AST.ContinueStatement {
    this.advance(); // consume 'continue'
    return { type: 'ContinueStatement' };
  }

  private throwStatement(): AST.ThrowStatement {
    this.advance(); // consume 'throw'
    const argument = this.expression();
    return { type: 'ThrowStatement', argument };
  }

  private tryStatement(): AST.TryStatement {
    this.advance(); // consume 'try'
    const block = this.blockStatement();
    
    const handlers: AST.CatchClause[] = [];
    while (this.match(TokenType.CATCH)) {
      let param: string | undefined;
      let typeAnnotation: AST.TypeAnnotation | undefined;

      if (this.match(TokenType.LPAREN)) {
        param = this.consume(TokenType.IDENTIFIER, 'Expected parameter name').value;
        if (this.match(TokenType.COLON)) {
          typeAnnotation = this.typeAnnotation();
        }
        this.consume(TokenType.RPAREN, "Expected ')'");
      }

      const body = this.blockStatement();
      handlers.push({ param, typeAnnotation, body });
    }

    return { type: 'TryStatement', block, handlers };
  }

  private deferStatement(): AST.DeferStatement {
    this.advance(); // consume 'defer'
    
    let body: AST.Expression | AST.BlockStatement;
    if (this.check(TokenType.LBRACE)) {
      body = this.blockStatement();
    } else {
      body = this.expression();
    }

    return { type: 'DeferStatement', body };
  }

  private usingStatement(): AST.UsingStatement {
    this.advance(); // consume 'using'
    this.consume(TokenType.LPAREN, "Expected '('");
    
    const binding = this.consume(TokenType.IDENTIFIER, 'Expected identifier').value;
    this.consume(TokenType.ASSIGN, "Expected '='");
    const init = this.expression();
    
    this.consume(TokenType.RPAREN, "Expected ')'");
    const body = this.blockStatement();

    return { type: 'UsingStatement', binding, init, body };
  }

  private blockStatement(): AST.BlockStatement {
    this.consume(TokenType.LBRACE, "Expected '{'");
    
    const body: AST.Statement[] = [];
    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      const stmt = this.declaration();
      if (stmt) body.push(stmt);
    }

    this.consume(TokenType.RBRACE, "Expected '}'");
    return { type: 'BlockStatement', body };
  }

  private expressionStatement(): AST.ExpressionStatement {
    const expression = this.expression();
    return { type: 'ExpressionStatement', expression };
  }

  // Expression parsing with precedence climbing
  private expression(): AST.Expression {
    return this.assignment();
  }

  private assignment(): AST.Expression {
    const expr = this.ternary();

    if (this.match(TokenType.ASSIGN, TokenType.PLUS_ASSIGN, TokenType.MINUS_ASSIGN,
                   TokenType.STAR_ASSIGN, TokenType.SLASH_ASSIGN, TokenType.PERCENT_ASSIGN)) {
      const operator = this.previous().value;
      const right = this.assignment();
      return { type: 'AssignmentExpression', operator, left: expr, right };
    }

    return expr;
  }

  private ternary(): AST.Expression {
    // Handle if expression: if (cond) a else b
    if (this.check(TokenType.IF)) {
      return this.ifExpression();
    }
    return this.logicalOr();
  }

  private ifExpression(): AST.Expression {
    this.advance(); // consume 'if'
    this.consume(TokenType.LPAREN, "Expected '('");
    const test = this.expression();
    this.consume(TokenType.RPAREN, "Expected ')'");
    const consequent = this.expression();
    this.consume(TokenType.ELSE, "Expected 'else'");
    const alternate = this.expression();
    return { type: 'ConditionalExpression', test, consequent, alternate };
  }

  // Parse expression without treating comma/semicolon as logical operators
  // Used in array literals, function arguments, object literals, etc.
  private assignmentExpression(): AST.Expression {
    const expr = this.conditionalExpression();

    if (this.match(TokenType.ASSIGN, TokenType.PLUS_ASSIGN, TokenType.MINUS_ASSIGN,
                   TokenType.STAR_ASSIGN, TokenType.SLASH_ASSIGN, TokenType.PERCENT_ASSIGN)) {
      const operator = this.previous().value;
      const right = this.assignmentExpression();
      return { type: 'AssignmentExpression', operator, left: expr, right };
    }

    return expr;
  }

  private conditionalExpression(): AST.Expression {
    // Handle if expression: if (cond) a else b
    if (this.check(TokenType.IF)) {
      return this.ifExpression();
    }
    // Handle when expression
    if (this.check(TokenType.WHEN)) {
      return this.whenExpression();
    }
    return this.logicalOrBase();
  }

  // Base logical or - only uses | (pipe) not semicolon
  private logicalOrBase(): AST.Expression {
    let expr = this.logicalAndBase();

    while (this.match(TokenType.PIPE)) {
      const right = this.logicalAndBase();
      expr = { type: 'LogicalExpression', operator: '||', left: expr, right };
    }

    return expr;
  }

  // Base logical and - only uses & (amp) not comma
  private logicalAndBase(): AST.Expression {
    let expr = this.equality();

    while (this.match(TokenType.AMP)) {
      const right = this.equality();
      expr = { type: 'LogicalExpression', operator: '&&', left: expr, right };
    }

    return expr;
  }

  private logicalOr(): AST.Expression {
    let expr = this.logicalAnd();

    while (this.match(TokenType.PIPE) || this.match(TokenType.SEMICOLON)) {
      const right = this.logicalAnd();
      expr = { type: 'LogicalExpression', operator: '||', left: expr, right };
    }

    return expr;
  }

  private logicalAnd(): AST.Expression {
    let expr = this.equality();

    while (this.match(TokenType.AMP) || this.match(TokenType.COMMA)) {
      const right = this.equality();
      expr = { type: 'LogicalExpression', operator: '&&', left: expr, right };
    }

    return expr;
  }

  private equality(): AST.Expression {
    let expr = this.comparison();

    while (this.match(TokenType.EQ, TokenType.NE)) {
      const operator = this.previous().value;
      const right = this.comparison();
      expr = { type: 'BinaryExpression', operator, left: expr, right };
    }

    return expr;
  }

  private comparison(): AST.Expression {
    let expr = this.term();

    while (this.match(TokenType.LT, TokenType.GT, TokenType.LE, TokenType.GE)) {
      const operator = this.previous().value;
      const right = this.term();
      expr = { type: 'BinaryExpression', operator, left: expr, right };
    }

    return expr;
  }

  private term(): AST.Expression {
    let expr = this.factor();

    while (this.match(TokenType.PLUS, TokenType.MINUS)) {
      const operator = this.previous().value;
      const right = this.factor();
      expr = { type: 'BinaryExpression', operator, left: expr, right };
    }

    return expr;
  }

  private factor(): AST.Expression {
    let expr = this.unary();

    while (this.match(TokenType.STAR, TokenType.SLASH, TokenType.PERCENT)) {
      const operator = this.previous().value;
      const right = this.unary();
      expr = { type: 'BinaryExpression', operator, left: expr, right };
    }

    return expr;
  }

  private unary(): AST.Expression {
    if (this.match(TokenType.BANG, TokenType.MINUS)) {
      const operator = this.previous().value;
      const argument = this.unary();
      return { type: 'UnaryExpression', operator, argument, prefix: true };
    }

    // typeof expression: typeof x or typeof(x)
    if (this.match(TokenType.TYPEOF)) {
      let argument: AST.Expression;
      if (this.check(TokenType.LPAREN)) {
        this.advance(); // consume '('
        argument = this.expression();
        this.consume(TokenType.RPAREN, "Expected ')'");
      } else {
        argument = this.unary();
      }
      return { type: 'TypeofExpression', argument };
    }

    // void expression
    if (this.match(TokenType.VOID)) {
      let argument: AST.Expression;
      if (this.check(TokenType.LPAREN)) {
        this.advance();
        argument = this.expression();
        this.consume(TokenType.RPAREN, "Expected ')'");
      } else {
        argument = this.unary();
      }
      return { type: 'VoidExpression', argument };
    }

    // delete expression
    if (this.match(TokenType.DELETE)) {
      const argument = this.unary();
      return { type: 'DeleteExpression', argument };
    }

    // yield expression
    if (this.match(TokenType.YIELD)) {
      const delegate = this.match(TokenType.STAR);
      let argument: AST.Expression | undefined;
      if (!this.check(TokenType.SEMICOLON) && !this.check(TokenType.RBRACE) && !this.isAtEnd()) {
        argument = this.assignmentExpression();
      }
      return { type: 'YieldExpression', argument, delegate };
    }

    return this.postfix();
  }

  private postfix(): AST.Expression {
    let expr = this.call();

    // Type operations: is, of
    if (this.match(TokenType.IS)) {
      const typeAnnotation = this.typeAnnotation();
      return { type: 'TypeCheckExpression', expression: expr, typeAnnotation };
    }

    if (this.match(TokenType.OF)) {
      const typeAnnotation = this.typeAnnotation();
      return { type: 'TypeCastExpression', expression: expr, typeAnnotation };
    }

    // instanceof expression
    if (this.match(TokenType.INSTANCEOF)) {
      const right = this.unary();
      return { type: 'InstanceofExpression', left: expr, right };
    }

    return expr;
  }

  private call(): AST.Expression {
    let expr = this.primary();

    while (true) {
      if (this.match(TokenType.LPAREN)) {
        expr = this.finishCall(expr);
      } else if (this.match(TokenType.DOT)) {
        const property = this.consume(TokenType.IDENTIFIER, 'Expected property name');
        expr = { type: 'MemberExpression', object: expr, property: { type: 'Identifier', name: property.value }, computed: false, optional: false };
      } else if (this.match(TokenType.SAFE_DOT)) {
        const property = this.consume(TokenType.IDENTIFIER, 'Expected property name');
        expr = { type: 'MemberExpression', object: expr, property: { type: 'Identifier', name: property.value }, computed: false, optional: true };
      } else if (this.match(TokenType.LBRACKET)) {
        const index = this.expression();
        this.consume(TokenType.RBRACKET, "Expected ']'");
        expr = { type: 'MemberExpression', object: expr, property: index, computed: true, optional: false };
      } else if (this.match(TokenType.RANGE)) {
        const end = this.expression();
        expr = { type: 'RangeExpression', start: expr, end, inclusive: false };
      } else if (this.match(TokenType.SEND)) {
        // Channel send: channel <- value
        const value = this.expression();
        expr = { type: 'SendExpression', channel: expr, value };
      } else {
        break;
      }
    }

    return expr;
  }

  private finishCall(callee: AST.Expression): AST.CallExpression {
    const args: AST.Expression[] = [];
    
    if (!this.check(TokenType.RPAREN)) {
      do {
        args.push(this.assignmentExpression());
      } while (this.match(TokenType.COMMA));
    }

    this.consume(TokenType.RPAREN, "Expected ')'");
    return { type: 'CallExpression', callee, arguments: args };
  }

  private primary(): AST.Expression {
    // Literals
    if (this.match(TokenType.NUL) || this.match(TokenType.NULL)) {
      return { type: 'Literal', value: null, raw: 'null' };
    }
    if (this.match(TokenType.TRUE)) {
      return { type: 'Literal', value: true, raw: 'true' };
    }
    if (this.match(TokenType.FALSE)) {
      return { type: 'Literal', value: false, raw: 'false' };
    }
    if (this.match(TokenType.THIS)) {
      return { type: 'ThisExpression' };
    }
    if (this.match(TokenType.SUPER)) {
      return { type: 'SuperExpression' };
    }
    if (this.match(TokenType.NUMBER)) {
      const raw = this.previous().value;
      let value: number;
      if (raw.startsWith('0b') || raw.startsWith('0B')) {
        value = parseInt(raw.slice(2), 2);
      } else if (raw.startsWith('0o') || raw.startsWith('0O')) {
        value = parseInt(raw.slice(2), 8);
      } else if (raw.startsWith('0x') || raw.startsWith('0X')) {
        value = parseInt(raw.slice(2), 16);
      } else {
        value = parseFloat(raw);
      }
      return { type: 'Literal', value, raw };
    }
    if (this.match(TokenType.STRING, TokenType.RAW_STRING)) {
      const value = this.previous().value;
      // Check for template string interpolation
      if (value.includes('${')) {
        return this.parseTemplateString(value);
      }
      return { type: 'Literal', value, raw: JSON.stringify(value) };
    }

    // Identifier
    if (this.match(TokenType.IDENTIFIER)) {
      return { type: 'Identifier', name: this.previous().value };
    }

    // Grouping or arrow function
    if (this.match(TokenType.LPAREN)) {
      // Check if it's an arrow function
      if (this.check(TokenType.RPAREN) || this.isArrowFunction()) {
        return this.arrowFunction();
      }
      const expr = this.expression();
      this.consume(TokenType.RPAREN, "Expected ')'");
      return expr;
    }

    // Array literal
    if (this.match(TokenType.LBRACKET)) {
      return this.arrayLiteral();
    }

    // Object/Map literal
    if (this.match(TokenType.LBRACE)) {
      return this.objectLiteral();
    }

    // Go expression
    if (this.match(TokenType.GO)) {
      const argument = this.expression();
      return { type: 'GoExpression', argument };
    }

    // Await expression
    if (this.match(TokenType.AWAIT)) {
      const argument = this.expression();
      return { type: 'AwaitExpression', argument };
    }

    // New expression: new Callee<T>(args)
    if (this.match(TokenType.NEW)) {
      this.consume(TokenType.IDENTIFIER, 'Expected class name after new');
      const calleeName = this.previous().value;
      let typeArguments: AST.TypeAnnotation[] | undefined;

      // Optional generic type arguments
      if (this.match(TokenType.LT)) {
        typeArguments = [];
        do {
          typeArguments.push(this.typeAnnotation());
        } while (this.match(TokenType.COMMA));
        this.consume(TokenType.GT, "Expected '>'");
      }

      const callee: AST.Identifier = { type: 'Identifier', name: calleeName };
      const args: AST.Expression[] = [];

      // Optional constructor arguments
      if (this.match(TokenType.LPAREN)) {
        if (!this.check(TokenType.RPAREN)) {
          do {
            args.push(this.assignmentExpression());
          } while (this.match(TokenType.COMMA));
        }
        this.consume(TokenType.RPAREN, "Expected ')' after arguments");
      }

      return { type: 'NewExpression', callee, typeArguments, arguments: args };
    }

    // Channel creation: chan T(size) or chan T
    if (this.match(TokenType.CHAN)) {
      let elementType: AST.TypeAnnotation | undefined;
      let bufferSize: AST.Expression | undefined;

      if (!this.check(TokenType.LPAREN)) {
        elementType = this.typeAnnotation();
      }

      if (this.match(TokenType.LPAREN)) {
        if (!this.check(TokenType.RPAREN)) {
          bufferSize = this.expression();
        }
        this.consume(TokenType.RPAREN, "Expected ')'");
      }

      return { type: 'ChannelExpression', elementType, bufferSize };
    }

    // Receive expression: <-channel
    if (this.match(TokenType.SEND)) {
      const channel = this.unary();
      return { type: 'ReceiveExpression', channel };
    }

    throw new ParserError(`Unexpected token: ${this.peek().value}`, this.peek());
  }

  private parseTemplateString(value: string): AST.TemplateStringExpression {
    const parts: (string | AST.Expression)[] = [];
    let current = '';
    let i = 0;

    while (i < value.length) {
      // Escaped template start: `$${` -> literal "${"
      if (
        value[i] === '$' &&
        i + 2 < value.length &&
        value[i + 1] === '$' &&
        value[i + 2] === '{'
      ) {
        current += '${';
        i += 3;
        continue;
      }

      if (value[i] === '$' && value[i + 1] === '{') {
        if (current) {
          parts.push(current);
          current = '';
        }
        i += 2;
        let depth = 1;
        let exprStr = '';
        while (i < value.length && depth > 0) {
          if (value[i] === '{') depth++;
          else if (value[i] === '}') depth--;
          if (depth > 0) exprStr += value[i];
          i++;
        }
        // Parse the expression
        
        const lexer = new Lexer(exprStr);
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);
        const expr = parser.expression();
        parts.push(expr);
      } else {
        current += value[i];
        i++;
      }
    }

    if (current) {
      parts.push(current);
    }

    return { type: 'TemplateStringExpression', parts };
  }

  private isArrowFunction(): boolean {
    // Look ahead to check for arrow function pattern
    let depth = 1;
    let pos = this.current;
    
    while (pos < this.tokens.length && depth > 0) {
      if (this.tokens[pos].type === TokenType.LPAREN) depth++;
      else if (this.tokens[pos].type === TokenType.RPAREN) depth--;
      pos++;
    }

    return pos < this.tokens.length && this.tokens[pos].type === TokenType.ARROW;
  }

  private arrowFunction(): AST.ArrowFunctionExpression {
    const params = this.parameterList();
    this.consume(TokenType.RPAREN, "Expected ')'");
    this.consume(TokenType.ARROW, "Expected '=>'");

    let body: AST.Expression | AST.BlockStatement;
    if (this.check(TokenType.LBRACE)) {
      body = this.blockStatement();
    } else {
      body = this.expression();
    }

    return { type: 'ArrowFunctionExpression', params, body };
  }

  private arrayLiteral(): AST.ArrayExpression {
    const elements: AST.Expression[] = [];

    if (!this.check(TokenType.RBRACKET)) {
      do {
        elements.push(this.assignmentExpression());
      } while (this.match(TokenType.COMMA) || this.match(TokenType.SEMICOLON));
    }

    this.consume(TokenType.RBRACKET, "Expected ']'");
    return { type: 'ArrayExpression', elements };
  }

  private objectLiteral(): AST.ObjectExpression {
    const properties: { key: AST.Expression; value: AST.Expression }[] = [];

    if (!this.check(TokenType.RBRACE)) {
      while (true) {
        const key = this.primary();
        if (this.match(TokenType.COLON)) {
          const value = this.assignmentExpression();
          properties.push({ key, value });
        } else {
          this.consume(TokenType.ARROW, "Expected '=>' or ':'");
          const value = this.assignmentExpression();
          properties.push({ key, value });
        }

        if (!this.match(TokenType.COMMA)) {
          break;
        }

        if (this.check(TokenType.RBRACE)) {
          break;
        }
      }
    }

    this.consume(TokenType.RBRACE, "Expected '}'");
    return { type: 'ObjectExpression', properties };
  }

  private typeAnnotation(): AST.TypeAnnotation {
    return this.unionType();
  }

  private unionType(): AST.TypeAnnotation {
    let type = this.intersectionType();

    if (this.check(TokenType.PIPE)) {
      const types: AST.TypeAnnotation[] = [type];
      while (this.match(TokenType.PIPE)) {
        types.push(this.intersectionType());
      }
      return { kind: 'union', types };
    }

    return type;
  }

  private intersectionType(): AST.TypeAnnotation {
    let type = this.primaryType();

    if (this.check(TokenType.AMP)) {
      const types: AST.TypeAnnotation[] = [type];
      while (this.match(TokenType.AMP)) {
        types.push(this.primaryType());
      }
      return { kind: 'intersection', types };
    }

    return type;
  }

  private primaryType(): AST.TypeAnnotation {
    if (this.check(TokenType.INTERFACE)) {
      return this.interfaceType();
    }

    // Simple type or generic
    if (this.check(TokenType.IDENTIFIER)) {
      const name = this.advance().value;
      
      // Check for generic type arguments
      if (this.match(TokenType.LT)) {
        const typeArguments: AST.TypeAnnotation[] = [];
        do {
          typeArguments.push(this.typeAnnotation());
        } while (this.match(TokenType.COMMA));
        this.consume(TokenType.GT, "Expected '>'");
        return { kind: 'generic', name, typeArguments };
      }

      return { kind: 'simple', name };
    }

    // Array type: [T] or [T; N]
    if (this.match(TokenType.LBRACKET)) {
      const elementType = this.typeAnnotation();
      let size: number | undefined;
      if (this.match(TokenType.SEMICOLON)) {
        const sizeToken = this.consume(TokenType.NUMBER, 'Expected array size');
        size = parseInt(sizeToken.value);
      }
      this.consume(TokenType.RBRACKET, "Expected ']'");
      return { kind: 'array', elementType, size };
    }

    // Object type literal or map type
    if (this.match(TokenType.LBRACE)) {
      if (this.check(TokenType.RBRACE)) {
        this.advance();
        return { kind: 'object', properties: [] };
      }

      const properties: AST.ObjectTypeProperty[] = [];

      while (true) {
        const keyToken = this.consume(TokenType.IDENTIFIER, 'Expected property name');
        const optional = this.match(TokenType.QUESTION);
        this.consume(TokenType.COLON, "Expected ':'");
        const valueType = this.typeAnnotation();
        properties.push({ key: keyToken.value, type: valueType, optional });

        if (!this.match(TokenType.COMMA)) {
          break;
        }

        if (this.check(TokenType.RBRACE)) {
          break;
        }
      }
      if (this.peek().type === TokenType.COMMA) {
        this.advance();
      }

      this.consume(TokenType.RBRACE, "Expected '}'");
      return { kind: 'object', properties };
    }

    // Tuple or function type: (T1, T2) or (T1, T2) : R
    if (this.match(TokenType.LPAREN)) {
      const types: AST.TypeAnnotation[] = [];
      if (!this.check(TokenType.RPAREN)) {
        do {
          types.push(this.typeAnnotation());
        } while (this.match(TokenType.COMMA));
      }
      this.consume(TokenType.RPAREN, "Expected ')'");

      // Function type
      if (this.match(TokenType.COLON)) {
        const returnType = this.typeAnnotation();
        return { kind: 'function', paramTypes: types, returnType };
      }

      return { kind: 'tuple', elementTypes: types };
    }

    throw new ParserError('Expected type annotation', this.peek());
  }

  private interfaceType(): AST.TypeAnnotation {
    this.advance(); // consume 'interface'
    const name = this.consume(TokenType.IDENTIFIER, 'Expected interface name').value;
    this.consume(TokenType.ASSIGN, "Expected '='");
    // For now, treat interface like object type
    const type = this.primaryType();
    return { kind: 'generic', name, typeArguments: [type] };
  }

  // Utility methods
  private match(...types: TokenType[]): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  private isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF;
  }

  private peek(): Token {
    return this.tokens[this.current];
  }

  private peekNext(): Token | undefined {
    if (this.current + 1 >= this.tokens.length) return undefined;
    return this.tokens[this.current + 1];
  }

  private previous(): Token {
    return this.tokens[this.current - 1];
  }

  private consume(type: TokenType, message: string): Token {
    if (this.check(type)) return this.advance();
    throw new ParserError(message, this.peek());
  }

  private synchronize(): void {
    this.advance();

    while (!this.isAtEnd()) {
      if (this.previous().type === TokenType.SEMICOLON) return;

      switch (this.peek().type) {
        case TokenType.FN:
        case TokenType.CONST:
        case TokenType.MUT:
        case TokenType.FOR:
        case TokenType.IF:
        case TokenType.WHEN:
        case TokenType.RETURN:
        case TokenType.IMPORT:
        case TokenType.EXPORT:
          return;
      }

      this.advance();
    }
  }
}
