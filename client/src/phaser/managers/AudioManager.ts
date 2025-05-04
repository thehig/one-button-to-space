import Phaser from "phaser";
import { CommunicationManager } from "./CommunicationManager";

interface SoundConfig {
  key: string;
  path: string;
  volume?: number;
  loop?: boolean;
}

export default class AudioManager {
  private scene: Phaser.Scene;
  private eventEmitter: Phaser.Events.EventEmitter;
  private communicationManager: CommunicationManager;
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

  constructor(
    scene: Phaser.Scene,
    eventEmitter: Phaser.Events.EventEmitter,
    communicationManager: CommunicationManager
  ) {
    this.scene = scene;
    this.eventEmitter = eventEmitter;
    this.communicationManager = communicationManager;
    this.sounds = new Map();
    this.communicationManager.logEvent("AudioManager", "constructor");
  }

  preload() {
    this.communicationManager.logEvent("AudioManager", "preloadStart");
    // Preload audio assets defined in configs
    // this.soundConfigs.forEach((config) => {
    //   this.communicationManager.logEvent("AudioManager", "loadingSoundAsset", {
    //     key: config.key,
    //     path: config.path,
    //   });
    //   // Check if the asset is already loaded by another scene/manager if necessary
    //   if (!this.scene.load.isLoading()) {
    //     this.scene.load.audio(config.key, config.path);
    //   }
    // });
    this.communicationManager.logEvent("AudioManager", "preloadComplete");
  }

  init() {
    this.communicationManager.logEvent("AudioManager", "initStart");
    this.setupEventListeners();
    this.communicationManager.logEvent("AudioManager", "initComplete");
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
    this.communicationManager.logEvent("AudioManager", "createStart");
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
    //     this.communicationManager.logEvent(
    //       "AudioManager",
    //       "soundAssetNotFoundWarning",
    //       { key: config.key }
    //     );
    //   }
    // });

    // Optionally, play background music immediately
    // this.playSound("background_music");
    this.communicationManager.logEvent("AudioManager", "createComplete");
  }

  playSound(key: string) {
    const sound = this.sounds.get(key);
    if (sound && !sound.isPlaying) {
      this.communicationManager.logEvent("AudioManager", "playingSound", {
        key,
      });
      sound.play();
    } else if (!sound) {
      this.communicationManager.logEvent(
        "AudioManager",
        "soundNotFoundWarning",
        {
          key,
        }
      );
    } else {
      // Optionally handle cases where sound is already playing (e.g., restart or ignore)
      this.communicationManager.logEvent(
        "AudioManager",
        "soundAlreadyPlaying",
        { key }
      );
    }
  }

  stopSound(key: string) {
    const sound = this.sounds.get(key);
    if (sound && sound.isPlaying) {
      this.communicationManager.logEvent("AudioManager", "stoppingSound", {
        key,
      });
      sound.stop();
    }
  }

  stopAllSounds() {
    this.communicationManager.logEvent("AudioManager", "stoppingAllSounds");
    this.scene.sound.stopAll();
    // Note: stopAll() stops everything, including potentially sounds not managed here.
    // A more granular approach might iterate through `this.sounds`:
    // this.sounds.forEach(sound => sound.stop());
  }

  setMusicVolume(volume: number) {
    const clampedVolume = Phaser.Math.Clamp(volume, 0, 1);
    this.communicationManager.logEvent("AudioManager", "settingMusicVolume", {
      volume: clampedVolume,
    });
    const music = this.sounds.get("background_music"); // Assuming 'background_music' key
    if (music) {
      music.setVolume(clampedVolume);
    }
  }

  setSfxVolume(volume: number) {
    const clampedVolume = Phaser.Math.Clamp(volume, 0, 1);
    this.communicationManager.logEvent("AudioManager", "settingSfxVolume", {
      volume: clampedVolume,
    });
    this.sounds.forEach((sound, key) => {
      // Assuming sounds other than 'background_music' are SFX
      if (key !== "background_music") {
        sound.setVolume(clampedVolume);
      }
    });
  }

  update(time: number, delta: number) {
    // Audio-related updates if needed (e.g., positional audio based on entity positions)
  }

  shutdown() {
    this.communicationManager.logEvent("AudioManager", "shutdownStart");
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
    this.communicationManager.logEvent("AudioManager", "shutdownComplete");
  }
}
