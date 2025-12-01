# Ljos

A modern programming language that compiles to JavaScript, combining the best features from multiple languages with a clean syntax and powerful type system.

## Table of Contents

- [Getting Started](#getting-started)
- [Language Features](#language-features)
- [Syntax Tutorial](#syntax-tutorial)
- [Project Configuration](#project-configuration)
- [Standard Library](#standard-library)
- [IDE Support](#ide-support)

## Getting Started

### Installation

```bash
# Navigate to compiler directory
cd compiler

# Install dependencies
npm install

# Build the compiler
npm run build
```

### Create a New Project

```bash
# Initialize project (JSON config)
ljc --init

# Or use .lj config file
ljc --init-lj
```

### Compile and Run

```bash
# Compile a single file
ljc main.lj

# Compile entire project
ljc -b

# Watch mode
ljc -b -w

# Run compiled code
node dist/main.js
```

## Language Features

- **Static Type System** - Compile-time type checking
- **Classes and OOP** - Classes, inheritance, access modifiers
- **Pattern Matching** - `when` expressions for pattern matching
- **Module System** - `import`/`export` modularization
- **String Interpolation** - `"Hello, ${name}!"`
- **Clean Syntax** - `#` for comments, `fn` for functions

## Syntax Tutorial

### Comments

```lj
# This is a single-line comment
```

### Variable Declaration

```lj
# Immutable variable
const name: Str = "Alice"
const age: Int = 25

# Mutable variable
mut count: Int = 0
count = count + 1

# Type inference
const message = "Hello"  # Automatically inferred as Str
```

### Basic Types

| Type | Description | Example |
|------|-------------|---------|
| `Int` | Integer | `42`, `-10` |
| `Float` | Floating point | `3.14`, `-0.5` |
| `Str` | String | `"hello"` |
| `Bool` | Boolean | `true`, `false` |
| `Nul` | Null value | `nul` |
| `Any` | Any type | - |

### Functions

```lj
# Basic function definition
fn add(a: Int, b: Int): Int {
  return a + b
}

# Function without return value
fn greet(name: Str) {
  println("Hello, ${name}!")
}

# With default parameters
fn greetWithPrefix(name: Str, prefix: Str = "Hello"): Str {
  return "${prefix}, ${name}!"
}
```

### String Interpolation

```lj
const name = "Alice"
const age = 25

# Use ${} to insert expressions
const message = "${name} is ${age} years old"
println(message)  # Output: Alice is 25 years old
```

### Classes

```lj
export class Person {
  # Private immutable field
  private const name: Str
  
  # Private mutable field
  private mut age: Int
  
  # Constructor
  constructor(name: Str, age: Int) {
    this.name = name
    this.age = age
  }
  
  # Public method
  public fn getName(): Str {
    return this.name
  }
  
  public fn getAge(): Int {
    return this.age
  }
  
  public fn setAge(age: Int) {
    this.age = age
  }
  
  public fn getInfo(): Str {
    return "${this.name} is ${this.age} years old"
  }
  
  public fn birthday() {
    this.age = this.age + 1
  }
}
```

#### Access Modifiers

- `public` - Public access (default)
- `private` - Class internal access only
- `protected` - Class and subclass access

#### Inheritance

```lj
class Animal {
  protected const name: Str
  
  constructor(name: Str) {
    this.name = name
  }
  
  public fn speak(): Str {
    return "..."
  }
}

class Dog extends Animal {
  constructor(name: Str) {
    super(name)
  }
  
  public fn speak(): Str {
    return "${this.name} says: Woof!"
  }
}
```

### Control Flow

#### if/else

```lj
if age >= 18 {
  println("Adult")
} else if age >= 13 {
  println("Teenager")
} else {
  println("Child")
}
```

#### for Loop

```lj
# Traditional for loop
for mut i = 0; i < 10; i = i + 1 {
  println(i)
}

# for-in loop
const items = [1, 2, 3, 4, 5]
for item in items {
  println(item)
}
```

#### while Loop

```lj
mut count = 0
while count < 5 {
  println(count)
  count = count + 1
}
```

#### when Expression (Pattern Matching)

```lj
const value = 2

when value {
  1 -> println("One")
  2 -> println("Two")
  3 -> println("Three")
  else -> println("Other")
}
```

### Module System

#### Imports

```lj
# Import from standard library
import { println } : "/std/io"
import { Int, Str, Bool } : "/std/core"

# Import from relative path
import { Person } : "./models/person"
import { greet, farewell } : "./utils/greeting"

# Import with rename
import { greet as sayHello } : "./utils/greeting"

# Default import
import config : "./config"

# Namespace import
import * as utils : "./utils"
```

#### Exports

```lj
# Named export
export fn greet(name: Str): Str {
  return "Hello, ${name}!"
}

export class Person {
  # ...
}

# Default export
export default defineConfig({
  # ...
})
```

### typeof Operator

```lj
println(typeof(42))       # Output: Int
println(typeof(3.14))     # Output: Float
println(typeof("hello"))  # Output: Str
println(typeof(true))     # Output: Bool
println(typeof(nul))      # Output: Nul
```

## Project Configuration

Ljos supports two configuration file formats:

### ljconfig.json

```json
{
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "target": "es2022",
    "module": "esm",
    "sourceMap": true,
    "prelude": "none",
    "strict": true
  },
  "include": ["src/**/*.lj"],
  "exclude": ["node_modules", "dist"]
}
```

### ljconfig.lj (Recommended)

```lj
import { defineConfig } : "/std/config"

export default defineConfig({
  compilerOptions: {
    outDir: "./dist",
    rootDir: "./src",
    target: "es2022",
    module: "esm",
    sourceMap: true,
    prelude: "none",
    strict: true
  },
  buildOptions: {
    target: "js",
    entry: "dist/main.js",
    executableName: "my-app"
  },
  include: ["src/**/*.lj"],
  exclude: ["node_modules", "dist"]
})
```

### Configuration Options

#### compilerOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `outDir` | string | `"./dist"` | Output directory |
| `rootDir` | string | `"./src"` | Source files root directory |
| `target` | string | `"es2022"` | Target ECMAScript version |
| `module` | string | `"esm"` | Module system (`esm`/`commonjs`) |
| `sourceMap` | boolean | `false` | Generate source maps |
| `minify` | boolean | `false` | Minify output |
| `prelude` | string | `"none"` | Prelude mode |
| `strict` | boolean | `false` | Strict type checking |

#### Prelude Modes

- `none` - No automatic imports
- `core` - Auto-import core types (`Int`, `Float`, `Bool`, `Str`, `Nul`, `Option`, `Result`, etc.)
- `full` - Auto-import core types + IO functions (`println`, `print`, `readln`, `dbg`)

#### buildOptions

| Option | Type | Description |
|--------|------|-------------|
| `target` | string | Build target: `js`/`pkg`/`bundle` |
| `entry` | string | Entry file |
| `executableName` | string | Executable name (pkg mode) |
| `pkgTargets` | string[] | pkg target platforms |

## Standard Library

### /std/io

Input/output module.

```lj
import { println, print, readln, dbg } : "/std/io"

# Output
println("Hello, World!")  # With newline
print("No newline")       # Without newline

# Debug output
const value = dbg(42)  # Outputs [DEBUG] 42, returns 42

# Input (async)
const name = await readln()
```

### /std/core

Core types and utility functions.

```lj
import { 
  Int, Float, Bool, Str, Nul,
  isInt, isFloat, isStr, isBool, isNul,
  toInt, toFloat, toStr, toBool,
  abs, min, max, clamp,
  range, rangeInclusive,
  assert, unreachable
} : "/std/core"

# Type checking
isInt(42)      # true
isStr("hello") # true

# Type conversion
toInt("42")    # 42
toStr(42)      # "42"

# Math functions
abs(-5)        # 5
min(3, 7)      # 3
max(3, 7)      # 7
clamp(15, 0, 10)  # 10

# Range generation
range(0, 5)           # [0, 1, 2, 3, 4]
rangeInclusive(0, 5)  # [0, 1, 2, 3, 4, 5]

# Assertions
assert(x > 0, "x must be positive")
unreachable("This should never happen")
```

### /std/config

Project configuration helper.

```lj
import { defineConfig } : "/std/config"

export default defineConfig({
  # Configuration content
})
```

## IDE Support

### VS Code Extension

Ljos provides a VS Code extension with:

- **Syntax Highlighting** - `.lj` file syntax coloring
- **Code Completion** - Keywords, types, function completion
- **Hover Information** - Display type information
- **Error Diagnostics** - Real-time syntax checking
- **Code Snippets** - Common code templates

#### Install Extension

```bash
cd lsp
npm install
npm run build
```

Then press F5 in VS Code to launch extension development mode.

## Command Line Tool

```
Ljos Compiler (ljc) v1.0.0

Usage: 
  ljc [options] <input-file>     Compile a single file
  ljc -b [options]               Compile entire project
  ljc --init                     Initialize new project

Options:
  -h, --help              Show help message
  -v, --version           Show version number
  -o, --output <file>     Output file path
  -w, --watch             Watch mode
  -c, --config <file>     Config file path
  -p, --prelude <mode>    Prelude mode: none/core/full
      --no-prelude        Disable prelude
  -b, --build, --project  Compile entire project
      --init              Initialize project (JSON config)
      --init-lj           Initialize project (.lj config)
```

## Example Project

See the `sample-project/` directory for a complete example:

```
sample-project/
├── ljconfig.lj          # Project configuration
├── src/
│   ├── main.lj          # Entry file
│   ├── models/
│   │   └── person.lj    # Person class
│   └── utils/
│       └── greeting.lj  # Utility functions
└── dist/                # Compiled output
```

## Project Structure

```
Ljos/
├── compiler/            # Compiler source code
│   ├── src/
│   │   ├── lexer.ts     # Lexer
│   │   ├── parser.ts    # Parser
│   │   ├── ast.ts       # AST definitions
│   │   ├── codegen.ts   # Code generator
│   │   ├── compiler.ts  # Main compiler class
│   │   ├── config.ts    # Configuration loader
│   │   └── cli.ts       # Command line tool
│   └── runtime/
│       └── std/         # Standard library runtime
├── lsp/                 # VS Code extension
└── sample-project/      # Example project
```

## License

MIT
