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
    this.updateObject = options.updateObject;
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
        var propertyDef = getPropertyDef.apply(this, [op.property, options, changes])
        opHandlers[op.operation].call(this,
            propertyDef,
            getValue.apply(this, [op, options]),
            op, options, changes);
    }, this);

    reportChanges.apply(this, [changes, options.updateObject, options.objectType]);
};

function reportChanges(changes, updateObject, objectType) {
    if (this.changeCallbacks && objectType && this.changeCallbacks[objectType]) {
        Object.keys(changes).forEach(function(key) {
            if (this.changeCallbacks[objectType][key]) {
                this.changeCallbacks[objectType][key](updateObject, updateObject[key], changes[key].before, changes[key].paths);
            }
            if (this.changeCallbacks[objectType].all) {
                this.changeCallbacks[objectType].all(updateObject, updateObject[key], changes[key].before, changes[key].paths);
            }
        }, this);
    }
}

function getPropertyDef(property, options, changes) {
    var obj = options.updateObject;
    var parts = property.split(/\./);
    if (this.camelCase) parts = parts.map(function(p) {
        return p.replace(/[-_]./g, function(str) {
            return str[1].toUpperCase();
        });
    });

    if (this.propertyNameMap) {
        var typeDef = this.propertyNameMap[options.objectType];
        parts[0] = (typeDef && typeDef[parts[0]]) || parts[0];
    }

    trackChanges.apply(this, [{
        baseName: parts[0],
        fullPath: property,
        updateObject: options.updateObject,
        options: options,
        changes: changes
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
        abortHandler: this.abortCallbacks && this.abortCallbacks[options.objectType] && (this.abortCallbacks[options.objectType][parts[0]] || this.abortCallbacks[options.objectType].all)
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
        var initialValue = options.updateObject[options.baseName];
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
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9ncnVudC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJpbmRleC5qcyIsImxheWVyLXBhdGNoLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOztBQ0FBO0FBQ0E7QUFDQTs7OztBQ0ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsImlmICghZ2xvYmFsLmxheWVyKSBnbG9iYWwubGF5ZXIgPSB7fTtcbmlmICghZ2xvYmFsLmxheWVyLmpzKSBnbG9iYWwubGF5ZXIuanMgPSB7fTtcbmdsb2JhbC5sYXllci5qcy5MYXllclBhdGNoUGFyc2VyID0gcmVxdWlyZShcIi4vbGF5ZXItcGF0Y2hcIik7IiwiLyoqXG4gKiBUaGUgbGF5ZXIuanMuTGF5ZXJQYXRjaFBhcnNlciBtZXRob2Qgd2lsbCBwYXJzZVxuICpcbiAqIEBtZXRob2RcbiAqIEBwYXJhbSB7Qm9vbGVhbn0gW2NhbWVsQ2FzZT1mYWxzZV0gICAgICAgICAgICAgICAgICAgICAgU2V0IHRoZSBjYW1lbCBjYXNlZCB2ZXJzaW9uIG9mIHRoZSBuYW1lIG9mIHRoZSBpbnB1dCBvYmplY3RcbiAqIEBwYXJhbSB7T2JqZWN0fSBbcHJvcGVydHlOYW1lTWFwXSAgICAgICAgICAgICAgICAgIE1hcHMgcHJvcGVydHkgbmFtZXMgaW4gdGhlIG9wZXJhdGlvbiB0byBwcm9wZXJ0eSBuYW1lcyBpbiB0aGUgbG9jYWwgb2JqZWN0IHNjaGVtYVxuICogQHBhcmFtIHtPYmplY3R9IFtjaGFuZ2VDYWxsYmFja3NdICAgICAgICAgICAgICAgICAgQ2FsbGJhY2sgbWFkZSBhbnkgdGltZSBhbiBvYmplY3QgaXMgY2hhbmdlZFxuICogQHBhcmFtIHtPYmplY3R9IFthYm9ydENhbGxiYWNrc10gICAgICAgICAgICAgQ2FsbGJhY2sgbWFkZSB0byB2ZXJpZnkgYSBjaGFuZ2UgaXMgcGVybWl0dGVkXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBbZG9lc09iamVjdE1hdGNoSWRDYWxsYmFja10gICAgICBDYWxsYmFjayByZXR1cm5zIGJvb2xlYW4gdG8gaW5kaWNhdGUgaWYgYSBnaXZlbiBvYmplY3QgbWF0Y2hlcyBhbiBJRC5cbiAqIEByZXR1cm4ge0Jvb2xlYW59ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBSZXR1cm5zIHRydWUgaWYgYWxsIG9wZXJhdGlvbnMgY29tcGxldGVkIHN1Y2Nlc3NmdWxseSwgZmFsc2UgaWYgc29tZSByZXR1cm5lZCBlcnJvcnNcbiAqL1xuXG5cbnZhciBvcEhhbmRsZXJzID0ge1xuICAgIFwic2V0XCI6IHNldFByb3AsXG4gICAgXCJkZWxldGVcIjogZGVsZXRlUHJvcCxcbiAgICBcImFkZFwiOiBhZGRQcm9wLFxuICAgIFwicmVtb3ZlXCI6IHJlbW92ZVByb3Bcbn07XG5cbmZ1bmN0aW9uIFBhcnNlcihvcHRpb25zKSB7XG4gICAgdGhpcy51cGRhdGVPYmplY3QgPSBvcHRpb25zLnVwZGF0ZU9iamVjdDtcbiAgICB0aGlzLmNhbWVsQ2FzZSA9IG9wdGlvbnMuY2FtZWxDYXNlO1xuICAgIHRoaXMucHJvcGVydHlOYW1lTWFwID0gb3B0aW9ucy5wcm9wZXJ0eU5hbWVNYXA7XG4gICAgdGhpcy5jaGFuZ2VDYWxsYmFja3MgPSBvcHRpb25zLmNoYW5nZUNhbGxiYWNrcztcbiAgICB0aGlzLmFib3J0Q2FsbGJhY2tzID0gb3B0aW9ucy5hYm9ydENhbGxiYWNrcztcbiAgICB0aGlzLmdldE9iamVjdENhbGxiYWNrID0gb3B0aW9ucy5nZXRPYmplY3RDYWxsYmFjaztcbiAgICB0aGlzLmRvZXNPYmplY3RNYXRjaElkQ2FsbGJhY2sgPSBvcHRpb25zLmRvZXNPYmplY3RNYXRjaElkQ2FsbGJhY2sgfHwgZnVuY3Rpb24oaWQsIG9iaikge1xuICAgICAgICByZXR1cm4gb2JqLmlkID09IGlkO1xuICAgIH07XG4gICAgcmV0dXJuIHRoaXM7XG59O1xubW9kdWxlLmV4cG9ydHMgPSBQYXJzZXI7XG5cblBhcnNlci5wcm90b3R5cGUucGFyc2UgPSBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgdmFyIGNoYW5nZXMgPSB7fTtcbiAgICBvcHRpb25zLm9wZXJhdGlvbnMuZm9yRWFjaChmdW5jdGlvbihvcCkge1xuICAgICAgICB2YXIgcHJvcGVydHlEZWYgPSBnZXRQcm9wZXJ0eURlZi5hcHBseSh0aGlzLCBbb3AucHJvcGVydHksIG9wdGlvbnMsIGNoYW5nZXNdKVxuICAgICAgICBvcEhhbmRsZXJzW29wLm9wZXJhdGlvbl0uY2FsbCh0aGlzLFxuICAgICAgICAgICAgcHJvcGVydHlEZWYsXG4gICAgICAgICAgICBnZXRWYWx1ZS5hcHBseSh0aGlzLCBbb3AsIG9wdGlvbnNdKSxcbiAgICAgICAgICAgIG9wLCBvcHRpb25zLCBjaGFuZ2VzKTtcbiAgICB9LCB0aGlzKTtcblxuICAgIHJlcG9ydENoYW5nZXMuYXBwbHkodGhpcywgW2NoYW5nZXMsIG9wdGlvbnMudXBkYXRlT2JqZWN0LCBvcHRpb25zLm9iamVjdFR5cGVdKTtcbn07XG5cbmZ1bmN0aW9uIHJlcG9ydENoYW5nZXMoY2hhbmdlcywgdXBkYXRlT2JqZWN0LCBvYmplY3RUeXBlKSB7XG4gICAgaWYgKHRoaXMuY2hhbmdlQ2FsbGJhY2tzICYmIG9iamVjdFR5cGUgJiYgdGhpcy5jaGFuZ2VDYWxsYmFja3Nbb2JqZWN0VHlwZV0pIHtcbiAgICAgICAgT2JqZWN0LmtleXMoY2hhbmdlcykuZm9yRWFjaChmdW5jdGlvbihrZXkpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmNoYW5nZUNhbGxiYWNrc1tvYmplY3RUeXBlXVtrZXldKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5jaGFuZ2VDYWxsYmFja3Nbb2JqZWN0VHlwZV1ba2V5XSh1cGRhdGVPYmplY3QsIHVwZGF0ZU9iamVjdFtrZXldLCBjaGFuZ2VzW2tleV0uYmVmb3JlLCBjaGFuZ2VzW2tleV0ucGF0aHMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHRoaXMuY2hhbmdlQ2FsbGJhY2tzW29iamVjdFR5cGVdLmFsbCkge1xuICAgICAgICAgICAgICAgIHRoaXMuY2hhbmdlQ2FsbGJhY2tzW29iamVjdFR5cGVdLmFsbCh1cGRhdGVPYmplY3QsIHVwZGF0ZU9iamVjdFtrZXldLCBjaGFuZ2VzW2tleV0uYmVmb3JlLCBjaGFuZ2VzW2tleV0ucGF0aHMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LCB0aGlzKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGdldFByb3BlcnR5RGVmKHByb3BlcnR5LCBvcHRpb25zLCBjaGFuZ2VzKSB7XG4gICAgdmFyIG9iaiA9IG9wdGlvbnMudXBkYXRlT2JqZWN0O1xuICAgIHZhciBwYXJ0cyA9IHByb3BlcnR5LnNwbGl0KC9cXC4vKTtcbiAgICBpZiAodGhpcy5jYW1lbENhc2UpIHBhcnRzID0gcGFydHMubWFwKGZ1bmN0aW9uKHApIHtcbiAgICAgICAgcmV0dXJuIHAucmVwbGFjZSgvWy1fXS4vZywgZnVuY3Rpb24oc3RyKSB7XG4gICAgICAgICAgICByZXR1cm4gc3RyWzFdLnRvVXBwZXJDYXNlKCk7XG4gICAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgaWYgKHRoaXMucHJvcGVydHlOYW1lTWFwKSB7XG4gICAgICAgIHZhciB0eXBlRGVmID0gdGhpcy5wcm9wZXJ0eU5hbWVNYXBbb3B0aW9ucy5vYmplY3RUeXBlXTtcbiAgICAgICAgcGFydHNbMF0gPSAodHlwZURlZiAmJiB0eXBlRGVmW3BhcnRzWzBdXSkgfHwgcGFydHNbMF07XG4gICAgfVxuXG4gICAgdHJhY2tDaGFuZ2VzLmFwcGx5KHRoaXMsIFt7XG4gICAgICAgIGJhc2VOYW1lOiBwYXJ0c1swXSxcbiAgICAgICAgZnVsbFBhdGg6IHByb3BlcnR5LFxuICAgICAgICB1cGRhdGVPYmplY3Q6IG9wdGlvbnMudXBkYXRlT2JqZWN0LFxuICAgICAgICBvcHRpb25zOiBvcHRpb25zLFxuICAgICAgICBjaGFuZ2VzOiBjaGFuZ2VzXG4gICAgfV0pO1xuXG4gICAgdmFyIGN1ck9iaiA9IG9iajtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHBhcnRzLmxlbmd0aC0xOyBpKyspIHtcbiAgICAgICAgdmFyIHBhcnQgPSBwYXJ0c1tpXTtcbiAgICAgICAgaWYgKHBhcnQgaW4gY3VyT2JqKSB7XG4gICAgICAgICAgICBjdXJPYmogPSBjdXJPYmpbcGFydF07XG4gICAgICAgICAgICBpZiAoY3VyT2JqID09PSBudWxsIHx8IHR5cGVvZiBjdXJPYmogIT0gXCJvYmplY3RcIikgdGhyb3cgbmV3IEVycm9yKFwiQ2FuIG5vdCBhY2Nlc3MgcHJvcGVydHkgXFxcIlwiICsgcHJvcGVydHkgKyBcIlxcXCJcIik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjdXJPYmpbcGFydF0gPSB7fTtcbiAgICAgICAgICAgIGN1ck9iaiA9IGN1ck9ialtwYXJ0XTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4ge1xuICAgICAgICBwb2ludGVyOiBjdXJPYmosXG4gICAgICAgIGxhc3ROYW1lOiBwYXJ0c1twYXJ0cy5sZW5ndGgtMV0sXG4gICAgICAgIGJhc2VOYW1lOiBwYXJ0c1swXSxcbiAgICAgICAgZnVsbFBhdGg6IHByb3BlcnR5LFxuICAgICAgICBhYm9ydEhhbmRsZXI6IHRoaXMuYWJvcnRDYWxsYmFja3MgJiYgdGhpcy5hYm9ydENhbGxiYWNrc1tvcHRpb25zLm9iamVjdFR5cGVdICYmICh0aGlzLmFib3J0Q2FsbGJhY2tzW29wdGlvbnMub2JqZWN0VHlwZV1bcGFydHNbMF1dIHx8IHRoaXMuYWJvcnRDYWxsYmFja3Nbb3B0aW9ucy5vYmplY3RUeXBlXS5hbGwpXG4gICAgfTtcbn1cblxuZnVuY3Rpb24gZ2V0VmFsdWUob3AsIG9wdGlvbnMpIHtcbiAgICBpZiAob3AuaWQpIHtcbiAgICAgICAgaWYgKCF0aGlzLmdldE9iamVjdENhbGxiYWNrKSB0aHJvdyBuZXcgRXJyb3IoXCJNdXN0IHByb3ZpZGUgZ2V0T2JqZWN0Q2FsbGJhY2sgaW4gY29uc3RydWN0b3IgdG8gdXNlIGlkc1wiKTtcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0T2JqZWN0Q2FsbGJhY2sob3AuaWQpIHx8IG9wLmlkO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBvcC52YWx1ZTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHRyYWNrQ2hhbmdlcyhvcHRpb25zKSB7XG4gICAgaWYgKCFvcHRpb25zLmNoYW5nZXNbb3B0aW9ucy5iYXNlTmFtZV0pIHtcbiAgICAgICAgdmFyIGluaXRpYWxWYWx1ZSA9IG9wdGlvbnMudXBkYXRlT2JqZWN0W29wdGlvbnMuYmFzZU5hbWVdO1xuICAgICAgICB2YXIgY2hhbmdlID0gb3B0aW9ucy5jaGFuZ2VzW29wdGlvbnMuYmFzZU5hbWVdID0ge3BhdGhzOiBbXX07XG4gICAgICAgIGNoYW5nZS5iZWZvcmUgPSAoaW5pdGlhbFZhbHVlICYmIHR5cGVvZiBpbml0aWFsVmFsdWUgPT0gXCJvYmplY3RcIikgPyBKU09OLnBhcnNlKEpTT04uc3RyaW5naWZ5KGluaXRpYWxWYWx1ZSkpIDogaW5pdGlhbFZhbHVlO1xuICAgIH1cbiAgICBvcHRpb25zLmNoYW5nZXNbb3B0aW9ucy5iYXNlTmFtZV0ucGF0aHMucHVzaChvcHRpb25zLmZ1bGxQYXRoKTtcbn1cblxuZnVuY3Rpb24gc2V0UHJvcChwcm9wZXJ0eURlZiwgdmFsdWUsIG9wLCBvcHRpb25zLCBjaGFuZ2VzKSB7XG4gICAgaWYgKHByb3BlcnR5RGVmLmFib3J0SGFuZGxlcikge1xuICAgICAgICBpZiAocHJvcGVydHlEZWYuYWJvcnRIYW5kbGVyKHByb3BlcnR5RGVmLmZ1bGxQYXRoLCBcInNldFwiLCB2YWx1ZSkpIHJldHVybjtcbiAgICB9XG4gICAgcHJvcGVydHlEZWYucG9pbnRlcltwcm9wZXJ0eURlZi5sYXN0TmFtZV0gPSB2YWx1ZTtcblxufVxuXG5mdW5jdGlvbiBkZWxldGVQcm9wKHByb3BlcnR5RGVmLCB2YWx1ZSwgb3AsIG9wdGlvbnMsIGNoYW5nZXMpIHtcbiAgICBpZiAocHJvcGVydHlEZWYuYWJvcnRIYW5kbGVyKSB7XG4gICAgICAgIGlmIChwcm9wZXJ0eURlZi5hYm9ydEhhbmRsZXIocHJvcGVydHlEZWYuZnVsbFBhdGgsIFwiZGVsZXRlXCIsIHZhbHVlKSkgcmV0dXJuO1xuICAgIH1cbiAgICBkZWxldGUgcHJvcGVydHlEZWYucG9pbnRlcltwcm9wZXJ0eURlZi5sYXN0TmFtZV07XG59XG5cbmZ1bmN0aW9uIGFkZFByb3AocHJvcGVydHlEZWYsIHZhbHVlLCBvcCwgb3B0aW9ucywgY2hhbmdlcykge1xuICAgIGlmIChwcm9wZXJ0eURlZi5hYm9ydEhhbmRsZXIpIHtcbiAgICAgICAgaWYgKHByb3BlcnR5RGVmLmFib3J0SGFuZGxlcihwcm9wZXJ0eURlZi5mdWxsUGF0aCwgXCJhZGRcIiwgdmFsdWUpKSByZXR1cm47XG4gICAgfVxuICAgIHZhciBvYmo7XG4gICAgaWYgKHByb3BlcnR5RGVmLmxhc3ROYW1lIGluIHByb3BlcnR5RGVmLnBvaW50ZXIpIHtcbiAgICAgICAgb2JqID0gcHJvcGVydHlEZWYucG9pbnRlcltwcm9wZXJ0eURlZi5sYXN0TmFtZV07XG4gICAgfSBlbHNlIHtcbiAgICAgICAgb2JqID0gcHJvcGVydHlEZWYucG9pbnRlcltwcm9wZXJ0eURlZi5sYXN0TmFtZV0gPSBbXTtcbiAgICB9XG4gICAgaWYgKCFBcnJheS5pc0FycmF5KG9iaikpIHRocm93IG5ldyBFcnJvcihcIlRoZSBhZGQgb3BlcmF0aW9uIHJlcXVpcmVzIGFuIGFycmF5IG9yIG5ldyBzdHJ1Y3R1cmUgdG8gYWRkIHRvLlwiKTtcbiAgICBpZiAoIW9wLmlkKSB7XG4gICAgICAgIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkgdGhyb3cgbmV3IEVycm9yKFwiVGhlIGFkZCBvcGVyYXRpb24gd2lsbCBub3QgYWRkIGFycmF5cyB0byBzZXRzLlwiKTtcbiAgICAgICAgaWYgKHZhbHVlICYmIHR5cGVvZiB2YWx1ZSA9PSBcIm9iamVjdFwiKSB0aHJvdyBuZXcgRXJyb3IoXCJUaGUgYWRkIG9wZXJhdGlvbiB3aWxsIG5vdCBhZGQgb2JqZWN0cyB0byBzZXRzLlwiKTtcbiAgICB9XG4gICAgaWYgKG9iai5pbmRleE9mKHZhbHVlKSA9PSAtMSkgb2JqLnB1c2godmFsdWUpO1xufVxuXG5mdW5jdGlvbiByZW1vdmVQcm9wKHByb3BlcnR5RGVmLCB2YWx1ZSwgb3AsIG9wdGlvbnMsIGNoYW5nZXMpIHtcbiAgICBpZiAocHJvcGVydHlEZWYuYWJvcnRIYW5kbGVyKSB7XG4gICAgICAgIGlmIChwcm9wZXJ0eURlZi5hYm9ydEhhbmRsZXIocHJvcGVydHlEZWYuZnVsbFBhdGgsIFwicmVtb3ZlXCIsIHZhbHVlKSkgcmV0dXJuO1xuICAgIH1cbiAgICB2YXIgb2JqO1xuICAgIGlmIChwcm9wZXJ0eURlZi5sYXN0TmFtZSBpbiBwcm9wZXJ0eURlZi5wb2ludGVyKSB7XG4gICAgICAgIG9iaiA9IHByb3BlcnR5RGVmLnBvaW50ZXJbcHJvcGVydHlEZWYubGFzdE5hbWVdO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIG9iaiA9IHByb3BlcnR5RGVmLnBvaW50ZXJbcHJvcGVydHlEZWYubGFzdE5hbWVdID0gW107XG4gICAgfVxuICAgIGlmICghQXJyYXkuaXNBcnJheShvYmopKSB0aHJvdyBuZXcgRXJyb3IoXCJUaGUgcmVtb3ZlIG9wZXJhdGlvbiByZXF1aXJlcyBhbiBhcnJheSBvciBuZXcgc3RydWN0dXJlIHRvIHJlbW92ZSBmcm9tLlwiKTtcblxuICAgIGlmICghb3AuaWQpIHtcbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSB0aHJvdyBuZXcgRXJyb3IoXCJUaGUgcmVtb3ZlIG9wZXJhdGlvbiB3aWxsIG5vdCByZW1vdmUgYXJyYXlzIGZyb20gc2V0cy5cIik7XG4gICAgICAgIGlmICh2YWx1ZSAmJiB0eXBlb2YgdmFsdWUgPT0gXCJvYmplY3RcIikgdGhyb3cgbmV3IEVycm9yKFwiVGhlIHJlbW92ZSBvcGVyYXRpb24gd2lsbCBub3QgcmVtb3ZlIG9iamVjdHMgZnJvbSBzZXRzLlwiKTtcblxuICAgICAgICB2YXIgaW5kZXggPSBvYmouaW5kZXhPZih2YWx1ZSk7XG4gICAgICAgIGlmIChpbmRleCAhPSAtMSkgb2JqLnNwbGljZShpbmRleCwgMSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBvYmoubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmRvZXNPYmplY3RNYXRjaElkQ2FsbGJhY2sob3AuaWQsIG9ialtpXSkpIHtcbiAgICAgICAgICAgICAgICBvYmouc3BsaWNlKGksIDEpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufVxuIl19
