// Token types for Ljos language
export enum TokenType {
  // Literals
  NUMBER = 'NUMBER',
  STRING = 'STRING',
  RAW_STRING = 'RAW_STRING',
  IDENTIFIER = 'IDENTIFIER',

  // Keywords
  NUL = 'NUL',
  TRUE = 'TRUE',
  FALSE = 'FALSE',
  MUT = 'MUT',
  CONST = 'CONST',
  CLASS = 'CLASS',
  ABSTRACT = 'ABSTRACT',
  ENUM = 'ENUM',
  EXTENDS = 'EXTENDS',
  IMPLEMENTS = 'IMPLEMENTS',
  STATIC = 'STATIC',
  CONSTRUCTOR = 'CONSTRUCTOR',
  NEW = 'NEW',
  IF = 'IF',
  ELSE = 'ELSE',
  FOR = 'FOR',
  WHEN = 'WHEN',
  BREAK = 'BREAK',
  CONTINUE = 'CONTINUE',
  RETURN = 'RETURN',
  THROW = 'THROW',
  IS = 'IS',
  OF = 'OF',
  FN = 'FN',
  IMPORT = 'IMPORT',
  EXPORT = 'EXPORT',
  FROM = 'FROM',
  DEFAULT = 'DEFAULT',
  AS = 'AS',
  IN = 'IN',
  TRY = 'TRY',
  CATCH = 'CATCH',
  TYPE = 'TYPE',
  INTERFACE = 'INTERFACE',
  WHERE = 'WHERE',
  GO = 'GO',
  DEFER = 'DEFER',
  MOVE = 'MOVE',
  BORROW = 'BORROW',
  USING = 'USING',
  MACRO = 'MACRO',
  AWAIT = 'AWAIT',
  CHAN = 'CHAN',
  SEND = 'SEND',      // <-
  
  // Additional keywords from other languages
  TYPEOF = 'TYPEOF',
  INSTANCEOF = 'INSTANCEOF',
  VOID = 'VOID',
  DELETE = 'DELETE',
  WHILE = 'WHILE',
  DO = 'DO',
  CASE = 'CASE',
  FINALLY = 'FINALLY',
  ASYNC = 'ASYNC',
  YIELD = 'YIELD',
  LET = 'LET',
  VAR = 'VAR',
  THIS = 'THIS',
  SUPER = 'SUPER',
  PRIVATE = 'PRIVATE',
  PROTECTED = 'PROTECTED',
  PUBLIC = 'PUBLIC',
  READONLY = 'READONLY',
  GET = 'GET',
  SET = 'SET',
  NULL = 'NULL',

  // Grouping
  LPAREN = 'LPAREN',       // (
  RPAREN = 'RPAREN',       // )
  LBRACKET = 'LBRACKET',   // [
  RBRACKET = 'RBRACKET',   // ]
  LBRACE = 'LBRACE',       // {
  RBRACE = 'RBRACE',       // }

  // Operators
  DOT = 'DOT',             // .
  SAFE_DOT = 'SAFE_DOT',   // ?.
  RANGE = 'RANGE',         // ..
  SAFE_RANGE = 'SAFE_RANGE', // ?..

  LT = 'LT',               // <
  GT = 'GT',               // >
  LE = 'LE',               // <=
  GE = 'GE',               // >=
  EQ = 'EQ',               // ==
  NE = 'NE',               // !=

  PLUS = 'PLUS',           // +
  MINUS = 'MINUS',         // -
  STAR = 'STAR',           // *
  SLASH = 'SLASH',         // /
  PERCENT = 'PERCENT',     // %

  ASSIGN = 'ASSIGN',       // =
  PLUS_ASSIGN = 'PLUS_ASSIGN',   // +=
  MINUS_ASSIGN = 'MINUS_ASSIGN', // -=
  STAR_ASSIGN = 'STAR_ASSIGN',   // *=
  SLASH_ASSIGN = 'SLASH_ASSIGN', // /=
  PERCENT_ASSIGN = 'PERCENT_ASSIGN', // %=

  BANG = 'BANG',           // !
  AMP = 'AMP',             // &
  PIPE = 'PIPE',           // |

  COMMA = 'COMMA',         // ,
  SEMICOLON = 'SEMICOLON', // ;
  COLON = 'COLON',         // :
  XOR = 'XOR',             // <>
  ARROW = 'ARROW',         // =>
  QUESTION = 'QUESTION',   // ?
  HASH = 'HASH',           // #
  AT = 'AT',               // @

  // Special
  EOF = 'EOF',
  NEWLINE = 'NEWLINE',
}

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

export const KEYWORDS: Record<string, TokenType> = {
  'nul': TokenType.NUL,
  'true': TokenType.TRUE,
  'false': TokenType.FALSE,
  'mut': TokenType.MUT,
  'const': TokenType.CONST,
  'class': TokenType.CLASS,
  'abstract': TokenType.ABSTRACT,
  'enum': TokenType.ENUM,
  'extends': TokenType.EXTENDS,
  'implements': TokenType.IMPLEMENTS,
  'static': TokenType.STATIC,
  'constructor': TokenType.CONSTRUCTOR,
  'new': TokenType.NEW,
  'if': TokenType.IF,
  'else': TokenType.ELSE,
  'for': TokenType.FOR,
  'when': TokenType.WHEN,
  'break': TokenType.BREAK,
  'continue': TokenType.CONTINUE,
  'return': TokenType.RETURN,
  'throw': TokenType.THROW,
  'is': TokenType.IS,
  'of': TokenType.OF,
  'fn': TokenType.FN,
  'import': TokenType.IMPORT,
  'export': TokenType.EXPORT,
  'from': TokenType.FROM,
  'default': TokenType.DEFAULT,
  'as': TokenType.AS,
  'in': TokenType.IN,
  'try': TokenType.TRY,
  'catch': TokenType.CATCH,
  'type': TokenType.TYPE,
  'interface': TokenType.INTERFACE,
  'where': TokenType.WHERE,
  'go': TokenType.GO,
  'defer': TokenType.DEFER,
  'move': TokenType.MOVE,
  'borrow': TokenType.BORROW,
  'using': TokenType.USING,
  'macro': TokenType.MACRO,
  'await': TokenType.AWAIT,
  'chan': TokenType.CHAN,
  
  // Additional keywords from other languages
  'typeof': TokenType.TYPEOF,
  'instanceof': TokenType.INSTANCEOF,
  'void': TokenType.VOID,
  'delete': TokenType.DELETE,
  'while': TokenType.WHILE,
  'do': TokenType.DO,
  'case': TokenType.CASE,
  'finally': TokenType.FINALLY,
  'async': TokenType.ASYNC,
  'yield': TokenType.YIELD,
  'let': TokenType.LET,
  'var': TokenType.VAR,
  'this': TokenType.THIS,
  'super': TokenType.SUPER,
  'private': TokenType.PRIVATE,
  'protected': TokenType.PROTECTED,
  'public': TokenType.PUBLIC,
  'readonly': TokenType.READONLY,
  'get': TokenType.GET,
  'set': TokenType.SET,
  'null': TokenType.NULL,
};
