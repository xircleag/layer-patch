describe("Layer Patch Tests", function() {
    var testObject, finalObject, parser;
    var objectCache = {
        "a": {id: "a"},
        "b": {id: "b"}
    };

    beforeEach(function() {
        parser = new layer.js.LayerPatchParser({
            getObjectCallback: function(id) {
                return objectCache[id];
            }
        });

        testObject = {
            hey: "ho",
            outerSet: ["d"],
            "sub_object": {
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
        expect(parser.parse instanceof Function).toEqual(true);
    });

    describe("The SET operation", function() {
        it("Should set a property", function() {
            parser.parse({
                updateObject: testObject,
                operations:  [
                    {operation: "set", property: "hey", value: "howdy"}
                ]
            });
            finalObject.hey = "howdy";
            expect(testObject).toEqual(finalObject);
        });

        it("Should set a subproperty", function() {
            parser.parse({
                updateObject: testObject,
                operations:  [
                    {operation: "set", property: "sub_object.subhey", value: "howdy"}
                ]
            });
            finalObject["sub_object"].subhey = "howdy";
            expect(testObject).toEqual(finalObject);
        });

        it("Should fail to set a subproperty of a non-object", function() {
            expect(function() {
                parser.parse({
                    updateObject: testObject,
                    operations:  [
                        {operation: "set", property: "hey.ho", value: "howdy"}
                    ]
                });
            }).toThrowError("Can not access property \"hey.ho\"");
        });

        it("Should set an array/set", function() {
            parser.parse({
                updateObject: testObject,
                operations:  [
                    {operation: "set", property: "sub_object.subber-object.set", value: ["z", "z", "z"]}
                ]
            });
            finalObject["sub_object"]["subber-object"].set = ["z","z","z"];
            expect(testObject).toEqual(finalObject);
        });

        it("Should set null", function() {
            parser.parse({
                updateObject: testObject,
                operations:  [
                    {operation: "set", property: "sub_object.subber-object.count", value: null}
                ]
            });
            finalObject["sub_object"]["subber-object"].count = null;
            expect(testObject).toEqual(finalObject);
        });

        it("Should create any missing structures", function() {
            parser.parse({
                updateObject: testObject,
                operations:  [
                    {operation: "set", property: "sub_object.a.b.c", value: "d"}
                ]
            });
            finalObject["sub_object"].a = {b: {c: "d"}};
            expect(testObject).toEqual(finalObject);
        });

        it("Should set by ID with valid ID", function() {
            parser.parse({
                updateObject: testObject,
                operations:  [
                    {operation: "set", property: "hey", id: "b"}
                ]
            });
            finalObject.hey = objectCache.b;
            expect(testObject).toEqual(finalObject);
        });

        it("Should set by ID with invalid ID", function() {
            parser.parse({
                updateObject: testObject,
                operations:  [
                    {operation: "set", property: "hey", id: "bbb"}
                ]
            });
            finalObject.hey = "bbb";
            expect(testObject).toEqual(finalObject);
        });
    });

    describe("The DELETE operation", function() {
        it("Should delete a property", function() {
            parser.parse({
                updateObject: testObject,
                operations:  [
                    {operation: "delete", property: "hey"}
                ]
            });
            delete finalObject.hey;
            expect(testObject).toEqual(finalObject);
        });

        it("Should delete a subproperty", function() {
            parser.parse({
                updateObject: testObject,
                operations:  [
                    {operation: "delete", property: "sub_object.subhey"}
                ]
            });
            delete finalObject["sub_object"].subhey;
            expect(testObject).toEqual(finalObject);
        });

        it("Should fail to delete a subproperty of a non-object", function() {
            expect(function() {
                parser.parse({
                    updateObject: testObject,
                    operations:  [
                        {operation: "delete", property: "hey.ho", value: "howdy"}
                    ]
                });
            }).toThrowError("Can not access property \"hey.ho\"");
        });

        it("Should delete an array/set", function() {
            parser.parse({
                updateObject: testObject,
                operations:  [
                    {operation: "delete", property: "sub_object.subber-object.set"}
                ]
            });
            delete finalObject["sub_object"]["subber-object"].set;
            expect(testObject).toEqual(finalObject);
        });


        it("Should create any missing structures", function() {
            parser.parse({
                updateObject: testObject,
                operations:  [
                    {operation: "delete", property: "sub_object.a.b.c"}
                ]
            });
            finalObject["sub_object"].a = {b: {}};
            expect(testObject).toEqual(finalObject);
        });
    });

    describe("The ADD operation", function() {
        it("Should fail if adding to a non-array", function() {
            expect(function() {
                parser.parse({
                    updateObject: testObject,
                    operations:  [
                        {operation: "add", property: "hey", value: "howdy"}
                    ]
                });
            }).toThrowError("The add operation requires an array or new structure to add to.");
        });

        it("Should fail to add an array to a set", function() {
            expect(function() {
                parser.parse({
                    updateObject: testObject,
                    operations:  [
                        {operation: "add", property: "outerSet", value: ["howdy"]}
                    ]
                });
            }).toThrowError("The add operation will not add arrays to sets.");
        });

        it("Should fail to add an object to a set", function() {
            expect(function() {
                parser.parse({
                    updateObject: testObject,
                    operations:  [
                        {operation: "add", property: "outerSet", value: {hey: "ho"}}
                    ]
                });
            }).toThrowError("The add operation will not add objects to sets.");
        });

        it("Should fail to add a subproperty of a non-object", function() {
            expect(function() {
                parser.parse({
                    updateObject: testObject,
                    operations:  [
                        {operation: "add", property: "hey.ho", value: "howdy"}
                    ]
                });
            }).toThrowError("Can not access property \"hey.ho\"");
        });

        it("Should not add a copy of a value", function() {
            parser.parse({
                updateObject: testObject,
                operations:  [
                    {operation: "add", property: "outerSet", value: "d"}
                ]
            });
            expect(testObject).toEqual(finalObject);
        });

        it("Should add a subproperty", function() {
            parser.parse({
                updateObject: testObject,
                operations:  [
                    {operation: "add", property: "outerSet", value: "howdy"}
                ]
            });
            finalObject.outerSet.push("howdy");
            expect(testObject).toEqual(finalObject);
        });

        it("Should set a subproperty", function() {
            parser.parse({
                updateObject: testObject,
                operations:  [
                    {operation: "add", property: "sub_object.subber-object.set", value: "howdy"}
                ]
            });
            finalObject["sub_object"]["subber-object"].set.push("howdy");
            expect(testObject).toEqual(finalObject);
        });

        it("Should create any missing structures", function() {
            parser.parse({
                updateObject: testObject,
                operations:  [
                    {operation: "add", property: "sub_object.a.b.c", value: "d"}
                ]
            });
            finalObject["sub_object"].a = {b: {c: ["d"]}};
            expect(testObject).toEqual(finalObject);
        });

        it("Should add by ID with valid ID", function() {
            parser.parse({
                updateObject: testObject,
                operations:  [
                    {operation: "add", property: "outerSet", id: "b"}
                ]
            });
            finalObject.outerSet.push(objectCache.b);
            expect(testObject).toEqual(finalObject);
        });

        it("Should add by ID with valid ID only once", function() {
            parser.parse({
                updateObject: testObject,
                operations:  [
                    {operation: "add", property: "outerSet", id: "b"},
                    {operation: "add", property: "outerSet", id: "b"}
                ]
            });
            finalObject.outerSet.push(objectCache.b);
            expect(testObject).toEqual(finalObject);
        });
    });

    describe("The REMOVE operation", function() {
        it("Should fail if removing from a non-array", function() {
            expect(function() {
                parser.parse({
                    updateObject: testObject,
                    operations:  [
                        {operation: "remove", property: "hey", value: "howdy"}
                    ]
                });
            }).toThrowError("The remove operation requires an array or new structure to remove from.");
        });

        it("Should fail to remove an array from a set", function() {
            expect(function() {
                parser.parse({
                    updateObject: testObject,
                    operations:  [
                        {operation: "remove", property: "outerSet", value: ["howdy"]}
                    ]
                });
            }).toThrowError("The remove operation will not remove arrays from sets.");
        });

        it("Should fail to remove an object from a set", function() {
            expect(function() {
                parser.parse({
                    updateObject: testObject,
                    operations:  [
                        {operation: "remove", property: "outerSet", value: {hey: "ho"}}
                    ]
                });
            }).toThrowError("The remove operation will not remove objects from sets.");
        });

        it("Should fail to remove a subproperty of a non-object", function() {
            expect(function() {
                parser.parse({
                    updateObject: testObject,
                    operations:  [
                        {operation: "remove", property: "hey.ho", value: "howdy"}
                    ]
                });
            }).toThrowError("Can not access property \"hey.ho\"");
        });

        it("Should remove a subproperty", function() {
            parser.parse({
                updateObject: testObject,
                operations:  [
                    {operation: "remove", property: "outerSet", value: "d"}
                ]
            });
            finalObject.outerSet = [];
            expect(testObject).toEqual(finalObject);
        });

        it("Should not remove if not present", function() {
            parser.parse({
                updateObject: testObject,
                operations:  [
                    {operation: "remove", property: "outerSet", value: "e"}
                ]
            });
            expect(testObject).toEqual(finalObject);
        });

        it("Should remove from a subproperty", function() {
            parser.parse({
                updateObject: testObject,
                operations:  [
                    {operation: "remove", property: "sub_object.subber-object.set", value: "a"}
                ]
            });
            finalObject["sub_object"]["subber-object"].set.shift();
            expect(testObject).toEqual(finalObject);
        });

        it("Should create any missing structures", function() {
            parser.parse({
                updateObject: testObject,
                operations:  [
                    {operation: "remove", property: "sub_object.a.b.c", value: "d"}
                ]
            });
            finalObject["sub_object"].a = {b: {c: []}};
            expect(testObject).toEqual(finalObject);
        });

        it("Should remove by ID with valid ID", function() {
            testObject.outerSet.push(objectCache.b);

            parser.parse({
                updateObject: testObject,
                operations:  [
                    {operation: "remove", property: "outerSet", id: "b"}
                ]
            });
            expect(testObject).toEqual(finalObject);
        });

        it("Should remove by ID with valid ID only once", function() {
            testObject.outerSet.push(objectCache.b);

            parser.parse({
                updateObject: testObject,
                operations:  [
                    {operation: "remove", property: "outerSet", id: "b"},
                    {operation: "remove", property: "outerSet", id: "b"}
                ]
            });
            expect(testObject).toEqual(finalObject);
        });

        it("Should remove by ID with not-found id resulting in noop", function() {
            parser.parse({
                updateObject: testObject,
                operations:  [
                    {operation: "remove", property: "outerSet", id: "bbbb"}
                ]
            });
            expect(testObject).toEqual(finalObject);
        });
    });

    xdescribe("Add by Index", function() {});
    xdescribe("Remove by Index", function() {});
    xdescribe("Add by Index and Value", function() {});
});