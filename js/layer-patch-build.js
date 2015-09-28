(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function (global){
if (!global.layer) global.layer = {};
if (!global.layer.js) global.layer.js = {};
global.layer.js.LayerPatchParser = require("./layer-patch");
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"./layer-patch":2}],2:[function(require,module,exports){
/**
 * The layer.js.LayerPatchParser method will parse
 *
 * @method
 * @param {Boolean} [camelCase=false]                      Set the camel cased version of the name of the input object
 * @param {Object} [propertyNameMap]                  Maps property names in the operation to property names in the local object schema
 * @param {Object} [changeCallbacks]                  Callback made any time an object is changed
 * @param {Object} [abortCallbacks]             Callback made to verify a change is permitted
 * @param {Function} [doesObjectMatchIdCallback]      Callback returns boolean to indicate if a given object matches an ID.
 * @return {Boolean}                                Returns true if all operations completed successfully, false if some returned errors
 */


var opHandlers = {
    "set": setProp,
    "delete": deleteProp,
    "add": addProp,
    "remove": removeProp
};

function Parser(options) {
    this.camelCase = options.camelCase;
    this.propertyNameMap = options.propertyNameMap;
    this.changeCallbacks = options.changeCallbacks;
    this.abortCallbacks = options.abortCallbacks;
    this.getObjectCallback = options.getObjectCallback;
    this.doesObjectMatchIdCallback = options.doesObjectMatchIdCallback || function(id, obj) {
        return obj.id == id;
    };
    this.returnIds = options.returnIds;
    return this;
};
module.exports = Parser;

Parser.prototype.parse = function(options) {
    var changes = {};
    options.operations.forEach(function(op) {
        var propertyDef = getPropertyDef.apply(this, [op.property, options, changes, op])
        opHandlers[op.operation].call(this,
            propertyDef,
            getValue.apply(this, [op, options]),
            op, options, changes);
    }, this);

    reportChanges.apply(this, [changes, options.object, options.type]);
};

function reportChanges(changes, updateObject, objectType) {
    if (this.changeCallbacks && objectType && this.changeCallbacks[objectType]) {
        Object.keys(changes).forEach(function(key) {
            if (this.changeCallbacks[objectType].all) {
                this.changeCallbacks[objectType].all(updateObject, updateObject[key], changes[key].before, changes[key].paths);
            }
            else if (this.changeCallbacks[objectType][key]) {
                this.changeCallbacks[objectType][key](updateObject, updateObject[key], changes[key].before, changes[key].paths);
            }
        }, this);
    }
}

function getPropertyDef(property, options, changes, operation) {
    var obj = options.object;
    var temporarySeparator = String.fromCharCode(145);
    property = property.replace(/\\\./g, temporarySeparator);
    property = property.replace(/\\(.)/g, "$1");
    var parts = property.split(/\./);

    var r = new RegExp(temporarySeparator, "g")
    parts = parts.map(function(part) {
        return part.replace(r, ".");
    });

    if (this.camelCase) {
        parts[0] = parts[0].replace(/[-_]./g, function(str) {
            return str[1].toUpperCase();
        });
    }

    if (this.propertyNameMap) {
        var typeDef = this.propertyNameMap[options.type];
        parts[0] = (typeDef && typeDef[parts[0]]) || parts[0];
    }

    trackChanges.apply(this, [{
        baseName: parts[0],
        fullPath: property,
        object: options.object,
        options: options,
        changes: changes,
        operation: operation
    }]);

    var curObj = obj;
    for (var i = 0; i < parts.length-1; i++) {
        var part = parts[i];
        if (part in curObj) {
            curObj = curObj[part];
            if (curObj === null || typeof curObj != "object") throw new Error("Can not access property \"" + property + "\"");
        } else {
            curObj[part] = {};
            curObj = curObj[part];
        }
    }
    return {
        pointer: curObj,
        lastName: parts[parts.length-1],
        baseName: parts[0],
        fullPath: property,
        abortHandler: this.abortCallbacks && this.abortCallbacks[options.type] && (this.abortCallbacks[options.type].all || this.abortCallbacks[options.type][parts[0]])
    };
}

function getValue(op, options) {
    if (op.id) {
        if (!this.getObjectCallback) throw new Error("Must provide getObjectCallback in constructor to use ids");
	var result = this.getObjectCallback(op.id);
	if (result) return result;
	if (this.returnIds) return op.id;
	return null;
    } else {
        return op.value;
    }
}

function trackChanges(options) {
    if (!options.changes[options.baseName]) {
        var initialValue = options.object[options.baseName];
        if ("id" in options.operation && initialValue) {
            initialValue = initialValue.id;
        }
        var change = options.changes[options.baseName] = {paths: []};
        change.before = (initialValue && typeof initialValue == "object") ? JSON.parse(JSON.stringify(initialValue)) : initialValue;
    }
    var paths = options.changes[options.baseName].paths;
    if (paths.indexOf(options.fullPath) == -1) {
        paths.push(options.fullPath);
    }
}

function setProp(propertyDef, value, op, options, changes) {
    if (propertyDef.abortHandler) {
        if (propertyDef.abortHandler(propertyDef.fullPath, "set", value)) return;
    }
    propertyDef.pointer[propertyDef.lastName] = value;

}

function deleteProp(propertyDef, value, op, options, changes) {
    if (propertyDef.abortHandler) {
        if (propertyDef.abortHandler(propertyDef.fullPath, "delete", value)) return;
    }
    delete propertyDef.pointer[propertyDef.lastName];
}

function addProp(propertyDef, value, op, options, changes) {
    if (propertyDef.abortHandler) {
        if (propertyDef.abortHandler(propertyDef.fullPath, "add", value)) return;
    }
    var obj;
    if (propertyDef.lastName in propertyDef.pointer) {
        obj = propertyDef.pointer[propertyDef.lastName];
    } else {
        obj = propertyDef.pointer[propertyDef.lastName] = [];
    }
    if (!Array.isArray(obj)) throw new Error("The add operation requires an array or new structure to add to.");
    if (!op.id) {
        if (Array.isArray(value)) throw new Error("The add operation will not add arrays to sets.");
        if (value && typeof value == "object") throw new Error("The add operation will not add objects to sets.");
    }
    if (obj.indexOf(value) == -1) obj.push(value);
}

function removeProp(propertyDef, value, op, options, changes) {
    if (propertyDef.abortHandler) {
        if (propertyDef.abortHandler(propertyDef.fullPath, "remove", value)) return;
    }
    var obj;
    if (propertyDef.lastName in propertyDef.pointer) {
        obj = propertyDef.pointer[propertyDef.lastName];
    } else {
        obj = propertyDef.pointer[propertyDef.lastName] = [];
    }
    if (!Array.isArray(obj)) throw new Error("The remove operation requires an array or new structure to remove from.");

    if (!op.id) {
        if (Array.isArray(value)) throw new Error("The remove operation will not remove arrays from sets.");
        if (value && typeof value == "object") throw new Error("The remove operation will not remove objects from sets.");

        var index = obj.indexOf(value);
        if (index != -1) obj.splice(index, 1);
    } else {
        for (var i = 0; i < obj.length; i++) {
            if (this.doesObjectMatchIdCallback(op.id, obj[i])) {
                obj.splice(i, 1);
                break;
            }
        }
    }
}

},{}]},{},[1])
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9ncnVudC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJpbmRleC5qcyIsImxheWVyLXBhdGNoLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOztBQ0FBO0FBQ0E7QUFDQTs7OztBQ0ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiaWYgKCFnbG9iYWwubGF5ZXIpIGdsb2JhbC5sYXllciA9IHt9O1xuaWYgKCFnbG9iYWwubGF5ZXIuanMpIGdsb2JhbC5sYXllci5qcyA9IHt9O1xuZ2xvYmFsLmxheWVyLmpzLkxheWVyUGF0Y2hQYXJzZXIgPSByZXF1aXJlKFwiLi9sYXllci1wYXRjaFwiKTsiLCIvKipcbiAqIFRoZSBsYXllci5qcy5MYXllclBhdGNoUGFyc2VyIG1ldGhvZCB3aWxsIHBhcnNlXG4gKlxuICogQG1ldGhvZFxuICogQHBhcmFtIHtCb29sZWFufSBbY2FtZWxDYXNlPWZhbHNlXSAgICAgICAgICAgICAgICAgICAgICBTZXQgdGhlIGNhbWVsIGNhc2VkIHZlcnNpb24gb2YgdGhlIG5hbWUgb2YgdGhlIGlucHV0IG9iamVjdFxuICogQHBhcmFtIHtPYmplY3R9IFtwcm9wZXJ0eU5hbWVNYXBdICAgICAgICAgICAgICAgICAgTWFwcyBwcm9wZXJ0eSBuYW1lcyBpbiB0aGUgb3BlcmF0aW9uIHRvIHByb3BlcnR5IG5hbWVzIGluIHRoZSBsb2NhbCBvYmplY3Qgc2NoZW1hXG4gKiBAcGFyYW0ge09iamVjdH0gW2NoYW5nZUNhbGxiYWNrc10gICAgICAgICAgICAgICAgICBDYWxsYmFjayBtYWRlIGFueSB0aW1lIGFuIG9iamVjdCBpcyBjaGFuZ2VkXG4gKiBAcGFyYW0ge09iamVjdH0gW2Fib3J0Q2FsbGJhY2tzXSAgICAgICAgICAgICBDYWxsYmFjayBtYWRlIHRvIHZlcmlmeSBhIGNoYW5nZSBpcyBwZXJtaXR0ZWRcbiAqIEBwYXJhbSB7RnVuY3Rpb259IFtkb2VzT2JqZWN0TWF0Y2hJZENhbGxiYWNrXSAgICAgIENhbGxiYWNrIHJldHVybnMgYm9vbGVhbiB0byBpbmRpY2F0ZSBpZiBhIGdpdmVuIG9iamVjdCBtYXRjaGVzIGFuIElELlxuICogQHJldHVybiB7Qm9vbGVhbn0gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFJldHVybnMgdHJ1ZSBpZiBhbGwgb3BlcmF0aW9ucyBjb21wbGV0ZWQgc3VjY2Vzc2Z1bGx5LCBmYWxzZSBpZiBzb21lIHJldHVybmVkIGVycm9yc1xuICovXG5cblxudmFyIG9wSGFuZGxlcnMgPSB7XG4gICAgXCJzZXRcIjogc2V0UHJvcCxcbiAgICBcImRlbGV0ZVwiOiBkZWxldGVQcm9wLFxuICAgIFwiYWRkXCI6IGFkZFByb3AsXG4gICAgXCJyZW1vdmVcIjogcmVtb3ZlUHJvcFxufTtcblxuZnVuY3Rpb24gUGFyc2VyKG9wdGlvbnMpIHtcbiAgICB0aGlzLmNhbWVsQ2FzZSA9IG9wdGlvbnMuY2FtZWxDYXNlO1xuICAgIHRoaXMucHJvcGVydHlOYW1lTWFwID0gb3B0aW9ucy5wcm9wZXJ0eU5hbWVNYXA7XG4gICAgdGhpcy5jaGFuZ2VDYWxsYmFja3MgPSBvcHRpb25zLmNoYW5nZUNhbGxiYWNrcztcbiAgICB0aGlzLmFib3J0Q2FsbGJhY2tzID0gb3B0aW9ucy5hYm9ydENhbGxiYWNrcztcbiAgICB0aGlzLmdldE9iamVjdENhbGxiYWNrID0gb3B0aW9ucy5nZXRPYmplY3RDYWxsYmFjaztcbiAgICB0aGlzLmRvZXNPYmplY3RNYXRjaElkQ2FsbGJhY2sgPSBvcHRpb25zLmRvZXNPYmplY3RNYXRjaElkQ2FsbGJhY2sgfHwgZnVuY3Rpb24oaWQsIG9iaikge1xuICAgICAgICByZXR1cm4gb2JqLmlkID09IGlkO1xuICAgIH07XG4gICAgdGhpcy5yZXR1cm5JZHMgPSBvcHRpb25zLnJldHVybklkcztcbiAgICByZXR1cm4gdGhpcztcbn07XG5tb2R1bGUuZXhwb3J0cyA9IFBhcnNlcjtcblxuUGFyc2VyLnByb3RvdHlwZS5wYXJzZSA9IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgICB2YXIgY2hhbmdlcyA9IHt9O1xuICAgIG9wdGlvbnMub3BlcmF0aW9ucy5mb3JFYWNoKGZ1bmN0aW9uKG9wKSB7XG4gICAgICAgIHZhciBwcm9wZXJ0eURlZiA9IGdldFByb3BlcnR5RGVmLmFwcGx5KHRoaXMsIFtvcC5wcm9wZXJ0eSwgb3B0aW9ucywgY2hhbmdlcywgb3BdKVxuICAgICAgICBvcEhhbmRsZXJzW29wLm9wZXJhdGlvbl0uY2FsbCh0aGlzLFxuICAgICAgICAgICAgcHJvcGVydHlEZWYsXG4gICAgICAgICAgICBnZXRWYWx1ZS5hcHBseSh0aGlzLCBbb3AsIG9wdGlvbnNdKSxcbiAgICAgICAgICAgIG9wLCBvcHRpb25zLCBjaGFuZ2VzKTtcbiAgICB9LCB0aGlzKTtcblxuICAgIHJlcG9ydENoYW5nZXMuYXBwbHkodGhpcywgW2NoYW5nZXMsIG9wdGlvbnMub2JqZWN0LCBvcHRpb25zLnR5cGVdKTtcbn07XG5cbmZ1bmN0aW9uIHJlcG9ydENoYW5nZXMoY2hhbmdlcywgdXBkYXRlT2JqZWN0LCBvYmplY3RUeXBlKSB7XG4gICAgaWYgKHRoaXMuY2hhbmdlQ2FsbGJhY2tzICYmIG9iamVjdFR5cGUgJiYgdGhpcy5jaGFuZ2VDYWxsYmFja3Nbb2JqZWN0VHlwZV0pIHtcbiAgICAgICAgT2JqZWN0LmtleXMoY2hhbmdlcykuZm9yRWFjaChmdW5jdGlvbihrZXkpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmNoYW5nZUNhbGxiYWNrc1tvYmplY3RUeXBlXS5hbGwpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmNoYW5nZUNhbGxiYWNrc1tvYmplY3RUeXBlXS5hbGwodXBkYXRlT2JqZWN0LCB1cGRhdGVPYmplY3Rba2V5XSwgY2hhbmdlc1trZXldLmJlZm9yZSwgY2hhbmdlc1trZXldLnBhdGhzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKHRoaXMuY2hhbmdlQ2FsbGJhY2tzW29iamVjdFR5cGVdW2tleV0pIHtcbiAgICAgICAgICAgICAgICB0aGlzLmNoYW5nZUNhbGxiYWNrc1tvYmplY3RUeXBlXVtrZXldKHVwZGF0ZU9iamVjdCwgdXBkYXRlT2JqZWN0W2tleV0sIGNoYW5nZXNba2V5XS5iZWZvcmUsIGNoYW5nZXNba2V5XS5wYXRocyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sIHRoaXMpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZ2V0UHJvcGVydHlEZWYocHJvcGVydHksIG9wdGlvbnMsIGNoYW5nZXMsIG9wZXJhdGlvbikge1xuICAgIHZhciBvYmogPSBvcHRpb25zLm9iamVjdDtcbiAgICB2YXIgdGVtcG9yYXJ5U2VwYXJhdG9yID0gU3RyaW5nLmZyb21DaGFyQ29kZSgxNDUpO1xuICAgIHByb3BlcnR5ID0gcHJvcGVydHkucmVwbGFjZSgvXFxcXFxcLi9nLCB0ZW1wb3JhcnlTZXBhcmF0b3IpO1xuICAgIHByb3BlcnR5ID0gcHJvcGVydHkucmVwbGFjZSgvXFxcXCguKS9nLCBcIiQxXCIpO1xuICAgIHZhciBwYXJ0cyA9IHByb3BlcnR5LnNwbGl0KC9cXC4vKTtcblxuICAgIHZhciByID0gbmV3IFJlZ0V4cCh0ZW1wb3JhcnlTZXBhcmF0b3IsIFwiZ1wiKVxuICAgIHBhcnRzID0gcGFydHMubWFwKGZ1bmN0aW9uKHBhcnQpIHtcbiAgICAgICAgcmV0dXJuIHBhcnQucmVwbGFjZShyLCBcIi5cIik7XG4gICAgfSk7XG5cbiAgICBpZiAodGhpcy5jYW1lbENhc2UpIHtcbiAgICAgICAgcGFydHNbMF0gPSBwYXJ0c1swXS5yZXBsYWNlKC9bLV9dLi9nLCBmdW5jdGlvbihzdHIpIHtcbiAgICAgICAgICAgIHJldHVybiBzdHJbMV0udG9VcHBlckNhc2UoKTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMucHJvcGVydHlOYW1lTWFwKSB7XG4gICAgICAgIHZhciB0eXBlRGVmID0gdGhpcy5wcm9wZXJ0eU5hbWVNYXBbb3B0aW9ucy50eXBlXTtcbiAgICAgICAgcGFydHNbMF0gPSAodHlwZURlZiAmJiB0eXBlRGVmW3BhcnRzWzBdXSkgfHwgcGFydHNbMF07XG4gICAgfVxuXG4gICAgdHJhY2tDaGFuZ2VzLmFwcGx5KHRoaXMsIFt7XG4gICAgICAgIGJhc2VOYW1lOiBwYXJ0c1swXSxcbiAgICAgICAgZnVsbFBhdGg6IHByb3BlcnR5LFxuICAgICAgICBvYmplY3Q6IG9wdGlvbnMub2JqZWN0LFxuICAgICAgICBvcHRpb25zOiBvcHRpb25zLFxuICAgICAgICBjaGFuZ2VzOiBjaGFuZ2VzLFxuICAgICAgICBvcGVyYXRpb246IG9wZXJhdGlvblxuICAgIH1dKTtcblxuICAgIHZhciBjdXJPYmogPSBvYmo7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBwYXJ0cy5sZW5ndGgtMTsgaSsrKSB7XG4gICAgICAgIHZhciBwYXJ0ID0gcGFydHNbaV07XG4gICAgICAgIGlmIChwYXJ0IGluIGN1ck9iaikge1xuICAgICAgICAgICAgY3VyT2JqID0gY3VyT2JqW3BhcnRdO1xuICAgICAgICAgICAgaWYgKGN1ck9iaiA9PT0gbnVsbCB8fCB0eXBlb2YgY3VyT2JqICE9IFwib2JqZWN0XCIpIHRocm93IG5ldyBFcnJvcihcIkNhbiBub3QgYWNjZXNzIHByb3BlcnR5IFxcXCJcIiArIHByb3BlcnR5ICsgXCJcXFwiXCIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY3VyT2JqW3BhcnRdID0ge307XG4gICAgICAgICAgICBjdXJPYmogPSBjdXJPYmpbcGFydF07XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHtcbiAgICAgICAgcG9pbnRlcjogY3VyT2JqLFxuICAgICAgICBsYXN0TmFtZTogcGFydHNbcGFydHMubGVuZ3RoLTFdLFxuICAgICAgICBiYXNlTmFtZTogcGFydHNbMF0sXG4gICAgICAgIGZ1bGxQYXRoOiBwcm9wZXJ0eSxcbiAgICAgICAgYWJvcnRIYW5kbGVyOiB0aGlzLmFib3J0Q2FsbGJhY2tzICYmIHRoaXMuYWJvcnRDYWxsYmFja3Nbb3B0aW9ucy50eXBlXSAmJiAodGhpcy5hYm9ydENhbGxiYWNrc1tvcHRpb25zLnR5cGVdLmFsbCB8fCB0aGlzLmFib3J0Q2FsbGJhY2tzW29wdGlvbnMudHlwZV1bcGFydHNbMF1dKVxuICAgIH07XG59XG5cbmZ1bmN0aW9uIGdldFZhbHVlKG9wLCBvcHRpb25zKSB7XG4gICAgaWYgKG9wLmlkKSB7XG4gICAgICAgIGlmICghdGhpcy5nZXRPYmplY3RDYWxsYmFjaykgdGhyb3cgbmV3IEVycm9yKFwiTXVzdCBwcm92aWRlIGdldE9iamVjdENhbGxiYWNrIGluIGNvbnN0cnVjdG9yIHRvIHVzZSBpZHNcIik7XG5cdHZhciByZXN1bHQgPSB0aGlzLmdldE9iamVjdENhbGxiYWNrKG9wLmlkKTtcblx0aWYgKHJlc3VsdCkgcmV0dXJuIHJlc3VsdDtcblx0aWYgKHRoaXMucmV0dXJuSWRzKSByZXR1cm4gb3AuaWQ7XG5cdHJldHVybiBudWxsO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBvcC52YWx1ZTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHRyYWNrQ2hhbmdlcyhvcHRpb25zKSB7XG4gICAgaWYgKCFvcHRpb25zLmNoYW5nZXNbb3B0aW9ucy5iYXNlTmFtZV0pIHtcbiAgICAgICAgdmFyIGluaXRpYWxWYWx1ZSA9IG9wdGlvbnMub2JqZWN0W29wdGlvbnMuYmFzZU5hbWVdO1xuICAgICAgICBpZiAoXCJpZFwiIGluIG9wdGlvbnMub3BlcmF0aW9uICYmIGluaXRpYWxWYWx1ZSkge1xuICAgICAgICAgICAgaW5pdGlhbFZhbHVlID0gaW5pdGlhbFZhbHVlLmlkO1xuICAgICAgICB9XG4gICAgICAgIHZhciBjaGFuZ2UgPSBvcHRpb25zLmNoYW5nZXNbb3B0aW9ucy5iYXNlTmFtZV0gPSB7cGF0aHM6IFtdfTtcbiAgICAgICAgY2hhbmdlLmJlZm9yZSA9IChpbml0aWFsVmFsdWUgJiYgdHlwZW9mIGluaXRpYWxWYWx1ZSA9PSBcIm9iamVjdFwiKSA/IEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkoaW5pdGlhbFZhbHVlKSkgOiBpbml0aWFsVmFsdWU7XG4gICAgfVxuICAgIHZhciBwYXRocyA9IG9wdGlvbnMuY2hhbmdlc1tvcHRpb25zLmJhc2VOYW1lXS5wYXRocztcbiAgICBpZiAocGF0aHMuaW5kZXhPZihvcHRpb25zLmZ1bGxQYXRoKSA9PSAtMSkge1xuICAgICAgICBwYXRocy5wdXNoKG9wdGlvbnMuZnVsbFBhdGgpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gc2V0UHJvcChwcm9wZXJ0eURlZiwgdmFsdWUsIG9wLCBvcHRpb25zLCBjaGFuZ2VzKSB7XG4gICAgaWYgKHByb3BlcnR5RGVmLmFib3J0SGFuZGxlcikge1xuICAgICAgICBpZiAocHJvcGVydHlEZWYuYWJvcnRIYW5kbGVyKHByb3BlcnR5RGVmLmZ1bGxQYXRoLCBcInNldFwiLCB2YWx1ZSkpIHJldHVybjtcbiAgICB9XG4gICAgcHJvcGVydHlEZWYucG9pbnRlcltwcm9wZXJ0eURlZi5sYXN0TmFtZV0gPSB2YWx1ZTtcblxufVxuXG5mdW5jdGlvbiBkZWxldGVQcm9wKHByb3BlcnR5RGVmLCB2YWx1ZSwgb3AsIG9wdGlvbnMsIGNoYW5nZXMpIHtcbiAgICBpZiAocHJvcGVydHlEZWYuYWJvcnRIYW5kbGVyKSB7XG4gICAgICAgIGlmIChwcm9wZXJ0eURlZi5hYm9ydEhhbmRsZXIocHJvcGVydHlEZWYuZnVsbFBhdGgsIFwiZGVsZXRlXCIsIHZhbHVlKSkgcmV0dXJuO1xuICAgIH1cbiAgICBkZWxldGUgcHJvcGVydHlEZWYucG9pbnRlcltwcm9wZXJ0eURlZi5sYXN0TmFtZV07XG59XG5cbmZ1bmN0aW9uIGFkZFByb3AocHJvcGVydHlEZWYsIHZhbHVlLCBvcCwgb3B0aW9ucywgY2hhbmdlcykge1xuICAgIGlmIChwcm9wZXJ0eURlZi5hYm9ydEhhbmRsZXIpIHtcbiAgICAgICAgaWYgKHByb3BlcnR5RGVmLmFib3J0SGFuZGxlcihwcm9wZXJ0eURlZi5mdWxsUGF0aCwgXCJhZGRcIiwgdmFsdWUpKSByZXR1cm47XG4gICAgfVxuICAgIHZhciBvYmo7XG4gICAgaWYgKHByb3BlcnR5RGVmLmxhc3ROYW1lIGluIHByb3BlcnR5RGVmLnBvaW50ZXIpIHtcbiAgICAgICAgb2JqID0gcHJvcGVydHlEZWYucG9pbnRlcltwcm9wZXJ0eURlZi5sYXN0TmFtZV07XG4gICAgfSBlbHNlIHtcbiAgICAgICAgb2JqID0gcHJvcGVydHlEZWYucG9pbnRlcltwcm9wZXJ0eURlZi5sYXN0TmFtZV0gPSBbXTtcbiAgICB9XG4gICAgaWYgKCFBcnJheS5pc0FycmF5KG9iaikpIHRocm93IG5ldyBFcnJvcihcIlRoZSBhZGQgb3BlcmF0aW9uIHJlcXVpcmVzIGFuIGFycmF5IG9yIG5ldyBzdHJ1Y3R1cmUgdG8gYWRkIHRvLlwiKTtcbiAgICBpZiAoIW9wLmlkKSB7XG4gICAgICAgIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkgdGhyb3cgbmV3IEVycm9yKFwiVGhlIGFkZCBvcGVyYXRpb24gd2lsbCBub3QgYWRkIGFycmF5cyB0byBzZXRzLlwiKTtcbiAgICAgICAgaWYgKHZhbHVlICYmIHR5cGVvZiB2YWx1ZSA9PSBcIm9iamVjdFwiKSB0aHJvdyBuZXcgRXJyb3IoXCJUaGUgYWRkIG9wZXJhdGlvbiB3aWxsIG5vdCBhZGQgb2JqZWN0cyB0byBzZXRzLlwiKTtcbiAgICB9XG4gICAgaWYgKG9iai5pbmRleE9mKHZhbHVlKSA9PSAtMSkgb2JqLnB1c2godmFsdWUpO1xufVxuXG5mdW5jdGlvbiByZW1vdmVQcm9wKHByb3BlcnR5RGVmLCB2YWx1ZSwgb3AsIG9wdGlvbnMsIGNoYW5nZXMpIHtcbiAgICBpZiAocHJvcGVydHlEZWYuYWJvcnRIYW5kbGVyKSB7XG4gICAgICAgIGlmIChwcm9wZXJ0eURlZi5hYm9ydEhhbmRsZXIocHJvcGVydHlEZWYuZnVsbFBhdGgsIFwicmVtb3ZlXCIsIHZhbHVlKSkgcmV0dXJuO1xuICAgIH1cbiAgICB2YXIgb2JqO1xuICAgIGlmIChwcm9wZXJ0eURlZi5sYXN0TmFtZSBpbiBwcm9wZXJ0eURlZi5wb2ludGVyKSB7XG4gICAgICAgIG9iaiA9IHByb3BlcnR5RGVmLnBvaW50ZXJbcHJvcGVydHlEZWYubGFzdE5hbWVdO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIG9iaiA9IHByb3BlcnR5RGVmLnBvaW50ZXJbcHJvcGVydHlEZWYubGFzdE5hbWVdID0gW107XG4gICAgfVxuICAgIGlmICghQXJyYXkuaXNBcnJheShvYmopKSB0aHJvdyBuZXcgRXJyb3IoXCJUaGUgcmVtb3ZlIG9wZXJhdGlvbiByZXF1aXJlcyBhbiBhcnJheSBvciBuZXcgc3RydWN0dXJlIHRvIHJlbW92ZSBmcm9tLlwiKTtcblxuICAgIGlmICghb3AuaWQpIHtcbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSB0aHJvdyBuZXcgRXJyb3IoXCJUaGUgcmVtb3ZlIG9wZXJhdGlvbiB3aWxsIG5vdCByZW1vdmUgYXJyYXlzIGZyb20gc2V0cy5cIik7XG4gICAgICAgIGlmICh2YWx1ZSAmJiB0eXBlb2YgdmFsdWUgPT0gXCJvYmplY3RcIikgdGhyb3cgbmV3IEVycm9yKFwiVGhlIHJlbW92ZSBvcGVyYXRpb24gd2lsbCBub3QgcmVtb3ZlIG9iamVjdHMgZnJvbSBzZXRzLlwiKTtcblxuICAgICAgICB2YXIgaW5kZXggPSBvYmouaW5kZXhPZih2YWx1ZSk7XG4gICAgICAgIGlmIChpbmRleCAhPSAtMSkgb2JqLnNwbGljZShpbmRleCwgMSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBvYmoubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmRvZXNPYmplY3RNYXRjaElkQ2FsbGJhY2sob3AuaWQsIG9ialtpXSkpIHtcbiAgICAgICAgICAgICAgICBvYmouc3BsaWNlKGksIDEpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufVxuIl19
