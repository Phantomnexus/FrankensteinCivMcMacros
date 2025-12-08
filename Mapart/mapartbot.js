/*

!!! CRITICAL: You must add the Canvas boundary, and Chest base y.
*/

// =========================================================================================
// --- CONFIGURATION: MOVEMENT, RELOG, AND CHEST LOCATION ---
// =========================================================================================

const lagTick = 9; // Delay ticks (adjust for your connection)
const abortKey = "s"; // The key to press to stop the script

// Canvas Patrol Boundaries
const xEast = 4842;
const xWest = 4711;
const zNorth = -6729;
const zSouth = -6673;

// Movement Settings
const pitchGoal = 20; 
const lineCompact = 2; // Refill trigger: Check inventory every 2 rows

// Auto-Relog Settings (!!! CRITICAL: MUST BE SET CORRECTLY !!!)
const SERVER_IP_PORT = "play.civmc.net"; // ip adress
const SERVER_PORT = 25565; //  your server's port
const RELOG_CHECK_TICKS = 100; // Ticks to wait after reconnection attempt before checking position

// Chest Location 
const CHEST_STAND_X = 4712; // you stand here 
const CHEST_STAND_Z = -6708; // your stand here
const CHEST_BLOCK_X = 4710;  // Chest coords
const CHEST_BLOCK_Z = -6709; 
const CHEST_BASE_Y = 64; // **!!! MUST SET THIS: Y-coordinate of the BOTTOM chest block !!!**
const CHEST_Y_OFFSETS = [0, 1, 2, 3]; 

// Inventory Goal (All 16 colors)
const CARPET_COLORS = [
    { id: "minecraft:white_carpet", goalCount: 128 }, // Change goal count according to requirement
    { id: "minecraft:orange_carpet", goalCount: 128 },
    { id: "minecraft:magenta_carpet", goalCount: 128 },
    { id: "minecraft:light_blue_carpet", goalCount: 128 },
    { id: "minecraft:yellow_carpet", goalCount: 128 },
    { id: "minecraft:lime_carpet", goalCount: 128 },
    { id: "minecraft:pink_carpet", goalCount: 128 },
    { id: "minecraft:gray_carpet", goalCount: 128 },
    { id: "minecraft:light_gray_carpet", goalCount: 128 },
    { id: "minecraft:cyan_carpet", goalCount: 128 },
    { id: "minecraft:purple_carpet", goalCount: 128 },
    { id: "minecraft:blue_carpet", goalCount: 128 },
    { id: "minecraft:brown_carpet", goalCount: 128 },
    { id: "minecraft:green_carpet", goalCount: 128 },
    { id: "minecraft:red_carpet", goalCount: 128 },
    { id: "minecraft:black_carpet", goalCount: 128 }
];

// -----------------------------------------------------------------------------------------
// --- CORE GLOBAL STATE (Persists across crashes/relogs) ---
// -----------------------------------------------------------------------------------------

const p = Player.getPlayer();
var currentDirection = 1; 
var currentX; 
var currentZ; 
var lineFinished;
var currentCompact; 
var shouldTerminate = false; 
var isResuming = false; 


// -----------------------------------------------------------------------------------------
// 
// -----------------------------------------------------------------------------------------

function lookAtCenter(x, z) {
    p.lookAt(x + 0.5, p.getY() + 0.5, z + 0.5);
}

function lookAtChest(y) {
    p.lookAt(CHEST_BLOCK_X + 0.5, y + 0.5, CHEST_BLOCK_Z + 0.5);
}

function checkManualAbort() {
    if (KeyBind.getPressedKeys().contains("key.keyboard." + abortKey)) {
        shouldTerminate = true
        Chat.log("🚨 Player has pressed abort key ('" + abortKey.toUpperCase() + "'). Terminating script now. 🚨")
    }
}

function walkTo(x, z) {
    lookAtCenter(x, z);
    KeyBind.keyBind("key.forward", true);
    while ((Math.abs(p.getX() - x - 0.5) > 0.2 || Math.abs(p.getZ() - z - 0.5) > 0.2) && !shouldTerminate) {
        lookAtCenter(x, z);
        Client.waitTick();
        checkManualAbort();
    }
    KeyBind.keyBind("key.forward", false);
    Client.waitTick(lagTick);
}


