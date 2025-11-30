# Ljos Compiler

Ljos 编程语言到 JavaScript 的编译器。

## 安装

```bash
cd compiler
npm install
npm run build
```

## 使用

### 命令行

```bash
# 编译单个文件
npx ljc main.lj

# 指定输出文件
npx ljc main.lj -o output.js

# 监视模式
npx ljc -w main.lj

# 查看帮助
npx ljc --help
```

### 开发模式

```bash
# 直接运行（不需要编译）
npm run dev -- examples/hello.lj

# 运行测试
npm run test
```

### 编程接口

```typescript
import { Compiler } from 'ljos-compiler';

const compiler = new Compiler({
  outDir: './dist',
  sourceMap: true,
});

// 编译字符串
const result = compiler.compile(`
  fn main() {
    println("Hello, Ljos!")
  }
  main()
`);

if (result.success) {
  console.log(result.code);
} else {
  console.error(result.errors);
}

// 编译文件
const fileResult = compiler.compileFile('main.lj');
```

## 语言特性

### 变量声明

```lj
const x = 10          # 不可变绑定
mut y = 20            # 可变绑定
const name: str = "Ljos"  # 带类型注解
```

### 函数

```lj
fn add(a: int, b: int) : int {
  return a + b
}

# 箭头函数
const multiply = (a, b) => a * b

# 默认参数
fn greet(name: str = "World") {
  println("Hello, ${name}!")
}
```

### 控制流

```lj
# if 语句（也是表达式）
if (x > 0) {
  println("positive")
} else (x < 0) {
  println("negative")
} else {
  println("zero")
}

# 条件表达式
const max = if (a > b) a else b

# for 循环
for (mut i = 0; i < 10; i += 1) {
  println(i)
}

# for-in 循环
for (item in items) {
  println(item)
}

# 无限循环
for {
  # ...
  if (done) break
}
```

### 模式匹配

```lj
when (value) {
  1 | 2 => println("one or two")
  n is int where n > 10 => println("large number")
  else => println("other")
}
```

### 类型系统

```lj
# 基础类型
const n: int = 42
const f: float = 3.14
const s: str = "hello"
const b: bool = true

# 数组
const arr: [int] = [1, 2, 3]

# 映射
const map: {str: int} = {name => 1, age => 2}

# 类型检查
if (x is int) {
  println("x is an integer")
}

# 类型转换
const y = x of int  # 安全转换，失败返回 nul
```

### 模块

```lj
# 导入
import { Server, Request } from "/std/http"
import utils from "./utils"
import * as fs from "/std/fs"

# 导出
export const PI = 3.14159
export fn calculate(x: int) : int {
  return x * 2
}
export default main
```

### 错误处理

```lj
try {
  riskyOperation()
} catch (e: IOError) {
  println("IO error: ${e}")
} catch {
  println("Unknown error")
}

# 抛出异常
throw "Something went wrong"
```

### 并发编程

```lj
# 创建协程
go processData()

# 创建通道
const ch = chan int(10)  # 带缓冲的通道

# 发送数据
ch <- 42

# 接收数据
const value = <-ch

# 异步等待
const result = await fetchData()
```

### 资源管理

```lj
# defer 语句 - 延迟执行（函数退出时执行）
defer cleanup()
defer file.close()

# using 语句 - 自动资源管理
using (f = File.open("test.txt")) {
  f.write("hello")
}  # 自动调用 f.dispose() 或 f.close()
```

### 高级类型

```lj
# 联合类型
const value: int | str = 42

# 交叉类型
const obj: Readable & Writable = stream

# 泛型
fn identity<T>(x: T) : T {
  return x
}
```

## 配置文件

在项目根目录创建 `.ljconfig.json`:

```json
{
  "compilerOptions": {
    "outDir": "./dist",
    "sourceMap": true,
    "target": "es2020"
  },
  "include": ["src/**/*.lj"],
  "exclude": ["node_modules"]
}
```

## 项目结构

```
compiler/
├── src/
│   ├── tokens.ts      # Token 类型定义
│   ├── lexer.ts       # 词法分析器
│   ├── ast.ts         # AST 节点定义
│   ├── parser.ts      # 语法分析器
│   ├── codegen.ts     # JavaScript 代码生成器
│   ├── compiler.ts    # 编译器主类
│   ├── cli.ts         # 命令行接口
│   ├── index.ts       # 导出入口
│   └── test.ts        # 测试文件
├── runtime/
│   ├── index.ts       # 运行时库入口
│   ├── channel.ts     # Channel 通道实现
│   └── defer.ts       # Defer 延迟执行实现
├── examples/
│   └── hello.lj       # 示例程序
├── package.json
├── tsconfig.json
└── README.md
```

## 编译流程

1. **词法分析 (Lexer)**: 将源代码转换为 Token 流
2. **语法分析 (Parser)**: 将 Token 流转换为 AST
3. **代码生成 (CodeGen)**: 将 AST 转换为 JavaScript 代码

## License

MIT
