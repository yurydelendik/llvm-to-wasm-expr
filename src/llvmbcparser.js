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

// See http://llvm.org/docs/BitCodeFormat.html ... eh, scratch that
// See ./lib/Bitcode/Writer/BitcodeWriter.cpp and ./include/llvm/Bitcode/LLVMBitCodes.h

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['exports'], ['bcparser'], factory);
  } else if (typeof exports !== 'undefined') {
    factory(exports, require('./bcparser'));
  } else {
    factory((root.llvmbcparser = {}), root.bcparser);
  }
}(this, function (exports, bcparser) {
  var MODULE_BLOCK_ID = 8;
  var PARAMATTR_BLOCK_ID = 9;
  var PARAMATTR_GROUP_BLOCK_ID = 10;
  var CONSTANTS_BLOCK_ID = 11;
  var FUNCTION_BLOCK_ID = 12;
  var TYPE_SYMTAB_BLOCK_ID = 13;
  var VALUE_SYMTAB_BLOCK_ID = 14;
  var METADATA_BLOCK_ID = 15;
  var METADATA_ATTACHMENT_ID = 16;
  var TYPE_BLOCK_ID = 17;

  var MODULE_CODE_VERSION = 1;
  var MODULE_CODE_TRIPLE = 2;
  var MODULE_CODE_DATALAYOUT = 3;
  var MODULE_CODE_ASM = 4;
  var MODULE_CODE_SECTIONNAME = 5;
  var MODULE_CODE_DEPLIB = 6;
  var MODULE_CODE_GLOBALVAR = 7;
  var MODULE_CODE_FUNCTION = 8;
  var MODULE_CODE_ALIAS = 9;
  var MODULE_CODE_PURGEVALS = 10;
  var MODULE_CODE_GCNAME = 11;

  var PARAMATTR_CODE_ENTRY = 2;
  var PARAMATTR_GROUP_CODE_ENTRY = 3;

  var TYPE_CODE_NUMENTRY = 1;
  var TYPE_CODE_VOID = 2;
  var TYPE_CODE_FLOAT = 3;
  var TYPE_CODE_DOUBLE = 4;
  var TYPE_CODE_LABEL = 5;
  var TYPE_CODE_OPAQUE = 6;
  var TYPE_CODE_INTEGER = 7;
  var TYPE_CODE_POINTER = 8;
  var TYPE_CODE_FUNCTION_OLD = 9;
  var TYPE_CODE_HALF = 10;
  var TYPE_CODE_ARRAY = 11;
  var TYPE_CODE_VECTOR = 12;
  var TYPE_CODE_X86_FP80 = 13;
  var TYPE_CODE_FP128 = 14;
  var TYPE_CODE_PPC_FP128 = 15;
  var TYPE_CODE_METADATA = 16;
  var TYPE_CODE_STRUCT_ANON = 18;
  var TYPE_CODE_STRUCT_NAME = 19;
  var TYPE_CODE_STRUCT_NAMED = 20;
  var TYPE_CODE_FUNCTION = 21;

  var CST_CODE_SETTYPE = 1;
  var CST_CODE_NULL = 2;
  var CST_CODE_UNDEF = 3;
  var CST_CODE_INTEGER = 4;
  var CST_CODE_WIDE_INTEGER = 5;
  var CST_CODE_FLOAT = 6;
  var CST_CODE_AGGREGATE = 7;
  var CST_CODE_STRING = 8;
  var CST_CODE_CSTRING = 9;
  var CST_CODE_CE_GEP = 12;
  var CST_CODE_CE_INBOUNDS_GEP = 20;

  var VST_CODE_ENTRY = 1;
  var VST_CODE_BBENTRY = 2;
  var VST_CODE_FNENTRY = 3;

  var FUNC_CODE_DECLAREBLOCKS = 1;
  var FUNC_CODE_INST_BINOP = 2;
  var FUNC_CODE_INST_CAST = 3;
  var FUNC_CODE_INST_GEP_OLD = 4;
  var FUNC_CODE_INST_SELECT = 5;
  var FUNC_CODE_INST_EXTRACTELT = 6;
  var FUNC_CODE_INST_INSERTELT = 7;
  var FUNC_CODE_INST_SHUFFLEVEC = 8;
  var FUNC_CODE_INST_CMP = 9;
  var FUNC_CODE_INST_RET = 10;
  var FUNC_CODE_INST_BR = 11;
  var FUNC_CODE_INST_SWITCH = 12;
  var FUNC_CODE_INST_INVOKE = 13;
  var FUNC_CODE_INST_UNREACHABLE = 15;
  var FUNC_CODE_INST_PHI = 16;
  var FUNC_CODE_INST_ALLOCA = 19;
  var FUNC_CODE_INST_LOAD = 20;
  var FUNC_CODE_INST_VAARG = 23;
  var FUNC_CODE_INST_STORE_OLD = 24;
  var FUNC_CODE_INST_EXTRACTVAL = 26;
  var FUNC_CODE_INST_INSERTVAL = 27;
  var FUNC_CODE_INST_CMP2 = 28;
  var FUNC_CODE_INST_VSELECT = 29;
  var FUNC_CODE_INST_INBOUNDS_GEP_OLD = 30;
  var FUNC_CODE_INST_INDIRECTBR = 31;
  var FUNC_CODE_DEBUG_LOC_AGAIN = 33;
  var FUNC_CODE_INST_CALL = 34;
  var FUNC_CODE_DEBUG_LOC = 35;
  var FUNC_CODE_INST_FENCE = 36;
  var FUNC_CODE_INST_CMPXCHG_OLD = 37;
  var FUNC_CODE_INST_ATOMICRMW = 38;
  var FUNC_CODE_INST_RESUME = 39;
  var FUNC_CODE_INST_LANDINGPAD_OLD = 40;
  var FUNC_CODE_INST_LOADATOMIC = 41;
  var FUNC_CODE_INST_STOREATOMIC_OLD = 42;
  var FUNC_CODE_INST_GEP = 43;
  var FUNC_CODE_INST_STORE = 44;
  var FUNC_CODE_INST_STOREATOMIC = 45;
  var FUNC_CODE_INST_CMPXCHG = 46;
  var FUNC_CODE_INST_LANDINGPAD = 47;
  var FUNC_CODE_INST_CLEANUPRET = 48;
  var FUNC_CODE_INST_CATCHRET = 49;
  var FUNC_CODE_INST_CATCHPAD = 50;
  var FUNC_CODE_INST_TERMINATEPAD = 51;
  var FUNC_CODE_INST_CLEANUPPAD = 52;
  var FUNC_CODE_INST_CATCHENDPAD = 53;
  var FUNC_CODE_INST_CLEANUPENDPAD = 54;
  var FUNC_CODE_OPERAND_BUNDLE = 55;


  function ValuesBag(parentBag) {
    this.values = parentBag ? parentBag.values.slice(0) : [];
    this.valuesCallbacks = [];
  }
  Object.defineProperty(ValuesBag.prototype, "length", {
    get: function () { return this.values.length; },
    enumerable: true,
    configurable: true
  });
  ValuesBag.prototype.appendValue = function (value) {
    var index = this.values.length;
    this.values.push(value);
    if (this.valuesCallbacks[index]) {
      this.valuesCallbacks[index].forEach(function (callback) {
        callback(value, index);
      });
      delete this.valuesCallbacks[index];
    }
    return index;
  };
  ValuesBag.prototype.getValue = function (index) {
    return this.values[index];
  };
  ValuesBag.prototype.hasValue = function (index) {
    return index < this.values.length;
  };


  function codesToString(codes) {
    return String.fromCharCode.apply(null, codes);
  }

  function translateTypeBlock(block) {
    var entries = [];
    var numEntries = -1;
    var structName = null;
    block.content.forEach(function (record) {
      if (record.type === "record") {
        switch (record.code) {
          case TYPE_CODE_NUMENTRY:
            numEntries = record.ops[0];
            break;
          case TYPE_CODE_STRUCT_NAME:
            structName = codesToString(record.ops);
            break;
          case TYPE_CODE_INTEGER:
            entries.push({type: "integer", size: record.ops[0], bytes: (record.ops[0] + 7) >> 3});
            break;
          case TYPE_CODE_ARRAY:
            var bytes = record.ops[0] * entries[record.ops[1]].bytes;
            entries.push({type: "array", itemTypeRef: record.ops[1], length: record.ops[0], bytes: bytes});
            break;
          case TYPE_CODE_POINTER:
            entries.push({type: "pointer", itemTypeRef: record.ops[0], addressSpace: record.ops[1]});
            break;
          case TYPE_CODE_FUNCTION_OLD:
            // [vararg, attrid, retty, paramty x N]
            entries.push({type: "function", vararg: !!record.ops[0], returnTypeRef: record.ops[2], paramTypeRefs: record.ops.slice(3)});
          case TYPE_CODE_FUNCTION:
            // [vararg, retty, paramty x N]
            entries.push({type: "function", vararg: !!record.ops[0], returnTypeRef: record.ops[1], paramTypeRefs: record.ops.slice(2)});
            break;
          case TYPE_CODE_FLOAT:
            entries.push({type: "float", bytes: 4});
            break;
          case TYPE_CODE_DOUBLE:
            entries.push({type: "double", bytes: 8});
            break;
          case TYPE_CODE_LABEL:
            entries.push({type: "label"});
            break;
          case TYPE_CODE_METADATA:
            entries.push({type: "metadata"});
            break;
          case TYPE_CODE_VOID:
            entries.push({type: "void"});
            break;
          case TYPE_CODE_STRUCT_ANON:
          case TYPE_CODE_STRUCT_NAMED:
            var isPacked = !!record.ops[0];
            var types = record.ops.slice(1);
            var bytes = 0;
            types.forEach(function (t) { bytes += entries[t].bytes; });
            entries.push({type: "struct", types: types, isPacked: isPacked, name: record.code === TYPE_CODE_STRUCT_NAMED ? structName : undefined});
            structName = null;
          default:
            throw new Error("Unsupported type");
            break;
        }
      }
    });
    return entries;
  }

  function getBuffer(value) {
    // FIXME
    return typeof value === "number" ? new Int32Array([value]).buffer : value;
  }

  function fixGlobalVar(value, values) {
    // FIXME
    if (value.type !== "globalVar") {
      return value;
    }
    return values.getValue(value.valueIndexRef);
  }

  function translateConstantsBlock(block, types, values) {
    var entries = [];
    var currentTypeIndex = -1, currentType;
    block.content.forEach(function (record) {
      if (record.type === "record") {
        var value, buffer;
        var entry = null;
        switch (record.code) {
          case CST_CODE_SETTYPE:
            currentTypeIndex = record.ops[0];
            currentType = types[currentTypeIndex];
            break;
          case CST_CODE_NULL:
            value = currentType.type === "integer" || currentType.type === "float" || currentType.type === "double" ? 0 : null;
            entry = {value: value, typeIndexRef: currentTypeIndex};
            break;
          case CST_CODE_UNDEF:
            entry = {value: undefined, typeIndexRef: currentTypeIndex};
            break;
          case CST_CODE_INTEGER:
            value = record.ops[0];
            if (typeof value !== "number") {
              throw new Error("Overflow");
            }
            value = value & 1 ? -(value >>> 1) : (value >>> 1); // sign correction
            entry = {value: value, typeIndexRef: currentTypeIndex};
            break;
          case CST_CODE_FLOAT:
            buffer = getBuffer(record.ops[0]);
            if (currentType.type === "float") {
              value = new DataView(buffer).getFloat32(0, true);
            } else if (currentType.type === "double") {
              value = new DataView(buffer).getFloat64(0, true);
            } else {
              throw new Error("Unsupported float size");
            }
            entry = {value: value, typeIndexRef: currentTypeIndex};
            break;
          case CST_CODE_STRING:
            entry = {value: new Uint8Array(record.ops), typeIndexRef: currentTypeIndex};
            break;
          case CST_CODE_CSTRING:
            entry = {value: new Uint8Array(record.ops.concat(0)), typeIndexRef: currentTypeIndex};
            break;
          case CST_CODE_CE_GEP:
          case CST_CODE_CE_INBOUNDS_GEP: //[n x operands]
            value = values.getValue(record.ops[2]);
            value = fixGlobalVar(value, values);
            for (var i = 3; i < record.ops.length; i += 2) {
              if (types[record.ops[i]].type !== "integer" ||
                values.getValue(record.ops[i + 1]).type !== "const" ||
                values.getValue(record.ops[i + 1]).value !== 0) {
                throw new Error("Unsupported GEP arguments");
              }
            }
            entry = {value: value.value, typeIndexRef: currentTypeIndex};
            break;
          default:
            throw new Error("Unsupported const");
            break;
        }
        if (entry) {
          entries.push(entry);
          entry.valueIndex = values.appendValue({type: "const", value: entry.value, typeIndexRef: entry.typeIndexRef});
        }
      }
    });
    return entries;
  }

  function translateFunctionBlock(block, module, globalValues, declaredFunction) {
    var result = {
      declareBlocks: null,
      typeIndexRef: declaredFunction.functionTypeRef,
      params: [],
      constants: [],
      metadata: null,
      blocks: []
    };

    var values = new ValuesBag(globalValues);

    var fnType = module.types[declaredFunction.functionTypeRef];
    if (fnType.type !== "function") {
      throw new Error("Not a function type");
    }
    fnType.paramTypeRefs.forEach(function (paramTypeRef, index) {
      result.params.push({
        typeIndexRef: paramTypeRef,
        valueIndex: values.appendValue({type: "param", index: index, typeIndexRef: paramTypeRef}),
      });
    });

    var getValueTypeIndex = function (value) {
      switch (value.type) {
        case "instruction":
        case "const":
        case "param":
        case "globalVar":
        case "declaredFunction":
          return value.typeIndexRef;
        default:
          throw new Error("unreachable");
      }
    };
    var getValueDesc = function (typeIndex, valueIndex) {
      return {typeIndexRef: typeIndex, valueIndexRef: valueIndex, futureValue: false};
    };
    var decodeValueDesc = function (offset, possibleTypeIndex) {
      offset |= 0;
      var typeIndex;
      var valueIndex = values.length - offset;
      var futureReference;
      if (offset > 0) {
        var value = values.getValue(valueIndex);
        typeIndex = getValueTypeIndex(value);
        futureReference = false;
      } else {
        typeIndex = possibleTypeIndex;
        futureReference = true;
      }
      return {typeIndexRef: typeIndex, valueIndexRef: valueIndex, futureValue: futureReference};
    };

    var currentBlock = null;
    var instructions = [];
    block.content.forEach(function (item) {
      if (item.type === "block") {
        var block = item;
        switch (block.blockID) {
          case CONSTANTS_BLOCK_ID:
            result.constants = translateConstantsBlock(block, module.types, values);
            break;
          case VALUE_SYMTAB_BLOCK_ID:
            block.content.forEach(function (entry) {
              if (entry.type !== "record") {
                return;
              }
              switch (entry.code) {
                case VST_CODE_ENTRY: // VST_ENTRY: [valueid, namechar x N]
                  var value = values.getValue(entry.ops[0]);
                  if (value && value.type === "instruction") {
                    instructions[value.index].valueName = codesToString(entry.ops.slice(1));
                  }
                  break;
                case VST_CODE_BBENTRY: // VST_BBENTRY: [bbid, namechar x N]
                  var block = result.blocks[entry.ops[0]];
                  block.labelName = codesToString(entry.ops.slice(1));
                  break;
                case VST_CODE_FNENTRY: // VST_FNENTRY: [valueid, offset, namechar x N]
                  break;
              }
            });
            break;
        }

      } else if (item.type === "record") {
        // See http://llvm.org/docs/LangRef.html
        var record = item;
        var instructionCode = record.code;
        var ops = record.ops;
        var instruction = null;
        var isTerminatorInstruction = false;
        var isNonVoidInstruction = false;
        var i, j, op1, op2;
        switch (record.code) {
          case FUNC_CODE_DECLAREBLOCKS: // [n]
            result.declareBlocks = ops[0];
            break;

          case FUNC_CODE_INST_ALLOCA: //  [instty, opty, op, align]
            instruction = {
              instruction: instructionCode,
              typeIndexRef: ops[0],
              size: getValueDesc(ops[1], ops[2]),
              align: ops[3]
            };
            isNonVoidInstruction = true;
            break;

          case FUNC_CODE_INST_BINOP: // [opcode, ty, opval, opval]
            i = 0;
            op1 = decodeValueDesc(ops[i], ops[i + 1]);
            i += op1.futureValue ? 2 : 1;
            op2 = decodeValueDesc(ops[i], op1.typeIndex);
            i++;
            instruction = {
              instruction: instructionCode,
              typeIndexRef: op1.typeIndexRef,
              opcode: ops[i],
              left: op1,
              right: op2,
              flags: i + 1 < ops.length ? undefined : ops[i + 1]
            };
            isNonVoidInstruction = true;
            break;

          case FUNC_CODE_INST_CMP2: // [opty, opval, opval, pred]
            i = 0;
            op1 = decodeValueDesc(ops[i], ops[i + 1]);
            i += op1.futureValue ? 2 : 1;
            op2 = decodeValueDesc(ops[i], op1.typeIndex);
            i++;
            instruction = {
              instruction: instructionCode,
              typeIndexRef: op1.typeIndexRef,
              opcode: ops[i],
              left: op1,
              right: op2,
              flags: i + 1 < ops.length ? undefined : ops[i + 1]
            };
            isNonVoidInstruction = true;
            break;

          case FUNC_CODE_INST_LOAD: // [opty, op, align, vol]
            op1 = decodeValueDesc(ops[0], ops[1]);
            i = op1.futureValue ? 2 : 1;
            instruction = {
              instruction: instructionCode,
              typeIndexRef: ops[i],
              arg: op1,
              align: ops[i + 1]
            };
            isNonVoidInstruction = true;
            break;

          case FUNC_CODE_INST_STORE: // [ptrty,ptr,valty,val, align, vol]
            i = 0;
            op1 = decodeValueDesc(ops[i], ops[i + 1]);
            i += op1.futureValue? 2 : 1;
            op2 = decodeValueDesc(ops[i], ops[i + 1]);
            i += op2.futureValue ? 2 : 1;
            instruction = {
              instruction: instructionCode,
              ptr: op1,
              arg: op2,
              align: ops[i],
              volatile: ops[i + 1]
            };
            break;

          case FUNC_CODE_INST_BR: //  [bb#, bb#, cond] or [bb#]
            if (ops.length === 1) {
              instruction = {
                instruction: instructionCode,
                jump: ops[0]
              };
            } else {
              instruction = {
                instruction: instructionCode,
                jump: ops[0],
                alternative: ops[1],
                cond: decodeValueDesc(ops[2], -1)
              };
            }
            isTerminatorInstruction = true;
            break;

          case FUNC_CODE_INST_RET: //  [opty,opval<both optional>]
            if (ops.length >= 1) {
              // TODO more than one arg
              instruction = {
                instruction: instructionCode,
                arg: decodeValueDesc(ops[0], ops.length === 1 ? -1 : ops[2])
              };
            } else {
              instruction = {
                instruction: instructionCode
              };
            }
            isTerminatorInstruction = true;
            break;


          case FUNC_CODE_INST_CALL: // [attr, cc, fnty, fnid, args...]
            i = 3;
            op1 = decodeValueDesc(ops[i], ops[i + 1]);
            i += op1.futureValue ? 2 : 1;

            var fnType = module.types[ops[2]];
            if (fnType.type !== "function") {
              throw new Error("Invalid type for call function");
            }

            var args = [];
            for (j = 0; j < fnType.paramTypeRefs.length; j++) {
              var argTypeIndex = fnType.paramTypeRefs[j];
              args.push(decodeValueDesc(ops[i], argTypeIndex));
              i++;
            }

            if (fnType.vararg) {
              while (i < ops.length) {
                op2 = decodeValueDesc(ops[i], i + 1 < ops.length ? ops[i + 1] : -1);
                i += op2.futureValue ? 2 : 1;
                args.push(op2);
              }
            }

            instruction = {
              instruction: instructionCode,
              attributes: ops[0],
              callconv: ops[1],
              typeIndexRef: fnType.returnTypeRef,
              callee: op1,
              args: args
            };
            isNonVoidInstruction = true;
            break;

          case FUNC_CODE_INST_CAST: // [opcode, ty, opty, opval]
          case FUNC_CODE_INST_GEP_OLD: //  [n x operands]
          case FUNC_CODE_INST_SELECT: //  [ty, opval, opval, opval]
          case FUNC_CODE_INST_EXTRACTELT: // [opty, opval, opval]
          case FUNC_CODE_INST_INSERTELT: // [ty, opval, opval, opval]
          case FUNC_CODE_INST_SHUFFLEVEC: // [ty, opval, opval, opval]
          case FUNC_CODE_INST_SWITCH: // [opty, op0, op1, ...]
          case FUNC_CODE_INST_INVOKE://  [attr, fnty, op0,op1, ...]
          case FUNC_CODE_INST_CMP: //  [opty, opval, opval, pred]
          case FUNC_CODE_INST_UNREACHABLE:
          case FUNC_CODE_INST_PHI: // [ty, val0,bb0, ...]
          case FUNC_CODE_INST_VAARG: //  [valistty, valist, instty]
          case FUNC_CODE_INST_STORE_OLD: // [ptrty,ptr,val, align, vol]
          case FUNC_CODE_INST_EXTRACTVAL: // [n x operands]
          case FUNC_CODE_INST_INSERTVAL: //  [n x operands]
          case FUNC_CODE_INST_VSELECT: // [ty,opval,opval,predty,pred]
          case FUNC_CODE_INST_INBOUNDS_GEP_OLD: // [n x operands]
          case FUNC_CODE_INST_INDIRECTBR: // [opty, op0, op1, ...]
          case FUNC_CODE_DEBUG_LOC_AGAIN: // DEBUG_LOC_AGAIN
          case FUNC_CODE_DEBUG_LOC: // [Line,Col,ScopeVal, IAVal]
          case FUNC_CODE_INST_FENCE: // [ordering, synchscope]
          case FUNC_CODE_INST_CMPXCHG_OLD: //[ptrty,ptr,cmp,new, align, vol, ordering, synchscope]
          case FUNC_CODE_INST_ATOMICRMW: // [ptrty,ptr,val, operation, align, vol, ordering, synchscope]
          case FUNC_CODE_INST_RESUME: //  [opval]
          case FUNC_CODE_INST_LANDINGPAD_OLD: // [ty,val,val,num,id0,val0...]
          case FUNC_CODE_INST_LOADATOMIC: // [opty, op, align, vol, ordering, synchscope]
          case FUNC_CODE_INST_STOREATOMIC_OLD: // [ptrty,ptr,val, align, vol, ordering, synchscope]
          case FUNC_CODE_INST_GEP: // [inbounds, n x operands]
          case FUNC_CODE_INST_STOREATOMIC: // [ptrty,ptr,val, align, vol
          case FUNC_CODE_INST_CMPXCHG: // [ptrty,ptr,valty,cmp,new, align, vol,ordering,synchscope]
          case FUNC_CODE_INST_LANDINGPAD: // [ty,val,num,id0,val0...]
          case FUNC_CODE_INST_CLEANUPRET: // [val] or [val,bb#]
          case FUNC_CODE_INST_CATCHRET: // [val,bb#]
          case FUNC_CODE_INST_CATCHPAD: // [bb#,bb#,num,args...]
          case FUNC_CODE_INST_TERMINATEPAD: // [bb#,num,args...]
          case FUNC_CODE_INST_CLEANUPPAD: // [num,args...]
          case FUNC_CODE_INST_CATCHENDPAD: // [] or [bb#]
          case FUNC_CODE_INST_CLEANUPENDPAD: // [val] or [val,bb#]
          case FUNC_CODE_OPERAND_BUNDLE: // [tag#, value...]
            instruction = {instruction: instructionCode, nonParsed: true, args: record.ops, valueOffset: values.length};

            isTerminatorInstruction =
              instructionCode === FUNC_CODE_INST_RET || instructionCode === FUNC_CODE_INST_BR ||
              instructionCode === FUNC_CODE_INST_SWITCH || instructionCode === FUNC_CODE_INST_INDIRECTBR ||
              instructionCode === FUNC_CODE_INST_INVOKE || instructionCode === FUNC_CODE_INST_RESUME ||
              instructionCode === FUNC_CODE_INST_CATCHPAD || instructionCode === FUNC_CODE_INST_CATCHENDPAD ||
              instructionCode === FUNC_CODE_INST_CATCHRET || instructionCode === FUNC_CODE_INST_TERMINATEPAD ||
              instructionCode === FUNC_CODE_INST_UNREACHABLE;
            isNonVoidInstruction =
              instructionCode === FUNC_CODE_INST_INVOKE || instructionCode === FUNC_CODE_INST_CATCHPAD ||
              instructionCode === FUNC_CODE_INST_BINOP || instructionCode === FUNC_CODE_INST_ALLOCA ||
              instructionCode === FUNC_CODE_INST_LOAD || instructionCode === FUNC_CODE_INST_GEP ||
              instructionCode === FUNC_CODE_INST_GEP_OLD || instructionCode === FUNC_CODE_INST_CAST ||
              instructionCode === FUNC_CODE_INST_CMP || instructionCode === FUNC_CODE_INST_CMP2 ||
              instructionCode === FUNC_CODE_INST_PHI || instructionCode === FUNC_CODE_INST_SELECT ||
              instructionCode === FUNC_CODE_INST_CALL || instructionCode === FUNC_CODE_INST_VAARG ||
              instructionCode === FUNC_CODE_INST_LANDINGPAD || instructionCode === FUNC_CODE_INST_LANDINGPAD_OLD ||
              instructionCode === FUNC_CODE_INST_CLEANUPPAD;
            break;
          default:
            throw new Error("Unsupported");
        }
        if (instruction) {
          if (!currentBlock) {
            currentBlock = {
              instructions: []
            };
            result.blocks.push(currentBlock);
          }

          if (isNonVoidInstruction) {
            instruction.valueIndex = values.appendValue({type: "instruction", index: instructions.length, typeIndexRef: instruction.typeIndexRef});
          }

          instructions.push(instruction);
          currentBlock.instructions.push(instruction);
        }
        if (isTerminatorInstruction) {
          currentBlock = null;
        }
      }
    });
    if (currentBlock) {
      throw new Error('Incomplete block');
    }
    return result;
  }

  function translateModuleValueSymbols(block, module, values, fnOffsets, functions) {
    block.content.forEach(function (record) {
      if (record.type === "record") {
        switch (record.code) {
          case VST_CODE_ENTRY: // [valueid, namechar x N]
            var value = values.getValue(record.ops[0]);
            switch (value.type) {
              case "globalVar":
                module.globalVars[value.index].name = codesToString(record.ops.slice(1));
                break;
              case "declaredFunction":
                module.declaredFunctions[value.index].name = codesToString(record.ops.slice(1));
                break;
              default:
                throw new Error('Unexpected value symbol');
            }
            break;
          case VST_CODE_FNENTRY: // [valueid, funcoffset, namechar x N]
            var value = values.getValue(record.ops[0]);
            if (value.type !== "declaredFunction") {
              throw new Error('Unexpected value symbol');
            }
            var declaredFunction = module.declaredFunctions[value.index];

            var bodyIndex = fnOffsets[record.ops[1]];
            if (bodyIndex === undefined) {
              throw new Error('Function body was not found.');
            }

            declaredFunction.name = codesToString(record.ops.slice(2));
            declaredFunction.bodyIndex = bodyIndex;
            functions[bodyIndex].declaredFunction = declaredFunction;
            break;
        }
      }
    });
  }

  function translateModuleBlock(moduleBlock) {
    var module = {
      version: undefined,
      triple: undefined,
      datalayout: undefined,
      globalVars: [],
      declaredFunctions: [],
      types: [],
      constants: [],
      functions: []
    };
    var values = new ValuesBag(null);
    var fnOffsets = [];
    var functions = [];
    var vstFound = false;
    moduleBlock.content.forEach(function (item) {
      if (item.type === "block") {
        switch (item.blockID) {
          case TYPE_BLOCK_ID:
            module.types = translateTypeBlock(item);
            break;
          case CONSTANTS_BLOCK_ID:
            module.constants = translateConstantsBlock(item, module.types, values);
            break;
          case FUNCTION_BLOCK_ID:
            fnOffsets[(item.offset / 32)>>>0] = functions.length;
            functions.push({block: item, declaredFunction: null});
            if (vstFound) { // FIXME find the right way
              var index = functions.length - 1;
              functions[index].declaredFunction = module.declaredFunctions[index];
              module.declaredFunctions[index].bodyIndex = index;
            }
            break;
          case VALUE_SYMTAB_BLOCK_ID:
            vstFound = true;
            translateModuleValueSymbols(item, module, values, fnOffsets, functions);
            break;
        }
      } else {
        var record = item;
        switch (record.code) {
          case MODULE_CODE_VERSION:
            module.version = record.ops[0];
            break;
          case MODULE_CODE_TRIPLE:
            module.triple = codesToString(record.ops);
            break;
          case MODULE_CODE_DATALAYOUT:
            module.datalayout = codesToString(record.ops);
            break;
          case MODULE_CODE_GLOBALVAR:
            // [pointer type, isconst, initid, linkage, alignment, section, visibility, threadlocal]
            var globalVar = {name: null, pointerTypeRef: record.ops[0], isConst: record.ops[1], initizerIndex: undefined}; // TODO more args
            if (record.ops[2]) { // has initializer
              globalVar.initiazerIndex = record.ops[2] - 1;
            }
            module.globalVars.push(globalVar);
            globalVar.valueIndex = values.appendValue({type: "globalVar", index: module.globalVars.length - 1, valueIndexRef: globalVar.initiazerIndex});
            break;
          case MODULE_CODE_FUNCTION:
            // [type, callingconv, isproto, linkage, paramattrs, alignment,
            //  section, visibility, gc, unnamed_addr]
            var declaredFunction = {name: null, functionTypeRef: record.ops[0], bodyIndex: -1}; // TODO more args
            module.declaredFunctions.push(declaredFunction);
            declaredFunction.valueIndex = values.appendValue({type: "declaredFunction", index: module.declaredFunctions.length - 1, typeIndexRef: declaredFunction.functionTypeRef});
            break;
        }
      }
    });
    functions.forEach(function(fn) {
      module.functions.push(translateFunctionBlock(fn.block, module, values, fn.declaredFunction));
    });
    return module;
  }

  function parseLLVMBitcode(buffer) {
    var reader = new bcparser.BitReader(buffer, 0, buffer.byteLength);
    var magic = reader.read32bit();
    if (!(magic ^ 0xDEC04342)) {
      reader.position = 0;
    } else {
      var version = reader.read32bit();
      if (magic !== 0x0B17C0DE || version !== 0) {
        throw new Error('Invalid wrapper headers: magic and version');
      }
      var offset = reader.read32bit();
      var size = reader.read32bit();
      var cpuType = reader.read32bit();

      reader = new bcparser.BitReader(buffer, offset, size);
    }

    var content = bcparser.parseBC(reader);
    if (content.length !== 1 ||
      content[0].type !== "block" || content[0].blockID !== MODULE_BLOCK_ID) {
      throw new Error("Invalid content");
    }

    return content[0] && translateModuleBlock(content[0]);
  }

  exports.parseLLVMBitcode = parseLLVMBitcode;
}));
