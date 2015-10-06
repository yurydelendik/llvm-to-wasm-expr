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

// See http://llvm.org/docs/BitCodeFormat.html

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['exports'], factory);
  } else if (typeof exports !== 'undefined') {
    factory(exports);
  } else {
    factory((root.bcparser = {}));
  }
}(this, function (exports) {

  var Char6Encoding = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._";

  var BitReader = function (buffer, offset, length) {
    this.data = new Uint8Array(buffer, offset, length);
    this.position = 0;
    this.buffer = 0;
    this.bufferSize = 0;
  };
  BitReader.prototype = {
    get offset() {
      return this.position * 8 - this.bufferSize;
    },
    readBits: function (size) {
      if (size > 23) { // cannot do more than 23 -- due to int32 sign overflow
        return this.readBits(size - 16) * 0x10000 + this.readBits(16);
      }
      while (this.bufferSize < size) {
        if (this.position >= this.data.length) {
          throw new Error('EOF');
        }
        this.buffer |= (this.data[this.position++] << this.bufferSize);
        this.bufferSize += 8;
      }
      var result = this.buffer & ((1 << size) - 1);
      this.buffer >>= size;
      this.bufferSize -= size;
      return result;
    },
    read32bit: function () {
      if ((this.position & 3) !== 0 || this.bufferSize !== 0) {
        throw new Error('Unaligned');
      }
      var result = this.data[this.position] | (this.data[this.position + 1] << 8) |
        (this.data[this.position + 2] << 16) | (this.data[this.position + 3] << 24);
      this.position += 4;
      return result;
    },
    align: function () {
      this.position = (this.position + 3) & ~3;
      this.buffer = 0;
      this.bufferSize = 0;
    },
    readVBR: function (size) {
      var mask = 1 << (size - 1), mult = 1;
      var result = 0, more, overflow = null;
      do {
        var chunk = this.readBits(size);
        var more = chunk & mask;
        if (mult >= 4294967296) {
          overflow = overflow || [];
          overflow.push(result & 255, (result >> 8) & 255, (result >> 16) & 255);
          mult /= 4294967296;
          result = result >>> 24;
        }
        result += mult * (chunk & (mask - 1));
        mult *= mask;
      } while (more);
      if (overflow === null) {
        return result;
      }
      while (mult > 1) {
        overflow.push(result & 255);
        result = result >>> 8;
        mult /= 0x100;
      }
      while ((overflow.length & 7)) { // align to 64 bit
        overflow.push(0);
      }
      return new Uint8Array(overflow).buffer;
    },
    readChar6: function () {
      var code = this.readBits(6);
      return Char6Encoding.charCodeAt(code);
    },
    isEOF: function () {
      return this.position >= this.data.length && this.bufferSize === 0;
    }
  };

  var END_BLOCK = 0;
  var ENTER_SUBBLOCK = 1;
  var DEFINE_ABBREV = 2;
  var UNABBREV_RECORD = 3;

  var BLOCKINFO_ID = 0;

  var SETBID_CODE = 1;
  var BLOCKNAME_CODE = 2;
  var SETRECORDNAME_CODE = 3;

  var FIXED_ENCODING = 1;
  var VBR_ENCODING = 2;
  var ARRAY_ENCODING = 3;
  var CHAR6_ENCODING = 4;
  var BLOB_ENCODING = 5;

  function parseBC(reader) {
    var startBitOffset = reader.offset;

    var magic = reader.readBits(16);
    if (magic !== 0x4342 /* BC */) {
      throw new Error('Invalid BC magic');
    }
    var magic2 = reader.readBits(16);
    if (magic2 !== 0xDEC0 /* 0xCODE */) {
      throw new Error('Invalid app magic');
    }
    var blockContext = {
      abbrevIDSize: 2,
      abbrevDefined: [],
      blockInfos: Object.create(null),
      id: -1,
      currentBlockInfo: null,
      content: [],
      ends: reader.length
    };
    var stack = [];
    while (!reader.isEOF()) {
      var offset = reader.offset - startBitOffset;
      var abbrevID = reader.readBits(blockContext.abbrevIDSize);
      switch (abbrevID) {
        case END_BLOCK:
          reader.align();

          if (blockContext.id === BLOCKINFO_ID) {
            blockContext = stack.pop();
            break;
          }

          var item = {
            type: "block",
            blockID: blockContext.id,
            content: blockContext.content,
            offset: blockContext.offset
          };
          blockContext = stack.pop();
          var info = blockContext.blockInfos[item.blockID];
          if (info && (info.name || info.recordNames)) {
            item.meta = {name: info.name, recordNames: info.recordNames};
          }
          blockContext.content.push(item);
          break;
        case ENTER_SUBBLOCK:
          var blockID = reader.readVBR(8);
          var newAbbrevIDSize = reader.readVBR(4);
          reader.align();
          var blockSize = reader.read32bit();

          stack.push(blockContext);
          if (blockID === BLOCKINFO_ID) {
            blockContext = {
              abbrevIDSize: newAbbrevIDSize,
              abbrevDefined: null,
              blockInfos: blockContext.blockInfos,
              id: blockID,
              currentBlockInfo: null,
              content: null,
              offset: offset,
              ends: reader.position + (blockSize << 2)
            };
            break;
          }
          blockContext = {
            abbrevIDSize: newAbbrevIDSize,
            abbrevDefined: blockContext.blockInfos[blockID] ? blockContext.blockInfos[blockID].abbrevDefined.slice(0) : [],
            blockInfos: Object.create(blockContext.blockInfos),
            id: blockID,
            currentBlockInfo: null,
            content: [],
            offset: offset,
            ends: reader.position + (blockSize << 2)
          };
          break;
        case DEFINE_ABBREV:
          var numops = reader.readVBR(5);
          var ops = new Array(numops);
          for (var i = 0; i < numops; i++) {
            var isLiteral = reader.readBits(1);
            if (isLiteral) {
              var value = reader.readVBR(8);
              ops[i] = {isLiteral: true, value: value};
            } else {
              var encoding = reader.readBits(3);
              switch (encoding) {
                case FIXED_ENCODING:
                case VBR_ENCODING:
                  var size = reader.readVBR(5);
                  ops[i] = {isLiteral: false, encoding: encoding, size: size};
                  break;
                case ARRAY_ENCODING:
                  if (i !== numops - 2) {
                    throw new Error("Invalid usage of array encoding");
                  }
                  ops[i] = {isLiteral: false, encoding: encoding};
                  break;
                case BLOB_ENCODING:
                  if (i !== numops - 1) {
                    throw new Error("Invalid usage of array encoding");
                  }
                  ops[i] = {isLiteral: false, encoding: encoding};
                  break;
                case CHAR6_ENCODING:
                  ops[i] = {isLiteral: false, encoding: encoding};
                  break;
                default:
                  throw new Error("Unsupported encoding");
              }
            }
          }
          if (blockContext.id === BLOCKINFO_ID) {
            blockContext.currentBlockInfo.abbrevDefined.push(ops);
            break;
          }
          blockContext.abbrevDefined.push(ops);
          break;
        case UNABBREV_RECORD:
          var code = reader.readVBR(6);
          var numops = reader.readVBR(6);
          var ops = new Array(numops);
          for (var i = 0; i < numops; i++) {
            ops[i] = reader.readVBR(6);
          }

          if (blockContext.id === BLOCKINFO_ID) {
            switch (code) {
              case SETBID_CODE:
                blockContext.currentBlockInfo = {
                  id: ops[0],
                  abbrevDefined: [],
                  name: null,
                  recordNames: null
                };
                blockContext.blockInfos[ops[0]] = blockContext.currentBlockInfo;
                break;
              case BLOCKNAME_CODE:
                blockContext.currentBlockInfo.name = String.fromCharCode.apply(null, ops);
                break;
              case SETRECORDNAME_CODE:
                var recordNames = blockContext.currentBlockInfo.recordNames || (blockContext.currentBlockInfo.recordNames = []);
                recordNames[ops[0]] = String.fromCharCode.apply(null, ops.slice(1));
                break;
            }
            break;
          }
          blockContext.content.push({type: "record", abbrev: false, code: code, ops: ops});
          break;
        default:
          var abbrev = blockContext.abbrevDefined[abbrevID - 4];
          var ops = [];
          for (var i = 0; i < abbrev.length; i++) {
            if (abbrev[i].isLiteral) {
              ops.push(abbrev[i].value);
              continue;
            }
            switch (abbrev[i].encoding) {
              case FIXED_ENCODING:
                ops.push(reader.readBits(abbrev[i].size));
                break;
              case VBR_ENCODING:
                ops.push(reader.readVBR(abbrev[i].size));
                break;
              case ARRAY_ENCODING:
                var length = reader.readVBR(6);
                i++;
                for (var j = 0; j < length; j++) {
                  switch (abbrev[i].encoding) {
                    case FIXED_ENCODING:
                      ops.push(reader.readBits(abbrev[i].size));
                      break;
                    case VBR_ENCODING:
                      ops.push(reader.readVBR(abbrev[i].size));
                      break;
                    case CHAR6_ENCODING:
                      ops.push(reader.readChar6());
                      break;
                    default:
                      throw new Error('Unsupported encoding for array item');
                  }
                }
                break;
              case CHAR6_ENCODING:
                ops.push(reader.readChar6());
                break;
              case BLOB_ENCODING:
                var length = reader.readVBR(6);
                reader.align();
                ops.push(new Uint8Array(this.buffer, this.position, this.position + length));
                this.position += length;
                reader.align();
                break;
            }
          }
          blockContext.content.push({type: "record", abbrev: true, code: ops[0], ops: ops.slice(1)});
          break;
      }
    }
    return blockContext.content;
  }

  exports.BitReader = BitReader;
  exports.parseBC = parseBC;
}));
