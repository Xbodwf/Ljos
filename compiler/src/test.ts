// Test file for Ljos compiler

import { Compiler } from './compiler';

const testCases = [
  {
    name: 'Variable declarations',
    code: `
const x = 10
mut y = 20
const name = "Ljos"
`,
    expected: `const x = 10;
let y = 20;
const name = "Ljos";`
  },
  {
    name: 'Function declaration',
    code: `
fn add(a: int, b: int) : int {
  return a + b
}
`,
    expected: `function add(a, b) {
  return (a + b);
}`
  },
  {
    name: 'If statement',
    code: `
if (x > 0) {
  println("positive")
} else {
  println("non-positive")
}
`,
    expected: `if ((x > 0)) {
  console.log("positive");
} else {
  console.log("non-positive");
}`
  },
  {
    name: 'For loop',
    code: `
for (mut i = 0; i < 10; i += 1) {
  println(i)
}
`,
    expected: `for (let i = 0; (i < 10); i += 1) {
  console.log(i);
}`
  },
  {
    name: 'For-in loop',
    code: `
for (item in items) {
  println(item)
}
`,
    expected: `for (const item of items) {
  console.log(item);
}`
  },
  {
    name: 'Arrow function',
    code: `
const add = (a, b) => a + b
const greet = (name) => {
  println("Hello, " + name)
}
`,
    expected: `const add = (a, b) => (a + b);
const greet = (name) => {
  console.log(("Hello, " + name));
};`
  },
  {
    name: 'Array literal',
    code: `
const nums = [1, 2, 3, 4, 5]
const matrix = [1, 2; 3, 4]
`,
    expected: `const nums = [1, 2, 3, 4, 5];
const matrix = [1, 2, 3, 4];`
  },
  {
    name: 'Object/Map literal',
    code: `
const person = {name => "Alice", age => 30}
`,
    expected: `const person = { name: "Alice", age: 30 };`
  },
  {
    name: 'Template string',
    code: `
const greeting = "Hello, \${name}!"
`,
    expected: 'const greeting = `Hello, ${name}!`;'
  },
  {
    name: 'Import statement',
    code: `
import { Server, Request } from "/std/http"
import utils from "./utils"
`,
    expected: `import { Server, Request } from "./runtime/http";
import utils from "./utils";`
  },
  {
    name: 'Export statement',
    code: `
export const PI = 3.14159
export fn calculate(x: int) : int {
  return x * 2
}
`,
    expected: `export const PI = 3.14159;
export function calculate(x) {
  return (x * 2);
}`
  },
  {
    name: 'Try-catch',
    code: `
try {
  riskyOperation()
} catch (e) {
  println(e)
}
`,
    expected: `try {
  riskyOperation();
} catch (e) {
  console.log(e);
}`
  },
  {
    name: 'When statement (switch)',
    code: `
when (value) {
  1 => println("one")
  2 => println("two")
  else => println("other")
}
`,
    expected: `switch (value) {
  case 1: {
    console.log("one");
    break;
  }
  case 2: {
    console.log("two");
    break;
  }
  default: {
    console.log("other");
    break;
  }
}`
  },
  {
    name: 'Type check (is)',
    code: `
if (x is int) {
  println("x is an integer")
}
`,
    expected: `if ((typeof x === 'number' && Number.isInteger(x))) {
  console.log("x is an integer");
}`
  },
  {
    name: 'Optional chaining',
    code: `
const name = user?.profile?.name
`,
    expected: `const name = user?.profile?.name;`
  },
  {
    name: 'Logical operators',
    code: `
if (a > 0, b < 10) {
  println("both conditions met")
}
`,
    expected: `if (((a > 0) && (b < 10))) {
  console.log("both conditions met");
}`
  },
  {
    name: 'Comments',
    code: `
# This is a single line comment
const x = 10
/* This is a
   multi-line comment */
const y = 20
`,
    expected: `const x = 10;
const y = 20;`
  },
  {
    name: 'Number literals',
    code: `
const decimal = 1_000_000
const binary = 0b1010_1100
const octal = 0o755
const hex = 0xDEAD_BEEF
const float = 3.14159
const scientific = 6.02e23
`,
    expected: `const decimal = 1000000;
const binary = 172;
const octal = 493;
const hex = 3735928559;
const float = 3.14159;
const scientific = 6.02e+23;`
  },
  {
    name: 'Conditional expression',
    code: `
const max = if (a > b) a else b
`,
    expected: `const max = ((a > b) ? a : b);`
  },
  {
    name: 'Range expression',
    code: `
const range = 1..10
`,
    expected: `const range = Array.from({ length: 10 - 1 }, (_, i) => 1 + i);`
  },
  {
    name: 'Go expression (async)',
    code: `
go processData()
`,
    expected: `(async () => processData())();`
  },
  {
    name: 'Await expression',
    code: `
const result = await fetchData()
`,
    expected: `const result = await fetchData();`
  },
  {
    name: 'Defer statement',
    code: `
defer cleanup()
`,
    expected: `__deferred.push(() => cleanup());`
  },
  {
    name: 'Using statement',
    code: `
using (f = File.open("test.txt")) {
  f.write("hello")
}
`,
    expected: `try {
  const f = File.open("test.txt");
  f.write("hello");
} finally {
  f?.dispose?.() ?? f?.close?.();
}`
  },
  {
    name: 'Channel creation',
    code: `
const ch = chan int(10)
`,
    expected: `const ch = new Channel(10);`
  },
  {
    name: 'Channel send',
    code: `
ch <- 42
`,
    expected: `ch.send(42);`
  },
  {
    name: 'Channel receive',
    code: `
const value = <-ch
`,
    expected: `const value = await ch.receive();`
  },
  {
    name: 'Union type annotation',
    code: `
const x: int | str = 42
`,
    expected: `const x = 42;`
  },
  {
    name: 'Intersection type annotation',
    code: `
const obj: Readable & Writable = stream
`,
    expected: `const obj = stream;`
  },
];

