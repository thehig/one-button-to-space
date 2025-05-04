import Phaser from "phaser";
// import { Client, Room } from 'colyseus.js'; // Import later when integrating Colyseus
import { CommunicationManager } from "./CommunicationManager"; // Import CommunicationManager

export default class NetworkManager {
  private scene: Phaser.Scene;
  private eventEmitter: Phaser.Events.EventEmitter;
  private communicationManager: CommunicationManager; // Add property
  // private client?: Client;
  // private room?: Room;

  constructor(
    scene: Phaser.Scene,
    eventEmitter: Phaser.Events.EventEmitter,
    communicationManager: CommunicationManager // Add parameter
  ) {
    this.scene = scene;
    this.eventEmitter = eventEmitter;
    this.communicationManager = communicationManager; // Store instance
    this.communicationManager.logEvent("NetworkManager", "constructor");
  }

  init() {
    this.communicationManager.logEvent("NetworkManager", "initStart");
    // Initialize Colyseus client later (Task #8)
    // this.client = new Client('ws://localhost:2567'); // Example endpoint
    this.setupEventListeners();
    this.communicationManager.logEvent("NetworkManager", "initComplete");
  }

  create() {
    this.communicationManager.logEvent("NetworkManager", "createStart");
    // Attempt to join a room later (Task #8)
    // this.joinRoom();
    this.communicationManager.logEvent("NetworkManager", "createComplete");
  }

  setupEventListeners() {
    // Listen for events from other managers (e.g., input) that need to be sent to the server
    this.eventEmitter.on("inputUpdate", this.handleInputUpdate, this);
  }

  handleInputUpdate(payload: any) {
    // this.communicationManager.logEvent('NetworkManager', 'sendingInput', payload);
    // Send input payload to the server room later
    // this.room?.send('input', payload);
  }

  // async joinRoom() {
  //   if (!this.client) return;
  //   try {
  //     this.communicationManager.logEvent('NetworkManager', 'attemptingToJoinRoom');
  //     // Replace 'your_room_name' with the actual room name defined on the server
  //     this.room = await this.client.joinOrCreate('your_room_name');
  //     this.communicationManager.logEvent('NetworkManager', 'joinedRoomSuccessfully', { sessionId: this.room.sessionId });
  //     this.setupRoomListeners();
  //     this.eventEmitter.emit('networkConnected', this.room);
  //   } catch (e) {
  //     this.communicationManager.logEvent('NetworkManager', 'joinRoomError', { error: e });
  //     this.eventEmitter.emit('networkError', e);
  //   }
  // }

  // setupRoomListeners() {
  //   if (!this.room) return;
  //   // Listen for messages from the server (e.g., state updates, entity creation/removal)
  //   this.room.onStateChange((state) => {
  //     // Consider logging only specific parts or diffs of the state
  //     // this.communicationManager.logEvent('NetworkManager', 'stateChangeReceived', { state });
  //     this.eventEmitter.emit('serverStateUpdate', state);
  //   });
  //   this.room.onMessage('entitySpawn', (message) => {
  //     this.eventEmitter.emit('serverEntitySpawn', message);
  //   });
  //   this.room.onMessage('entityRemove', (message) => {
  //     this.eventEmitter.emit('serverEntityRemove', message);
  //   });
  //   this.room.onError((code, message) => {
  //     this.communicationManager.logEvent('NetworkManager', 'colyseusRoomError', { code, message });
  //     this.eventEmitter.emit('networkError', { code, message });
  //   });
  //   this.room.onLeave((code) => {
  //     this.communicationManager.logEvent('NetworkManager', 'leftRoom', { code });
  //     this.eventEmitter.emit('networkDisconnected', code);
  //     this.room = undefined;
  //   });
  // }

  update(time: number, delta: number) {
    // Network-related updates if needed
  }

  shutdown() {
    this.communicationManager.logEvent("NetworkManager", "shutdownStart");
    // Leave the room and clean up listeners
    // this.room?.leave();
    this.eventEmitter.off("inputUpdate", this.handleInputUpdate, this);
    // this.client = undefined; // Optional: Clean up client instance if appropriate
    this.communicationManager.logEvent("NetworkManager", "shutdownComplete");
  }
}
