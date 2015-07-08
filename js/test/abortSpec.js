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
            object: {a: 5},
            type: "typea",
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
            object: {a: {hey: "ho"}},
            type: "typea",
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
            object: {a: {hey: "ho"}},
            type: "typea",
            operations: [
                {operation: "set", property: "a.b.c", value: 10}
            ]
        });
        expect(called).toEqual(true);
    });

    it("Should ignore other handlers if there is an all handler", function() {
        var called = false;
        parser = new layer.js.LayerPatchParser({
            abortCallbacks: {
                "typea": {
                    "all": function(property, operation, value) {
                        called = true;
                    },
                    a: function(property, operation, value) {
                        expect("This not to have been called").toEqual("Doh!");
                    },
                    b: function(property, operation, value) {
                        expect("This not to have been called").toEqual("Doh!");
                    }
                }
            }
        });


        parser.parse({
            object: {a: {hey: "ho"}},
            type: "typea",
            operations: [
                {operation: "set", property: "b", value: 10},
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

        var object = {a:5};
        parser.parse({
            object: object,
            type: "typea",
            operations: [
                {operation: "set", property: "a", value: 10}
            ]
        });
        expect(object).toEqual({
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

        var object = {a:5};
        parser.parse({
            object: object,
            type: "typea",
            operations: [
                {operation: "set", property: "a", value: 10}
            ]
        });
        expect(object).toEqual({
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

        var object = {a:5};
        parser.parse({
            object: object,
            type: "typea",
            operations: [
                {operation: "set", property: "a", value: 10}
            ]
        });
        expect(object).toEqual({
            a: 5
        });
    });


});