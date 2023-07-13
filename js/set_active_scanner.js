



const scanner_exists = document.getElementById("already_exists");
const scanner_id = document.getElementById("scanner_id");
const scanner_secret = document.getElementById("scanner_secret");
const scanner_form = document.getElementById("scanner_id_form");
const onboard_url = document.getElementById("onboard_url");


const qr_code_value = document.getElementById("qr_code_value");
const send_to_scanner_form = document.getElementById("send_qr_active_scanner");
const networ_is_connected = document.getElementById("network_connected");
var netwrok_connected_status = true;

const new_lock_id = document.getElementById("new_lock_id");
const new_lock_secret = document.getElementById("new_lock_secret");
const new_lock_form = document.getElementById("new_lock_form");

var establishment_name = "";
const lock_list = [];
// {
//     "id": connect_resp["list_of_locks"][i],
//     "occupied": false,
//     "open": false,
//     "close_timer": null
// }
const event_log = [];
let socket;

function get_current_event_time() {
    const date = (new Date());
    let day = date.getDate();
    let month = date.getMonth() + 1;
    let year = date.getFullYear();
    let hours = date.getUTCHours();
    let minutes = date.getUTCMinutes();
    let seconds = date.getUTCSeconds();
    let currentDate = `${year}-${month.toLocaleString('en-US', {
        minimumIntegerDigits: 2,
        useGrouping: false
    })}-${day.toLocaleString('en-US', {
        minimumIntegerDigits: 2,
        useGrouping: false
    })}T${hours.toLocaleString('en-US', {
        minimumIntegerDigits: 2,
        useGrouping: false
    })}:${minutes.toLocaleString('en-US', {
        minimumIntegerDigits: 2,
        useGrouping: false
    })}:${seconds.toLocaleString('en-US', {
        minimumIntegerDigits: 2,
        useGrouping: false
    })}`;
    console.log("Current time generated is: " + currentDate)
    return currentDate;
}


function base64ToHex(str) {
    for (var i = 0, bin = atob(str.replace(/[ \r\n]+$/, "")), hex = []; i < bin.length; ++i) {
        let tmp = bin.charCodeAt(i).toString(16);
        if (tmp.length === 1) tmp = "0" + tmp;
        hex[hex.length] = tmp;
    }
    return hex.join("");
}

