![Ljos](https://socialify.git.ci/Xbodwf/Ljos/image?custom_description=A+programming+language&description=1&font=JetBrains+Mono&forks=1&issues=1&language=1&name=1&pulls=1&stargazers=1&theme=Auto)

# Ljos


## 目录

- [快速开始](#快速开始)
- [语言特性](#语言特性)
- [语法教程](#语法教程)
- [项目配置](#项目配置)
- [标准库](#标准库)
- [IDE 支持](#ide-支持)

## 快速开始

### 安装

```bash
# 进入 compiler 目录
cd compiler

# 安装依赖
npm install

# 构建编译器
npm run build
```

### 创建新项目

```bash
# 初始化项目 (JSON 配置)
ljc --init

# 或使用 .lj 配置文件
ljc --init-lj
```

### 编译运行

```bash
# 编译单个文件
ljc main.lj

# 编译整个项目
ljc -b

# 监听模式
ljc -b -w

# 运行编译后的代码
node dist/main.js
```

## 语言特性

- **静态类型系统** - 编译时类型检查
- **类和面向对象** - 支持类、继承、访问修饰符
- **模式匹配** - `when` 表达式进行模式匹配
- **模块系统** - `import`/`export` 模块化
- **字符串插值** - `"Hello, ${name}!"`
- **简洁语法** - 使用 `#` 注释，`fn` 定义函数

## 语法教程

### 注释

```lj
# 这是单行注释
```

### 变量声明

```lj
# 不可变变量
const name: Str = "Alice"
const age: Int = 25

# 可变变量
mut count: Int = 0
count = count + 1

# 类型推断
const message = "Hello"  # 自动推断为 Str
```

### 基本类型

| 类型 | 说明 | 示例 |
|------|------|------|
| `Int` | 整数 | `42`, `-10` |
| `Float` | 浮点数 | `3.14`, `-0.5` |
| `Str` | 字符串 | `"hello"` |
| `Bool` | 布尔值 | `true`, `false` |
| `Nul` | 空值 | `nul` |
| `Any` | 任意类型 | - |

### 函数

```lj
# 基本函数定义
fn add(a: Int, b: Int): Int {
  return a + b
}

# 无返回值函数
fn greet(name: Str) {
  println("Hello, ${name}!")
}

# 带默认参数
fn greetWithPrefix(name: Str, prefix: Str = "Hello"): Str {
  return "${prefix}, ${name}!"
}
```

### 字符串插值

```lj
const name = "Alice"
const age = 25

# 使用 ${} 插入表达式
const message = "${name} is ${age} years old"
println(message)  # 输出: Alice is 25 years old
```

### 类

```lj
export class Person {
  # 私有不可变字段
  private const name: Str
  
  # 私有可变字段
  private mut age: Int
  
  # 构造函数
  constructor(name: Str, age: Int) {
    this.name = name
    this.age = age
  }
  
  # 公开方法
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

#### 访问修饰符

- `public` - 公开访问（默认）
- `private` - 仅类内部访问
- `protected` - 类及子类访问

#### 继承

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

### 控制流

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

#### for 循环

```lj
# 传统 for 循环
for mut i = 0; i < 10; i = i + 1 {
  println(i)
}

# for-in 循环
const items = [1, 2, 3, 4, 5]
for item in items {
  println(item)
}
```

#### while 循环

```lj
mut count = 0
while count < 5 {
  println(count)
  count = count + 1
}
```

#### when 表达式（模式匹配）

```lj
const value = 2

when value {
  1 -> println("One")
  2 -> println("Two")
  3 -> println("Three")
  else -> println("Other")
}
```

### 模块系统

#### 导入

```lj
# 从标准库导入
import { println } : "/std/io"
import { Int, Str, Bool } : "/std/core"

# 从相对路径导入
import { Person } : "./models/person"
import { greet, farewell } : "./utils/greeting"

# 导入并重命名
import { greet as sayHello } : "./utils/greeting"

# 默认导入
import config : "./config"

# 命名空间导入
import * as utils : "./utils"
```

#### 导出

```lj
# 命名导出
export fn greet(name: Str): Str {
  return "Hello, ${name}!"
}

export class Person {
  # ...
}

# 默认导出
export default defineConfig({
  # ...
})
```

### typeof 操作符

```lj
println(typeof(42))       # 输出: Int
println(typeof(3.14))     # 输出: Float
println(typeof("hello"))  # 输出: Str
println(typeof(true))     # 输出: Bool
println(typeof(nul))      # 输出: Nul
```

## 项目配置

Ljos 支持两种配置文件格式：

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

### ljconfig.lj（推荐）

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

### 配置选项

#### compilerOptions

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `outDir` | string | `"./dist"` | 输出目录 |
| `rootDir` | string | `"./src"` | 源文件根目录 |
| `target` | string | `"es2022"` | 目标 ECMAScript 版本 |
| `module` | string | `"esm"` | 模块系统 (`esm`/`commonjs`) |
| `sourceMap` | boolean | `false` | 生成 source map |
| `minify` | boolean | `false` | 压缩输出 |
| `prelude` | string | `"none"` | 预导入模式 |
| `strict` | boolean | `false` | 严格类型检查 |

#### prelude 模式

- `none` - 不自动导入任何内容
- `core` - 自动导入核心类型 (`Int`, `Float`, `Bool`, `Str`, `Nul`, `Option`, `Result` 等)
- `full` - 自动导入核心类型 + IO 函数 (`println`, `print`, `readln`, `dbg`)

#### buildOptions

| 选项 | 类型 | 说明 |
|------|------|------|
| `target` | string | 构建目标: `js`/`pkg`/`bundle` |
| `entry` | string | 入口文件 |
| `executableName` | string | 可执行文件名 (pkg 模式) |
| `pkgTargets` | string[] | pkg 目标平台 |

## 标准库

### /std/io

输入输出模块。

```lj
import { println, print, readln, dbg } : "/std/io"

# 输出
println("Hello, World!")  # 带换行
print("No newline")       # 不带换行

# 调试输出
const value = dbg(42)  # 输出 [DEBUG] 42，返回 42

# 输入 (异步)
const name = await readln()
```

### /std/core

核心类型和工具函数。

```lj
import { 
  Int, Float, Bool, Str, Nul,
  isInt, isFloat, isStr, isBool, isNul,
  toInt, toFloat, toStr, toBool,
  abs, min, max, clamp,
  range, rangeInclusive,
  assert, unreachable
} : "/std/core"

# 类型检查
isInt(42)      # true
isStr("hello") # true

# 类型转换
toInt("42")    # 42
toStr(42)      # "42"

# 数学函数
abs(-5)        # 5
min(3, 7)      # 3
max(3, 7)      # 7
clamp(15, 0, 10)  # 10

# 范围生成
range(0, 5)           # [0, 1, 2, 3, 4]
rangeInclusive(0, 5)  # [0, 1, 2, 3, 4, 5]

# 断言
assert(x > 0, "x must be positive")
unreachable("This should never happen")
```

### /std/config

项目配置辅助。

```lj
import { defineConfig } : "/std/config"

export default defineConfig({
  # 配置内容
})
```

## IDE 支持

### VS Code 扩展

Ljos 提供 VS Code 扩展，支持：

- **语法高亮** - `.lj` 文件语法着色
- **代码补全** - 关键字、类型、函数补全
- **悬停提示** - 显示类型信息
- **错误诊断** - 实时语法检查
- **代码片段** - 常用代码模板

#### 安装扩展

```bash
cd lsp
npm install
npm run build
```

然后在 VS Code 中按 F5 启动扩展开发模式。

## 命令行工具

```
Ljos Compiler (ljc) v1.0.0

Usage: 
  ljc [options] <input-file>     编译单个文件
  ljc -b [options]               编译整个项目
  ljc --init                     初始化新项目

Options:
  -h, --help              显示帮助信息
  -v, --version           显示版本号
  -o, --output <file>     输出文件路径
  -w, --watch             监听模式
  -c, --config <file>     配置文件路径
  -p, --prelude <mode>    预导入模式: none/core/full
      --no-prelude        禁用预导入
  -b, --build, --project  编译整个项目
      --init              初始化项目 (JSON 配置)
      --init-lj           初始化项目 (.lj 配置)
```

## 示例项目

查看 `sample-project/` 目录获取完整示例：

```
sample-project/
├── ljconfig.lj          # 项目配置
├── src/
│   ├── main.lj          # 入口文件
│   ├── models/
│   │   └── person.lj    # Person 类
│   └── utils/
│       └── greeting.lj  # 工具函数
└── dist/                # 编译输出
```

## 项目结构

```
Ljos/
├── compiler/            # 编译器源码
│   ├── src/
│   │   ├── lexer.ts     # 词法分析器
│   │   ├── parser.ts    # 语法分析器
│   │   ├── ast.ts       # AST 定义
│   │   ├── codegen.ts   # 代码生成器
│   │   ├── compiler.ts  # 编译器主类
│   │   ├── config.ts    # 配置加载
│   │   └── cli.ts       # 命令行工具
│   └── runtime/
│       └── std/         # 标准库运行时
├── lsp/                 # VS Code 扩展
└── sample-project/      # 示例项目
```

## License

MIT
