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
    if (this.camelCase) parts = parts.map(function(p) {
        return p.replace(/[-_]./g, function(str) {
            return str[1].toUpperCase();
        });
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
    options.changes[options.baseName].paths.push(options.fullPath);
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
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9ncnVudC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJpbmRleC5qcyIsImxheWVyLXBhdGNoLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOztBQ0FBO0FBQ0E7QUFDQTs7OztBQ0ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsImlmICghZ2xvYmFsLmxheWVyKSBnbG9iYWwubGF5ZXIgPSB7fTtcbmlmICghZ2xvYmFsLmxheWVyLmpzKSBnbG9iYWwubGF5ZXIuanMgPSB7fTtcbmdsb2JhbC5sYXllci5qcy5MYXllclBhdGNoUGFyc2VyID0gcmVxdWlyZShcIi4vbGF5ZXItcGF0Y2hcIik7IiwiLyoqXG4gKiBUaGUgbGF5ZXIuanMuTGF5ZXJQYXRjaFBhcnNlciBtZXRob2Qgd2lsbCBwYXJzZVxuICpcbiAqIEBtZXRob2RcbiAqIEBwYXJhbSB7Qm9vbGVhbn0gW2NhbWVsQ2FzZT1mYWxzZV0gICAgICAgICAgICAgICAgICAgICAgU2V0IHRoZSBjYW1lbCBjYXNlZCB2ZXJzaW9uIG9mIHRoZSBuYW1lIG9mIHRoZSBpbnB1dCBvYmplY3RcbiAqIEBwYXJhbSB7T2JqZWN0fSBbcHJvcGVydHlOYW1lTWFwXSAgICAgICAgICAgICAgICAgIE1hcHMgcHJvcGVydHkgbmFtZXMgaW4gdGhlIG9wZXJhdGlvbiB0byBwcm9wZXJ0eSBuYW1lcyBpbiB0aGUgbG9jYWwgb2JqZWN0IHNjaGVtYVxuICogQHBhcmFtIHtPYmplY3R9IFtjaGFuZ2VDYWxsYmFja3NdICAgICAgICAgICAgICAgICAgQ2FsbGJhY2sgbWFkZSBhbnkgdGltZSBhbiBvYmplY3QgaXMgY2hhbmdlZFxuICogQHBhcmFtIHtPYmplY3R9IFthYm9ydENhbGxiYWNrc10gICAgICAgICAgICAgQ2FsbGJhY2sgbWFkZSB0byB2ZXJpZnkgYSBjaGFuZ2UgaXMgcGVybWl0dGVkXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBbZG9lc09iamVjdE1hdGNoSWRDYWxsYmFja10gICAgICBDYWxsYmFjayByZXR1cm5zIGJvb2xlYW4gdG8gaW5kaWNhdGUgaWYgYSBnaXZlbiBvYmplY3QgbWF0Y2hlcyBhbiBJRC5cbiAqIEByZXR1cm4ge0Jvb2xlYW59ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBSZXR1cm5zIHRydWUgaWYgYWxsIG9wZXJhdGlvbnMgY29tcGxldGVkIHN1Y2Nlc3NmdWxseSwgZmFsc2UgaWYgc29tZSByZXR1cm5lZCBlcnJvcnNcbiAqL1xuXG5cbnZhciBvcEhhbmRsZXJzID0ge1xuICAgIFwic2V0XCI6IHNldFByb3AsXG4gICAgXCJkZWxldGVcIjogZGVsZXRlUHJvcCxcbiAgICBcImFkZFwiOiBhZGRQcm9wLFxuICAgIFwicmVtb3ZlXCI6IHJlbW92ZVByb3Bcbn07XG5cbmZ1bmN0aW9uIFBhcnNlcihvcHRpb25zKSB7XG4gICAgdGhpcy5jYW1lbENhc2UgPSBvcHRpb25zLmNhbWVsQ2FzZTtcbiAgICB0aGlzLnByb3BlcnR5TmFtZU1hcCA9IG9wdGlvbnMucHJvcGVydHlOYW1lTWFwO1xuICAgIHRoaXMuY2hhbmdlQ2FsbGJhY2tzID0gb3B0aW9ucy5jaGFuZ2VDYWxsYmFja3M7XG4gICAgdGhpcy5hYm9ydENhbGxiYWNrcyA9IG9wdGlvbnMuYWJvcnRDYWxsYmFja3M7XG4gICAgdGhpcy5nZXRPYmplY3RDYWxsYmFjayA9IG9wdGlvbnMuZ2V0T2JqZWN0Q2FsbGJhY2s7XG4gICAgdGhpcy5kb2VzT2JqZWN0TWF0Y2hJZENhbGxiYWNrID0gb3B0aW9ucy5kb2VzT2JqZWN0TWF0Y2hJZENhbGxiYWNrIHx8IGZ1bmN0aW9uKGlkLCBvYmopIHtcbiAgICAgICAgcmV0dXJuIG9iai5pZCA9PSBpZDtcbiAgICB9O1xuICAgIHJldHVybiB0aGlzO1xufTtcbm1vZHVsZS5leHBvcnRzID0gUGFyc2VyO1xuXG5QYXJzZXIucHJvdG90eXBlLnBhcnNlID0gZnVuY3Rpb24ob3B0aW9ucykge1xuICAgIHZhciBjaGFuZ2VzID0ge307XG4gICAgb3B0aW9ucy5vcGVyYXRpb25zLmZvckVhY2goZnVuY3Rpb24ob3ApIHtcbiAgICAgICAgdmFyIHByb3BlcnR5RGVmID0gZ2V0UHJvcGVydHlEZWYuYXBwbHkodGhpcywgW29wLnByb3BlcnR5LCBvcHRpb25zLCBjaGFuZ2VzLCBvcF0pXG4gICAgICAgIG9wSGFuZGxlcnNbb3Aub3BlcmF0aW9uXS5jYWxsKHRoaXMsXG4gICAgICAgICAgICBwcm9wZXJ0eURlZixcbiAgICAgICAgICAgIGdldFZhbHVlLmFwcGx5KHRoaXMsIFtvcCwgb3B0aW9uc10pLFxuICAgICAgICAgICAgb3AsIG9wdGlvbnMsIGNoYW5nZXMpO1xuICAgIH0sIHRoaXMpO1xuXG4gICAgcmVwb3J0Q2hhbmdlcy5hcHBseSh0aGlzLCBbY2hhbmdlcywgb3B0aW9ucy5vYmplY3QsIG9wdGlvbnMudHlwZV0pO1xufTtcblxuZnVuY3Rpb24gcmVwb3J0Q2hhbmdlcyhjaGFuZ2VzLCB1cGRhdGVPYmplY3QsIG9iamVjdFR5cGUpIHtcbiAgICBpZiAodGhpcy5jaGFuZ2VDYWxsYmFja3MgJiYgb2JqZWN0VHlwZSAmJiB0aGlzLmNoYW5nZUNhbGxiYWNrc1tvYmplY3RUeXBlXSkge1xuICAgICAgICBPYmplY3Qua2V5cyhjaGFuZ2VzKS5mb3JFYWNoKGZ1bmN0aW9uKGtleSkge1xuICAgICAgICAgICAgaWYgKHRoaXMuY2hhbmdlQ2FsbGJhY2tzW29iamVjdFR5cGVdLmFsbCkge1xuICAgICAgICAgICAgICAgIHRoaXMuY2hhbmdlQ2FsbGJhY2tzW29iamVjdFR5cGVdLmFsbCh1cGRhdGVPYmplY3QsIHVwZGF0ZU9iamVjdFtrZXldLCBjaGFuZ2VzW2tleV0uYmVmb3JlLCBjaGFuZ2VzW2tleV0ucGF0aHMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAodGhpcy5jaGFuZ2VDYWxsYmFja3Nbb2JqZWN0VHlwZV1ba2V5XSkge1xuICAgICAgICAgICAgICAgIHRoaXMuY2hhbmdlQ2FsbGJhY2tzW29iamVjdFR5cGVdW2tleV0odXBkYXRlT2JqZWN0LCB1cGRhdGVPYmplY3Rba2V5XSwgY2hhbmdlc1trZXldLmJlZm9yZSwgY2hhbmdlc1trZXldLnBhdGhzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSwgdGhpcyk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBnZXRQcm9wZXJ0eURlZihwcm9wZXJ0eSwgb3B0aW9ucywgY2hhbmdlcywgb3BlcmF0aW9uKSB7XG4gICAgdmFyIG9iaiA9IG9wdGlvbnMub2JqZWN0O1xuICAgIHZhciBwYXJ0cyA9IHByb3BlcnR5LnNwbGl0KC9cXC4vKTtcbiAgICBpZiAodGhpcy5jYW1lbENhc2UpIHBhcnRzID0gcGFydHMubWFwKGZ1bmN0aW9uKHApIHtcbiAgICAgICAgcmV0dXJuIHAucmVwbGFjZSgvWy1fXS4vZywgZnVuY3Rpb24oc3RyKSB7XG4gICAgICAgICAgICByZXR1cm4gc3RyWzFdLnRvVXBwZXJDYXNlKCk7XG4gICAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgaWYgKHRoaXMucHJvcGVydHlOYW1lTWFwKSB7XG4gICAgICAgIHZhciB0eXBlRGVmID0gdGhpcy5wcm9wZXJ0eU5hbWVNYXBbb3B0aW9ucy50eXBlXTtcbiAgICAgICAgcGFydHNbMF0gPSAodHlwZURlZiAmJiB0eXBlRGVmW3BhcnRzWzBdXSkgfHwgcGFydHNbMF07XG4gICAgfVxuXG4gICAgdHJhY2tDaGFuZ2VzLmFwcGx5KHRoaXMsIFt7XG4gICAgICAgIGJhc2VOYW1lOiBwYXJ0c1swXSxcbiAgICAgICAgZnVsbFBhdGg6IHByb3BlcnR5LFxuICAgICAgICBvYmplY3Q6IG9wdGlvbnMub2JqZWN0LFxuICAgICAgICBvcHRpb25zOiBvcHRpb25zLFxuICAgICAgICBjaGFuZ2VzOiBjaGFuZ2VzLFxuICAgICAgICBvcGVyYXRpb246IG9wZXJhdGlvblxuICAgIH1dKTtcblxuICAgIHZhciBjdXJPYmogPSBvYmo7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBwYXJ0cy5sZW5ndGgtMTsgaSsrKSB7XG4gICAgICAgIHZhciBwYXJ0ID0gcGFydHNbaV07XG4gICAgICAgIGlmIChwYXJ0IGluIGN1ck9iaikge1xuICAgICAgICAgICAgY3VyT2JqID0gY3VyT2JqW3BhcnRdO1xuICAgICAgICAgICAgaWYgKGN1ck9iaiA9PT0gbnVsbCB8fCB0eXBlb2YgY3VyT2JqICE9IFwib2JqZWN0XCIpIHRocm93IG5ldyBFcnJvcihcIkNhbiBub3QgYWNjZXNzIHByb3BlcnR5IFxcXCJcIiArIHByb3BlcnR5ICsgXCJcXFwiXCIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY3VyT2JqW3BhcnRdID0ge307XG4gICAgICAgICAgICBjdXJPYmogPSBjdXJPYmpbcGFydF07XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHtcbiAgICAgICAgcG9pbnRlcjogY3VyT2JqLFxuICAgICAgICBsYXN0TmFtZTogcGFydHNbcGFydHMubGVuZ3RoLTFdLFxuICAgICAgICBiYXNlTmFtZTogcGFydHNbMF0sXG4gICAgICAgIGZ1bGxQYXRoOiBwcm9wZXJ0eSxcbiAgICAgICAgYWJvcnRIYW5kbGVyOiB0aGlzLmFib3J0Q2FsbGJhY2tzICYmIHRoaXMuYWJvcnRDYWxsYmFja3Nbb3B0aW9ucy50eXBlXSAmJiAodGhpcy5hYm9ydENhbGxiYWNrc1tvcHRpb25zLnR5cGVdLmFsbCB8fCB0aGlzLmFib3J0Q2FsbGJhY2tzW29wdGlvbnMudHlwZV1bcGFydHNbMF1dKVxuICAgIH07XG59XG5cbmZ1bmN0aW9uIGdldFZhbHVlKG9wLCBvcHRpb25zKSB7XG4gICAgaWYgKG9wLmlkKSB7XG4gICAgICAgIGlmICghdGhpcy5nZXRPYmplY3RDYWxsYmFjaykgdGhyb3cgbmV3IEVycm9yKFwiTXVzdCBwcm92aWRlIGdldE9iamVjdENhbGxiYWNrIGluIGNvbnN0cnVjdG9yIHRvIHVzZSBpZHNcIik7XG4gICAgICAgIHJldHVybiB0aGlzLmdldE9iamVjdENhbGxiYWNrKG9wLmlkKSB8fCBvcC5pZDtcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gb3AudmFsdWU7XG4gICAgfVxufVxuXG5mdW5jdGlvbiB0cmFja0NoYW5nZXMob3B0aW9ucykge1xuICAgIGlmICghb3B0aW9ucy5jaGFuZ2VzW29wdGlvbnMuYmFzZU5hbWVdKSB7XG4gICAgICAgIHZhciBpbml0aWFsVmFsdWUgPSBvcHRpb25zLm9iamVjdFtvcHRpb25zLmJhc2VOYW1lXTtcbiAgICAgICAgaWYgKFwiaWRcIiBpbiBvcHRpb25zLm9wZXJhdGlvbiAmJiBpbml0aWFsVmFsdWUpIHtcbiAgICAgICAgICAgIGluaXRpYWxWYWx1ZSA9IGluaXRpYWxWYWx1ZS5pZDtcbiAgICAgICAgfVxuICAgICAgICB2YXIgY2hhbmdlID0gb3B0aW9ucy5jaGFuZ2VzW29wdGlvbnMuYmFzZU5hbWVdID0ge3BhdGhzOiBbXX07XG4gICAgICAgIGNoYW5nZS5iZWZvcmUgPSAoaW5pdGlhbFZhbHVlICYmIHR5cGVvZiBpbml0aWFsVmFsdWUgPT0gXCJvYmplY3RcIikgPyBKU09OLnBhcnNlKEpTT04uc3RyaW5naWZ5KGluaXRpYWxWYWx1ZSkpIDogaW5pdGlhbFZhbHVlO1xuICAgIH1cbiAgICBvcHRpb25zLmNoYW5nZXNbb3B0aW9ucy5iYXNlTmFtZV0ucGF0aHMucHVzaChvcHRpb25zLmZ1bGxQYXRoKTtcbn1cblxuZnVuY3Rpb24gc2V0UHJvcChwcm9wZXJ0eURlZiwgdmFsdWUsIG9wLCBvcHRpb25zLCBjaGFuZ2VzKSB7XG4gICAgaWYgKHByb3BlcnR5RGVmLmFib3J0SGFuZGxlcikge1xuICAgICAgICBpZiAocHJvcGVydHlEZWYuYWJvcnRIYW5kbGVyKHByb3BlcnR5RGVmLmZ1bGxQYXRoLCBcInNldFwiLCB2YWx1ZSkpIHJldHVybjtcbiAgICB9XG4gICAgcHJvcGVydHlEZWYucG9pbnRlcltwcm9wZXJ0eURlZi5sYXN0TmFtZV0gPSB2YWx1ZTtcblxufVxuXG5mdW5jdGlvbiBkZWxldGVQcm9wKHByb3BlcnR5RGVmLCB2YWx1ZSwgb3AsIG9wdGlvbnMsIGNoYW5nZXMpIHtcbiAgICBpZiAocHJvcGVydHlEZWYuYWJvcnRIYW5kbGVyKSB7XG4gICAgICAgIGlmIChwcm9wZXJ0eURlZi5hYm9ydEhhbmRsZXIocHJvcGVydHlEZWYuZnVsbFBhdGgsIFwiZGVsZXRlXCIsIHZhbHVlKSkgcmV0dXJuO1xuICAgIH1cbiAgICBkZWxldGUgcHJvcGVydHlEZWYucG9pbnRlcltwcm9wZXJ0eURlZi5sYXN0TmFtZV07XG59XG5cbmZ1bmN0aW9uIGFkZFByb3AocHJvcGVydHlEZWYsIHZhbHVlLCBvcCwgb3B0aW9ucywgY2hhbmdlcykge1xuICAgIGlmIChwcm9wZXJ0eURlZi5hYm9ydEhhbmRsZXIpIHtcbiAgICAgICAgaWYgKHByb3BlcnR5RGVmLmFib3J0SGFuZGxlcihwcm9wZXJ0eURlZi5mdWxsUGF0aCwgXCJhZGRcIiwgdmFsdWUpKSByZXR1cm47XG4gICAgfVxuICAgIHZhciBvYmo7XG4gICAgaWYgKHByb3BlcnR5RGVmLmxhc3ROYW1lIGluIHByb3BlcnR5RGVmLnBvaW50ZXIpIHtcbiAgICAgICAgb2JqID0gcHJvcGVydHlEZWYucG9pbnRlcltwcm9wZXJ0eURlZi5sYXN0TmFtZV07XG4gICAgfSBlbHNlIHtcbiAgICAgICAgb2JqID0gcHJvcGVydHlEZWYucG9pbnRlcltwcm9wZXJ0eURlZi5sYXN0TmFtZV0gPSBbXTtcbiAgICB9XG4gICAgaWYgKCFBcnJheS5pc0FycmF5KG9iaikpIHRocm93IG5ldyBFcnJvcihcIlRoZSBhZGQgb3BlcmF0aW9uIHJlcXVpcmVzIGFuIGFycmF5IG9yIG5ldyBzdHJ1Y3R1cmUgdG8gYWRkIHRvLlwiKTtcbiAgICBpZiAoIW9wLmlkKSB7XG4gICAgICAgIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkgdGhyb3cgbmV3IEVycm9yKFwiVGhlIGFkZCBvcGVyYXRpb24gd2lsbCBub3QgYWRkIGFycmF5cyB0byBzZXRzLlwiKTtcbiAgICAgICAgaWYgKHZhbHVlICYmIHR5cGVvZiB2YWx1ZSA9PSBcIm9iamVjdFwiKSB0aHJvdyBuZXcgRXJyb3IoXCJUaGUgYWRkIG9wZXJhdGlvbiB3aWxsIG5vdCBhZGQgb2JqZWN0cyB0byBzZXRzLlwiKTtcbiAgICB9XG4gICAgaWYgKG9iai5pbmRleE9mKHZhbHVlKSA9PSAtMSkgb2JqLnB1c2godmFsdWUpO1xufVxuXG5mdW5jdGlvbiByZW1vdmVQcm9wKHByb3BlcnR5RGVmLCB2YWx1ZSwgb3AsIG9wdGlvbnMsIGNoYW5nZXMpIHtcbiAgICBpZiAocHJvcGVydHlEZWYuYWJvcnRIYW5kbGVyKSB7XG4gICAgICAgIGlmIChwcm9wZXJ0eURlZi5hYm9ydEhhbmRsZXIocHJvcGVydHlEZWYuZnVsbFBhdGgsIFwicmVtb3ZlXCIsIHZhbHVlKSkgcmV0dXJuO1xuICAgIH1cbiAgICB2YXIgb2JqO1xuICAgIGlmIChwcm9wZXJ0eURlZi5sYXN0TmFtZSBpbiBwcm9wZXJ0eURlZi5wb2ludGVyKSB7XG4gICAgICAgIG9iaiA9IHByb3BlcnR5RGVmLnBvaW50ZXJbcHJvcGVydHlEZWYubGFzdE5hbWVdO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIG9iaiA9IHByb3BlcnR5RGVmLnBvaW50ZXJbcHJvcGVydHlEZWYubGFzdE5hbWVdID0gW107XG4gICAgfVxuICAgIGlmICghQXJyYXkuaXNBcnJheShvYmopKSB0aHJvdyBuZXcgRXJyb3IoXCJUaGUgcmVtb3ZlIG9wZXJhdGlvbiByZXF1aXJlcyBhbiBhcnJheSBvciBuZXcgc3RydWN0dXJlIHRvIHJlbW92ZSBmcm9tLlwiKTtcblxuICAgIGlmICghb3AuaWQpIHtcbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSB0aHJvdyBuZXcgRXJyb3IoXCJUaGUgcmVtb3ZlIG9wZXJhdGlvbiB3aWxsIG5vdCByZW1vdmUgYXJyYXlzIGZyb20gc2V0cy5cIik7XG4gICAgICAgIGlmICh2YWx1ZSAmJiB0eXBlb2YgdmFsdWUgPT0gXCJvYmplY3RcIikgdGhyb3cgbmV3IEVycm9yKFwiVGhlIHJlbW92ZSBvcGVyYXRpb24gd2lsbCBub3QgcmVtb3ZlIG9iamVjdHMgZnJvbSBzZXRzLlwiKTtcblxuICAgICAgICB2YXIgaW5kZXggPSBvYmouaW5kZXhPZih2YWx1ZSk7XG4gICAgICAgIGlmIChpbmRleCAhPSAtMSkgb2JqLnNwbGljZShpbmRleCwgMSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBvYmoubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmRvZXNPYmplY3RNYXRjaElkQ2FsbGJhY2sob3AuaWQsIG9ialtpXSkpIHtcbiAgICAgICAgICAgICAgICBvYmouc3BsaWNlKGksIDEpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufVxuIl19