const stringToArrayBuffer = (string) => {
    let byteArray = new Uint8Array(string.length);
    for (var i = 0; i < string.length; i++) {
        byteArray[i] = string.codePointAt(i);
    }
    return byteArray;
}
function base64ToArrayBuffer(base64) {
    var binaryString = atob(base64);
    var bytes = new Uint8Array(binaryString.length);
    for (var i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

function hex2a(hexx) {
    var hex = hexx.toString();//force conversion
    var str = '';
    for (var i = 0; i < hex.length; i += 2)
        str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
    return str;
}

async function importSecretKey(rawKey) {
    var raw_key = stringToArrayBuffer(rawKey);
    return window.crypto.subtle.importKey("raw", raw_key, {
        name: "AES-CBC",
        length: 128
    }, true, ["encrypt", "decrypt"]);
}

async function decrypt128(data, key, iv) {
    return window.crypto.subtle.decrypt({
        name: "AES-CBC",
        iv
    }, key, data);
}

function display_lock_list() {
    console.log(lock_list)
    var docFrag = document.createDocumentFragment();
    lock_list.forEach(element => {
        var tempNode = document.querySelector("div[data-type='template']").cloneNode(true); //true for deep clone
        tempNode.querySelector("h6.lock_id_title").textContent = element.id;
        if (element["occupied"] === false && element["open"] === true) {
            tempNode.querySelector("button.occupy_lock_button").disabled = false;
        } else {
            tempNode.querySelector("button.occupy_lock_button").disabled = true;
        }
        if (element["occupied"] === true) {
            tempNode.querySelector("button.exit_lock_button").disabled = false;
        } else {
            tempNode.querySelector("button.exit_lock_button").disabled = true;
        }
        tempNode.querySelector("button.exit_lock_button").id = element.id;
        tempNode.querySelector("button.occupy_lock_button").id = element.id;
        tempNode.style.display = "flex";
        docFrag.appendChild(tempNode);
    });
    const lock_container = document.getElementById("lock_container");
    lock_container.innerHTML = "";
    lock_container.appendChild(docFrag);
    delete docFrag;
}

function connect_response_handler(connect_resp) {
    establishment_name = connect_resp["establishment_name"];
    for (var i = 0; i < connect_resp["list_of_locks"].length; i++) {
        //Remove Old Locks object.
        const objWithIdIndex = lock_list.findIndex((obj) => obj.id === connect_resp["list_of_locks"][i]);
        if (objWithIdIndex == -1) {
            const new_lock = {
                "id": connect_resp["list_of_locks"][i],
                "occupied": false,
                "open": false,
                "close_timer": null
            }
            lock_list.push(new_lock);
        }
        lock_list.forEach(element => {
            if (connect_resp["list_of_locks"].includes(element.id) === false) {
                const removable_index = lock_list.findIndex((obj) => obj.id === element.id);
                if (removable_index > -1) {
                    lock_list.splice(removable_index, 1);
                }
            }
        })
    }
    display_lock_list();
}

function websocket_setup(device_id, device_secret) {
    // websocket_url = `wss://localhost:3000/?device_id=${device_id}&device_secret=${device_secret}`;
    websocket_url = `wss://dev.tkrm.co/?device_id=${device_id}&device_secret=${device_secret}`;
    //Connect to Server
    if (socket !== undefined) {
        socket.close();
    }
    socket = new WebSocket(websocket_url);
    // Send Connect message
    socket.onopen = function (e) {
        const connect_message = {
            "device_id": device_id,
            "message_type": "CONNECT"
        };
        console.log(`Sending Connect message: ${(connect_message.toString())}`)
        socket.send(JSON.stringify(connect_message));
    };
    //Setup event handler
    socket.onmessage = function (event) {
        console.log(`[message] Data received from server: ${(event.data)}`);
        payload = JSON.parse(event.data);
        switch (payload["message_type"]) {
            case "CONNECTRESP": {
                connect_response_handler(payload);
                break;
            } case "GROUPAVLBL": {
                const group_avlbl_resp = {
                    "message_type": "GROUPAVLBLRESP",
                    "available_locks": []
                }
                lock_list.forEach(element => {
                    if (element.occupied === false && element.open === false) {
                        group_avlbl_resp["available_locks"].push(element.id)
                    }
                });
                socket.send(JSON.stringify(group_avlbl_resp));
                break;
            } case "DEVICEAVLBL": {
                const query_device = payload["device_id"];
                const device_avlbl_resp = {
                    "message_type": "DEVICEAVLBLRESP",
                    "device_id": query_device,
                    "availability": "BUSY"
                }
                lock_list.forEach(element => {
                    if (element.id === query_device) {
                        let availability = (element.occupied === false && element.open === false) ? "FREE" : "BUSY";
                        device_avlbl_resp["availability"] = availability;
                        socket.send(JSON.stringify(device_avlbl_resp));
                    }
                })
                break;
            }
        };

    };
    socket.onclose = function (event) {
        alert("Connection Closed By server")
    }

}

function register_scanner(scanner_data, url) {
    const XHR = new XMLHttpRequest();
    XHR.onreadystatechange = () => {
        if (XHR.readyState !== 4) {
            return;
        }
        if (XHR.status == 201) {
            alert("Scanner Registered");
            //Start Websocket Connection
            websocket_setup(scanner_data["device_id"], scanner_data["device_secret"]);
        } else {
            alert("Scanner Register Failed");
        }
    };
    XHR.open("POST", url);
    XHR.setRequestHeader("Accept", "application/json");
    XHR.setRequestHeader("Content-Type", "application/json");
    XHR.send(JSON.stringify(scanner_data));
    websocket_setup(scanner_data["device_id"], scanner_data["device_secret"]);
}
function register_lock(lock_data, url) {
    const XHR = new XMLHttpRequest();
    XHR.onreadystatechange = () => {
        if (XHR.readyState !== 4) {
            return;
        }
        if (XHR.status == 201) {
            alert("Lock Registered");
        } else {
            alert("Lock Register Failed");
        }
    };
    XHR.open("POST", url);
    XHR.setRequestHeader("Accept", "application/json");
    XHR.setRequestHeader("Content-Type", "application/json");
    XHR.send(JSON.stringify(lock_data));
}

scanner_form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (scanner_exists.checked === false) {
        //Get API Key
        const apikey = onboard_url.value
        //Add device to TKRM System
        const scanner_data = {
            "device_id": scanner_id.value,
            "device_type": "SCANNER",
            "device_secret": scanner_secret.value
        }
        register_scanner(scanner_data, apikey);
    } else {
        //Start Websocket Connection
        websocket_setup(scanner_id.value, scanner_secret.value);
    }
});