// ----------------------------------------------------------------------------------------
// Movement 
// -----------------------------------------------------------------------------------------

function farmLine() {
    
    // Skip the long walkTo if we just re-logged and are already near the target X-coordinate
    if (!isResuming) {
        walkTo(currentX, zSouth * currentDirection + zNorth * (1 - currentDirection));
    } else {
        Chat.log(`Resuming movement from Z=${currentZ}.`);
    }
    isResuming = false; 
    
    if (shouldTerminate) return;

    lineFinished = false;
    let pitch = 90;
    const tapDuration = 4; 
    const tapWait = 5;     

    while (!lineFinished && !shouldTerminate) {
        
        // --- CRITICAL STATE SAVING ---
        currentZ = p.getZ(); 
        // -----------------------------
        
        Client.waitTick();
        checkManualAbort();
        if (shouldTerminate) break;

        while (Math.abs(pitch - pitchGoal) > 5 && !shouldTerminate) {
            pitch += (pitchGoal - pitch) / 10
            Client.waitTick();
            p.lookAt(currentDirection * 180, pitch);
            checkManualAbort();
        }

        if (shouldTerminate) break;

        // Walk Tapping Logic (W key)
        KeyBind.keyBind("key.forward", true);
        Client.waitTick(tapDuration);

        KeyBind.keyBind("key.forward", false);
        Client.waitTick(tapWait);

        // Check if line end reached
        if (currentDirection == 1) { 
            if ((Math.floor(p.getZ()) < zNorth + 4)) {
                lineFinished = true;
            }
        } else { 
            if ((Math.floor(p.getZ()) > zSouth - 4)) {
                lineFinished = true;
            }
        }
    }

    KeyBind.keyBind("key.forward", false);
    Client.waitTick(lagTick);
}

function farmTwoLine() { 
    farmLine();
    if (shouldTerminate) return;

    currentX++;
    currentDirection = 1 - currentDirection;
    farmLine();
    if (shouldTerminate) return;

    currentX++;
    currentDirection = 1 - currentDirection;
    currentCompact += 2;

    if (currentCompact >= lineCompact) {
        refillMain(); 
        if (shouldTerminate) return;
        currentCompact = 0;
    }
}

function farmMain() { 
    Chat.log("Starting/Resuming patrol at X=" + currentX);

    while (currentX <= xEast && !shouldTerminate) {
        farmTwoLine();
        Client.waitTick(lagTick * 2); 
    }
}


// -----------------------------------------------------------------------------------------
// INVENTORY REFILL
// -----------------------------------------------------------------------------------------

function getPlayerItemCount(itemId) {
    const slots = Player.openInventory().getSlots('main', 'hotbar');
    let count = 0;
    for (const slot of slots) {
        const item = Player.openInventory().getSlot(slot);
        if (item && item.getItemId() === itemId) {
            count += item.getCount();
        }
    }
    return count;
}

function checkInventoryDeficit() {
    const deficitList = [];
    Chat.log("--- Checking Inventory Deficit ---");
    for (const itemData of CARPET_COLORS) {
        const currentCount = getPlayerItemCount(itemData.id);
        const required = itemData.goalCount - currentCount;
        if (required > 0) {
            deficitList.push({ id: itemData.id, required: required });
        }
        checkManualAbort();
        if (shouldTerminate) break;
    }
    return deficitList;
}

