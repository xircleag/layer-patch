# Layer Patch Javascript Utility

The goal of this utility is to take as input

1. Layer Patch Operations Arrays
2. An object to modify

And perform those modifications.  However, the following additional inputs make this utility a bit more practical:

1. A type for the object (used to do lookups in the other config structures)
4. An optional camelCase parameter to indicate whether properties such as sent_at should be transformed to sentAt
5. An optional Hash mapping property names from the server property name "sent_at" to any property name in your client side schema "sent_time"
6. An optional Hash mapping changes to properties to callbacks to handle triggering events based on the changes.
7. An optional Hash mapping of callbacks to validate the change before allowing it to procede.
8. An optional callback for finding an object by ID (required for `{operation: "set", property: "fred", id: "layer:///messages/m1"}`

## Examples

```
/* The Property Name Map: Allows us to map a property name received
 * in the operation to a different property name in our local object.
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

/* The Change Event Handler: Allows side effects and events to be fired
 * based on a change.
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

// Return true to abort; false, null, undefined all allow operation to procede
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

