import { Token, TokenType, KEYWORDS } from './tokens';

export class LexerError extends Error {
  constructor(message: string, public line: number, public column: number) {
    super(`Lexer Error at ${line}:${column}: ${message}`);
    this.name = 'LexerError';
  }
}

export class Lexer {
  private source: string;
  private tokens: Token[] = [];
  private start = 0;
  private current = 0;
  private line = 1;
  private column = 1;
  private startColumn = 1;

  constructor(source: string) {
    this.source = source;
  }

  tokenize(): Token[] {
    while (!this.isAtEnd()) {
      this.start = this.current;
      this.startColumn = this.column;
      this.scanToken();
    }

    this.tokens.push({
      type: TokenType.EOF,
      value: '',
      line: this.line,
      column: this.column,
    });

    return this.tokens;
  }

  private scanToken(): void {
    const c = this.advance();

    switch (c) {
      // Grouping
      case '(': this.addToken(TokenType.LPAREN); break;
      case ')': this.addToken(TokenType.RPAREN); break;
      case '[': this.addToken(TokenType.LBRACKET); break;
      case ']': this.addToken(TokenType.RBRACKET); break;
      case '{': this.addToken(TokenType.LBRACE); break;
      case '}': this.addToken(TokenType.RBRACE); break;

      // Operators
      case '+': this.addToken(this.match('=') ? TokenType.PLUS_ASSIGN : TokenType.PLUS); break;
      case '-': this.addToken(this.match('=') ? TokenType.MINUS_ASSIGN : TokenType.MINUS); break;
      case '*': this.addToken(this.match('=') ? TokenType.STAR_ASSIGN : TokenType.STAR); break;
      case '%': this.addToken(this.match('=') ? TokenType.PERCENT_ASSIGN : TokenType.PERCENT); break;
      case '&': this.addToken(this.match('&') ? TokenType.AND : TokenType.AMP); break;
      case '|': this.addToken(this.match('|') ? TokenType.OR : TokenType.PIPE); break;
      case ',': this.addToken(TokenType.COMMA); break;
      case ';': this.addToken(TokenType.SEMICOLON); break;
      case ':': this.addToken(TokenType.COLON); break;
      case '@':
        // Check for template string prefix @"
        if (this.peek() === '"') {
          this.advance(); // consume "
          this.templateString();
        } else {
          this.addToken(TokenType.AT);
        }
        break;

      case '.':
        if (this.match('.')) {
          this.addToken(TokenType.RANGE);
        } else {
          this.addToken(TokenType.DOT);
        }
        break;

      case '?':
        if (this.match('.')) {
          if (this.match('.')) {
            this.addToken(TokenType.SAFE_RANGE);
          } else {
            this.addToken(TokenType.SAFE_DOT);
          }
        } else {
          this.addToken(TokenType.QUESTION);
        }
        break;

      case '<':
        if (this.match('=')) {
          this.addToken(TokenType.LE);
        } else if (this.match('>')) {
          this.addToken(TokenType.XOR);
        } else if (this.match('-')) {
          this.addToken(TokenType.SEND);  // <- for channel receive/send
        } else {
          this.addToken(TokenType.LT);
        }
        break;

      case '>':
        this.addToken(this.match('=') ? TokenType.GE : TokenType.GT);
        break;

      case '=':
        if (this.match('=')) {
          this.addToken(TokenType.EQ);
        } else if (this.match('>')) {
          this.addToken(TokenType.ARROW);
        } else {
          this.addToken(TokenType.ASSIGN);
        }
        break;

      case '!':
        this.addToken(this.match('=') ? TokenType.NE : TokenType.BANG);
        break;

      case '/':
        if (this.match('*')) {
          this.blockComment();
        } else if (this.match('=')) {
          this.addToken(TokenType.SLASH_ASSIGN);
        } else {
          this.addToken(TokenType.SLASH);
        }
        break;

      case '#':
        // Single line comment
        while (this.peek() !== '\n' && !this.isAtEnd()) {
          this.advance();
        }
        break;

      case '\'':
        if (this.peek() === '\'') {
          this.advance();
          this.typeComment();
        } else {
          // Character literal 'c' or '\n' etc.
          this.charLiteral();
        }
        break;

      case '"':
        this.string(); // Regular string, no template interpolation
        break;

      case '`':
        this.templateBacktickString(); // Template string with interpolation
        break;

      // Whitespace
      case ' ':
      case '\r':
      case '\t':
        break;

      case '\n':
        this.line++;
        this.column = 1;
        break;

      default:
        if (this.isDigit(c)) {
          this.number();
        } else if (this.isAlpha(c)) {
          this.identifier();
        } else {
          throw new LexerError(`Unexpected character: ${c}`, this.line, this.startColumn);
        }
    }
  }

