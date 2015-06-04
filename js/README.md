# Layer Patch Javascript Utility

The goal of this utility is to take as input

1. Layer Patch Operations Arrays
2. An object to modify
3. An optional camelCase parameter to indicate whether properties such as sent_at should be transformed to sentAt
4. An optional Hash mapping property names from the server property name "sent_at" to any property name in your client side schema "sent_time"
5. An optional Hash mapping changes to properties to callbacks to handle side effects of any changes
6. An optional Hash mapping of callbacks to prevent the requested changes as illegal changes.
7. An optional callback for finding an object by ID (required for `{operation: "set", property: "fred", id: "layer:///messages/m1"}`

## Examples

var propertyNameMap = {
    Message: {
        sent_at: "sent_time"
    },
    Conversation: {
        participants: "recipients",
        metadata: "metaData"
    }
};

var changeCallbacks = {
    Conversation: {
        metadata: function(oldValue, newValue, op) {
            alert("Metadata has changed; " + op.value + " has been " + op.operation + "ed");
        }
    },
    Message: {
        recipient_status: function(oldValue, newValue, op) {

        },
        all: function(propertyName, oldValue, newValue, op) {

        }
    }
}

// Return true to abort; false, null, undefined all allow operation to procede
var abortChangeCallbacks = {
    Conversation: {
        metadata: function(oldValue, newValue, op) {
            // Nobody gets to set the title to "fred"
            if (newValue.title == "fred") return true;
        },
        all: function(propertyName, oldValue, newValue, op) {
            // Reject changes to any field whose name suggests it
            // is for date/time but whose value doesn't parse to
            // date/time.
            if (propertyName.match(/_at$/)) {
                var d = new Date(newValue);
                if (isNaN(d.getTime())) return true;
            }
        }
    }
};

var getObjectCallback = function(id) {
    return objectCache[id];
}

layer.js.LayerPatchParser({
    operations: websocketMsg.data,
    updateObject: mycache.fetch(websocketMsg.object.id),
    camelCase: false,
    propertyNameMap: propertyNameMap,
    changeCallbacks: changeCallbacks,
    abortChangeCallbacks: abortChangeCallbacks,
    getObjectCallback: getObjectCallback
});

## Evolution

It is the goal of this library to only handle Layer-Patch processing in a way that is specific to the standard and independent of how or where that standard is implemented.  As such, it does not include:

1. Websockets to listen to a Layer Websocket server
2. Handlers for websocket events for creating and deleting objects
3. Caching/managing a cache of objects

It should be in our TODO list however to build a new library that:

1. Manages a Websocket connection to Layer
2. Manages create and delete events
3. Uses this library to handle Layer-Patch events

