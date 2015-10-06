/*
 * Copyright 2015 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['exports', 'llvmbcparser', 'relooper', 'relooperparser'], factory);
  } else if (typeof exports !== 'undefined') {
    factory(exports, require('./llvmbcparser'), require('./Relooper'), require('./relooperparser'));
  } else {
    factory((root.bcparser = {}), root.llvmbcparser, root.Relooper, root.relooperparser);
  }
}(this, function (exports, llvmbcparser, Relooper, relooperparser) {

  function findValuesReferences(obj, refs, blockIndex, instIndex) {
    if (obj.valueIndexRef) {
      var valueRefs = refs[obj.valueIndexRef] || (refs[obj.valueIndexRef] = []);
      valueRefs.push({blockIndex: blockIndex, instIndex: instIndex});
    }
    for (var p in obj) {
      if (typeof obj[p] === 'object' && obj[p] !== null) {
        findValuesReferences(obj[p], refs, blockIndex, instIndex);
      }
    }
  }

  function reloopFlow(fn) {
    Relooper.init();
    var blocks = fn.blocks.map(function (block, index) {
      var b = Relooper.addBlock('// Block ' + index);
      Relooper.setBlockCode(b, '"' + index + '";');
      return b;
    });
    var nextExprId = blocks.length;
    var conditions = [];
    fn.blocks.forEach(function (block, index) {
      var lastInstruction = block.instructions[block.instructions.length - 1];
      if (lastInstruction.instruction === 11) { // br
        if (lastInstruction.cond) {
          conditions[nextExprId] = lastInstruction.cond;
          Relooper.addBranch(blocks[index], blocks[lastInstruction.jump], '"' + nextExprId + '"');
          nextExprId++;
          Relooper.addBranch(blocks[index], blocks[lastInstruction.alternative]);
        } else {
          Relooper.addBranch(blocks[index], blocks[lastInstruction.jump]);
        }
      }
    });
    var jsCode = Relooper.render(blocks[0]);
    Relooper.cleanup();

    var hasLabel = /\blabel\b/.test(jsCode);

    var shapes = relooperparser.parseJSShapes(jsCode);
    return {shapes: shapes, conditions: conditions, hasLabel: hasLabel};
  }

  function translateType(types, typeIndexRef) {
    var type = types[typeIndexRef];
    switch (type.type) {
      case "integer":
        if (type.size === 32) return "i32";
        if (type.size === 64) return "i64";
        break;
      case "float":
        if (type.bytes === 4) return "f32";
        if (type.bytes === 8) return "f64";
        break;
    }
    throw new Error("Unsupported");
  }

  function translateBlock(block, blockIndex, context) {
    var result = [];
    block.instructions.forEach(function (inst) {
      switch (inst.instruction) {
        case 19: // ALLOC
          break;
        case 11: // BR
          break;
        case 44: // STORE
          var ptrValueType = context.valuesTypes[inst.ptr.valueIndexRef];
          switch (ptrValueType.type) {
            case "localRef":
              var items = ["set_local", ptrValueType.index, null];
              result.push(items);
              context.valuesRegs.push({
                targetItems: items,
                index: 2,
                valueIndexRef: inst.arg.valueIndexRef
              });
              break;
            default:
              throw new Error("Unsupported");
          }
          break;
        case 20: // LOAD
          var argValueType = context.valuesTypes[inst.arg.valueIndexRef];
          switch (argValueType.type) {
            case "localRef":
              var items = ["get_local", argValueType.index];
              context.values[inst.valueIndex] = items;
              break;
            default:
              throw new Error("Unsupported");
          }
          break;
        case 10: // RETURN
          var items = ["return"];
          if (inst.arg) {
            items.push(null);
            context.valuesRegs.push({
              targetItems: items,
              index: 1,
              valueIndexRef: inst.arg.valueIndexRef
            });
          }
          result.push(items);
          break;
        case 2: // BINOP
          var prefix = translateType(context.types, inst.typeIndexRef);
          var items = [null, null, null];
          switch (inst.opcode) {
            case 0: // ADD
              items[0] = prefix + ".add";
              break;
            case 1: // SUB
              items[0] = prefix + ".sub";
              break;
            case 2: // MUL
              items[0] = prefix + ".mul";
              break;
            default :
              throw new Error("Unsupported");
          }
          context.valuesRegs.push({
            targetItems: items,
            index: 1,
            valueIndexRef: inst.left.valueIndexRef
          });
          context.valuesRegs.push({
            targetItems: items,
            index: 2,
            valueIndexRef: inst.right.valueIndexRef
          });
          context.values[inst.valueIndex] = items;
          break;
        case 28: // CMP2
          var prefix = translateType(context.types, inst.left.typeIndexRef);
          var items = [null, null, null];
          switch (inst.opcode) {
            case 32: // EQ
              items[0] = prefix + ".eq";
              break;
            case 40: // LT
              items[0] = prefix + ".lt_s";
              break;
            default :
              throw new Error("Unsupported");
          }
          context.valuesRegs.push({
            targetItems: items,
            index: 1,
            valueIndexRef: inst.left.valueIndexRef
          });
          context.valuesRegs.push({
            targetItems: items,
            index: 2,
            valueIndexRef: inst.right.valueIndexRef
          });
          context.values[inst.valueIndex] = items;
          break;
        case 34: // CALL
          var calleeValueType = context.valuesTypes[inst.callee.valueIndexRef];
          if (calleeValueType.type !== "function") {
            throw new Error("Unsupported");
          }
          var items;
          if (calleeValueType.imported) {
            items = ['call_imported', calleeValueType.importIndex];
          } else {
            items = ['call', calleeValueType.bodyIndex];
          }
          inst.args.forEach(function (arg, index) {
            items.push(null);
            context.valuesRegs.push({
              targetItems: items,
              index: index + 2,
              valueIndexRef: arg.valueIndexRef
            });
          });
          context.values[inst.valueIndex] = items;
          break;
        default:
          throw new Error("Unsupported");
      }
      if (inst.valueIndex && context.valuesTypes[inst.valueIndex] === "local") {
        result.push(["set_local", context.values[inst.valueIndex]]);
      }
      if (inst.valueIndex && !context.valuesTypes[inst.valueIndex]) {
        result.push(context.values[inst.valueIndex]);
      }
    });
    return result;
  }

  function translateExprInto(expr, context, items, index) {
    while (Array.isArray(expr) && expr.length === 1) {
      expr = expr[0];
    }
    if (typeof expr === 'object' && expr !== null && expr.expr) {
      var cond = context.conditions[expr.expr];
      context.valuesRegs.push({
        targetItems: items,
        index: index,
        valueIndexRef: cond.valueIndexRef
      });
      return;
    }
    if (expr === "label") {
      context.localRegs.push({targetItems: items, index: index});
      return;
    }
    if (typeof expr === "number") {
      items[index] = expr;
      return;
    }
    if (!Array.isArray(expr) || expr.length === 0) {
      throw new Error('Unsupported');
    }
    var i = expr.indexOf("&&");
    if (i >= 0) {
      var ifItems = ['if', null, null, 0];
      translateExprInto(expr.slice(0, i), context, ifItems, 1);
      translateExprInto(expr.slice(i + 1), context, ifItems, 2);
      items[index] = ifItems;
      return;
    }
    i = expr.indexOf("==");
    if (i >= 0) {
      var cmpItems = ['i32.eq', null, null];
      translateExprInto(expr.slice(0, i), context, cmpItems, 1);
      translateExprInto(expr.slice(i + 1), context, cmpItems, 2);
      items[index] = cmpItems;
      return;
    }
    if (expr.length === 2 && expr[0] === '!') {
      var ifItems = ['if', null, 0, 1];
      translateExprInto(expr[1], context, ifItems, 1);
      items[index] = ifItems;
      return;
    }
    throw new Error("Unsupported");
  }

  function translateFunction(types, globalValues, fn) {
    var localValues = globalValues.slice(0);

    var nextLocalIndex = 0;
    fn.params.forEach(function (p) {
      localValues[p.valueIndex] = {type: "local", index: nextLocalIndex++};
    });

    fn.constants.forEach(function (c) {
      localValues[c.valueIndex] = {type: "const", v: c};
    });

    var localTypes = [];
    var declaredBlocks = fn.declareBlocks;
    fn.blocks.forEach(function (block, blockIndex) {
      block.instructions.forEach(function (inst) {
        if (inst.valueIndex) {
          localValues[inst.valueIndex] = {
            type: "inst",
            inst: inst,
            blockIndex: blockIndex
          };
        }
      });
    });
    var valueRefs = [];
    fn.blocks.forEach(function (block, blockIndex) {
      block.instructions.forEach(function (inst, instIndex) {
        findValuesReferences(inst, valueRefs, blockIndex, instIndex);
      });
    });

    var valueTypes = valueRefs.map(function (vr, index) {
      if (!vr) {
        return null;
      }

      var value = localValues[index];
      if (value.type !== "inst") {
        return value;
      }
      if (value.inst.instruction === 19) { // allocated to be local
        localTypes.push(translateType(types, value.inst.typeIndexRef));
        return {type: "localRef", index: nextLocalIndex++};
      }
      if (vr.length === 1 && // has one ref
        vr[0].blockIndex === value.blockIndex) { // the same block
        return {type: "tmp"};
      }
      localTypes.push(translateType(types, value.inst.typeIndexRef));
      return {type: "local", index: nextLocalIndex++};
    });

    var relooped = reloopFlow(fn);
    var labelVarIndex = -1;
    if (relooped.hasLabel) {
      labelVarIndex = nextLocalIndex;
      localTypes.push("i32");
      nextLocalIndex++;
    }

    var root = [];
    var queue = relooped.shapes.map(function (s) {
      return {targetContainer: root, item: s};
    });
    var context = {
      labelsRegs: [],
      localRegs: [],
      exprRegs: [],
      valuesRegs: [],
      values: [],
      conditions: relooped.conditions,
      valuesTypes: valueTypes,
      types: types
    };

    localValues.forEach(function (lv, index) {
      if (lv.type === "const") {
        var type = types[lv.v.typeIndexRef];
        switch (type.type) {
          case "integer":
            context.values[index] = "" + lv.v.value;
            break;
          case "float":
            context.values[index] = "" + lv.v.value;
            if (context.values[index].indexOf(".") < 0) {
              context.values[index] += ".0";
            }
            break;
          default:
            context.values[index] = "NaN"; // FIXME
            break;
        }
      } else if (lv.type === "local") {
        context.values[index] = ['get_local', lv.index];
      }
    });

    while (queue.length > 0) {
      var task = queue.shift();
      switch (task.item.type) {
        case "expr":
          var blockIndex = task.item.expr;
          var block = fn.blocks[blockIndex];
          Array.prototype.push.apply(task.targetContainer, translateBlock(block, blockIndex, context));
          break;
        case "block":
          var items = ['block'];
          task.item.shapes.forEach(function (s) {
            queue.push({targetContainer: items, item: s});
          });
          task.targetContainer.push(items);
          break;
        case "loop":
          var loopBody = ['block'];
          task.item.body.forEach(function (s) {
            queue.push({targetContainer: loopBody, item: s});
          });
          task.targetContainer.push(['loop', loopBody]);
          break;
        case "if":
          var thenBody = ['block'];
          task.item.thenShapes.forEach(function (s) {
            queue.push({targetContainer: thenBody, item: s});
          });
          var items = ['if', null, thenBody];
          translateExprInto(task.item.condition, context, items, 1);
          var elseBody = null;
          if (task.item.elseShapes) {
            elseBody = ['block'];
            task.item.elseShapes.forEach(function (s) {
              queue.push({targetContainer: elseBody, item: s});
            });
            items.push(elseBody);
          }
          task.targetContainer.push(items);
          break;
        case "break":
          var items = [task.item.isContinue ? 'continue' : 'break'];
          if (task.item.label) {
            items.push(null);
            context.labelsRegs.push({
              targetItems: items,
              index: 2,
              blockIndex: task.item.label
            })
          }
          task.targetContainer.push(items);
          break;
        default:
          throw new Error();

      }
    }

    context.valuesRegs.forEach(function (reg) {
      var v = context.values[reg.valueIndexRef];
      if (v === undefined) {
        throw new Error("Unsupported");
      }
      reg.targetItems[reg.index] = v;
    });

    var fnType = types[fn.typeIndexRef];
    var params = [];
    fnType.paramTypeRefs.forEach(function (pt) {
      params.push(['param', translateType(types, pt)]);
    });
    params.push(['result', translateType(types, fnType.returnTypeRef)]);
    if (localTypes.length) {
      params.push(['local'].concat(localTypes));
    }
    return ['func'].concat(params, root);
  }

  function translateModule(module) {
    var types = [];
    module.types.forEach(function (t, index) {
      types[index] = t
    });

    var imports = [];
    var globalValues = [];
    module.globalVars.forEach(function (v) {
      globalValues[v.valueIndex] = {type: "memory", global: true, value: v};
    });
    module.declaredFunctions.forEach(function (f) {
      if (f.bodyIndex < 0) {
        var importIndex = imports.length;
        var importItems = ['import', "\"external\"", "\"" + f.name + "\""];
        imports.push(importItems);
        globalValues[f.valueIndex] = {
          type: "function",
          imported: true,
          value: f,
          importIndex: importIndex
        };
      } else {
        globalValues[f.valueIndex] = {
          type: "function",
          imported: false,
          value: f,
          bodyIndex: f.bodyIndex
        };
      }
    });
    module.constants.forEach(function (c) {
      globalValues[c.valueIndex] = {type: "const", v: c};
    });

    var functions = module.functions.map(function (f) {
      return translateFunction(types, globalValues, f);
    });
    var exports = [].map(function (exportName) {
      return ['export', "\"" + exportName + "\"", module.declaredFunctions.filter(function (f) {
        return f.name === exportName;
      })[0].bodyIndex];
    });
    return ['module'].concat(imports, functions, exports);
  }

  function formatSexpr(obj) {
    function print(arr, indent) {
      var i = 0;
      var s = indent + '(';
      while (i < arr.length && !Array.isArray(arr[i])) {
        i++;
      }
      s += arr.slice(0, i).join(' ');
      if (i >= arr.length) {
        return s + ')\n';
      }
      s += '\n' + arr.slice(i).map(function (item) {
          if (!Array.isArray(item)) {
            return indent + '  ' + item + '\n';
          }
          return print(item, indent + '  ');
        }).join('');
      return s + indent + ')\n';
    }

    return print(obj, '');
  }

  exports.translateLlvmToWasm = function (buffer) {
    var module = llvmbcparser.parseLLVMBitcode(buffer);
    var translated = translateModule(module);
    return formatSexpr(translated);
  };
}));
