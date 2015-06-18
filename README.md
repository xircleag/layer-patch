# The Layer-Patch Format


## Introduction

What is Layer-Patch, and why use it rather than industry standard formats?

Layer-Patch is a format for communicating changes to objects between multiple devices/services so that all devices can maintain a common object state.

It is similar in many ways to the JSON-Patch standard. The JSON-Patch standard had a few key flaws:

1. It has a concept of arrays, but no concept of sets.
2. Small changes in the ordering of the array, or in the sequence in which syncing is done will cause objects to get out of sync, resulting in bad behaviors.  Such issues may be easily addressed in a tight-knit set of teams and environments, but will result in many errors when used to communicate with a wide variety of customers using a wide variety of frameworks.
3. It uses JSON Pointer notation (path elements seperated by "/") inconsistent with a variety of standard practices based around path elements being separated by ".".

> Note that this document uses examples from data models used by Layer, Inc.  The format described here however should be applicable to any domain.

> The term "Base Object" refers to a core resource that can be mutated via patch operations.  Examples in this document will use Conversation and Message objects used by Layer, Inc.

> Note that there may be occasional notes in the document, formatted like this.  They will be used to indicate the current state of implementation of the format, and should not be considered a part of the specification itself.

## The Format

    Content-type: application/vnd.layer-patch+json

    [
        {operation: "add",      property: "propA.propB", value: "fred"},
        {operation: "remove",   property: "propA.propB", value: "fred"},
        {operation: "add",      property: "propA.propB", value: "fred", index: 3},
        {operation: "remove",   property: "propA.propB", value: "fred", index: 3},
        {operation: "remove",   property: "propA.propB", index: 3},
        {operation: "set",      property: "propA.propB", value: "fred"},
        {operation: "delete",   property: "propA.propB"},
        {operation: "set",      property: "propA.propB", id: "layer:///messages/uuid"}
    ]


The above structure shows the Operations Array, which consists of an array of operations to be executed in sequence, each operation modifying the specified resource.

### Using the Operations Array via REST API

A REST call will identify the resource to be modified via the URL of the request.  The call will provide

1. A "Content-Type" header of "application/vnd.layer-patch+json".
2. A request body that consists of the Operations Array.


```
PATCH /conversations/{conversation_id}
Content-type: "application/vnd.layer-patch+json"

[
    {operation: "add",      property: "participants", value: "user1"},
    {operation: "add",      property: "participants", value: "user2"},
    {operation: "remove",   property: "participants", value: "user3"}
]
```

### Using the Operations Array via Websocket API

A Websocket event will identify the resource to be modified and will provide an Operations Array to tell the client or server how to update that resource.  Here is one example:

    {
        "type": "change",
        "operation": "patch",
        "object": {
            "type": "Conversation",
            "id": "layer:///conversations/f3cc7b32-3c92-11e4-baad-164230d1df67",
            "url": "https://api.layer.com/conversations/f3cc7b32-3c92-11e4-baad-164230d1df67"
        },
        "data": [
            {operation: "delete", property: "metadata.todo"},
            {operation: "set",    property: "unread_message_count", 5}
        ]
    }

### The Operations Array

The operations array can contain zero or more elements. Each element represents an Operation

Each Operation consists of the following keys:

* operation: Type of mutation to perform (required)
* property: Path to the property to modify (required)
* value: Value to be added or removed from the property
* id: Id of the object to be added or removed from the property
* index: Index in an array of a value to insert or remove

#### The Operation Key

The following values are supported for `operation`:

* add: Adds the specified value to an array/set.
* remove: Removes the specified value from an array/set.
* set: Sets the specified key in an object.
* delete: Removes the specified key from an object.

#### The Property Key

A property identifies either a property of the Base Object or a `.` separated path to a key within one of its properties.

* `unread_message_count`: Identifies the unread_message_count property of a Base Object.
* `recipient_status.fred`: Identifies the recipient_status property of a Base Object, and the `fred` key within the recipient_status value.

Any key within an object identified by the `property` that does not exist will be created.  Note however:

* New properties will never be created on a Base Object, only within object/dictionary properties of the Base Object.
* This rule *does* apply to the `delete` operation; refering to "metadata.a.b" means that `metadata: {a: {b: null}}` must be created so that b can be deleted; thus, `{a: {}}` may be created in order to delete "metadata.a.b". (note: the creation of the structure is the goal, implementation details are not intended to be mandated here).