new_lock_form.addEventListener("submit", function (event) {
    event.preventDefault();
    //Get API Key
    const apikey = onboard_url.value
    //Add device to TKRM System
    const lock_data = {
        "device_id": new_lock_id.value,
        "device_type": "LOCK",
        "device_secret": new_lock_secret.value
    }
    register_lock(lock_data, apikey);

});


function occupy_lock_handler(id) {
    console.log("Handling Occupy");
    //Change Status to Occupied
    lock_list.forEach(element => {
        if (element.id === id) {
            element.occupied = true;
        }
    });
    //Update UI
    display_lock_list();
    const status_change_evt = {
        "message_type": "STATUSCHNG",
        "device_id": scanner_id.value,
        "status": "BUSY",
        "used_device": id,
        "generated_time": get_current_event_time(),
    }
    //if Network connected, send to backend
    if (netwrok_connected_status && socket !== undefined) {
        socket.send(JSON.stringify(status_change_evt))
    }
    //if not, Keep event data.
    else {
        event_log.push(status_change_evt)
    }
}
function exit_lock_handler(id) {
    console.log(id);
    //Change Status to Unoccupied
    //Change Status to Occupied
    lock_list.forEach(element => {
        if (element.id === id) {
            element.occupied = false;
            element.open = false;
        }
    });
    //Update UI
    display_lock_list();
    //if Network connected, send to backend
    const status_change_evt = {
        "message_type": "STATUSCHNG",
        "device_id": scanner_id.value,
        "status": "FREE",
        "used_device": id,
        "generated_time": get_current_event_time(),
    }
    //if Network connected, send to backend
    if (netwrok_connected_status && socket !== undefined) {
        socket.send(JSON.stringify(status_change_evt))
    }
    //if not, Keep event data.
    else {
        event_log.push(status_change_evt)
    }
}

networ_is_connected.addEventListener('change', (event) => {
    netwrok_connected_status = event.currentTarget.checked
    //Send Each Event to server from eventlist
    if (netwrok_connected_status && socket !== undefined) {
        event_log.forEach(event => {
            socket.send(JSON.stringify(event));
        })
        //Clear Events
        event_log.splice(0, event_log.length);
    }
})

function close_device(id) {
    // Close door.
    console.log("timeout closing door");
    lock_list.forEach(element => {
        if (element.id === id) {
            element["open"] = false;
            element["close_timer"] = null;
        }
    })
    display_lock_list();
}

function open_all_devices() {
    for (var i = 0; i < lock_list.length; i++) {
        lock_list[i]["open"] = true;
        if (lock_list[i]["close_timer"] === null) {
            clearTimeout(lock_list[i]["close_timer"])
            lock_list[i]["close_timer"] = null;
        }
        const temp_lock_id = lock_list[i]["id"]
        lock_list[i]["close_timer"] = setTimeout(() => {
            close_device(temp_lock_id);
        }, 10000);
    }
    display_lock_list();
}

