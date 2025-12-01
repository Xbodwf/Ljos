import { println } from "./runtime/std/io.js";
class Person {
  #name = "";
  age = 0;
  id = 1;
  constructor(name, age) {
    this.name = name;
    this.age = age;
  }
  getName() {
    return this.name;
  }
  #secret() {
    return "secret";
  }
  getAge() {
    return this.age;
  }
}
const p = new Person("Alice", 30);
println(p.getName());
