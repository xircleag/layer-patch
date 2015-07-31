# Layer Patch Javascript Utility

The goal of this utility is to take as input

1. Layer Patch Operations Arrays
2. An object to modify

## Installing

### Installing from Github

You can directly download the file layer-patch-build.js and load that from a script tag.  If you load it this way, your initialization code will look like:

```
var parser = new layer.js.LayerPatchParser({});
```

You can download and build the repo itself via:

```
> git clone git@github.com:layerhq/layer-patch.git
> cd layer-patch
> npm install  (sudo may be required for this)
```

The end result will be a layer-patch-build.js file which you can load via a script tag, with the same initialization code as above.

#### Testing the Github Repo

You can run the tests on your build by loading `js/test/SpecRunner.html` in your browser.

### Installing from npm

If using npm and browserify, this will be the preferred approach.

```
> npm install layer-patch --save
```

Your initialization code will then look like:

```
var LayerPatchParser = require("layer-patch");
var parser = new LayerPatchParser({});
```


## Basic Example

```
var parser = new layer.js.LayerPatchParser({});

var testObj = {
    "a": "Hello",
    "b": "There"
};
parser.parse({
    object: testObj,
    operations: [
        {"operation": "set", "property": "a", "value": "Goodbye"},
        {"operation": "set", "property": "c", "value": 5}
    ]
});
```

The above example transforms `testObj` to
```json
{
    "a": "Goodbye",
    "b": "There",
    "c": 5
}
```

## Layer Websocket Example

This example shows using this library for receiving operations from the Layer Platform's Websocket API.

It depends upon the getObjectCallback and changeCallbacks documented below.

```

// Setup an object cache into which we will write new objects
var objectCache = {};

// This example does not define what an EventManager is, but assumes it has a trigger method.
var EventManager = new EventManager();

// Create the parser
var parser = new LayerParser({
    getObjectCallback: function(id) {
        return objectCache[id]
    },
    changeCallbacks: {
        Message: {
            all: function(object, newValue, oldValue, paths) {
                console.log(object.id + " has changed " + paths.join(", ") + " from " + newValue + " to " + oldValue);
                EventManager.trigger("patch", "Message", object, newValue, oldValue, paths);
            }
        },
        Conversation: {
            all: function(object, newValue, oldValue, paths) {
                console.log(object.id + " has changed " + paths.join(", ") + " from " + newValue + " to " + oldValue);
                EventManager.trigger("patch", "Conversation", object, newValue, oldValue, paths);
            }
        }
    }
});

// Assumes the websocket is already initialized and just needs an onMessage event handler
socket.addEventListener("message", function(evt) {
    var msg = JSON.parse(evt.data);
    try {
        switch(msg.type + "." + msg.operation) {

            // On receiving a create event, notify the app
            // of the new object, and cache the object
            case "change.create":
                EventManager.trigger("create", msg.object.type, msg.data);
                objectCache[msg.object.id] = msg.data;
                break;

            // On receiving a delete event, notify the app of
            // the removed object, and remove it from cache
            case "change.delete":
                EventManager.trigger("delete", msg.object.type, objectCache[msg.object.id]);
                delete objectCache[msg.object.id];
                break;

            // On receiving a patch event, let the parser handle it.
            // Find the object to be modified, and if it exists, pass it and
            // the operations to the parser.
            // The changeCallbacks handler will notify the app
            // of any changes.
            case "change.patch":
                var objectToChange = objectCache[msg.object.id];
                if (objectToChange) {
                    parser.parse({
                        object: objectToChange,
                        type: msg.object.type,
                        operations: msg.data
                    });
                }
                break;
        }
    } catch(e) {
        console.error("layer-patch Error: " + e);
    }
});
```

## Library Properties

The parser takes a number of optional parameters when initializing it.  Many of these depend upon
the `type` parameter.

Every call to the `parse` method has an input of `type`:

```
parser.parse({
    object: testObj,
    type: "Person",
    operations: ops
});
```

This `type` value is used as an index into many of the configuration properties shown below.

Note that subproperty names are NOT supported in any of these configurations.  For example, if you have a property called "metadata" you can use any of these configuration parameters to affect "metadata", but if an operation were to set "metadata.age", configurations on "metadata" would continue to apply, but you can not add configurations for the "age" subproperty.

### getObjectCallback

