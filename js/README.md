# Layer Patch Javascript Utility

The goal of this utility is to take as input

1. Layer Patch Operations Arrays
2. An object to modify

And perform the modification specifed in the Operations Array.  However, the following additional inputs make this utility a bit more practical:

1. objectType: The type of object being modified
2. camelCase: An optional camelCase parameter to indicate whether properties such as sent_at seen in the Operations Array should be transformed to sentAt when applied to the object.
3. propertyNameMap: An optional Hash mapping property names in the Operations Array to property names in the object (e.g. "sent_at" => "sent_time").
4. changeCallbacks: An optional Hash mapping property changes to callbacks that handle triggering events based on the changes.
5. abortCallbacks: An optional Hash map of callbacks to validate the change before allowing it to procede.
6. getObjectCallback: An optional callback for finding an object by ID (required for `{operation: "set", property: "metadata.fred", id: "fred"}`)
7. doesObjectMatchIdCallback: An optional callback for comparing an Id to an Object for use in managing Sets when doing add/remove operations.

## Examples

```
/* propertyNameMap: Allows us to map a property name received
 * in the operation to a different property name in our local object.
 * Note that the map is organized by Object type, and requires the `objectType` parameter to match the object
 * type keys.
 *
 *      {operation: "set", property: "sent_at", value: "2010-10-10"}
 * 
 * will set the input object's "sent_time" property to "2010-10-10". Note that this only works for root 
 * properties. The sent_at in the following example can not be remapped:
 *
 *      {operation: "set", property: "metadata.sent_at", value: "2010-10-10"}
 * 
 */
var propertyNameMap = {
    Message: {
        sent_at: "sent_time"
    },
    Conversation: {
        participants: "recipients",
        metadata: "metaData"
    }
};

/* changeCallbacks: Allows us to map changes to values specified by the Operations Array to
 * callbacks that trigger side effects and fire events.
 * Note that the map is organized by Object type, and requires the `objectType` parameter to match the object
 * type keys.
 *
 * Each objectType can have an `all` method.  `all` is only called if a more specific method for the property 
 * changed is not present.  In the example below, a change to recipient_status will not call `all`, 
 * but all other changes to the Message object will call `all`.
 */
var changeCallbacks = {
    Conversation: {
        metadata: function(updateObject, oldValue, newValue, paths) {
            alert("Metadata has changed; The following paths were changed: " + paths.join(", "));
        }
    },
    Message: {
        recipient_status: function(updateObject, oldValue, newValue, paths) {

        },
        all: function(updateObject, oldValue, newValue, paths) {

        }
    }
}

/* abortCallbacks: Allows us to examine a change, and declare it to be acceptable/unacceptable. 
 * Return true to prevent the specified change from happening.  Any other return or lack of return value
 * will allow the change to procede.
 *
 * Note that the map is organized by Object type, and requires the `objectType` parameter to match the object
 * type keys.
 *
 * Each objectType can have an `all` method.  `all` is only called if a more specific method for the property 
 * changed is not present.  In the example below, a change to metadata will not call `all`, 
 * but all other changes to the Conversation object will call `all`.
 */
var abortCallbacks = {
    Conversation: {
        metadata: function(property, operation, value) {
            // Nobody gets to set the title to "fred"
            if (property == "metadata.title" &&
                operation == "set" &&
                value == "fred") return true;
        },
        all: function(property, operation, value) {
            // Reject changes to any field whose name suggests it
            // is for date/time but whose value doesn't parse to
            // date/time.
            if (operation == "set" && property.match(/_at$/)) {
                var d = new Date(value);
                if (isNaN(d.getTime())) return true;
            }
        }
    }
};


/* getObjectCallback: When the Operations Array tells us to set a value by `id`, 
 * we need this method to lookup the ID to find the correct object.
 */
var getObjectCallback = function(id) {
    return objectCache[id];
}

var parser = layer.js.LayerPatchParser({
    camelCase: false,
    propertyNameMap: propertyNameMap,
    changeCallbacks: changeCallbacks,
    abortCallbacks: abortCallbacks,
    getObjectCallback: getObjectCallback,
    doesObjectMatchIdCallback: function(id, obj) {
        return obj.id == id;
    }
});

parser.parse({
    updateObject: obj,
    objectType: "Message", // used to access propertyNameMap and callback Maps
    operations: [op1, op2, op3, ...]
});


```
## Evolution

It is the goal of this library to only handle Layer-Patch processing in a way that is specific to the standard and independent of how or where that standard is implemented.  As such, it does not include:

1. Websockets to listen to a Layer Websocket server
2. Handlers for websocket events for creating and deleting objects
3. Caching/managing a cache of objects

It should be in our TODO list however to build a new library that:

1. Manages a Websocket connection to Layer
2. Manages create and delete events
3. Uses this library to handle Layer-Patch events