function open_all_unocupied_devices() {
    for (var i = 0; i < lock_list.length; i++) {
        if (lock_list[i]["occupied"] === false) {
            const temp_lock_id = lock_list[i]["id"]
            lock_list[i]["open"] = true;
            if (lock_list[i]["close_timer"] === null) {
                clearTimeout(lock_list[i]["close_timer"])
                lock_list[i]["close_timer"] = null;
            }
            lock_list[i]["close_timer"] = setTimeout(() => {
                close_device(temp_lock_id);
            }, 10000);
        }
    }
    display_lock_list();
}

function find_device_and_open(base64_qr_code) {
    for (var i = 0; i < lock_list.length; i++) {
        if (lock_list[i]["occupied"] === false && lock_list[i]["open"] === false) {
            console.log("found an unoccupied device");
            lock_list[i]["open"] = true;
            const qr_read_event = {
                "message_type": "QRUSED",
                "device_id": scanner_id.value,
                "qr_value": (base64_qr_code),
                "generated_time": get_current_event_time(),
                "used_device": lock_list[i]["id"]
            }
            if (netwrok_connected_status && socket !== undefined) {
                console.log("Sending Event to Server " + JSON.stringify(qr_read_event));
                console.log(qr_read_event)
                socket.send(JSON.stringify(qr_read_event))
            }
            //if not, Keep event data.
            else {
                event_log.push(qr_read_event)
            }
            if (lock_list[i]["close_timer"] === null) {
                clearTimeout(lock_list[i]["close_timer"])
                lock_list[i]["close_timer"] = null;
            }
            lock_list[i]["close_timer"] = setTimeout(() => {
                close_device(lock_list[i]["id"]);
            }, 10000);
            display_lock_list();
            return;
        }
    }
}

function handle_tkrm_qr_codes(decoded_qr, base64_qr_code) {
    console.log("TKRM QR Code: " + decoded_qr)
    if (decoded_qr.includes("1970-01-01T00:00:00")) {
        console.log("TRKR QR is Force ALL");
        //type 3, force open all

        const qr_read_event = {
            "message_type": "QRUSED",
            "device_id": scanner_id.value,
            "qr_value": (base64_qr_code),
            "generated_time": get_current_event_time(),
            "used_device": "ALL"
        }
        if (netwrok_connected_status && socket !== undefined) {
            console.log("Sending Event to Server " + JSON.stringify(qr_read_event));
            socket.send(JSON.stringify(qr_read_event))
        }
        //if not, Keep event data.
        else {
            event_log.push(qr_read_event)
        }
        open_all_devices();
    } else if (decoded_qr.includes("1970-01-02T00:00:00")) {
        console.log("TRKR QR is Force ALL Unless Occupied");
        //type 4, open all unoccupied
        const qr_read_event = {
            "message_type": "QRUSED",
            "device_id": scanner_id.value,
            "qr_value": (base64_qr_code),
            "generated_time": get_current_event_time(),
            "used_device": "ALL"
        }
        console.log(qr_read_event)
        if (netwrok_connected_status && socket !== undefined) {
            console.log("Sending Event to Server " + JSON.stringify(qr_read_event));
            socket.send(JSON.stringify(qr_read_event))
        }
        //if not, Keep event data.
        else {
            event_log.push(qr_read_event)
        }
        open_all_unocupied_devices();
    } else {
        console.log("TRKR QR is Open 1");
        const received_time_string = decoded_qr.substring(39);
        const received_time = new Date(received_time_string + "+00:00");
        const current_time = new Date();
        //type 1, check if time is within 4 hours, then find a single device to open
        var diff = (received_time.getTime() - current_time.getTime()) / 1000;
        diff /= (60 * 60);
        diff = Math.abs(Math.round(diff));
        if (diff < 4) {
            console.log("TRKR Open 1 is less than 4 hours " + decoded_qr);
            find_device_and_open((base64_qr_code))
        } else {
            alert("This TKRM QR Code is too old");
        }
    }
}