#### The Value and Id Key

All operations except delete take either a `value` or a `id`.  `value` or `id` specify what value is to be written or removed from the property.  `value` passes the value directly while `id` identifies an object to be passed in.

#### The Index Key

The `index` property is used to modify the `add` and `remove` operations.

* Omitting the `index` will result in `add` and `remove` performing *set* rather than *array* operations.  As such, `add` will not add a second copy of a value and `remove` will only remove by value.
* `add` by `index` will cause the specified value to be *inserted*.  If the goal is to *replace* the previous value, then you must first perform a `remove` operation.
* `remove` by `index` removes the value at the specified array index.
* `remove` by `index` with a `value` or `id` as part of the operation will only remove the specified index from the array if the value at that index matches the value from the operation.

> Support for `index` and array manipulation is not yet implemented in any frameworks

## Details


### The `set` operation

One can directly set a property.

Initial State:

    unread_message_count: 100

Set it to 5:

    [{
        operation: "set",
        property: "unread_message_count",
        value: 5
    }]

Final State:

    unread_message_count: 5

One can also set an embedded property:

Initial State:

    recipient_status: {
        fred: "sent",
        sue: "sent"
    }

Change fred to "read":

    [{
        operation: "set",
        property: "recipient_status.fred",
        value: "read"
    }]

Final State:

    recipient_status: {
        fred: "read",
        sue: "sent"
    }


Finally, while `add` and `remove` can only work on arrays, `set` if used on an array will replace the entire array with a new value.

Initial State:

    participants: ["mary", "joe"]

Replace the list:

    [{
        operation: "set",
        property: "participants",
        value: ["fred", "sue"]
    }]

Final State:

    participants: ["fred", "sue"]

#### Setting using `id`

Instead of providing a value, one could provide an `id` that identifies a resource.

Initial State:

    last_message: null

Set the value by id

    [{
        operation: "set",
        property: "last_message",
        id: "layer:///messages/uuid"
    }]

While processing this can be done simply by setting `last_message = "layer:///messages/uuid"`, the expectation is that developers will use the `id` value as a hint to lookup the ID in their object cache and set last_message to an object:

    conversation.last_message = lookupObject("layer:///messages/uuid");

Final State:

    last_message: {
        id: "layer:///messages/uuid",
        url: "https://api.layer.com/messages/uuid",
        parts: [...]
    }

Note that this version of the specification does not describe how to lookup objects, nor how to match an object by Id.  This is presumed to be custom to each object type.

### The `delete` operation

The delete operation will remove the specified key from the object.  Notes:

* It is *invalid* to delete a property of a Base Object (e.g. Message.recipient_status, Conversation.unread_message_count, etc...).  Instead use the `set` operation with a `value` of *null*.
* It is *valid* to delete a key within an object/dictionary stored in a Base Object's property. (e.g Conversation.metadata.fred).
* Delete has the same meaning as removing a key from a Hash: it removes the key from the object along with any/all data it references.

Initial State:

    recipient_status: {
        fred: "read",
        sue: "sent"
    }

Remove fred:

    [{
        operation: "delete",
        property: "recipient_status.fred"
    }]

Final State:

    recipient_status: {
        sue: "sent"
    }



### The `add` Operation


`add` is used solely for operating upon array properties. `add` takes a value and adds it to the target property array.

#### Using `add` for Operations on Sets

An `add` Operation that omits the `index` property will use Set logic when adding values.

**Add to Set means that the specified value will be added to the array.**

Initial State:

    participants: ["mary", "joe"]

Adds "fred" and "sue" to the participants array

    [{
        operation: "add",
        property: "participants",
        value: "fred"
    },
    {
        operation: "add",
        property: "participants",
        value: "sue"
    }]

Final State:

    participants: ["mary", "joe", "fred", "sue"]

**Add to Set means that if the value is already there, its a no-op.**

Initial State:

    participants: ["mary", "joe"]

Adds "mary" and "sue" to the participants array:

    [{
        operation: "add",
        property: "participants",
        value: "mary"
    },
    {
        operation: "add",
        property: "participants",
        value: "sue"
    }]

Final State:

    participants: ["mary", "joe", "sue"]

**Until the spec evolves to define how to compare two objects, adding objects to sets will not work.**

    [{
        operation: "add",
        property: "metadata.myobject",
        value: {my: "object"}
    }]

Will throw an error.  

