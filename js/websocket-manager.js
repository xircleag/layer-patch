var LayerJsonParser = require("./layer-patch");
/* Input is a connected websocket, and a cache of all layer objects (cached by their layer-id) */
module.exports = function(websocket, objectCache, eventManager) {

    var parser = new LayerJsonParser({
        camelCase: true,
        getObjectCallback: function(id) {
            return objectCache[id];
        },
        abortCallback: {
            Conversation: {
                // We don't really need this; we get read receipts, new messages, etc...
                // and will calculate this on our own
                unread_message_count: function() {
                    return false;
                }
            }
        },
        changeCallback: {
            Conversation: {
                all: function(conversation, newValue, oldValue, paths) {
                    eventManager.trigger("conversation-change", conversation, newValue, oldValue, paths);
                }
            },
            Message: {
                all: function(message, newValue, oldValue, paths) {
                    eventManager.trigger("message-change", message, newValue, oldValue, paths);
                }
            },
    });
    websocket.addEventListener("message", messageHandler);
    function messageHandler function(evt) {
        var msg = JSON.parse(evt.data);
        try {
            switch(msg.type == "change" ? msg.operation : msg.type) {
                case "create":
                    objectCache[msg.data.id] = msg.data;
                    break;
                case "delete":
                    delete objectCache[msg.data.id];
                    break;
                case "patch":
                    parser.parse({
                        updateObject: objectCache[msg.object.id],
                        objectType: msg.object.type,
                        operations: msg.data
                    });
                    break;
                case "typing_indicator":
                    this.handleTypingIndicator(msg);
                    break;
            }
        } catch(e) {
            console.log("Layer-Websocket: Failed to handle websocket message");
            console.dir(msg);
        }
        this.trigger("message", msg);
    }
};