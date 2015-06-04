/**
 * The layer.js.LayerPatchParser method will parse
 *
 * @method
 * @param {Layer-Patch-Operation[]} operations     Array of Layer Patch Operations
 * @param {Object} updateObject                    Object to update using the operation
 * @param {Boolean} camelCase                      Set the camel cased version of the name of the input object
 * @param {Object} propertyNameMap                  Maps property names in the operation to property names in the local object schema
 * @param {Object} changeCallbacks                  Callback made any time an object is changed
 * @param {Object} abortChangeCallbacks             Callback made to verify a change is permitted
 * @return {Boolean}                                Returns true if all operations completed successfully, false if some returned errors
 */
(function(global) {
    if (!global.layer) global.layer = {};
    if (!global.layer.js) global.layer.js = {};

    var opHandlers = {
        "set": setProp,
        "delete": deleteProp,
        "add": addProp,
        "remove": removeProp
    };

    global.layer.js.layerParser = function(options) {
        var o = options.updateObject;
        options.operations.forEach(function(op) {
            opHandlers[op.operation](options);
        });
    };

    function setProp(options) {
    }

    function deleteProp(options) {

    }

    function addProp(options) {

    }

    function removeProp(options) {


    }
})(typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {});