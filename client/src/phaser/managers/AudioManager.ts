import Phaser from "phaser";

interface SoundConfig {
  key: string;
  path: string;
  volume?: number;
  loop?: boolean;
}

export default class AudioManager {
  private scene: Phaser.Scene;
  private eventEmitter: Phaser.Events.EventEmitter;
  private sounds: Map<string, Phaser.Sound.BaseSound>;

  // Example sound configuration
  // private soundConfigs: SoundConfig[] = [
  //   { key: 'jump', path: 'assets/audio/jump.wav', volume: 0.5 },
  //   { key: 'coin', path: 'assets/audio/coin.wav', volume: 0.7 },
  //   {
  //     key: 'background_music',
  //     path: 'assets/audio/music.mp3',
  //     volume: 0.3,
  //     loop: true,
  //   },
  //   // Add more sound configurations here
  // ];

  constructor(scene: Phaser.Scene, eventEmitter: Phaser.Events.EventEmitter) {
    this.scene = scene;
    this.eventEmitter = eventEmitter;
    this.sounds = new Map();
    console.log("AudioManager: constructor");
  }

  preload() {
    console.log("AudioManager: preload");
    // Preload audio assets defined in configs
    // this.soundConfigs.forEach((config) => {
    //   console.log(
    //     `AudioManager: Loading sound ${config.key} from ${config.path}`
    //   );
    //   // Check if the asset is already loaded by another scene/manager if necessary
    //   if (!this.scene.load.isLoading()) {
    //     // Basic check, might need more robust logic
    //     this.scene.load.audio(config.key, config.path);
    //   }
    // });
  }

  init() {
    console.log("AudioManager: init");
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Listen for events that trigger sounds
    this.eventEmitter.on("playAudio", this.playSound, this);
    this.eventEmitter.on("stopAudio", this.stopSound, this);
    this.eventEmitter.on("stopAllAudio", this.stopAllSounds, this);
    this.eventEmitter.on("setMusicVolume", this.setMusicVolume, this);
    this.eventEmitter.on("setSfxVolume", this.setSfxVolume, this);
  }

  create() {
    console.log("AudioManager: create");
    // Add sounds to the manager once loaded
    // This often happens implicitly via preload, but you could add sounds manually too
    // this.soundConfigs.forEach((config) => {
    //   if (this.scene.sound.get(config.key)) {
    //     const soundInstance = this.scene.sound.add(config.key, {
    //       volume: config.volume ?? 1.0,
    //       loop: config.loop ?? false,
    //     });
    //     this.sounds.set(config.key, soundInstance);
    //   } else {
    //     console.warn(
    //       `AudioManager: Sound asset '${config.key}' not found after preload.`
    //     );
    //   }
    // });

    // Optionally, play background music immediately
    // this.playSound("background_music");
  }

  playSound(key: string) {
    const sound = this.sounds.get(key);
    if (sound && !sound.isPlaying) {
      console.log(`AudioManager: Playing sound ${key}`);
      sound.play();
    } else if (!sound) {
      console.warn(`AudioManager: Sound ${key} not found or not ready.`);
    } else {
      // Optionally handle cases where sound is already playing (e.g., restart or ignore)
      // console.log(`AudioManager: Sound ${key} is already playing.`);
    }
  }

  stopSound(key: string) {
    const sound = this.sounds.get(key);
    if (sound && sound.isPlaying) {
      console.log(`AudioManager: Stopping sound ${key}`);
      sound.stop();
    }
  }

  stopAllSounds() {
    console.log("AudioManager: Stopping all sounds");
    this.scene.sound.stopAll();
    // Note: stopAll() stops everything, including potentially sounds not managed here.
    // A more granular approach might iterate through `this.sounds`:
    // this.sounds.forEach(sound => sound.stop());
  }

  setMusicVolume(volume: number) {
    console.log(`AudioManager: Setting music volume to ${volume}`);
    const music = this.sounds.get("background_music"); // Assuming 'background_music' key
    if (music) {
      music.setVolume(Phaser.Math.Clamp(volume, 0, 1));
    }
  }

  setSfxVolume(volume: number) {
    console.log(`AudioManager: Setting SFX volume to ${volume}`);
    this.sounds.forEach((sound, key) => {
      // Assuming sounds other than 'background_music' are SFX
      if (key !== "background_music") {
        sound.setVolume(Phaser.Math.Clamp(volume, 0, 1));
      }
    });
  }

  update(time: number, delta: number) {
    // Audio-related updates if needed (e.g., positional audio based on entity positions)
  }

  shutdown() {
    console.log("AudioManager: shutdown");
    // Stop all sounds managed by this instance and remove listeners
    this.sounds.forEach((sound) => {
      if (sound.isPlaying) {
        sound.stop();
      }
      // Optionally destroy the sound instance if scene is fully restarting
      // sound.destroy();
    });
    this.sounds.clear(); // Clear the map

    this.eventEmitter.off("playAudio", this.playSound, this);
    this.eventEmitter.off("stopAudio", this.stopSound, this);
    this.eventEmitter.off("stopAllAudio", this.stopAllSounds, this);
    this.eventEmitter.off("setMusicVolume", this.setMusicVolume, this);
    this.eventEmitter.off("setSfxVolume", this.setSfxVolume, this);

    // Consider if `this.scene.sound.removeAll()` is appropriate, but be careful
    // as it affects sounds potentially managed by other scenes/systems.
  }
}
