describe("Layer Patch Tests", function() {
    var testObject, finalObject, parser;
    var objectCache = {
        "a": {id: "a"},
        "b": {id: "b"}
    };

    beforeEach(function() {
        parser = new layer.js.layerParser({
            getObjectById: function(id) {
                return objectCache[id];
            }
        });

        testObject = {
            hey: "ho",
            outerSet: ["d"],
            "sub-object": {
                subhey: "subho",
                count: 5,
                "subber-object": {
                    count: 10,
                    set: ["a", "c", "z"]
                }
            }
        };

        // finalObject is a clone of testObject
        finalObject = JSON.parse(JSON.stringify(testObject));
    });

    it("Should have a parser", function() {
        expect(Boolean(parser)).toEqual(true);
    });

    describe("The SET operation", function() {
        it("Should set a property", function() {
            layer.js.layerParser({
                updateObject: testObject,
                operations: [
                    {operation: "set", property: "hey", value: "howdy"}
                ]
            });
            finalObject.hey = "howdy";
            expect(testObject).toEqual(finalObject);
        });

        it("Should set a subproperty", function() {
            layer.js.layerParser({
                updateObject: testObject,
                operations: [
                    {operation: "set", property: "sub-object.subhey", value: "howdy"}
                ]
            });
            finalObject["sub-object"].subhey = "howdy";
            expect(testObject).toEqual(finalObject);
        });

        it("Should set an array/set", function() {
            layer.js.layerParser({
                updateObject: testObject,
                operations: [
                    {operation: "set", property: "sub-object.subber-object.set", value: ["z", "z", "z"]}
                ]
            });
            finalObject["sub-object"]["subber-object"].set = ["z","z","z"];
            expect(testObject).toEqual(finalObject);
        });

        it("Should set null", function() {
            layer.js.layerParser({
                updateObject: testObject,
                operations: [
                    {operation: "set", property: "sub-object.subber-object.count", value: null}
                ]
            });
            finalObject["sub-object"]["subber-object"].count = null;
            expect(testObject).toEqual(finalObject);
        });

        it("Should create any missing structures", function() {
            layer.js.layerParser({
                updateObject: testObject,
                operations: [
                    {operation: "set", property: "sub-object.a.b.c", value: "d"}
                ]
            });
            finalObject["sub-object"].a = {b: {c: "d"}};
            expect(testObject).toEqual(finalObject);
        });

        it("Should set by ID with valid ID", function() {
            layer.js.layerParser({
                updateObject: testObject,
                operations: [
                    {operation: "set", property: "hey", id: "b"}
                ]
            });
            finalObject.hey = objectCache.b;
            expect(testObject).toEqual(finalObject);
        });

        it("Should set by ID with invalid ID", function() {
            layer.js.layerParser({
                updateObject: testObject,
                operations: [
                    {operation: "set", property: "hey", id: "bbb"}
                ]
            });
            finalObject.hey = "bbb";
            expect(testObject).toEqual(finalObject);
        });
    });

    describe("The DELETE operation", function() {
        it("Should delete a property", function() {
            layer.js.layerParser({
                updateObject: testObject,
                operations: [
                    {operation: "delete", property: "hey"}
                ]
            });
            delete finalObject.hey;
            expect(testObject).toEqual(finalObject);
        });

        it("Should delete a subproperty", function() {
            layer.js.layerParser({
                updateObject: testObject,
                operations: [
                    {operation: "delete", property: "sub-object.subhey"}
                ]
            });
            delete finalObject["sub-object"];
            expect(testObject).toEqual(finalObject);
        });

        it("Should delete an array/set", function() {
            layer.js.layerParser({
                updateObject: testObject,
                operations: [
                    {operation: "delete", property: "sub-object.subber-object.set"}
                ]
            });
            delete finalObject["sub-object"]["subber-object"].set;
            expect(testObject).toEqual(finalObject);
        });


        it("Should create any missing structures", function() {
            layer.js.layerParser({
                updateObject: testObject,
                operations: [
                    {operation: "delete", property: "sub-object.a.b.c"}
                ]
            });
            finalObject["sub-object"].a = {b: {}};
            expect(testObject).toEqual(finalObject);
        });
    });

    describe("The ADD operation", function() {
        it("Should fail if adding to a non-array", function() {
            expect(function() {
                layer.js.layerParser({
                    updateObject: testObject,
                    operations: [
                        {operation: "add", property: "hey", value: "howdy"}
                    ]
                });
            }).toThrowError("The add operation requires an array or new structure to add to.");
        });

        it("Should not add a copy of a value", function() {
            layer.js.layerParser({
                updateObject: testObject,
                operations: [
                    {operation: "add", property: "outerSet", value: "d"}
                ]
            });
            expect(testObject).toEqual(finalObject);
        });

        it("Should add a subproperty", function() {
            layer.js.layerParser({
                updateObject: testObject,
                operations: [
                    {operation: "add", property: "outerSet", value: "howdy"}
                ]
            });
            finalObject.outerSet.push("howdy");
            expect(testObject).toEqual(finalObject);
        });

        it("Should set a subproperty", function() {
            layer.js.layerParser({
                updateObject: testObject,
                operations: [
                    {operation: "add", property: "sub-object.subber-object.set", value: "howdy"}
                ]
            });
            finalObject["sub-object"]["subber-object"].set.push("howdy");
            expect(testObject).toEqual(finalObject);
        });

        it("Should create any missing structures", function() {
            layer.js.layerParser({
                updateObject: testObject,
                operations: [
                    {operation: "add", property: "sub-object.a.b.c", value: "d"}
                ]
            });
            finalObject["sub-object"].a = {b: {c: ["d"]}};
            expect(testObject).toEqual(finalObject);
        });
    });

    describe("The REMOVE operation", function() {
        it("Should fail if removing from a non-array", function() {
            expect(function() {
                layer.js.layerParser({
                    updateObject: testObject,
                    operations: [
                        {operation: "remove", property: "hey", value: "howdy"}
                    ]
                });
            }).toThrowError("The remove operation requires an array or new structure to remove from.");
        });

        it("Should remove a subproperty", function() {
            layer.js.layerParser({
                updateObject: testObject,
                operations: [
                    {operation: "remove", property: "outerSet", value: "d"}
                ]
            });
            finalObject.outerSet = [];
            expect(testObject).toEqual(finalObject);
        });

        it("Should not remove if not present", function() {
            layer.js.layerParser({
                updateObject: testObject,
                operations: [
                    {operation: "remove", property: "outerSet", value: "e"}
                ]
            });
            expect(testObject).toEqual(finalObject);
        });

        it("Should remove from a subproperty", function() {
            layer.js.layerParser({
                updateObject: testObject,
                operations: [
                    {operation: "remove", property: "sub-object.subber-object.set", value: "a"}
                ]
            });
            finalObject["sub-object"]["subber-object"].set.shift();
            expect(testObject).toEqual(finalObject);
        });

        it("Should create any missing structures", function() {
            layer.js.layerParser({
                updateObject: testObject,
                operations: [
                    {operation: "remove", property: "sub-object.a.b.c", value: "d"}
                ]
            });
            finalObject["sub-object"].a = {b: {c: []}};
            expect(testObject).toEqual(finalObject);
        });
    });
});