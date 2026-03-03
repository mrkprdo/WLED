#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { Parser } = require('./parser');
const { Codegen } = require('./codegen');

function compile(source) {
  const parser = new Parser(source);
  const ast = parser.parse();
  const codegen = new Codegen(ast);
  return codegen.generate();
}

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log('Usage: wledc <input.wled> [-o output.wfx]');
    console.log('       wledc <input.wled> --ast    (print AST)');
    console.log('       wledc <input.wled> --hex    (print hex dump)');
    process.exit(args.length === 0 ? 1 : 0);
  }

  const inputFile = args[0];
  let outputFile = null;
  let printAst = false;
  let printHex = false;

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '-o' && i + 1 < args.length) {
      outputFile = args[++i];
    } else if (args[i] === '--ast') {
      printAst = true;
    } else if (args[i] === '--hex') {
      printHex = true;
    }
  }

  // Default output: same name with .wfx extension
  if (!outputFile && !printAst) {
    outputFile = inputFile.replace(/\.wled$/, '.wfx');
  }

  let source;
  try {
    source = fs.readFileSync(inputFile, 'utf8');
  } catch (e) {
    console.error(`Error reading ${inputFile}: ${e.message}`);
    process.exit(1);
  }

  try {
    if (printAst) {
      const parser = new Parser(source);
      const ast = parser.parse();
      console.log(JSON.stringify(ast, null, 2));
      return;
    }

    const binary = compile(source);

    if (printHex) {
      // Print hex dump
      const lines = [];
      for (let i = 0; i < binary.length; i += 16) {
        const hex = [];
        const ascii = [];
        for (let j = 0; j < 16; j++) {
          if (i + j < binary.length) {
            const b = binary[i + j];
            hex.push(b.toString(16).padStart(2, '0'));
            ascii.push(b >= 0x20 && b < 0x7F ? String.fromCharCode(b) : '.');
          } else {
            hex.push('  ');
            ascii.push(' ');
          }
        }
        lines.push(`${i.toString(16).padStart(4, '0')}  ${hex.slice(0,8).join(' ')}  ${hex.slice(8).join(' ')}  |${ascii.join('')}|`);
      }
      console.log(lines.join('\n'));
    }

    if (outputFile) {
      // Ensure output directory exists
      const dir = path.dirname(outputFile);
      if (dir && dir !== '.') {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(outputFile, binary);
      console.log(`Compiled ${inputFile} → ${outputFile} (${binary.length} bytes)`);
    }
  } catch (e) {
    console.error(`${e.message}`);
    process.exit(1);
  }
}

main();

module.exports = { compile };
