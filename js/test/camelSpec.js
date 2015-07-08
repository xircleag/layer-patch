describe("CamelCase Tests", function() {
    var testObject, finalObject, parser;
    var objectCache = {
        "a": {id: "a"},
        "b": {id: "b"}
    };

    beforeEach(function() {
        parser = new layer.js.LayerPatchParser({
            camelCase: true,
            getObjectCallback: function(id) {
                return objectCache[id];
            }
        });

        testObject = {
            hey: "ho",
            outerSet: ["d"],
            "subObject": {
                subhey: "subho",
                count: 5,
                "subberObject": {
                    count: 10,
                    set: ["a", "c", "z"]
                }
            }
        };

        // finalObject is a clone of testObject
        finalObject = JSON.parse(JSON.stringify(testObject));
    });

    it("Should map sub-object to subObject for set operation", function() {
        parser.parse({
            object: testObject,
            operations: [
                {operation: "set", property: "sub-object", value: {howdy: "ho"}}
            ]
        });
        finalObject.subObject = {"howdy": "ho"};
        expect(testObject).toEqual(finalObject);
    });

    it("Should map sub-object to subObject for delete operation", function() {
        parser.parse({
            object: testObject,
            operations: [
                {operation: "delete", property: "sub-object"}
            ]
        });
        delete finalObject.subObject;
        expect(testObject).toEqual(finalObject);
    });

    it("Should map sub-object to subObject for add operation", function() {
        testObject.subObject = [];
        parser.parse({
            object: testObject,
            operations: [
                {operation: "add", property: "sub-object", value: "hi"}
            ]
        });
        finalObject.subObject = ["hi"];
        expect(testObject).toEqual(finalObject);
    });

    it("Should map sub-object to subObject for remove operation", function() {
        testObject.subObject = ["hi", "ho"];
        parser.parse({
            object: testObject,
            operations: [
                {operation: "remove", property: "sub-object", value: "hi"}
            ]
        });
        finalObject.subObject = ["ho"];
        expect(testObject).toEqual(finalObject);
    });

    it("Should map sub-object to subObject but NOT subproperties for set operation", function() {
        parser.parse({
            object: testObject,
            operations: [
                {operation: "set", property: "sub-object.doh-ray", value: "me"}
            ]
        });
        finalObject.subObject["doh-ray"] = "me";
        expect(testObject).toEqual(finalObject);
    });

    xdescribe("Add by Index", function() {});
    xdescribe("Remove by Index", function() {});
    xdescribe("Add by Index and Value", function() {});
});