function refillFromChest(deficitList) {
    if (deficitList.length === 0) return;

    walkTo(CHEST_STAND_X, CHEST_STAND_Z);
    if (shouldTerminate) return;

    Chat.log("--- Starting Refill from Stacked Chests ---");

    for (const y_offset of CHEST_Y_OFFSETS) {
        const current_chest_y = CHEST_BASE_Y + y_offset;
        
        lookAtChest(current_chest_y); 
        Client.waitTick(lagTick);
        p.interact(); 
        Client.waitTick(lagTick * 2);

        const chestInv = Player.openInventory();
        if (!chestInv || !chestInv.getName().includes("Chest")) {
            Chat.log(`WARNING: Failed to open chest at Y=${current_chest_y}. Skipping.`);
            continue; 
        }

        let needs_refill = false;
        for (const deficit of deficitList) { if (deficit.required > 0) { needs_refill = true; break; } }
        if (!needs_refill) { Player.openInventory().close(); break; }

        const chestSlots = chestInv.getSlots('container');
        
        for (let i = 0; i < deficitList.length; i++) {
            let deficit = deficitList[i];
            if (deficit.required <= 0) continue; 

            let needed = deficit.required;

            for (const slot of chestSlots) {
                const item = chestInv.getSlot(slot);
                if (item && item.getItemId() === deficit.id) {
                    const countInSlot = item.getCount();
                    const transferAmount = Math.min(needed, countInSlot);
                    
                    for (let j = 0; j < Math.ceil(transferAmount / 64); j++) {
                        chestInv.quick(slot);
                        Client.waitTick(lagTick / 2);
                        checkManualAbort();
                        if (shouldTerminate) break;
                    }

                    needed -= transferAmount;
                    deficitList[i].required = needed; 

                    if (needed <= 0) { break; }
                }
                if (shouldTerminate) break;
            }
            if (shouldTerminate) break;
        }

        Player.openInventory().close();
        Client.waitTick(lagTick);
        if (shouldTerminate) break;
    }

    Chat.log("--- Refill Attempt Complete. Inventory Closed ---");
}

function refillMain() {
    let deficitList = checkInventoryDeficit();
    if (shouldTerminate) return;

    if (deficitList.length > 0) {
        refillFromChest(deficitList);
    } else {
        Chat.log("Inventory check passed. Skipping refill.");
    }
}


// -----------------------------------------------------------------------------------------

// -----------------------------------------------------------------------------------------

function start() {
    currentCompact = 0;
    shouldTerminate = false;
    
    // Initial State Check/Reset
    if (currentX === undefined || currentX > xEast) {
        currentX = Math.floor(p.getX());
        currentDirection = 1;
        Chat.log(`Starting new patrol cycle at X=${currentX}.`);
    } else {
        Chat.log(`Resuming patrol cycle at preserved X=${currentX}, Z=${currentZ}.`);
        isResuming = true;
    }

    while (!shouldTerminate) {
        
        try {
            checkManualAbort();
            if (shouldTerminate) break;

            farmMain(); 

            if (!shouldTerminate) {
                Chat.log("Patrol cycle finished. Performing end-of-run refill check.");
                currentCompact = lineCompact; 
                refillMain(); 
                
                currentX = xWest;
                currentDirection = 1; 
                Chat.log("Restarting patrol cycle...");
            }

        } catch (e) {
            
            Chat.log("🔴 DISCONNECTION DETECTED: " + e.message);
            KeyBind.keyBind("key.forward", false); 

            Chat.log("Attempting to reconnect in 5 seconds...");
            Client.waitTick(100); 

            while (true) {
                checkManualAbort();
                if (shouldTerminate) break;
                
                Chat.log("Calling World.connect API to reconnect...");
                World.connect(SERVER_IP_PORT, SERVER_PORT); 
                
                Chat.log("Waiting for connection to stabilize...");
                Client.waitTick(RELOG_CHECK_TICKS); // Wait for connection/loading

                try {
                    // Check if connected (p.getX() will throw if not)
                    p.getX(); 
                    
                    isResuming = true; 
                    Chat.log(`✅ Successfully reconnected! Resuming at X=${currentX}, Z=${p.getZ()}...`);
                    break; 

                } catch (relogError) {
                    Chat.log("Relog attempt failed or world not loaded. Trying connection again...");
                }
            }
        }
    }

    if (shouldTerminate) {
        Chat.log("Script manually aborted. Final position saved (X=" + currentX + ", Z=" + currentZ + ").");
    } else {
        Chat.log("Script finished."); 
    }
}

start();
