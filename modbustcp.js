/**
 * Original Work Copyright 2015 Valmet Automation Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Modified work Copyright 2016 Argonne National Laboratory.
 *
 * Licensed under the the BSD 3-Clause License (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://opensource.org/licenses/BSD-3-Clause
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

function timestamp() {
    return new Date().
        toISOString().
        replace(/T/, ' ').      // replace T with a space
        replace(/\..+/, '')
}
function log(msg, args) {
    if (args)
        console.log(timestamp() + ': ' + msg, args);
    else
        console.log(timestamp() + ': ' + msg);
}


module.exports = function (RED) {
    var modbus = require('jsmodbus');
    var util = require('util');

    function ModbusTCPServerNode(config) {
        RED.nodes.createNode(this, config);
        this.host = config.host;
        this.port = config.port;
        this.unit_id = config.unit_id;                
        this.modbusconn = null;        
        var node = this;

        node.initializeModbusTCPConnectionWrite = function (nodeClient, callback) {
            if (node.modbusconn && node.modbusconn.isConnected()) {
                log('Already connected to modbustcp for write slave at ' + config.host + ':' + config.port);
                if (callback && (typeof callback === 'function')){
                    callback(node.modbusconn);
                }
                return node.modbusconn;
            }
            log('Connecting to modbustcp slave for write at ' + config.host + ':' + config.port + ' unit_id: ' + config.unit_id);
            node.modbusconn = null;
            console.log('Node origin: ' + nodeClient);
            node.source = nodeClient;
            node.modbusconn = modbus.createTCPClient(config.port, config.host, Number(config.unit_id), function(err){
                if (err) {                                      
                    node.error('ModbusTCPConnectionWrite: ' + util.inspect(err, false, null));
                    console.log('Node origin: ' + node.modbusconn);
                    node.source.send([null, { payload: 'ModbusTCPConnectionWrite: ' + util.inspect(err, false, null)}]);
                    return null;
                } 
                log('ModbusTCP Write: successfully connected to ' + config.host + ':' + config.port + ' unit_id: ' + config.unit_id);
            });

            if (callback && (typeof callback === 'function'))            
                callback(node.modbusconn);    
                       
            return node.modbusconn;

        };

        node.initializeModbusTCPConnectionRead = function (nodeClient, callback) {
            if (node.modbusconn && node.modbusconn.isConnected()) {
                log('Already connected to modbustcp for read slave at ' + config.host + ':' + config.port);
                if (callback && (typeof callback === 'function')){
                    callback(node.modbusconn);
                }
                return node.modbusconn;
            }
            log('Connecting to modbustcp for read slave at ' + config.host + ':' + config.port + ' unit_id: ' + config.unit_id);
            node.modbusconn = null;
            console.log('Node origin: ' + nodeClient);
            node.source = nodeClient;
            node.modbusconn = modbus.createTCPClient(config.port, config.host, Number(config.unit_id), function(err){
                if (err) {                                      
                    node.error('ModbusTCPConnectionRead: ' + util.inspect(err, false, null));
                    console.log('Node origin: ' + node.modbusconn);
                    node.source.send([null, { payload: 'ModbusTCPConnectionRead: ' + util.inspect(err, false, null)}]);
                    return null;
                } 
                log('ModbusTCP Read: successfully connected to ' + config.host + ':' + config.port + ' unit_id: ' + config.unit_id);
            });

            if (callback && (typeof callback === 'function'))            
                callback(node.modbusconn);    
                       
            return node.modbusconn;

        };        
        node.on("close", function () {
            log('disconnecting from modbustcp slave at ' + config.host + ':' + config.port);
            node.modbusconn && node.modbusconn.isConnected() && node.modbusconn.close();
        });
    }

    RED.nodes.registerType("modbustcp-no-pooling-server", ModbusTCPServerNode);
  
    function ModbusTCPWrite(config) {
        RED.nodes.createNode(this, config);
        this.name = config.name;
        this.dataType = config.dataType;
        this.adr = Number(config.adr);
        this.ctrl = RED.nodes.getNode(config.server);
        var node = this;
        var modbusTCPServer = RED.nodes.getNode(config.server);
        
        this.on("input", function (msg) {            
            if (!(msg && msg.hasOwnProperty('payload'))) return;
            
            if (msg.payload == null) {
                node.error('ModbusTCPClientWrite: Invalid msg.payload!');
                return;
            }
            node.status(null);
            modbusTCPServer.initializeModbusTCPConnectionWrite(node, function(connection){
                node.receiveEvent1 = function(){
                    if(!node.connection.isConnected())
                    {
                        log('Modbus TCP Server Closed Connection Write');
                        node.status({fill:"grey",shape:"dot",text:"Disconnected"});                           
                    }              
                }
                node.connection = connection;
                node.connection.on('close', node.receiveEvent1);

                switch (node.dataType) {
                    case "Coil": //FC: 5                         
                        node.connection.writeSingleCoil(node.adr, Number(msg.payload), function (resp, err) {
                            if (err) {
                                node.status({fill:"red",shape:"dot",text:"Error"});
                                console.log(err);                                 
                                node.error('ModbusTCPClientWrite: ' + JSON.stringify(err));
                                node.send([null, { payload: 'writeSingleCoilWrite: ' + JSON.stringify(err)}]);
                                return;
                            }
                            if (resp) 
                            {
                                //node.status({fill:"green",shape:"dot",text:util.inspect(resp, false, null)});
                                node.status({fill:"green",shape:"dot",text:"Write: [" + msg.payload + "]"});
                                node.send([msg, null]);
                            }
                            node.connection && node.connection.isConnected() && node.connection.close();
                        });                    
                        
                        break;
                    case "HoldingRegister": //FC: 6                               
                        node.connection.writeSingleRegister(node.adr, Number(msg.payload), function (resp, err) {
                            if (err) {
                                node.status({fill:"red",shape:"dot",text:"Error"});
                                console.log(err); 
                                node.error('ModbusTCPClient: ' + JSON.stringify(err));
                                node.send([null, { payload: 'writeSingleRegisterWrite: ' + JSON.stringify(err)}]);
                                return;
                            }
                            if (resp) 
                            {
                                //node.status({fill:"green",shape:"dot",text:util.inspect(resp, false, null)});
                                node.status({fill:"green",shape:"dot",text:"Write: [" + msg.payload + "]"});
                                node.send([msg, null]);
                            }
                            node.connection && node.connection.isConnected() && node.connection.close();
                        });                         
                        
                        break
                }
            })
        }); 
    }

    //
    RED.nodes.registerType("modbustcp-no-pooling-write", ModbusTCPWrite);

    function ModbusTCPRead(config) {
        RED.nodes.createNode(this, config);
        this.name = config.name;
        this.dataType = config.dataType;
        this.adr = config.adr;
        this.quantity = config.quantity;
        this.connection = null;
        var node = this;
        var modbusTCPServer = RED.nodes.getNode(config.server);  

        this.on("input", function (msg) {            
            if (!(msg && msg.hasOwnProperty('payload'))) return;
            
            if (msg.payload == null) {
                node.error('ModbusTCPClientRead: Invalid msg.payload!');
                return;
            }
            node.status(null);
            modbusTCPServer.initializeModbusTCPConnectionRead(node, function(connection){            
                node.receiveEvent1 = function(){
                    if(!node.connection.isConnected())
                    {
                        log('Modbus TCP Server Closed Connection Read');
                        node.status({fill:"grey",shape:"dot",text:"Disconnected."});                       
                    }              
                }

                node.connection = connection;
                node.connection.on('close', node.receiveEvent1);

                var msg = {};  
                msg.topic = node.name;              

                switch (node.dataType){
                    case "Coil": //FC: 1
                        node.status({fill:"yellow",shape:"dot",text:"Connecting"});
                        node.connection.readCoils(node.adr,node.quaintty, function (resp, err) { 
                            if (err) {
                                node.status({fill:"red",shape:"dot",text:"Error"});
                                console.log(err); 
                                node.error('ModbusTCPClient: ' + JSON.stringify(err));
                                node.send([null, { payload: 'readCoils: ' + JSON.stringify(err)}]);
                                return;
                            }
                            if (resp) 
                            {
                                node.status({fill:"green",shape:"dot",text:"Ready: [" + resp.coils + "]"});
                                msg.payload = resp.coils; // array of coil values
                                node.send([msg, null]);
                            }
                            node.connection && node.connection.isConnected() && node.connection.close();
                        });
                        break;
                    case "Input": //FC: 2
                        node.status({fill:"yellow",shape:"dot",text:"Connecting"});
                        node.connection.readDiscreteInput(node.adr,node.quantity, function (resp, err) { 
                            if (err) {
                                node.status({fill:"red",shape:"dot",text:"Error"});
                                console.log(err); 
                                node.error('ModbusTCPClient: ' + JSON.stringify(err));
                                node.send([null, { payload: 'readDiscreteInput: ' + JSON.stringify(err)}]);
                                return;
                            }
                            if (resp) 
                            {
                                node.status({fill:"green",shape:"dot",text:"Read: [" + resp.coils + "]"});
                                msg.payload = resp.coils; // array of discrete input values
                                node.send([msg, null]);
                            }
                            node.connection && node.connection.isConnected() && node.connection.close();
                        });
                        break;
                    case "HoldingRegister": //FC: 3
                        node.status({fill:"yellow",shape:"dot",text:"Connecting"});
                        node.connection.readHoldingRegister(node.adr,node.quantity, function (resp, err) { 
                            if (err) {
                                node.status({fill:"red",shape:"dot",text:"Error"});
                                console.log(err); 
                                node.error('ModbusTCPClient: ' + JSON.stringify(err));
                                node.send([null, { payload: 'readDiscreteInput: ' + JSON.stringify(err)}]);
                                return;
                            }
                            if (resp) 
                            {
                                node.status({fill:"green",shape:"dot",text:"Read: [" + resp.register + "]"});
                                msg.payload = resp.register; // array of register values
                                node.send([msg, null]);
                            }
                            node.connection && node.connection.isConnected() && node.connection.close();
                        });
                        break;
                    case "InputRegister": //FC: 4                        
                        node.status({fill:"yellow",shape:"dot",text:"Connecting"});
                        node.connection.readInputRegister(node.adr,node.quantity, function (resp, err) { 
                            if (err) {
                                node.status({fill:"red",shape:"dot",text:"Error"});
                                console.log(err); 
                                node.error('ModbusTCPClient: ' + JSON.stringify(err));
                                node.send([null, { payload: 'readDiscreteInput: ' + JSON.stringify(err)}]);
                                return;
                            }
                            if (resp) 
                            {                                    
                                node.status({fill:"green",shape:"dot",text:"Read: [" + resp.register + "]"});
                                msg.payload = resp.register; // array of register values
                                node.send([msg, null]);                                    
                            }
                            node.connection && node.connection.isConnected() && node.connection.close();
                        });
                        break;
                }
                                         
            });           

        });
    }
    
    RED.nodes.registerType("modbustcp-no-pooling-read", ModbusTCPRead);

}