  private string(): void {
    let value = '';
    
    while (this.peek() !== '"' && !this.isAtEnd()) {
      if (this.peek() === '\n') {
        this.line++;
        this.column = 1;
      }
      
      if (this.peek() === '\\') {
        this.advance();
        const escaped = this.advance();
        switch (escaped) {
          case 'n': value += '\n'; break;
          case 'r': value += '\r'; break;
          case 't': value += '\t'; break;
          case '\\': value += '\\'; break;
          case '"': value += '"'; break;
          case '$': value += '$'; break;
          case 'x': {
            const hex = this.source.substring(this.current, this.current + 2);
            this.current += 2;
            this.column += 2;
            value += String.fromCharCode(parseInt(hex, 16));
            break;
          }
          case 'u': {
            const hex = this.source.substring(this.current, this.current + 4);
            this.current += 4;
            this.column += 4;
            value += String.fromCharCode(parseInt(hex, 16));
            break;
          }
          case 'U': {
            const hex = this.source.substring(this.current, this.current + 8);
            this.current += 8;
            this.column += 8;
            value += String.fromCodePoint(parseInt(hex, 16));
            break;
          }
          default:
            throw new LexerError(`Invalid escape sequence: \\${escaped}`, this.line, this.column);
        }
      } else {
        value += this.advance();
      }
    }

    if (this.isAtEnd()) {
      throw new LexerError('Unterminated string', this.line, this.startColumn);
    }

    this.advance(); // Closing "
    this.addToken(TokenType.STRING, value);
  }

  // Character literal 'c' or '\n' etc.
  private charLiteral(): void {
    let value: string;
    
    if (this.peek() === '\\') {
      this.advance(); // consume backslash
      const escaped = this.advance();
      switch (escaped) {
        case 'n': value = '\n'; break;
        case 'r': value = '\r'; break;
        case 't': value = '\t'; break;
        case '\\': value = '\\'; break;
        case '\'': value = '\''; break;
        case '0': value = '\0'; break;
        case 'x': {
          const hex = this.source.substring(this.current, this.current + 2);
          this.current += 2;
          this.column += 2;
          value = String.fromCharCode(parseInt(hex, 16));
          break;
        }
        case 'u': {
          const hex = this.source.substring(this.current, this.current + 4);
          this.current += 4;
          this.column += 4;
          value = String.fromCharCode(parseInt(hex, 16));
          break;
        }
        default:
          throw new LexerError(`Invalid escape sequence in char literal: \\${escaped}`, this.line, this.column);
      }
    } else if (this.isAtEnd() || this.peek() === '\'') {
      throw new LexerError('Empty character literal', this.line, this.startColumn);
    } else {
      value = this.advance();
    }
    
    if (this.peek() !== '\'') {
      throw new LexerError('Unterminated character literal or multi-character literal', this.line, this.startColumn);
    }
    
    this.advance(); // Closing '
    this.addToken(TokenType.CHAR, value);
  }

  // Template string with @"..." prefix - supports ${} interpolation with escape sequences
  private templateString(): void {
    let value = '';
    
    while (this.peek() !== '"' && !this.isAtEnd()) {
      if (this.peek() === '\n') {
        this.line++;
        this.column = 1;
      }
      
      if (this.peek() === '\\') {
        this.advance();
        const escaped = this.advance();
        switch (escaped) {
          case 'n': value += '\n'; break;
          case 'r': value += '\r'; break;
          case 't': value += '\t'; break;
          case '\\': value += '\\'; break;
          case '"': value += '"'; break;
          case '$': value += '$'; break;
          case 'x': {
            const hex = this.source.substring(this.current, this.current + 2);
            this.current += 2;
            this.column += 2;
            value += String.fromCharCode(parseInt(hex, 16));
            break;
          }
          case 'u': {
            const hex = this.source.substring(this.current, this.current + 4);
            this.current += 4;
            this.column += 4;
            value += String.fromCharCode(parseInt(hex, 16));
            break;
          }
          case 'U': {
            const hex = this.source.substring(this.current, this.current + 8);
            this.current += 8;
            this.column += 8;
            value += String.fromCodePoint(parseInt(hex, 16));
            break;
          }
          default:
            throw new LexerError(`Invalid escape sequence: \\${escaped}`, this.line, this.column);
        }
      } else {
        value += this.advance();
      }
    }

    if (this.isAtEnd()) {
      throw new LexerError('Unterminated template string', this.line, this.startColumn);
    }

    this.advance(); // Closing "
    this.addToken(TokenType.TEMPLATE_STRING, value);
  }

