describe("Abort Callback Tests", function() {


    it("Should call the propertyName handler with the proper arguments", function() {
        var called = false;
        parser = new layer.js.LayerPatchParser({
            abortCallbacks: {
                "typea": {
                    "a": function(property, operation, value) {
                        called = true;
                        expect(operation).toEqual("set");
                        expect(value).toEqual(10);
                        expect(property).toEqual("a");
                    }
                }
            }
        });


        parser.parse({
            updateObject: {a: 5},
            objectType: "typea",
            operations: [
                {operation: "set", property: "a", value: 10}
            ]
        });
        expect(called).toEqual(true);
    });


    it("Should call the propertyName handler for subproperties", function() {
        var called = false;
        parser = new layer.js.LayerPatchParser({
            abortCallbacks: {
                "typea": {
                    "a": function(property, operation, value) {
                        called = true;
                        expect(operation).toEqual("set");
                        expect(value).toEqual(10);
                        expect(property).toEqual("a.b.c");
                    }
                }
            }
        });


        parser.parse({
            updateObject: {a: {hey: "ho"}},
            objectType: "typea",
            operations: [
                {operation: "set", property: "a.b.c", value: 10}
            ]
        });
        expect(called).toEqual(true);
    });

    it("Should call the all handler for subproperties", function() {
        var called = false;
        parser = new layer.js.LayerPatchParser({
            abortCallbacks: {
                "typea": {
                    "all": function(property, operation, value) {
                        called = true;
                        expect(operation).toEqual("set");
                        expect(value).toEqual(10);
                        expect(property).toEqual("a.b.c");
                    }
                }
            }
        });


        parser.parse({
            updateObject: {a: {hey: "ho"}},
            objectType: "typea",
            operations: [
                {operation: "set", property: "a.b.c", value: 10}
            ]
        });
        expect(called).toEqual(true);
    });


    it("Should allow change if returns false", function() {
        parser = new layer.js.LayerPatchParser({
            abortCallbacks: {
                "typea": {
                    "a": function(property, operation, value) {
                        return false;
                    }
                }
            }
        });

        var updateObject = {a:5};
        parser.parse({
            updateObject: updateObject,
            objectType: "typea",
            operations: [
                {operation: "set", property: "a", value: 10}
            ]
        });
        expect(updateObject).toEqual({
            a: 10
        });
    });

    it("Should NOT allow change if returns true", function() {
        parser = new layer.js.LayerPatchParser({
            abortCallbacks: {
                "typea": {
                    "a": function(property, operation, value) {
                        return true;
                    }
                }
            }
        });

        var updateObject = {a:5};
        parser.parse({
            updateObject: updateObject,
            objectType: "typea",
            operations: [
                {operation: "set", property: "a", value: 10}
            ]
        });
        expect(updateObject).toEqual({
            a: 5
        });
    });

    it("Should block change if returns true from all", function() {
        parser = new layer.js.LayerPatchParser({
            abortCallbacks: {
                "typea": {
                    "all": function(property, operation, value) {
                        return true;
                    }
                }
            }
        });

        var updateObject = {a:5};
        parser.parse({
            updateObject: updateObject,
            objectType: "typea",
            operations: [
                {operation: "set", property: "a", value: 10}
            ]
        });
        expect(updateObject).toEqual({
            a: 5
        });
    });


});