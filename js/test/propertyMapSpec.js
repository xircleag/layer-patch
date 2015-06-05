describe("PropertyMap Tests", function() {
    var parser;

    beforeEach(function() {
        parser = new layer.js.LayerPatchParser({
            propertyNameMap: {
                "typea": {
                    "a": "aaa",
                    "b": "BCE",
                },
                "typeb": {
                    "fred": "Ted",
                    "frodo": "dodo"
                }
            }
        });
    });

    it("Should set proper value", function() {
        var testObject = {
            aaa: 5,
            BCE: true
        };

        parser.parse({
            updateObject: testObject,
            objectType: "typea",
            operations: [
                {operation: "set", property: "a", value: 8},
                {operation: "set", property: "b", value: "fred"}
            ]
        });

        expect(testObject).toEqual({
            aaa: 8,
            BCE: "fred"
        });
    });

    it("Should set witout map if object not present", function() {
        var testObject = {
            aaa: 5,
            BCE: true
        };

        parser.parse({
            updateObject: testObject,
            objectType: "typeC",
            operations: [
                {operation: "set", property: "a", value: 8},
                {operation: "set", property: "b", value: "fred"}
            ]
        });

        expect(testObject).toEqual({
            aaa: 5,
            BCE: true,
            a: 8,
            b: "fred"
        });
    });


    it("Should delete proper value", function() {
        var testObject = {
            Ted: "is dead",
            dodo: {
                airSpeedVelocity: 0
            },
            hah: "ho"
        };

        parser.parse({
            updateObject: testObject,
            objectType: "typeb",
            operations: [
                {operation: "delete", property: "fred"},
                {operation: "delete", property: "frodo"}
            ]
        });

        expect(testObject).toEqual({hah: "ho"});
    });

    it("Should add proper value", function() {
        var testObject = {hey: "ho"};

            parser.parse({
            updateObject: testObject,
            objectType: "typea",
            operations: [
                {operation: "add", property: "a", value: "AA"},
                {operation: "add", property: "b", value: "BB"},
                {operation: "add", property: "c", value: "CC"},
            ]
        });
        expect(testObject).toEqual({
            aaa: ["AA"],
            BCE: ["BB"],
            c: ["CC"],
            hey: "ho"
        });
    });

    it("Should remove proper value", function() {
        var testObject = {
            Ted: ["a", "b"]
        };

            parser.parse({
            updateObject: testObject,
            objectType: "typeb",
            operations: [
                {operation: "remove", property: "fred", value: "a"},
                {operation: "remove", property: "frodo.records", value: "b"},
                {operation: "remove", property: "c", value: "c"},
            ]
        });
        expect(testObject).toEqual({
            Ted: ["b"],
            dodo: {
                records: []
            },
            c: []
        });
    });

    xdescribe("Add by Index", function() {});
    xdescribe("Remove by Index", function() {});
    xdescribe("Add by Index and Value", function() {});
});