  // Template backtick string `...` - supports ${} interpolation, raw (no escape processing)
  private templateBacktickString(): void {
    let value = '';
    
    while (this.peek() !== '`' && !this.isAtEnd()) {
      if (this.peek() === '\n') {
        this.line++;
        this.column = 1;
      }
      value += this.advance();
    }

    if (this.isAtEnd()) {
      throw new LexerError('Unterminated template string', this.line, this.startColumn);
    }

    this.advance(); // Closing `
    this.addToken(TokenType.TEMPLATE_STRING, value);
  }

  private number(): void {
    // Check for binary, octal, or hex
    if (this.source[this.start] === '0') {
      const next = this.peek();
      if (next === 'b' || next === 'B') {
        this.advance();
        while (this.isBinaryDigit(this.peek()) || this.peek() === '_') {
          this.advance();
        }
        const value = this.source.substring(this.start, this.current).replace(/_/g, '');
        this.addToken(TokenType.NUMBER, value);
        return;
      } else if (next === 'o' || next === 'O') {
        this.advance();
        while (this.isOctalDigit(this.peek()) || this.peek() === '_') {
          this.advance();
        }
        const value = this.source.substring(this.start, this.current).replace(/_/g, '');
        this.addToken(TokenType.NUMBER, value);
        return;
      } else if (next === 'x' || next === 'X') {
        this.advance();
        while (this.isHexDigit(this.peek()) || this.peek() === '_') {
          this.advance();
        }
        const value = this.source.substring(this.start, this.current).replace(/_/g, '');
        this.addToken(TokenType.NUMBER, value);
        return;
      }
    }

    // Decimal integer part
    while (this.isDigit(this.peek()) || this.peek() === '_') {
      this.advance();
    }

    // Decimal part
    if (this.peek() === '.' && this.isDigit(this.peekNext())) {
      this.advance(); // consume '.'
      while (this.isDigit(this.peek()) || this.peek() === '_') {
        this.advance();
      }
    }

    // Exponent part
    if (this.peek() === 'e' || this.peek() === 'E') {
      this.advance();
      if (this.peek() === '+' || this.peek() === '-') {
        this.advance();
      }
      while (this.isDigit(this.peek()) || this.peek() === '_') {
        this.advance();
      }
    }

    const value = this.source.substring(this.start, this.current).replace(/_/g, '');
    this.addToken(TokenType.NUMBER, value);
  }

  private identifier(): void {
    while (this.isAlphaNumeric(this.peek())) {
      this.advance();
    }

    const text = this.source.substring(this.start, this.current);
    const type = KEYWORDS[text] ?? TokenType.IDENTIFIER;
    this.addToken(type, text);
  }

  private blockComment(): void {
    let depth = 1;
    
    while (depth > 0 && !this.isAtEnd()) {
      if (this.peek() === '/' && this.peekNext() === '*') {
        this.advance();
        this.advance();
        depth++;
      } else if (this.peek() === '*' && this.peekNext() === '/') {
        this.advance();
        this.advance();
        depth--;
      } else {
        if (this.peek() === '\n') {
          this.line++;
          this.column = 1;
        }
        this.advance();
      }
    }
  }

  private typeComment(): void {
    // Skip type comment '' ... ''
    while (!this.isAtEnd()) {
      if (this.peek() === '\'' && this.peekNext() === '\'') {
        this.advance();
        this.advance();
        return;
      }
      if (this.peek() === '\n') {
        this.line++;
        this.column = 1;
      }
      this.advance();
    }
    throw new LexerError('Unterminated type comment', this.line, this.startColumn);
  }

  private match(expected: string): boolean {
    if (this.isAtEnd()) return false;
    if (this.source[this.current] !== expected) return false;
    this.current++;
    this.column++;
    return true;
  }

  private peek(): string {
    if (this.isAtEnd()) return '\0';
    return this.source[this.current];
  }

  private peekNext(): string {
    if (this.current + 1 >= this.source.length) return '\0';
    return this.source[this.current + 1];
  }

  private advance(): string {
    const c = this.source[this.current];
    this.current++;
    this.column++;
    return c;
  }

  private isAtEnd(): boolean {
    return this.current >= this.source.length;
  }

  private isDigit(c: string): boolean {
    return c >= '0' && c <= '9';
  }

  private isBinaryDigit(c: string): boolean {
    return c === '0' || c === '1';
  }

  private isOctalDigit(c: string): boolean {
    return c >= '0' && c <= '7';
  }

  private isHexDigit(c: string): boolean {
    return (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F');
  }

  private isAlpha(c: string): boolean {
    return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_';
  }

  private isAlphaNumeric(c: string): boolean {
    return this.isAlpha(c) || this.isDigit(c);
  }

  private addToken(type: TokenType, value?: string): void {
    const text = value ?? this.source.substring(this.start, this.current);
    this.tokens.push({
      type,
      value: text,
      line: this.line,
      column: this.startColumn,
    });
  }
}
