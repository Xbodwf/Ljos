import { println } from "../runtime/std/io.js";
function greet(name = "World") {
  return `Hello, ${name}!`;
}
function main() {
  println("println");
  println("fn main() {}");
  println(`fn greet(name: Str = 'World') : Str { return 'Hello, \${name}!'; }`);
  if (((((1 > 0) && (2 > 1)) || ((0 < 1) && (0 > -1))) || ((0.1 === 0.1) && (1 !== 10)))) {
    println(greet());
    println(greet("Ljos"));
  } else if ((0 > 1)) {
    println("This won't print");
  } else {
    println("All tests passed!");
  }
  for (let i = 1; (i < 5); i = (i + 1)) {
    println(`i = ${i}`);
  }
  println((() => {
switch (true) {
case (1 > 0): {
return "one is greater than zero";
break;
}
case (2 < 1): {
return "two is less than one";
break;
}
case (3 < 2): {
return "impossible*2";
break;
}
default: {
return "this is the default case";
break;
}
}
})());
  return 1;
}
main();
