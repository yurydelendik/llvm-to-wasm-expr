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
    define(['exports'], factory);
  } else if (typeof exports !== 'undefined') {
    factory(exports);
  } else {
    factory((root.relooperparser = {}));
  }
}(this, function (exports) {

  function Tokenizer(buffer) {
    this.buffer = buffer;
    this.position = 0;
    this.currentToken = null;
    this.value = null;
    this.error = null;
  }
  Tokenizer.prototype.nextToken = function () {
    if (this.position >= this.buffer.length) {
      return (this.currentToken = null); // EOF
    }
    if (this.currentToken === "error") {
      return this.currentToken;
    }

    var ch = this.buffer[this.position++];
    this.value = null;
    if (ch === " " || ch === "\n" || (ch === "/" && this.buffer[this.position] === "/")) {
      do {
        if (ch === "/") {
          while ((ch = this.buffer[this.position]) && ch !== "\n") {
            this.position++;
          }
          this.position++;
        }
      } while ((ch = this.buffer[this.position]) === " " || ch === "\n" || (ch === "/" && this.buffer[this.position] === "/"));
      return (this.currentToken = " ");
    }

    if (ch === "{" || ch === "}" || ch === "(" || ch === ")" ||
        ch === ":" || ch === ";" || ch === "!") {
      return (this.currentToken = ch);
    }
    if (ch === "&") {
      if (this.buffer[this.position] !== "&") {
        this.error = "expected &&";
        return (this.currentToken = "error");
      }
      this.position++;
      return (this.currentToken = "&&");
    }
    if (ch === "|") {
      if (this.buffer[this.position] !== "0") {
        this.error = "expected |0";
        return (this.currentToken = "error");
      }
      this.position++;
      return (this.currentToken = "|0");
    }
    if (ch === "=") {
      if (this.buffer[this.position] !== "=") {
        return (this.currentToken = "=");
      }
      this.position++;
      return (this.currentToken = "==");
    }

    if (ch >= "0" && ch <= "9") {
      var number = ch;
      while ((ch = this.buffer[this.position]) >= "0" && ch <= "9") {
        number += ch;
        this.position++;
      }
      this.value = +number;
      return (this.currentToken = "number");
    }
    if (ch === "L") {
      var label = "";
      while ((ch = this.buffer[this.position]) >= "0" && ch <= "9") {
        label += ch;
        this.position++;
      }
      this.value = +label;
      return (this.currentToken = "label");
    }
    if (ch === "\"") {
      var expr = "";
      while ((ch = this.buffer[this.position]) >= "0" && ch <= "9") {
        expr += ch;
        this.position++;
      }
      if (this.buffer[this.position] !== "\"") {
        this.error = "unexpected numbered expression";
        return (this.currentToken = "error");
      }
      this.position++;
      this.value = +expr;
      return (this.currentToken = "expr");
    }
    if (ch >= "a" && ch <= "z") {
      var keyword = ch;
      while ((ch = this.buffer[this.position]) >= "a" && ch <= "z") {
        keyword += ch;
        this.position++;
      }
      if (keyword !== "if" && keyword !== "else" &&
          keyword !== "switch" && keyword !== "case" && keyword !== "default" &&
          keyword !== "while" && keyword !== "do" && keyword !== "break" &&
          keyword !== "continue" && keyword !== "label") {
        this.error = "unknown keyword: " + keyword;
        return (this.currentToken = "error");
      }
      this.value = keyword;
      return (this.currentToken = "keyword");
    }
    this.error = "expected symbol: " + ch;
    this.currentToken = "error";
  };

  function readSetLabel(tokenizer) {
    if (tokenizer.nextToken() === " ") {
      tokenizer.nextToken();
    }
    if (tokenizer.currentToken !== "=") {
      throw new Error("expected label=");
    }
    if (tokenizer.nextToken() === " ") {
      tokenizer.nextToken();
    }
    if (tokenizer.currentToken !== "number") {
      throw new Error("expected label number");
    }
    var label = tokenizer.value;
    if (tokenizer.nextToken() !== ";") {
      throw  new Error("expected ;")
    }
    tokenizer.nextToken();
    return {type: "setlabel", label: label};
  }

  function readLabel(tokenizer) {
    var label = tokenizer.value;
    if (tokenizer.nextToken() !== ":") {
      throw new Error('expected :');
    }
    if (tokenizer.nextToken() === " ") {
      tokenizer.nextToken();
    }

    var result = null;
    switch (tokenizer.currentToken) {
      case "{":
        result = {type: "block", shapes: readShapes(tokenizer, false)};
        break;
      case "label":
        shapes.push(readLabel(tokenizer));
        break;
      case "keyword":
        switch (tokenizer.value) {
          case "label":
            result = readSetLabel(tokenizer);
            break;
          case "if":
            result = readIfShape(tokenizer);
            break;
          case "while":
            result = readWhileShape(tokenizer);
            break;
          case "do":
            result = readDoWhileShape(tokenizer);
            break;
          case "switch":
            result = readSwitchShape(tokenizer);
            break;
          case "break":
          case "continue":
            result = readBreak(tokenizer);
            break;
          default:
            throw new Error("Unexpected keyword: " + tokenizer.value);
        }
        break;
      case "expr":
        var expr = tokenizer.value;
        if (tokenizer.nextToken() === ";") {
          throw new Error("Expected ;");
        }
        tokenizer.nextToken();
        result = {type: "expr", expr: expr};
        break;
      default:
        throw new Error("Unexpected token: " + tokenizer.currentToken);
    }
    return {type: "label", label: label, shape: result};
  }

  function readExpression(tokenizer) {
    tokenizer.nextToken();
    var items = [];
    eo_expression:
    while (true) {
      switch (tokenizer.currentToken) {
        case " ":
          tokenizer.nextToken();
          break;
        case "(":
          items.push(readExpression(tokenizer));
          break;
        case ")":
          tokenizer.nextToken();
          break eo_expression;
        case "==":
        case "&&":
        case "!":
          items.push(tokenizer.currentToken);
          tokenizer.nextToken();
          break;
        case "|0":
          // items.push("|0");
          tokenizer.nextToken();
          break;
        case "number":
          items.push(tokenizer.value);
          tokenizer.nextToken();
          break;
        case "expr":
          items.push({expr: tokenizer.value});
          tokenizer.nextToken();
          break;
        case "keyword":
          switch (tokenizer.value) {
            case "label":
              items.push("label");
              break;
            default:
              throw new Error("unexpected keyword: " + tokenizer.value);
          }
          tokenizer.nextToken();
          break;
        default:
          throw new Error("unexpected token: " + tokenizer.currentToken);
      }
    }
    return items;
  }

  function readBreak(tokenizer) {
    var isContinue = tokenizer.currentToken === "continue";
    if (tokenizer.nextToken() === " ") {
      tokenizer.nextToken();
    }
    var label = null;
    switch (tokenizer.currentToken) {
      case ";":
        tokenizer.nextToken();
        break;
      case "label":
        label = tokenizer.value;
        if (tokenizer.nextToken() !== ";") {
          throw new Error("expected ;");
        }
        tokenizer.nextToken();
        break;
      default:
        throw new Error("expected label");
    }
    return {type: "break", isContinue: isContinue, label: label};
  }

  function readWhileShape(tokenizer) {
    if (tokenizer.nextToken() === " ") {
      tokenizer.nextToken();
    }

    if (tokenizer.currentToken !== "(") {
      throw new Error("expected expression");
    }

    var condition = readExpression(tokenizer);

    if (condition.length !== 1 && condition[0] !== 1) {
      throw new Error("expected while(1)");
    }

    if (tokenizer.currentToken === " ") {
      tokenizer.nextToken();
    }

    if (tokenizer.currentToken !== "{") {
      throw new Error("expected shapes");
    }

    var body = readShapes(tokenizer, false);

    return {type: "loop", body: body};
  }

  function readDoWhileShape(tokenizer) {
    if (tokenizer.nextToken() === " ") {
      tokenizer.nextToken();
    }

    if (tokenizer.currentToken !== "{") {
      throw new Error("expected shapes");
    }

    var body = readShapes(tokenizer, false);

    if (tokenizer.currentToken === " ") {
      tokenizer.nextToken();
    }

    if (tokenizer.currentToken !== "keyword" || tokenizer.value !== "while") {
      throw new Error("expected while");
    }

    if (tokenizer.nextToken() === " ") {
      tokenizer.nextToken();
    }

    if (tokenizer.currentToken !== "(") {
      throw new Error("expected expression");
    }

    var condition = readExpression(tokenizer);

    if (tokenizer.currentToken === " ") {
      tokenizer.nextToken();
    }
    if (tokenizer.currentToken !== ";") {
      throw new Error("expected ;");
    }
    tokenizer.nextToken();

    if (condition.length !== 1 || condition[0] !== 0) {
      throw new Error("expected while(0)");
    }

    return {type: "block", shapes: body, dowhile: true};
  }

  function readSwitchShape(tokenizer) {
    if (tokenizer.nextToken() === " ") {
      tokenizer.nextToken();
    }

    if (tokenizer.currentToken !== "(") {
      throw new Error("expected expression");
    }

    var selector = readExpression(tokenizer);

    if (tokenizer.currentToken === " ") {
      tokenizer.nextToken();
    }

    if (tokenizer.currentToken !== "{") {
      throw new Error("expected switch cases");
    }

    tokenizer.nextToken();

    var arms = [];
    eo_switch:
    while (true) {
      switch (tokenizer.currentToken) {
        case " ":
          tokenizer.nextToken();
          break;
        case "}":
          tokenizer.nextToken();
          break eo_switch;
        case "keyword":
          var value = null;
          switch (tokenizer.value) {
            case "case":
              if (tokenizer.nextToken() === " ") {
                tokenizer.nextToken();
              }
              switch (tokenizer.currentToken) {
                case "expr":
                  value = {"expr": tokenizer.value};
                  break;
                case "number":
                  value = tokenizer.value;
                  break;
                default:
                  throw new Error("expected valid case value");
              }
              tokenizer.nextToken();
              break;
            case "default":
              tokenizer.nextToken();
              break;
            default:
              throw new Error("expected case or default");
          }

          if (tokenizer.currentToken !== ":") {
            throw new Error("expected :");
          }

          if (tokenizer.nextToken() === " ") {
            tokenizer.nextToken();
          }

          if (tokenizer.currentToken !== "{") {
            throw new Error("expected case shapes");
          }

          var body = readShapes(tokenizer, false);
          arms.push({value: value, body: body});
          break;
        default:
          throw new Error("expected switch case");
      }
    }
    return {type: "switch", selector: selector, arms: arms};
  }

  function readIfShape(tokenizer) {
    if (tokenizer.nextToken() === " ") {
      tokenizer.nextToken();
    }

    if (tokenizer.currentToken !== "(") {
      throw new Error("expected expression");
    }

    var condition = readExpression(tokenizer);

    if (tokenizer.currentToken === " ") {
      tokenizer.nextToken();
    }

    if (tokenizer.currentToken !== "{") {
      throw new Error("expected shapes");
    }

    var thenShapes = readShapes(tokenizer, false);

    if (tokenizer.currentToken === " ") {
      tokenizer.nextToken();
    }

    var elseShapes = null;
    if (tokenizer.currentToken === "keyword" && tokenizer.value === "else") {
      if (tokenizer.nextToken() === " ") {
        tokenizer.nextToken();
      }

      if (tokenizer.currentToken === "keyword" && tokenizer.value === "if") {
        tokenizer.nextToken();
        elseShapes = [readIfShape(tokenizer)];
      } else {
        if (tokenizer.currentToken !== "{") {
          throw new Error("expected shapes");
        }

        elseShapes = readShapes(tokenizer, false);
      }
    }

    return {type: "if", condition: condition, thenShapes: thenShapes, elseShapes: elseShapes};
  }

  function readShapes(tokenizer, global) {
    if (!global) {
      tokenizer.nextToken();
    }
    var shapes = [];
    var labels = null;
    eo_shapes:
    while (true) {
      if (!tokenizer.currentToken) {
        if (!global) {
          throw new Error('unexpected EOF');
        }
        break;
      }
      switch (tokenizer.currentToken) {
        case " ":
          tokenizer.nextToken();
          break;
        case "}":
          if (global) {
            throw new Error('unexpected }');
          }
          tokenizer.nextToken();
          break eo_shapes;
        case "{":
          shapes.push({type: "block", shapes: readShapes(tokenizer, false)});
          break;
        case "label":
          shapes.push(readLabel(tokenizer));
          break;
        case "keyword":
          switch (tokenizer.value) {
            case "label":
              shapes.push(readSetLabel(tokenizer));
              break;
            case "if":
              shapes.push(readIfShape(tokenizer));
              break;
            case "while":
              shapes.push(readWhileShape(tokenizer));
              break;
            case "do":
              shapes.push(readDoWhileShape(tokenizer));
              break;
            case "switch":
              shapes.push(readSwitchShape(tokenizer));
              break;
            case "break":
            case "continue":
              shapes.push(readBreak(tokenizer));
              break;
            default:
              throw new Error("Unexpected keyword: " + tokenizer.value);
          }
          break;
        case "expr":
          var expr = tokenizer.value;
          if (tokenizer.nextToken() !== ";") {
            throw new Error("Expected ;");
          }
          tokenizer.nextToken();
          shapes.push({type: "expr", expr: expr});
          break;
        default:
          throw new Error("Unexpected token: " + tokenizer.currentToken);
      }
    }
    return shapes;
  }
  function parseJSShapes(code) {
    var tokenizer = new Tokenizer(code);
    if (!tokenizer.nextToken()) {
      return [];
    }
    var shapes = readShapes(tokenizer, true);
    return shapes;
  }

  exports.parseJSShapes = parseJSShapes;
}));