function runTests(): void {
  const compiler = new Compiler();
  let passed = 0;
  let failed = 0;

  console.log('Running Ljos Compiler Tests\n');
  console.log('='.repeat(50));

  for (const test of testCases) {
    const result = compiler.compile(test.code.trim());
    
    if (!result.success) {
      console.log(`\n❌ FAILED: ${test.name}`);
      console.log('   Errors:');
      for (const error of result.errors) {
        console.log(`   - ${error.message}`);
      }
      failed++;
      continue;
    }

    const actualCode = result.code!.trim();
    const expectedCode = test.expected.trim();

    // Normalize whitespace for comparison
    const normalizeCode = (code: string) => 
      code.split('\n').map(line => line.trim()).filter(line => line).join('\n');

    if (normalizeCode(actualCode) === normalizeCode(expectedCode)) {
      console.log(`\n✅ PASSED: ${test.name}`);
      passed++;
    } else {
      console.log(`\n❌ FAILED: ${test.name}`);
      console.log('   Expected:');
      console.log(expectedCode.split('\n').map(l => '   ' + l).join('\n'));
      console.log('   Actual:');
      console.log(actualCode.split('\n').map(l => '   ' + l).join('\n'));
      failed++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`\nResults: ${passed} passed, ${failed} failed, ${testCases.length} total`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

// Run a simple demo
function runDemo(): void {
  console.log('\n' + '='.repeat(50));
  console.log('Demo: Compiling sample Ljos code\n');

  const sampleCode = `
# Ljos Sample Program
import { println } from "/std/io"

# Function to calculate factorial
fn factorial(n: int) : int {
  if (n <= 1) {
    return 1
  }
  return n * factorial(n - 1)
}

# Main function
fn main() {
  const numbers = [1, 2, 3, 4, 5]
  
  for (num in numbers) {
    const result = factorial(num)
    println("factorial(\${num}) = \${result}")
  }
  
  # Using when statement
  const grade = 85
  when {
    grade >= 90 => println("A")
    grade >= 80 => println("B")
    grade >= 70 => println("C")
    else => println("F")
  }
}

main()
`;

  const compiler = new Compiler();
  const result = compiler.compile(sampleCode);

  if (result.success) {
    console.log('Generated JavaScript:\n');
    console.log(result.code);
  } else {
    console.log('Compilation failed:');
    for (const error of result.errors) {
      console.log(`  ${error.line}:${error.column} - ${error.message}`);
    }
  }
}

// Main
runTests();
runDemo();
