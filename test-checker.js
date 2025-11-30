const { SyntaxChecker } = require('./lsp/out/ljos/checker');
const checker = new SyntaxChecker();

const fs = require('fs');
const source = fs.readFileSync('./compiler/examples/newFeaturesTest.lj', 'utf8');

const diags = checker.check(source);
console.log('Diagnostics:', JSON.stringify(diags, null, 2));

// Debug: check classTypes
console.log('\nClass types:');
for (const [name, type] of checker.classTypes || []) {
  console.log(`Class ${name}:`);
  console.log('  Members:', [...type.members.keys()]);
}