The getObjectCallback allows the parser to handle operations such as
```
[{"operation": "set", "property": "friend", "id": "fred"}]
```
As the operation is setting by id rather than by value, the parser needs a way to lookup the object identified by "fred".  The parser will use the `getObjectCallback` method provided to find the object specified by "fred" and use that as the value.

```
var objectCache = {
    "fred": {
        "firstName": "fred",
        "lastName": "flinstone",
        "status": "stoneAged"
    }
};

/**
 * @method
 * @param  {string} id    ID of the object to look for
 * @return {object}       Object that matches the id (or null)
 */
var getObjectCallback = function(id) {
    return objectCache[id];
}

var parser = new layer.js.LayerPatchParser({
    getObjectCallback: getObjectCallback
});

var testObj = {
    "a": "Hello",
    "b": "There",
    "friend": null
};
parser.parse({
    object: testObj,
    operations: [{"operation": "set", "property": "friend", "id": "fred"}]
});
```

The above operation will result in a final state for testObj:
```json
{
    "a": "Hello",
    "b": "There",
    "friend": {
        "firstName": "fred",
        "lastName": "flinstone",
        "status": "stoneAged"
    }
}
```

### doesObjectMatchIdCallback

When adding or removing objects to a set, a way of comparing objects is needed.  While adding/removing objects is only allowed by passing in an id rather than object, we need a way to compare that id to the objects in the set.  The doesObjectMatchIdCallback method will be called on each object in the set and returns true if its a match.  If its a match, an `add` operation will determine that the object is already present and does not need adding; a `remove` operation will remove the matching entry.

Note that if using the Layer Platform Websocket, this method is not required; sets managed by Layer
do not contain objects.

```
/**
 * @method
 * @param  {string} id  ID of the object to be added/removed
 * @param  {object} obj The current object we are testing
 * @return {boolean}     Return true if the object matches the ID
 */
function doesObjectMatchIdCallback(id, obj) {
    return obj.id == id;
}
```

### camelCase

If true, camelCase says take any uncamel cased property names in the
layer-patch operations array, and assume that the local copy uses the camelCased equivalent.

```

var parser = new layer.js.LayerPatchParser({
    camelCase: true
});

var testObj = {
    "isAFriend": true,
    "myEnemy": "fred"
};
parser.parse({
    object: testObj,
    operations: [
        {"operation": "set", "property": "is_a_friend", "value": false},
        {"operation": "set", "property": "my_enemy", "value": "wilma"}
    ]
});
```

The above operation will result in a final state for testObj:
```json
{
    "isAFriend": false,
    "myEnemy": "wilma"
}
```

### propertyNameMap


The Property Name Map: Allows us to map a property name received from a
remote client/server to our local object models which may have different property names.
This is similar to the `camelCase` property but provides fine grained control.

The map is organized by object type.
```
var propertyNameMap = {
    "Person": {
        "age": "year_count"
    },
    "Dog": {
        "breed": "dog_type"
    }
};

var parser = new layer.js.LayerPatchParser({
    "propertyNameMap": propertyNameMap
});

var testObj = {
    "year_count": 50,
    "name": "fred"
};
parser.parse({
    "object": testObj,
    "type": "Person",
    "operations": [
        {"operation": "set", "property": "age", "value": 51}
    ]
});
```

The above operation will result in a final state for testObj:
```json
{
    "year_count": 51,
    "name": "fred"
}
```

### changeCallbacks

The Change Event Handler allows side effects and events to be fired based on a change
executed by the parser.  The changeCallback parameter should be broken down by object type,
and each object type can either contain an "all" function or individual functions for each property
name.

