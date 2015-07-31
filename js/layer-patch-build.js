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
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9ncnVudC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJpbmRleC5qcyIsImxheWVyLXBhdGNoLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOztBQ0FBO0FBQ0E7QUFDQTs7OztBQ0ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJpZiAoIWdsb2JhbC5sYXllcikgZ2xvYmFsLmxheWVyID0ge307XG5pZiAoIWdsb2JhbC5sYXllci5qcykgZ2xvYmFsLmxheWVyLmpzID0ge307XG5nbG9iYWwubGF5ZXIuanMuTGF5ZXJQYXRjaFBhcnNlciA9IHJlcXVpcmUoXCIuL2xheWVyLXBhdGNoXCIpOyIsIi8qKlxuICogVGhlIGxheWVyLmpzLkxheWVyUGF0Y2hQYXJzZXIgbWV0aG9kIHdpbGwgcGFyc2VcbiAqXG4gKiBAbWV0aG9kXG4gKiBAcGFyYW0ge0Jvb2xlYW59IFtjYW1lbENhc2U9ZmFsc2VdICAgICAgICAgICAgICAgICAgICAgIFNldCB0aGUgY2FtZWwgY2FzZWQgdmVyc2lvbiBvZiB0aGUgbmFtZSBvZiB0aGUgaW5wdXQgb2JqZWN0XG4gKiBAcGFyYW0ge09iamVjdH0gW3Byb3BlcnR5TmFtZU1hcF0gICAgICAgICAgICAgICAgICBNYXBzIHByb3BlcnR5IG5hbWVzIGluIHRoZSBvcGVyYXRpb24gdG8gcHJvcGVydHkgbmFtZXMgaW4gdGhlIGxvY2FsIG9iamVjdCBzY2hlbWFcbiAqIEBwYXJhbSB7T2JqZWN0fSBbY2hhbmdlQ2FsbGJhY2tzXSAgICAgICAgICAgICAgICAgIENhbGxiYWNrIG1hZGUgYW55IHRpbWUgYW4gb2JqZWN0IGlzIGNoYW5nZWRcbiAqIEBwYXJhbSB7T2JqZWN0fSBbYWJvcnRDYWxsYmFja3NdICAgICAgICAgICAgIENhbGxiYWNrIG1hZGUgdG8gdmVyaWZ5IGEgY2hhbmdlIGlzIHBlcm1pdHRlZFxuICogQHBhcmFtIHtGdW5jdGlvbn0gW2RvZXNPYmplY3RNYXRjaElkQ2FsbGJhY2tdICAgICAgQ2FsbGJhY2sgcmV0dXJucyBib29sZWFuIHRvIGluZGljYXRlIGlmIGEgZ2l2ZW4gb2JqZWN0IG1hdGNoZXMgYW4gSUQuXG4gKiBAcmV0dXJuIHtCb29sZWFufSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgUmV0dXJucyB0cnVlIGlmIGFsbCBvcGVyYXRpb25zIGNvbXBsZXRlZCBzdWNjZXNzZnVsbHksIGZhbHNlIGlmIHNvbWUgcmV0dXJuZWQgZXJyb3JzXG4gKi9cblxuXG52YXIgb3BIYW5kbGVycyA9IHtcbiAgICBcInNldFwiOiBzZXRQcm9wLFxuICAgIFwiZGVsZXRlXCI6IGRlbGV0ZVByb3AsXG4gICAgXCJhZGRcIjogYWRkUHJvcCxcbiAgICBcInJlbW92ZVwiOiByZW1vdmVQcm9wXG59O1xuXG5mdW5jdGlvbiBQYXJzZXIob3B0aW9ucykge1xuICAgIHRoaXMuY2FtZWxDYXNlID0gb3B0aW9ucy5jYW1lbENhc2U7XG4gICAgdGhpcy5wcm9wZXJ0eU5hbWVNYXAgPSBvcHRpb25zLnByb3BlcnR5TmFtZU1hcDtcbiAgICB0aGlzLmNoYW5nZUNhbGxiYWNrcyA9IG9wdGlvbnMuY2hhbmdlQ2FsbGJhY2tzO1xuICAgIHRoaXMuYWJvcnRDYWxsYmFja3MgPSBvcHRpb25zLmFib3J0Q2FsbGJhY2tzO1xuICAgIHRoaXMuZ2V0T2JqZWN0Q2FsbGJhY2sgPSBvcHRpb25zLmdldE9iamVjdENhbGxiYWNrO1xuICAgIHRoaXMuZG9lc09iamVjdE1hdGNoSWRDYWxsYmFjayA9IG9wdGlvbnMuZG9lc09iamVjdE1hdGNoSWRDYWxsYmFjayB8fCBmdW5jdGlvbihpZCwgb2JqKSB7XG4gICAgICAgIHJldHVybiBvYmouaWQgPT0gaWQ7XG4gICAgfTtcbiAgICB0aGlzLnJldHVybklkcyA9IG9wdGlvbnMucmV0dXJuSWRzO1xuICAgIHJldHVybiB0aGlzO1xufTtcbm1vZHVsZS5leHBvcnRzID0gUGFyc2VyO1xuXG5QYXJzZXIucHJvdG90eXBlLnBhcnNlID0gZnVuY3Rpb24ob3B0aW9ucykge1xuICAgIHZhciBjaGFuZ2VzID0ge307XG4gICAgb3B0aW9ucy5vcGVyYXRpb25zLmZvckVhY2goZnVuY3Rpb24ob3ApIHtcbiAgICAgICAgdmFyIHByb3BlcnR5RGVmID0gZ2V0UHJvcGVydHlEZWYuYXBwbHkodGhpcywgW29wLnByb3BlcnR5LCBvcHRpb25zLCBjaGFuZ2VzLCBvcF0pXG4gICAgICAgIG9wSGFuZGxlcnNbb3Aub3BlcmF0aW9uXS5jYWxsKHRoaXMsXG4gICAgICAgICAgICBwcm9wZXJ0eURlZixcbiAgICAgICAgICAgIGdldFZhbHVlLmFwcGx5KHRoaXMsIFtvcCwgb3B0aW9uc10pLFxuICAgICAgICAgICAgb3AsIG9wdGlvbnMsIGNoYW5nZXMpO1xuICAgIH0sIHRoaXMpO1xuXG4gICAgcmVwb3J0Q2hhbmdlcy5hcHBseSh0aGlzLCBbY2hhbmdlcywgb3B0aW9ucy5vYmplY3QsIG9wdGlvbnMudHlwZV0pO1xufTtcblxuZnVuY3Rpb24gcmVwb3J0Q2hhbmdlcyhjaGFuZ2VzLCB1cGRhdGVPYmplY3QsIG9iamVjdFR5cGUpIHtcbiAgICBpZiAodGhpcy5jaGFuZ2VDYWxsYmFja3MgJiYgb2JqZWN0VHlwZSAmJiB0aGlzLmNoYW5nZUNhbGxiYWNrc1tvYmplY3RUeXBlXSkge1xuICAgICAgICBPYmplY3Qua2V5cyhjaGFuZ2VzKS5mb3JFYWNoKGZ1bmN0aW9uKGtleSkge1xuICAgICAgICAgICAgaWYgKHRoaXMuY2hhbmdlQ2FsbGJhY2tzW29iamVjdFR5cGVdLmFsbCkge1xuICAgICAgICAgICAgICAgIHRoaXMuY2hhbmdlQ2FsbGJhY2tzW29iamVjdFR5cGVdLmFsbCh1cGRhdGVPYmplY3QsIHVwZGF0ZU9iamVjdFtrZXldLCBjaGFuZ2VzW2tleV0uYmVmb3JlLCBjaGFuZ2VzW2tleV0ucGF0aHMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAodGhpcy5jaGFuZ2VDYWxsYmFja3Nbb2JqZWN0VHlwZV1ba2V5XSkge1xuICAgICAgICAgICAgICAgIHRoaXMuY2hhbmdlQ2FsbGJhY2tzW29iamVjdFR5cGVdW2tleV0odXBkYXRlT2JqZWN0LCB1cGRhdGVPYmplY3Rba2V5XSwgY2hhbmdlc1trZXldLmJlZm9yZSwgY2hhbmdlc1trZXldLnBhdGhzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSwgdGhpcyk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBnZXRQcm9wZXJ0eURlZihwcm9wZXJ0eSwgb3B0aW9ucywgY2hhbmdlcywgb3BlcmF0aW9uKSB7XG4gICAgdmFyIG9iaiA9IG9wdGlvbnMub2JqZWN0O1xuICAgIHZhciBwYXJ0cyA9IHByb3BlcnR5LnNwbGl0KC9cXC4vKTtcbiAgICBpZiAodGhpcy5jYW1lbENhc2UpIHBhcnRzWzBdID0gcGFydHNbMF0ucmVwbGFjZSgvWy1fXS4vZywgZnVuY3Rpb24oc3RyKSB7XG4gICAgICAgIHJldHVybiBzdHJbMV0udG9VcHBlckNhc2UoKTtcbiAgICB9KTtcblxuICAgIGlmICh0aGlzLnByb3BlcnR5TmFtZU1hcCkge1xuICAgICAgICB2YXIgdHlwZURlZiA9IHRoaXMucHJvcGVydHlOYW1lTWFwW29wdGlvbnMudHlwZV07XG4gICAgICAgIHBhcnRzWzBdID0gKHR5cGVEZWYgJiYgdHlwZURlZltwYXJ0c1swXV0pIHx8IHBhcnRzWzBdO1xuICAgIH1cblxuICAgIHRyYWNrQ2hhbmdlcy5hcHBseSh0aGlzLCBbe1xuICAgICAgICBiYXNlTmFtZTogcGFydHNbMF0sXG4gICAgICAgIGZ1bGxQYXRoOiBwcm9wZXJ0eSxcbiAgICAgICAgb2JqZWN0OiBvcHRpb25zLm9iamVjdCxcbiAgICAgICAgb3B0aW9uczogb3B0aW9ucyxcbiAgICAgICAgY2hhbmdlczogY2hhbmdlcyxcbiAgICAgICAgb3BlcmF0aW9uOiBvcGVyYXRpb25cbiAgICB9XSk7XG5cbiAgICB2YXIgY3VyT2JqID0gb2JqO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcGFydHMubGVuZ3RoLTE7IGkrKykge1xuICAgICAgICB2YXIgcGFydCA9IHBhcnRzW2ldO1xuICAgICAgICBpZiAocGFydCBpbiBjdXJPYmopIHtcbiAgICAgICAgICAgIGN1ck9iaiA9IGN1ck9ialtwYXJ0XTtcbiAgICAgICAgICAgIGlmIChjdXJPYmogPT09IG51bGwgfHwgdHlwZW9mIGN1ck9iaiAhPSBcIm9iamVjdFwiKSB0aHJvdyBuZXcgRXJyb3IoXCJDYW4gbm90IGFjY2VzcyBwcm9wZXJ0eSBcXFwiXCIgKyBwcm9wZXJ0eSArIFwiXFxcIlwiKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGN1ck9ialtwYXJ0XSA9IHt9O1xuICAgICAgICAgICAgY3VyT2JqID0gY3VyT2JqW3BhcnRdO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiB7XG4gICAgICAgIHBvaW50ZXI6IGN1ck9iaixcbiAgICAgICAgbGFzdE5hbWU6IHBhcnRzW3BhcnRzLmxlbmd0aC0xXSxcbiAgICAgICAgYmFzZU5hbWU6IHBhcnRzWzBdLFxuICAgICAgICBmdWxsUGF0aDogcHJvcGVydHksXG4gICAgICAgIGFib3J0SGFuZGxlcjogdGhpcy5hYm9ydENhbGxiYWNrcyAmJiB0aGlzLmFib3J0Q2FsbGJhY2tzW29wdGlvbnMudHlwZV0gJiYgKHRoaXMuYWJvcnRDYWxsYmFja3Nbb3B0aW9ucy50eXBlXS5hbGwgfHwgdGhpcy5hYm9ydENhbGxiYWNrc1tvcHRpb25zLnR5cGVdW3BhcnRzWzBdXSlcbiAgICB9O1xufVxuXG5mdW5jdGlvbiBnZXRWYWx1ZShvcCwgb3B0aW9ucykge1xuICAgIGlmIChvcC5pZCkge1xuICAgICAgICBpZiAoIXRoaXMuZ2V0T2JqZWN0Q2FsbGJhY2spIHRocm93IG5ldyBFcnJvcihcIk11c3QgcHJvdmlkZSBnZXRPYmplY3RDYWxsYmFjayBpbiBjb25zdHJ1Y3RvciB0byB1c2UgaWRzXCIpO1xuXHR2YXIgcmVzdWx0ID0gdGhpcy5nZXRPYmplY3RDYWxsYmFjayhvcC5pZCk7XG5cdGlmIChyZXN1bHQpIHJldHVybiByZXN1bHQ7XG5cdGlmICh0aGlzLnJldHVybklkcykgcmV0dXJuIG9wLmlkO1xuXHRyZXR1cm4gbnVsbDtcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gb3AudmFsdWU7XG4gICAgfVxufVxuXG5mdW5jdGlvbiB0cmFja0NoYW5nZXMob3B0aW9ucykge1xuICAgIGlmICghb3B0aW9ucy5jaGFuZ2VzW29wdGlvbnMuYmFzZU5hbWVdKSB7XG4gICAgICAgIHZhciBpbml0aWFsVmFsdWUgPSBvcHRpb25zLm9iamVjdFtvcHRpb25zLmJhc2VOYW1lXTtcbiAgICAgICAgaWYgKFwiaWRcIiBpbiBvcHRpb25zLm9wZXJhdGlvbiAmJiBpbml0aWFsVmFsdWUpIHtcbiAgICAgICAgICAgIGluaXRpYWxWYWx1ZSA9IGluaXRpYWxWYWx1ZS5pZDtcbiAgICAgICAgfVxuICAgICAgICB2YXIgY2hhbmdlID0gb3B0aW9ucy5jaGFuZ2VzW29wdGlvbnMuYmFzZU5hbWVdID0ge3BhdGhzOiBbXX07XG4gICAgICAgIGNoYW5nZS5iZWZvcmUgPSAoaW5pdGlhbFZhbHVlICYmIHR5cGVvZiBpbml0aWFsVmFsdWUgPT0gXCJvYmplY3RcIikgPyBKU09OLnBhcnNlKEpTT04uc3RyaW5naWZ5KGluaXRpYWxWYWx1ZSkpIDogaW5pdGlhbFZhbHVlO1xuICAgIH1cbiAgICB2YXIgcGF0aHMgPSBvcHRpb25zLmNoYW5nZXNbb3B0aW9ucy5iYXNlTmFtZV0ucGF0aHM7XG4gICAgaWYgKHBhdGhzLmluZGV4T2Yob3B0aW9ucy5mdWxsUGF0aCkgPT0gLTEpIHtcbiAgICAgICAgcGF0aHMucHVzaChvcHRpb25zLmZ1bGxQYXRoKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHNldFByb3AocHJvcGVydHlEZWYsIHZhbHVlLCBvcCwgb3B0aW9ucywgY2hhbmdlcykge1xuICAgIGlmIChwcm9wZXJ0eURlZi5hYm9ydEhhbmRsZXIpIHtcbiAgICAgICAgaWYgKHByb3BlcnR5RGVmLmFib3J0SGFuZGxlcihwcm9wZXJ0eURlZi5mdWxsUGF0aCwgXCJzZXRcIiwgdmFsdWUpKSByZXR1cm47XG4gICAgfVxuICAgIHByb3BlcnR5RGVmLnBvaW50ZXJbcHJvcGVydHlEZWYubGFzdE5hbWVdID0gdmFsdWU7XG5cbn1cblxuZnVuY3Rpb24gZGVsZXRlUHJvcChwcm9wZXJ0eURlZiwgdmFsdWUsIG9wLCBvcHRpb25zLCBjaGFuZ2VzKSB7XG4gICAgaWYgKHByb3BlcnR5RGVmLmFib3J0SGFuZGxlcikge1xuICAgICAgICBpZiAocHJvcGVydHlEZWYuYWJvcnRIYW5kbGVyKHByb3BlcnR5RGVmLmZ1bGxQYXRoLCBcImRlbGV0ZVwiLCB2YWx1ZSkpIHJldHVybjtcbiAgICB9XG4gICAgZGVsZXRlIHByb3BlcnR5RGVmLnBvaW50ZXJbcHJvcGVydHlEZWYubGFzdE5hbWVdO1xufVxuXG5mdW5jdGlvbiBhZGRQcm9wKHByb3BlcnR5RGVmLCB2YWx1ZSwgb3AsIG9wdGlvbnMsIGNoYW5nZXMpIHtcbiAgICBpZiAocHJvcGVydHlEZWYuYWJvcnRIYW5kbGVyKSB7XG4gICAgICAgIGlmIChwcm9wZXJ0eURlZi5hYm9ydEhhbmRsZXIocHJvcGVydHlEZWYuZnVsbFBhdGgsIFwiYWRkXCIsIHZhbHVlKSkgcmV0dXJuO1xuICAgIH1cbiAgICB2YXIgb2JqO1xuICAgIGlmIChwcm9wZXJ0eURlZi5sYXN0TmFtZSBpbiBwcm9wZXJ0eURlZi5wb2ludGVyKSB7XG4gICAgICAgIG9iaiA9IHByb3BlcnR5RGVmLnBvaW50ZXJbcHJvcGVydHlEZWYubGFzdE5hbWVdO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIG9iaiA9IHByb3BlcnR5RGVmLnBvaW50ZXJbcHJvcGVydHlEZWYubGFzdE5hbWVdID0gW107XG4gICAgfVxuICAgIGlmICghQXJyYXkuaXNBcnJheShvYmopKSB0aHJvdyBuZXcgRXJyb3IoXCJUaGUgYWRkIG9wZXJhdGlvbiByZXF1aXJlcyBhbiBhcnJheSBvciBuZXcgc3RydWN0dXJlIHRvIGFkZCB0by5cIik7XG4gICAgaWYgKCFvcC5pZCkge1xuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHRocm93IG5ldyBFcnJvcihcIlRoZSBhZGQgb3BlcmF0aW9uIHdpbGwgbm90IGFkZCBhcnJheXMgdG8gc2V0cy5cIik7XG4gICAgICAgIGlmICh2YWx1ZSAmJiB0eXBlb2YgdmFsdWUgPT0gXCJvYmplY3RcIikgdGhyb3cgbmV3IEVycm9yKFwiVGhlIGFkZCBvcGVyYXRpb24gd2lsbCBub3QgYWRkIG9iamVjdHMgdG8gc2V0cy5cIik7XG4gICAgfVxuICAgIGlmIChvYmouaW5kZXhPZih2YWx1ZSkgPT0gLTEpIG9iai5wdXNoKHZhbHVlKTtcbn1cblxuZnVuY3Rpb24gcmVtb3ZlUHJvcChwcm9wZXJ0eURlZiwgdmFsdWUsIG9wLCBvcHRpb25zLCBjaGFuZ2VzKSB7XG4gICAgaWYgKHByb3BlcnR5RGVmLmFib3J0SGFuZGxlcikge1xuICAgICAgICBpZiAocHJvcGVydHlEZWYuYWJvcnRIYW5kbGVyKHByb3BlcnR5RGVmLmZ1bGxQYXRoLCBcInJlbW92ZVwiLCB2YWx1ZSkpIHJldHVybjtcbiAgICB9XG4gICAgdmFyIG9iajtcbiAgICBpZiAocHJvcGVydHlEZWYubGFzdE5hbWUgaW4gcHJvcGVydHlEZWYucG9pbnRlcikge1xuICAgICAgICBvYmogPSBwcm9wZXJ0eURlZi5wb2ludGVyW3Byb3BlcnR5RGVmLmxhc3ROYW1lXTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBvYmogPSBwcm9wZXJ0eURlZi5wb2ludGVyW3Byb3BlcnR5RGVmLmxhc3ROYW1lXSA9IFtdO1xuICAgIH1cbiAgICBpZiAoIUFycmF5LmlzQXJyYXkob2JqKSkgdGhyb3cgbmV3IEVycm9yKFwiVGhlIHJlbW92ZSBvcGVyYXRpb24gcmVxdWlyZXMgYW4gYXJyYXkgb3IgbmV3IHN0cnVjdHVyZSB0byByZW1vdmUgZnJvbS5cIik7XG5cbiAgICBpZiAoIW9wLmlkKSB7XG4gICAgICAgIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkgdGhyb3cgbmV3IEVycm9yKFwiVGhlIHJlbW92ZSBvcGVyYXRpb24gd2lsbCBub3QgcmVtb3ZlIGFycmF5cyBmcm9tIHNldHMuXCIpO1xuICAgICAgICBpZiAodmFsdWUgJiYgdHlwZW9mIHZhbHVlID09IFwib2JqZWN0XCIpIHRocm93IG5ldyBFcnJvcihcIlRoZSByZW1vdmUgb3BlcmF0aW9uIHdpbGwgbm90IHJlbW92ZSBvYmplY3RzIGZyb20gc2V0cy5cIik7XG5cbiAgICAgICAgdmFyIGluZGV4ID0gb2JqLmluZGV4T2YodmFsdWUpO1xuICAgICAgICBpZiAoaW5kZXggIT0gLTEpIG9iai5zcGxpY2UoaW5kZXgsIDEpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgb2JqLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5kb2VzT2JqZWN0TWF0Y2hJZENhbGxiYWNrKG9wLmlkLCBvYmpbaV0pKSB7XG4gICAgICAgICAgICAgICAgb2JqLnNwbGljZShpLCAxKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cbiJdfQ==
