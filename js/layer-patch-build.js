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
    var parts = property.split(/\./);
    if (this.camelCase) parts[0] = parts[0].replace(/[-_]./g, function(str) {
        return str[1].toUpperCase();
    });

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
        return this.getObjectCallback(op.id) || op.id;
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
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9ncnVudC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJpbmRleC5qcyIsImxheWVyLXBhdGNoLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOztBQ0FBO0FBQ0E7QUFDQTs7OztBQ0ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiaWYgKCFnbG9iYWwubGF5ZXIpIGdsb2JhbC5sYXllciA9IHt9O1xuaWYgKCFnbG9iYWwubGF5ZXIuanMpIGdsb2JhbC5sYXllci5qcyA9IHt9O1xuZ2xvYmFsLmxheWVyLmpzLkxheWVyUGF0Y2hQYXJzZXIgPSByZXF1aXJlKFwiLi9sYXllci1wYXRjaFwiKTsiLCIvKipcbiAqIFRoZSBsYXllci5qcy5MYXllclBhdGNoUGFyc2VyIG1ldGhvZCB3aWxsIHBhcnNlXG4gKlxuICogQG1ldGhvZFxuICogQHBhcmFtIHtCb29sZWFufSBbY2FtZWxDYXNlPWZhbHNlXSAgICAgICAgICAgICAgICAgICAgICBTZXQgdGhlIGNhbWVsIGNhc2VkIHZlcnNpb24gb2YgdGhlIG5hbWUgb2YgdGhlIGlucHV0IG9iamVjdFxuICogQHBhcmFtIHtPYmplY3R9IFtwcm9wZXJ0eU5hbWVNYXBdICAgICAgICAgICAgICAgICAgTWFwcyBwcm9wZXJ0eSBuYW1lcyBpbiB0aGUgb3BlcmF0aW9uIHRvIHByb3BlcnR5IG5hbWVzIGluIHRoZSBsb2NhbCBvYmplY3Qgc2NoZW1hXG4gKiBAcGFyYW0ge09iamVjdH0gW2NoYW5nZUNhbGxiYWNrc10gICAgICAgICAgICAgICAgICBDYWxsYmFjayBtYWRlIGFueSB0aW1lIGFuIG9iamVjdCBpcyBjaGFuZ2VkXG4gKiBAcGFyYW0ge09iamVjdH0gW2Fib3J0Q2FsbGJhY2tzXSAgICAgICAgICAgICBDYWxsYmFjayBtYWRlIHRvIHZlcmlmeSBhIGNoYW5nZSBpcyBwZXJtaXR0ZWRcbiAqIEBwYXJhbSB7RnVuY3Rpb259IFtkb2VzT2JqZWN0TWF0Y2hJZENhbGxiYWNrXSAgICAgIENhbGxiYWNrIHJldHVybnMgYm9vbGVhbiB0byBpbmRpY2F0ZSBpZiBhIGdpdmVuIG9iamVjdCBtYXRjaGVzIGFuIElELlxuICogQHJldHVybiB7Qm9vbGVhbn0gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFJldHVybnMgdHJ1ZSBpZiBhbGwgb3BlcmF0aW9ucyBjb21wbGV0ZWQgc3VjY2Vzc2Z1bGx5LCBmYWxzZSBpZiBzb21lIHJldHVybmVkIGVycm9yc1xuICovXG5cblxudmFyIG9wSGFuZGxlcnMgPSB7XG4gICAgXCJzZXRcIjogc2V0UHJvcCxcbiAgICBcImRlbGV0ZVwiOiBkZWxldGVQcm9wLFxuICAgIFwiYWRkXCI6IGFkZFByb3AsXG4gICAgXCJyZW1vdmVcIjogcmVtb3ZlUHJvcFxufTtcblxuZnVuY3Rpb24gUGFyc2VyKG9wdGlvbnMpIHtcbiAgICB0aGlzLmNhbWVsQ2FzZSA9IG9wdGlvbnMuY2FtZWxDYXNlO1xuICAgIHRoaXMucHJvcGVydHlOYW1lTWFwID0gb3B0aW9ucy5wcm9wZXJ0eU5hbWVNYXA7XG4gICAgdGhpcy5jaGFuZ2VDYWxsYmFja3MgPSBvcHRpb25zLmNoYW5nZUNhbGxiYWNrcztcbiAgICB0aGlzLmFib3J0Q2FsbGJhY2tzID0gb3B0aW9ucy5hYm9ydENhbGxiYWNrcztcbiAgICB0aGlzLmdldE9iamVjdENhbGxiYWNrID0gb3B0aW9ucy5nZXRPYmplY3RDYWxsYmFjaztcbiAgICB0aGlzLmRvZXNPYmplY3RNYXRjaElkQ2FsbGJhY2sgPSBvcHRpb25zLmRvZXNPYmplY3RNYXRjaElkQ2FsbGJhY2sgfHwgZnVuY3Rpb24oaWQsIG9iaikge1xuICAgICAgICByZXR1cm4gb2JqLmlkID09IGlkO1xuICAgIH07XG4gICAgcmV0dXJuIHRoaXM7XG59O1xubW9kdWxlLmV4cG9ydHMgPSBQYXJzZXI7XG5cblBhcnNlci5wcm90b3R5cGUucGFyc2UgPSBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgdmFyIGNoYW5nZXMgPSB7fTtcbiAgICBvcHRpb25zLm9wZXJhdGlvbnMuZm9yRWFjaChmdW5jdGlvbihvcCkge1xuICAgICAgICB2YXIgcHJvcGVydHlEZWYgPSBnZXRQcm9wZXJ0eURlZi5hcHBseSh0aGlzLCBbb3AucHJvcGVydHksIG9wdGlvbnMsIGNoYW5nZXMsIG9wXSlcbiAgICAgICAgb3BIYW5kbGVyc1tvcC5vcGVyYXRpb25dLmNhbGwodGhpcyxcbiAgICAgICAgICAgIHByb3BlcnR5RGVmLFxuICAgICAgICAgICAgZ2V0VmFsdWUuYXBwbHkodGhpcywgW29wLCBvcHRpb25zXSksXG4gICAgICAgICAgICBvcCwgb3B0aW9ucywgY2hhbmdlcyk7XG4gICAgfSwgdGhpcyk7XG5cbiAgICByZXBvcnRDaGFuZ2VzLmFwcGx5KHRoaXMsIFtjaGFuZ2VzLCBvcHRpb25zLm9iamVjdCwgb3B0aW9ucy50eXBlXSk7XG59O1xuXG5mdW5jdGlvbiByZXBvcnRDaGFuZ2VzKGNoYW5nZXMsIHVwZGF0ZU9iamVjdCwgb2JqZWN0VHlwZSkge1xuICAgIGlmICh0aGlzLmNoYW5nZUNhbGxiYWNrcyAmJiBvYmplY3RUeXBlICYmIHRoaXMuY2hhbmdlQ2FsbGJhY2tzW29iamVjdFR5cGVdKSB7XG4gICAgICAgIE9iamVjdC5rZXlzKGNoYW5nZXMpLmZvckVhY2goZnVuY3Rpb24oa2V5KSB7XG4gICAgICAgICAgICBpZiAodGhpcy5jaGFuZ2VDYWxsYmFja3Nbb2JqZWN0VHlwZV0uYWxsKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5jaGFuZ2VDYWxsYmFja3Nbb2JqZWN0VHlwZV0uYWxsKHVwZGF0ZU9iamVjdCwgdXBkYXRlT2JqZWN0W2tleV0sIGNoYW5nZXNba2V5XS5iZWZvcmUsIGNoYW5nZXNba2V5XS5wYXRocyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmICh0aGlzLmNoYW5nZUNhbGxiYWNrc1tvYmplY3RUeXBlXVtrZXldKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5jaGFuZ2VDYWxsYmFja3Nbb2JqZWN0VHlwZV1ba2V5XSh1cGRhdGVPYmplY3QsIHVwZGF0ZU9iamVjdFtrZXldLCBjaGFuZ2VzW2tleV0uYmVmb3JlLCBjaGFuZ2VzW2tleV0ucGF0aHMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LCB0aGlzKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGdldFByb3BlcnR5RGVmKHByb3BlcnR5LCBvcHRpb25zLCBjaGFuZ2VzLCBvcGVyYXRpb24pIHtcbiAgICB2YXIgb2JqID0gb3B0aW9ucy5vYmplY3Q7XG4gICAgdmFyIHBhcnRzID0gcHJvcGVydHkuc3BsaXQoL1xcLi8pO1xuICAgIGlmICh0aGlzLmNhbWVsQ2FzZSkgcGFydHNbMF0gPSBwYXJ0c1swXS5yZXBsYWNlKC9bLV9dLi9nLCBmdW5jdGlvbihzdHIpIHtcbiAgICAgICAgcmV0dXJuIHN0clsxXS50b1VwcGVyQ2FzZSgpO1xuICAgIH0pO1xuXG4gICAgaWYgKHRoaXMucHJvcGVydHlOYW1lTWFwKSB7XG4gICAgICAgIHZhciB0eXBlRGVmID0gdGhpcy5wcm9wZXJ0eU5hbWVNYXBbb3B0aW9ucy50eXBlXTtcbiAgICAgICAgcGFydHNbMF0gPSAodHlwZURlZiAmJiB0eXBlRGVmW3BhcnRzWzBdXSkgfHwgcGFydHNbMF07XG4gICAgfVxuXG4gICAgdHJhY2tDaGFuZ2VzLmFwcGx5KHRoaXMsIFt7XG4gICAgICAgIGJhc2VOYW1lOiBwYXJ0c1swXSxcbiAgICAgICAgZnVsbFBhdGg6IHByb3BlcnR5LFxuICAgICAgICBvYmplY3Q6IG9wdGlvbnMub2JqZWN0LFxuICAgICAgICBvcHRpb25zOiBvcHRpb25zLFxuICAgICAgICBjaGFuZ2VzOiBjaGFuZ2VzLFxuICAgICAgICBvcGVyYXRpb246IG9wZXJhdGlvblxuICAgIH1dKTtcblxuICAgIHZhciBjdXJPYmogPSBvYmo7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBwYXJ0cy5sZW5ndGgtMTsgaSsrKSB7XG4gICAgICAgIHZhciBwYXJ0ID0gcGFydHNbaV07XG4gICAgICAgIGlmIChwYXJ0IGluIGN1ck9iaikge1xuICAgICAgICAgICAgY3VyT2JqID0gY3VyT2JqW3BhcnRdO1xuICAgICAgICAgICAgaWYgKGN1ck9iaiA9PT0gbnVsbCB8fCB0eXBlb2YgY3VyT2JqICE9IFwib2JqZWN0XCIpIHRocm93IG5ldyBFcnJvcihcIkNhbiBub3QgYWNjZXNzIHByb3BlcnR5IFxcXCJcIiArIHByb3BlcnR5ICsgXCJcXFwiXCIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY3VyT2JqW3BhcnRdID0ge307XG4gICAgICAgICAgICBjdXJPYmogPSBjdXJPYmpbcGFydF07XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHtcbiAgICAgICAgcG9pbnRlcjogY3VyT2JqLFxuICAgICAgICBsYXN0TmFtZTogcGFydHNbcGFydHMubGVuZ3RoLTFdLFxuICAgICAgICBiYXNlTmFtZTogcGFydHNbMF0sXG4gICAgICAgIGZ1bGxQYXRoOiBwcm9wZXJ0eSxcbiAgICAgICAgYWJvcnRIYW5kbGVyOiB0aGlzLmFib3J0Q2FsbGJhY2tzICYmIHRoaXMuYWJvcnRDYWxsYmFja3Nbb3B0aW9ucy50eXBlXSAmJiAodGhpcy5hYm9ydENhbGxiYWNrc1tvcHRpb25zLnR5cGVdLmFsbCB8fCB0aGlzLmFib3J0Q2FsbGJhY2tzW29wdGlvbnMudHlwZV1bcGFydHNbMF1dKVxuICAgIH07XG59XG5cbmZ1bmN0aW9uIGdldFZhbHVlKG9wLCBvcHRpb25zKSB7XG4gICAgaWYgKG9wLmlkKSB7XG4gICAgICAgIGlmICghdGhpcy5nZXRPYmplY3RDYWxsYmFjaykgdGhyb3cgbmV3IEVycm9yKFwiTXVzdCBwcm92aWRlIGdldE9iamVjdENhbGxiYWNrIGluIGNvbnN0cnVjdG9yIHRvIHVzZSBpZHNcIik7XG4gICAgICAgIHJldHVybiB0aGlzLmdldE9iamVjdENhbGxiYWNrKG9wLmlkKSB8fCBvcC5pZDtcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gb3AudmFsdWU7XG4gICAgfVxufVxuXG5mdW5jdGlvbiB0cmFja0NoYW5nZXMob3B0aW9ucykge1xuICAgIGlmICghb3B0aW9ucy5jaGFuZ2VzW29wdGlvbnMuYmFzZU5hbWVdKSB7XG4gICAgICAgIHZhciBpbml0aWFsVmFsdWUgPSBvcHRpb25zLm9iamVjdFtvcHRpb25zLmJhc2VOYW1lXTtcbiAgICAgICAgaWYgKFwiaWRcIiBpbiBvcHRpb25zLm9wZXJhdGlvbiAmJiBpbml0aWFsVmFsdWUpIHtcbiAgICAgICAgICAgIGluaXRpYWxWYWx1ZSA9IGluaXRpYWxWYWx1ZS5pZDtcbiAgICAgICAgfVxuICAgICAgICB2YXIgY2hhbmdlID0gb3B0aW9ucy5jaGFuZ2VzW29wdGlvbnMuYmFzZU5hbWVdID0ge3BhdGhzOiBbXX07XG4gICAgICAgIGNoYW5nZS5iZWZvcmUgPSAoaW5pdGlhbFZhbHVlICYmIHR5cGVvZiBpbml0aWFsVmFsdWUgPT0gXCJvYmplY3RcIikgPyBKU09OLnBhcnNlKEpTT04uc3RyaW5naWZ5KGluaXRpYWxWYWx1ZSkpIDogaW5pdGlhbFZhbHVlO1xuICAgIH1cbiAgICB2YXIgcGF0aHMgPSBvcHRpb25zLmNoYW5nZXNbb3B0aW9ucy5iYXNlTmFtZV0ucGF0aHM7XG4gICAgaWYgKHBhdGhzLmluZGV4T2Yob3B0aW9ucy5mdWxsUGF0aCkgPT0gLTEpIHtcbiAgICAgICAgcGF0aHMucHVzaChvcHRpb25zLmZ1bGxQYXRoKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHNldFByb3AocHJvcGVydHlEZWYsIHZhbHVlLCBvcCwgb3B0aW9ucywgY2hhbmdlcykge1xuICAgIGlmIChwcm9wZXJ0eURlZi5hYm9ydEhhbmRsZXIpIHtcbiAgICAgICAgaWYgKHByb3BlcnR5RGVmLmFib3J0SGFuZGxlcihwcm9wZXJ0eURlZi5mdWxsUGF0aCwgXCJzZXRcIiwgdmFsdWUpKSByZXR1cm47XG4gICAgfVxuICAgIHByb3BlcnR5RGVmLnBvaW50ZXJbcHJvcGVydHlEZWYubGFzdE5hbWVdID0gdmFsdWU7XG5cbn1cblxuZnVuY3Rpb24gZGVsZXRlUHJvcChwcm9wZXJ0eURlZiwgdmFsdWUsIG9wLCBvcHRpb25zLCBjaGFuZ2VzKSB7XG4gICAgaWYgKHByb3BlcnR5RGVmLmFib3J0SGFuZGxlcikge1xuICAgICAgICBpZiAocHJvcGVydHlEZWYuYWJvcnRIYW5kbGVyKHByb3BlcnR5RGVmLmZ1bGxQYXRoLCBcImRlbGV0ZVwiLCB2YWx1ZSkpIHJldHVybjtcbiAgICB9XG4gICAgZGVsZXRlIHByb3BlcnR5RGVmLnBvaW50ZXJbcHJvcGVydHlEZWYubGFzdE5hbWVdO1xufVxuXG5mdW5jdGlvbiBhZGRQcm9wKHByb3BlcnR5RGVmLCB2YWx1ZSwgb3AsIG9wdGlvbnMsIGNoYW5nZXMpIHtcbiAgICBpZiAocHJvcGVydHlEZWYuYWJvcnRIYW5kbGVyKSB7XG4gICAgICAgIGlmIChwcm9wZXJ0eURlZi5hYm9ydEhhbmRsZXIocHJvcGVydHlEZWYuZnVsbFBhdGgsIFwiYWRkXCIsIHZhbHVlKSkgcmV0dXJuO1xuICAgIH1cbiAgICB2YXIgb2JqO1xuICAgIGlmIChwcm9wZXJ0eURlZi5sYXN0TmFtZSBpbiBwcm9wZXJ0eURlZi5wb2ludGVyKSB7XG4gICAgICAgIG9iaiA9IHByb3BlcnR5RGVmLnBvaW50ZXJbcHJvcGVydHlEZWYubGFzdE5hbWVdO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIG9iaiA9IHByb3BlcnR5RGVmLnBvaW50ZXJbcHJvcGVydHlEZWYubGFzdE5hbWVdID0gW107XG4gICAgfVxuICAgIGlmICghQXJyYXkuaXNBcnJheShvYmopKSB0aHJvdyBuZXcgRXJyb3IoXCJUaGUgYWRkIG9wZXJhdGlvbiByZXF1aXJlcyBhbiBhcnJheSBvciBuZXcgc3RydWN0dXJlIHRvIGFkZCB0by5cIik7XG4gICAgaWYgKCFvcC5pZCkge1xuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHRocm93IG5ldyBFcnJvcihcIlRoZSBhZGQgb3BlcmF0aW9uIHdpbGwgbm90IGFkZCBhcnJheXMgdG8gc2V0cy5cIik7XG4gICAgICAgIGlmICh2YWx1ZSAmJiB0eXBlb2YgdmFsdWUgPT0gXCJvYmplY3RcIikgdGhyb3cgbmV3IEVycm9yKFwiVGhlIGFkZCBvcGVyYXRpb24gd2lsbCBub3QgYWRkIG9iamVjdHMgdG8gc2V0cy5cIik7XG4gICAgfVxuICAgIGlmIChvYmouaW5kZXhPZih2YWx1ZSkgPT0gLTEpIG9iai5wdXNoKHZhbHVlKTtcbn1cblxuZnVuY3Rpb24gcmVtb3ZlUHJvcChwcm9wZXJ0eURlZiwgdmFsdWUsIG9wLCBvcHRpb25zLCBjaGFuZ2VzKSB7XG4gICAgaWYgKHByb3BlcnR5RGVmLmFib3J0SGFuZGxlcikge1xuICAgICAgICBpZiAocHJvcGVydHlEZWYuYWJvcnRIYW5kbGVyKHByb3BlcnR5RGVmLmZ1bGxQYXRoLCBcInJlbW92ZVwiLCB2YWx1ZSkpIHJldHVybjtcbiAgICB9XG4gICAgdmFyIG9iajtcbiAgICBpZiAocHJvcGVydHlEZWYubGFzdE5hbWUgaW4gcHJvcGVydHlEZWYucG9pbnRlcikge1xuICAgICAgICBvYmogPSBwcm9wZXJ0eURlZi5wb2ludGVyW3Byb3BlcnR5RGVmLmxhc3ROYW1lXTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBvYmogPSBwcm9wZXJ0eURlZi5wb2ludGVyW3Byb3BlcnR5RGVmLmxhc3ROYW1lXSA9IFtdO1xuICAgIH1cbiAgICBpZiAoIUFycmF5LmlzQXJyYXkob2JqKSkgdGhyb3cgbmV3IEVycm9yKFwiVGhlIHJlbW92ZSBvcGVyYXRpb24gcmVxdWlyZXMgYW4gYXJyYXkgb3IgbmV3IHN0cnVjdHVyZSB0byByZW1vdmUgZnJvbS5cIik7XG5cbiAgICBpZiAoIW9wLmlkKSB7XG4gICAgICAgIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkgdGhyb3cgbmV3IEVycm9yKFwiVGhlIHJlbW92ZSBvcGVyYXRpb24gd2lsbCBub3QgcmVtb3ZlIGFycmF5cyBmcm9tIHNldHMuXCIpO1xuICAgICAgICBpZiAodmFsdWUgJiYgdHlwZW9mIHZhbHVlID09IFwib2JqZWN0XCIpIHRocm93IG5ldyBFcnJvcihcIlRoZSByZW1vdmUgb3BlcmF0aW9uIHdpbGwgbm90IHJlbW92ZSBvYmplY3RzIGZyb20gc2V0cy5cIik7XG5cbiAgICAgICAgdmFyIGluZGV4ID0gb2JqLmluZGV4T2YodmFsdWUpO1xuICAgICAgICBpZiAoaW5kZXggIT0gLTEpIG9iai5zcGxpY2UoaW5kZXgsIDEpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgb2JqLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5kb2VzT2JqZWN0TWF0Y2hJZENhbGxiYWNrKG9wLmlkLCBvYmpbaV0pKSB7XG4gICAgICAgICAgICAgICAgb2JqLnNwbGljZShpLCAxKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cbiJdfQ==
