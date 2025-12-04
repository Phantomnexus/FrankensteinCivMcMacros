// === Ancient Debris Detector (Xaero's, coords in feedback) ===

const chatListener = JsMacros.on("RecvMessage", JavaWrapper.methodToJava((event) => {
    const msg = event.text.getString();
    const target = "You sense debris nearby 1 ANCIENT_DEBRIS nearby";

    if (msg === target) {
        // adds waypoint 
        Keybind.press("key.keyboard.Numpad6");
// put your keybind for quickwaypoint instead of numpad6

Client.waitTick(5); 

// Release the key
Keybind.release("key.keyboard.Numpad6");
    }
}));