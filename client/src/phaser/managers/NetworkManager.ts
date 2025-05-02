import Phaser from "phaser";
// import { Client, Room } from 'colyseus.js'; // Import later when integrating Colyseus

export default class NetworkManager {
  private scene: Phaser.Scene;
  private eventEmitter: Phaser.Events.EventEmitter;
  // private client?: Client;
  // private room?: Room;

  constructor(scene: Phaser.Scene, eventEmitter: Phaser.Events.EventEmitter) {
    this.scene = scene;
    this.eventEmitter = eventEmitter;
    console.log("NetworkManager: constructor");
  }

  init() {
    console.log("NetworkManager: init");
    // Initialize Colyseus client later (Task #8)
    // this.client = new Client('ws://localhost:2567'); // Example endpoint
    this.setupEventListeners();
  }

  create() {
    console.log("NetworkManager: create");
    // Attempt to join a room later (Task #8)
    // this.joinRoom();
  }

  setupEventListeners() {
    // Listen for events from other managers (e.g., input) that need to be sent to the server
    this.eventEmitter.on("inputUpdate", this.handleInputUpdate, this);
  }

  handleInputUpdate(payload: any) {
    // console.log('NetworkManager: Sending input', payload);
    // Send input payload to the server room later
    // this.room?.send('input', payload);
  }

  // async joinRoom() {
  //   if (!this.client) return;
  //   try {
  //     console.log('NetworkManager: Attempting to join room...');
  //     // Replace 'your_room_name' with the actual room name defined on the server
  //     this.room = await this.client.joinOrCreate('your_room_name');
  //     console.log('NetworkManager: Joined room successfully!', this.room.sessionId);
  //     this.setupRoomListeners();
  //     this.eventEmitter.emit('networkConnected', this.room);
  //   } catch (e) {
  //     console.error("NetworkManager: Join error", e);
  //     this.eventEmitter.emit('networkError', e);
  //   }
  // }

  // setupRoomListeners() {
  //   if (!this.room) return;
  //   // Listen for messages from the server (e.g., state updates, entity creation/removal)
  //   this.room.onStateChange((state) => {
  //     // console.log('NetworkManager: State change received', state);
  //     this.eventEmitter.emit('serverStateUpdate', state);
  //   });
  //   this.room.onMessage('entitySpawn', (message) => {
  //     this.eventEmitter.emit('serverEntitySpawn', message);
  //   });
  //   this.room.onMessage('entityRemove', (message) => {
  //     this.eventEmitter.emit('serverEntityRemove', message);
  //   });
  //   this.room.onError((code, message) => {
  //     console.error('NetworkManager: Colyseus room error', code, message);
  //     this.eventEmitter.emit('networkError', { code, message });
  //   });
  //   this.room.onLeave((code) => {
  //     console.log('NetworkManager: Left room', code);
  //     this.eventEmitter.emit('networkDisconnected', code);
  //     this.room = undefined;
  //   });
  // }

  update(time: number, delta: number) {
    // Network-related updates if needed
  }

  shutdown() {
    console.log("NetworkManager: shutdown");
    // Leave the room and clean up listeners
    // this.room?.leave();
    this.eventEmitter.off("inputUpdate", this.handleInputUpdate, this);
    // this.client = undefined; // Optional: Clean up client instance if appropriate
  }
}
