var translateLlvmToWasm = require('../src/llvmwasm.js').translateLlvmToWasm;
var fs = require('fs');

var buffer = new Uint8Array(fs.readFileSync('example.bc')).buffer;
console.log(translateLlvmToWasm(buffer));