function handle_zakat_qr_codes(decoded_qr) {
    let hex_qr = base64ToHex(decoded_qr)
    console.log(hex_qr)
    //Extract time string first
    let start_index = 0
    var date_string_value = ""
    while (start_index < hex_qr.length) {
        var tag = hex_qr.slice(0 + start_index, 2 + start_index)
        var val_length = hex_qr.slice(2 + start_index, 4 + start_index)
        var value = hex_qr.slice(4 + start_index, 4 + (parseInt(val_length, 16) * 2) + start_index)
        if (tag == "03") {
            date_string_value = hex2a(value)
        }
        start_index = start_index + 4 + (parseInt(val_length, 16) * 2);
    }
    console.log(date_string_value)
    var received_datetime = new Date(date_string_value)
    var current_time = new Date(date_string_value)
    var diff = (received_datetime.getTime() - current_time.getTime()) / 1000;
    diff /= (60 * 60);
    diff = Math.abs(Math.round(diff));
    if (diff < 4) {
        find_device_and_open(decoded_qr)
        return true;
    } else {
        alert("This Zakat QR Code is too old");
    }
    return false;
}

send_to_scanner_form.addEventListener("submit", async function (event) {
    event.preventDefault();
    const INITIALIZATION_VECTOR = '0000000000000000';
    var iv = stringToArrayBuffer(INITIALIZATION_VECTOR);
    //Check if  scanner_secret.value is 16 chars
    if (scanner_secret.value.length !== 16) {
        alert("Invalid Scanner Secret");
    }
    var secret_key = await importSecretKey(scanner_secret.value);

    //4 types of qr codes: 
    //1: TKRM QR Code:
    //QR code is +16 chars
    //Starts with a 16 char value,
    //Contains the value in the cipher
    //Contains scanner ID
    //Contains time
    //2: Zakat QR code
    //Unencrypted
    //Contains establishment name
    //Contains datetime within 4 hours
    //3: Master with force code:
    //QR code is the same as TKRM QR Code with time "1970-01-01T00:00:00",
    //4: Master without force code:
    //QR code is the same as TKRM QR Code with time "1970-01-02T00:00:00",
    // if QR Code type is not here, quit, if here, go on.
    //Try Zakat first:
    let base64_qr_code = qr_code_value.value;
    while (base64_qr_code.slice(-1) === "\n") {
        console.log("removing new Line")
        base64_qr_code = base64_qr_code.substring(0, base64_qr_code.length - 1);
    }
    try {
        console.log(base64ToHex(base64_qr_code).includes(establishment_name));
        console.log((establishment_name));
        if (base64ToHex(base64_qr_code).includes(establishment_name)) {
            // has to be type 2
            console.log("Zakat QR Read");
            if (!handle_zakat_qr_codes((base64_qr_code))) {
                throw new Error('Parameter is not a Zakat QR');
            }
        } else {
            throw new Error('Parameter is not a Zakat QR');
        }
    } catch (error) {
        console.log(error)
        //Didnt workout, try TKRM
        if (qr_code_value.value.length > 16) {

            try {
                const token = qr_code_value.value.slice(0, 16);
                const cipher_text = qr_code_value.value.slice(16);
                var data = base64ToArrayBuffer(cipher_text);
                var decrypt_output = await decrypt128(data, secret_key, iv)
                let dec = new TextDecoder();
                var decoded_qr = dec.decode(decrypt_output);
                console.log(decoded_qr);
                if (decoded_qr.includes(token) && decoded_qr.includes(scanner_id.value)) {
                    //Either type 1, 3, 4
                    console.log("TKRM QR Read");
                    handle_tkrm_qr_codes(decoded_qr, base64_qr_code);
                } else {
                    alert("Invalid QR Code");
                }
            } catch (error) {
                alert("Error: Invalid QR Code");
            }
        } else {
            alert("Error: Invalid QR Code");
        }
    }
});