```
/**
 * @param {object} object   The object that has been changed
 * @param {Mixed} oldValue  The original value of the property that changed
 * @param {Mixed} newValue  The new value of the property that changed
 * @param {string[]} paths  Array of property paths that have changed
 *
 * Note that the paths array typically contains only a single element.
 * The only time it contains multiple elements is if subproperties are changed,
 * in which case it groups all changes to the same property in a single call.
 */
var changeCallbacks = {
    Person: {
        year_count: function(object, oldValue, newValue, paths) {
            alert("Metadata has changed; The following paths were changed: " + paths.join(", "));
        },
        profession: function(object, oldValue, newValue, paths) {
            alert("The person is now a " + newValue);
        }
    },
    Dog: {
        all: function(object, oldValue, newValue, paths) {
            alert("The dog's " + paths.join(", ") + " properties have changed to " + newValue);
        }
    }
}

var parser = new layer.js.LayerPatchParser({
    changeCallbacks: changeCallbacks
});

var testPerson = {
    "year_count": 50,
    "name": "fred",
    "metadata": {
        "nickname": "Freaky Fred",
        "last_nickname": "Friendly Fred"
    }
};

var testDog = {
    "breed": "poodle",
    "attitude": "hostile",
    "preferred_food": "zombie"
};

parser.parse({
    object: testPerson,
    type: "Person",
    operations: [
        {"operation": "set", "property": "year_count", "value": 51},
        {"operation": "set", "property": "metadata.nickname", value: "Freaky Frodo"},
        {"operation": "set", "property": "metadata.last_nickname", value: "Freaky Fred"}
    ]
});

parser.parse({
    object: testDog,
    type: "Dog",
    operations: [
        {"operation": "set", "property": "preferred_food", "value": "Frankenstein"}
    ]
});
```

The two parse calls above will result in the following events:

1. year_count callback called with (testPerson, 50, 51, ["year_count"])
2. metadata callback called with (testPerson, {nickname: "Freaky Fred", last_nickname: "Friendly Fred"}, {nickname: "Freaky Frodo", last_nickname: "Freaky Fred"}, ["metadata.nickname", "metadata.last_nickname"])
3. all callback called with (testDog, "zombie", "Frankenstein", ["preferred_food"])

### abortCallback

The Abort Event Handler allows an operation to be rejected before its performed. The abortCallback parameter should be broken down by object type,
and each object type can either contain an "all" function or individual functions for each property
name.

Each function should return true or a truthy value to abort the change; a falsy value will allow the
change to procede.

```
/**
 * @param {string} property     The full path for the property to be changed
 * @param {object} operation    One of set, delete, add, remove
 * @param {Mixed}  value        The value to be set (if its a set operation)
 * @return {boolean}            True means prevent this operation from executing
 */
var abortCallbacks = {
    Person: {
        year_count: function(property, operation, value) {
            // System should reject negative years; all else is good.
            if (operation == "set" && value < 0) return true;
        }
    },
    Dog: {
        all: function(property, operation, value) {
            // Reject changes to any field whose name ends in _at but
            // whose value doesn't parse to date/time.
            if (operation == "set" && property.match(/_at$/)) {
                var d = new Date(value);
                if (isNaN(d.getTime())) return true;
            }
        }
    }
};


var parser = new layer.js.LayerPatchParser({
    abortCallbacks: abortCallbacks
});

var testPerson = {
    year_count: 50,
    name: "fred"
};

var testDog = {
    breed: "poodle",
    attitude: "hostile",
    preferred_food: "zombie",
    ate_zombie_at: "10/10/2010"
};

parser.parse({
    object: testPerson,
    type: "Person",
    operations: [
        {"operation": "set", "property": "year_count", "value": -51},
        {"operation": "set", "property": "year_count", "value": 52},
    ]
});

parser.parse({
    object: testDog,
    type: "Dog",
    operations: [
        {"operation": "set", "property": "ate_zombie_at", "value": "101010"},
        {"operation": "set", "property": "preferred_food", "value": "Bad Dates"}
    ]
});
```

The two parse calls above will result in the following objects:
```
var testPerson = {
    year_count: 52,
    name: "fred"
};

var testDog = {
    breed: "poodle",
    attitude: "hostile",
    preferred_food: "Bad Dates",
    ate_zombie_at: "10/10/2010"
};
```

### returnIds

When setting values by ID, proper behavior when the object associated
with that ID is not well defined by the Layer Patch specification.
The default behavior is to set the property to null if the ID is not
found.  Setting the returnIds property to true will set the property
to the string ID if the object is not found.

## Evolution

It is the goal of this library to only handle Layer-Patch processing in a way that is specific to the standard and independent of how or where that standard is implemented.  As such, it does not include:

1. Websockets to listen to a Layer Websocket server
2. Handlers for websocket events for creating and deleting objects
3. Caching/managing a cache of objects

It should be in our TODO list however to build a new library that:

1. Manages a Websocket connection to Layer
2. Manages create and delete events
3. Uses this library to handle Layer-Patch events

