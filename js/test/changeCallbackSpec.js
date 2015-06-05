describe("Change Callback Tests", function() {


    it("Should call the propertyName handler with the proper arguments", function() {
        var called = false;
        parser = new layer.js.LayerPatchParser({
            changeCallbacks: {
                "typea": {
                    "a": function(updateObject, newValue, oldValue, paths) {
                        called = true;
                        expect(oldValue).toEqual(5);
                        expect(newValue).toEqual(10);
                        expect(paths).toEqual(["a"]);
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
            changeCallbacks: {
                "typea": {
                    "a": function(updateObject, newValue, oldValue, paths) {
                        called = true;
                        expect(oldValue).toEqual({hey: "ho"});
                        expect(newValue).toEqual({
                            hey: "ho",
                            b: {c: 10}
                        });
                        expect(paths).toEqual(["a.b.c"]);
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
            changeCallbacks: {
                "typea": {
                    "all": function(updateObject, newValue, oldValue, paths) {
                        called = true;
                        expect(oldValue).toEqual({hey: "ho"});
                        expect(newValue).toEqual({
                            hey: "ho",
                            b: {c: 10}
                        });
                        expect(paths).toEqual(["a.b.c"]);
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


    it("Should call event handler only once", function() {
        var called = false;
        var count = 0;
        parser = new layer.js.LayerPatchParser({
            changeCallbacks: {
                "typea": {
                    "a": function(updateObject, newValue, oldValue, paths) {
                        called = true;
                        expect(count).toEqual(0);
                        count++;
                    }
                }
            }
        });


        parser.parse({
            updateObject: {a: 5},
            objectType: "typea",
            operations: [
                {operation: "set", property: "a", value: 10},
                {operation: "set", property: "a", value: 15}
            ]
        });
        expect(called).toEqual(true);
    });

    it("Should call event handler with final result only", function() {
        var called = false;
        var count = 0;
        parser = new layer.js.LayerPatchParser({
            changeCallbacks: {
                "typea": {
                    "a": function(updateObject, newValue, oldValue, paths) {
                        called = true;
                        expect(count).toEqual(0);
                        count++;

                        expect(oldValue).toEqual({hey: "ho"});
                        expect(newValue).toEqual({
                            hey: "ho",
                            b: 10,
                            c: 15
                        });
                        expect(paths).toEqual(["a.b", "a.c"]);
                    }
                }
            }
        });


        parser.parse({
            updateObject: {a: {hey: "ho"}},
            objectType: "typea",
            operations: [
                {operation: "set", property: "a.b", value: 10},
                {operation: "set", property: "a.c", value: 15}
            ]
        });
        expect(called).toEqual(true);
    });

});