**Until the spec evolves to define how to compare two Sets or Arrays, adding Arrays or Sets will not work.**

    [{
        operation: "add",
        property: "participants",
        value: ["fred", "sue"]
    }]

Will throw an error.  

**An exception to adding objects: adding values by id is supported as it provides a clear way to compare objects.**

Initial State:

    metadata: {
        linked_messages: [
            {id: "layer:///messages/id1", ...},
            {id: "layer:///messages/id2", ...},
            {id: "layer:///messages/id3", ...}
        ]
    }

Add Messages with id2 and id5:

    [{
        operation: "add",
        property: "metadata.linked_messages",
        id: "layer:///messages/id2"
    }, {
        operation: "add",
        property: "metadata.linked_messages",
        id: "layer:///messages/id5"
    }]

Final State:

    metadata: {
        linked_messages: [
            {id: "layer:///messages/id1", ...},
            {id: "layer:///messages/id2", ...},
            {id: "layer:///messages/id3", ...},
            {id: "layer:///messages/id5", ...}
        ]
    }

Note that id2 was not added as it was already present.

**As explained in (Property) [#property], a missing property will be created.  For the `add` Operation, it will be created as an array.**

Initial State:

    metadata: {}

Add "mary" to metadata.a.b.c:

    [{
        operation: "add",
        property: "metadata.a.b.c",
        value: "mary"
    }]

Final State:

    metadata: {
        a: {
            b: {
                c: ["mary"]
            }
        }
    }

#### Using `add` in Array Operations

Providing an `index` property causes this operation to be treated as an array operation rather than a set operation.

Interpreting Index:

* 0: Insert the value at the start of the array, shifting all other values back.  This does NOT overwrite the value at index 0.
* 5: Insert the value into the middle of the array, at index 5.
* -1: Push the value at the end of the array

Because this is an array operation, it will add the same value multiple times.

Initial State:

    participants: ["mary"]

Add "mary" and "joe" to the  participant list:

    [{
        operation: "add",
        property: "participants",
        value: "mary",
        index: "-"
    },
    {
        operation: "add",
        property: "participants",
        value: "joe",
        index: 0
    }]

Final State:

    participants: ["joe", "mary", "mary"]

Obviously for participants, we'd want to treat it as a Set rather than as an Array.

> At this time, only set, and not array behaviors are implemented in the code in this repository.

### The `remove` operation

`remove` is used solely for operating upon array properties.  `remove` takes a value and removes it from the target property array.

#### Using `remove` for Operations on Sets

A `remove` Operation that omits the index property will use Set logic when removing values.

**Remove from Sets means that the specified value will be removed from the array.**

Initial State:

    participants: ["mary", "joe", "sue", "fred"]

Remove "fred" and "sue" from the participants array:

    [{
        operation: "remove",
        property: "participants",
        value: "fred"
    },
    {
        operation: "remove",
        property: "participants",
        value: "sue"
    }]

Final State:

    participants: ["mary", "joe"]

**Remove from Set means that if the value is not found, its a no-op, not an error.**

Initial State:

    participants: ["mary", "joe", "sue", "fred"]

Remove "fred" and "Zod" from the participants array:

    [{
        operation: "remove",
        property: "participants",
        value: "fred"
    },
    {
        operation: "remove",
        property: "participants",
        value: "Zod"
    }]

Final State:

    participants: ["mary", "sue", "joe"]

The absense of a "Zod" does not affect successful completion of all operations in the Operations Array.

**Until the spec evolves to define how to compare two objects, removing objects from sets will not work.**

    [{
        operation: "remove",
        property: "metadata.myarray",
        value: {hey: "ho"}
    }]

Will throw an error.

**Until the spec evolves to define how to compare two Sets or Arrays, removing Arrays or Sets will not work.**

    [{
        operation: "remove",
        property: "participants",
        value: ["fred", "sue"]
    }]

Will throw an error.

**An exception to removing objects: removing values by id is supported as it provides a clear way to compare objects.**

Initial State:

    metadata: {
        linked_messages: [
            {id: "layer:///messages/id1", ...},
            {id: "layer:///messages/id2", ...},
            {id: "layer:///messages/id3", ...}
        ]
    }

Remove id2 from metadata.linked_messages:

    [{
        operation: "remove",
        property: "metadata.linked_messages",
        id: "layer:///messages/id2"
    }]

Final State:

    metadata: {
        linked_messages: [
            {id: "layer:///messages/id1", ...},
            {id: "layer:///messages/id3", ...}
        ]
    }

**As explained in (Property) [#property], a missing property will be created.  For the `remove` Operation, it will be created as an Array.**

Initial State:

    metadata: {}

Remove "mary" from metadata.a.b.c:

    [{
        operation: "remove",
        property: "metadata.a.b.c",
        value: "mary"
    }]

Final State:

    metadata: {
        a: {
            b: {
                c: []
            }
        }
    }

#### Using `remove` in Array Operations

Providing an `index` value will treat this as an array Operation.

Interpreting Index:

* 0:Remove the value at the start of the array.
* 5: Remove the value at index 5 of the array.
* -1: Remove the last value from the array.

Initial State:

    participants: ["mary", "joe", "Zod"]

Remove the second element:

    [{
        operation: "remove",
        property: "participants",
        index: 1
    }]

Final Result:

    participants: ["mary", "Zod"]

Note that operations are executed in the order specified. Thus the following will remove the first and third elements, rather than the first and second elements:

    [{
        operation: "remove",
        property: "participants",
        index: 0
    }, {
        operation: "remove",
        property: "participants",
        index: 1
    }]


> At this time, only set, and not array behaviors are implemented in the code in this repository.

##### Using `value` with `index`

Providing an `index` and a `value` will remove the value at the specified index IF it matches the specified value.

Initial State:

    participants: ["mary", "joe", "Zod"]

Remove the first and second elements:

    [{
        operation: "remove",
        property: "participants",
        index: 1,
        value: "Zod"
    }, {
        operation: "remove",
        property: "participants",
        index: 0,
        value: "mary"
    }]

Final Result:

    participants: ["joe", "Zod"]

Note that "joe" at index 1 was not removed because it did not match the value "Zod".  The fact that "joe" moved after the second operation, does not get taken into account.

Also note that operations are executed in the order specified. Thus the following operation would be hazardous:

    [{
        operation: "remove",
        property: "participants",
        index: 0,
        value: "Zod"
    }, {
        operation: "remove",
        property: "participants",
        index: 1
    }]

Depending on whether the first value is "Zod", the operation will either remove the first and third elements of the array, or the second element of the array.  This can be addressed with correctly sequenced operations (an array of operations operates upon array indexes in reverse index order).

## Examples

### Managing Active Participants

The scenario below assumes that we start with the following metadata for managing which participants are actively posting to a Conversation.

    {
        active_participants: ["fred", "sue"],
        inactive_participants: {
            "mary": "2014-09-09T04:44:47+00:00",
            "john": "2014-09-10T08:88:87+00:00"
        }
    }

We should be able to move mary from an inactive_participant to an active_participant.

    [{
        operation: "add",
        property: "metadata.active_participants",
        value: "mary"
    },
    {
        operation: "delete",
        property: "inactive_participants.mary"
    }]

Or undo it with:

    [{
        operation: "remove",
        property: "metadata.active_participants",
        value: "mary"
    },
    {
        operation: "set",
        property: "metadata.inactive_participants.mary",
        value: "2014-09-09T04:44:47+00:00"

    }]

### Managing Links Between Conversations

Slack has a nice feature where you can post a URL to a message in another conversation.  How would that be accomplished using "patch" operations on metadata?

Initial State:

    metadata: {}

The Operation:

    [{
        operation: "set",
        property: "metadata.linked_message",
        id: "layer:///messages/940de862-3c96-11e4-baad-164230d1df67"
    }]

Final State:

    metadata: {
        linked_message: {
            id: "layer:///messages/940de862-3c96-11e4-baad-164230d1df67",
            url: "https://api.layer.com/messages/940de862-3c96-11e4-baad-164230d1df67",
            parts: [...]
        }
    }

Such an operation could be used to repeatedly update what messages/conversations are being pointed to by that property.

## Future Work

The following have been left out of the spec but may be added in the future for consistency:

1. Actual implementation of array operations is not expected for early implementations of this spec.
2. Handling Objects, Arrays and Sets when adding or removing values from Sets: In order to do this, we need to have a platform-agnostic way of signaling the equivalency of two objects, arrays or sets.
3. More concise syntax.  It should be possible to add 100 values to an array without 100 operations.
4. More detail should be provided on how add and remove by "id" actually match by "id".

## License

Layer-Patch is available under the Apache 2 License. See the LICENSE file for more info.
