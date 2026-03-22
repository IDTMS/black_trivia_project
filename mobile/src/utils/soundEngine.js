import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';

const STORAGE_KEY = 'blackcard_audio_muted';
const MUSIC_VOLUME = 0.4;
const SFX_VOLUME = 0.8;
const FADE_INTERVAL_MS = 50;

const ASSETS = {
  ambient: require('../../assets/sounds/ambient-title.wav'),
  cursor: require('../../assets/sounds/cursor.wav'),
  confirm: require('../../assets/sounds/confirm.wav'),
  correct: require('../../assets/sounds/correct.wav'),
  wrong: require('../../assets/sounds/wrong.wav'),
  victory: require('../../assets/sounds/victory.wav'),
  defeat: require('../../assets/sounds/defeat.wav'),
};

let isReady = false;
let muted = false;
let ambientSound = null;
let ambientVolume = 0;
let fadeTimer = null;
let initPromise = null;
const soundCache = new Map();
const muteListeners = new Set();

const notifyMuteListeners = () => {
  muteListeners.forEach((listener) => {
    try {
      listener(muted);
    } catch {
      // ignore listener failures
    }
  });
};

const clearFadeTimer = () => {
  if (fadeTimer) {
    clearInterval(fadeTimer);
    fadeTimer = null;
  }
};

const fadeAmbientTo = async (targetVolume, duration = 700, shouldStop = false) => {
  if (!ambientSound) return;

  clearFadeTimer();

  const startVolume = ambientVolume;
  const steps = Math.max(1, Math.floor(duration / FADE_INTERVAL_MS));
  let currentStep = 0;

  fadeTimer = setInterval(async () => {
    currentStep += 1;
    const progress = Math.min(1, currentStep / steps);
    ambientVolume = startVolume + (targetVolume - startVolume) * progress;

    try {
      await ambientSound.setVolumeAsync(ambientVolume);
      if (progress >= 1) {
        clearFadeTimer();
        if (shouldStop && targetVolume <= 0.001) {
          await ambientSound.stopAsync();
        }
      }
    } catch {
      clearFadeTimer();
    }
  }, FADE_INTERVAL_MS);
};

const ensureAudioMode = async () => {
  if (isReady) return;

  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    shouldDuckAndroid: true,
  });

  const storedMute = await AsyncStorage.getItem(STORAGE_KEY);
  muted = storedMute === 'true';
  isReady = true;
  notifyMuteListeners();
};

export const initializeSoundEngine = async () => {
  if (initPromise) return initPromise;

  initPromise = ensureAudioMode();
  return initPromise;
};

const loadSound = async (key) => {
  await initializeSoundEngine();

  if (key === 'ambient') {
    if (ambientSound) return ambientSound;
    const { sound } = await Audio.Sound.createAsync(ASSETS.ambient, {
      isLooping: true,
      volume: 0,
      shouldPlay: false,
    });
    ambientSound = sound;
    ambientVolume = 0;
    return ambientSound;
  }

  if (soundCache.has(key)) {
    return soundCache.get(key);
  }

  const { sound } = await Audio.Sound.createAsync(ASSETS[key], {
    volume: muted ? 0 : SFX_VOLUME,
    shouldPlay: false,
  });
  soundCache.set(key, sound);
  return sound;
};

const playSfx = async (key) => {
  await initializeSoundEngine();
  if (muted) return;

  const sound = await loadSound(key);
  try {
    await sound.stopAsync();
  } catch {
    // noop
  }
  await sound.setPositionAsync(0);
  await sound.setVolumeAsync(SFX_VOLUME);
  await sound.playAsync();
};

export const playAmbient = async ({ fadeInMs = 900 } = {}) => {
  await initializeSoundEngine();
  const sound = await loadSound('ambient');
  clearFadeTimer();

  if (muted) {
    ambientVolume = 0;
    await sound.setVolumeAsync(0);
    return;
  }

  const status = await sound.getStatusAsync();
  if (!status.isLoaded) return;

  if (!status.isPlaying) {
    ambientVolume = 0;
    await sound.setVolumeAsync(0);
    await sound.playAsync();
  }

  await fadeAmbientTo(MUSIC_VOLUME, fadeInMs);
};

export const fadeOutAmbient = async (duration = 700, shouldStop = true) => {
  if (!ambientSound) return;
  await fadeAmbientTo(0, duration, shouldStop);
};

export const stopAmbient = async () => {
  clearFadeTimer();
  if (!ambientSound) return;
  ambientVolume = 0;
  try {
    await ambientSound.stopAsync();
    await ambientSound.setPositionAsync(0);
  } catch {
    // noop
  }
};

export const subscribeMute = (listener) => {
  muteListeners.add(listener);
  listener(muted);
  return () => muteListeners.delete(listener);
};

export const isMuted = () => muted;

export const setMuted = async (nextMuted) => {
  await initializeSoundEngine();
  muted = nextMuted;
  await AsyncStorage.setItem(STORAGE_KEY, String(nextMuted));

  if (ambientSound) {
    try {
      if (nextMuted) {
        ambientVolume = 0;
        await ambientSound.setVolumeAsync(0);
      } else {
        await ambientSound.setVolumeAsync(MUSIC_VOLUME);
        ambientVolume = MUSIC_VOLUME;
      }
    } catch {
      // noop
    }
  }

  const updates = [...soundCache.values()].map((sound) =>
    sound.setVolumeAsync(nextMuted ? 0 : SFX_VOLUME).catch(() => {})
  );
  await Promise.all(updates);
  notifyMuteListeners();
  return muted;
};

export const toggleMute = async () => setMuted(!muted);

export const unloadSounds = async () => {
  clearFadeTimer();
  const unloaders = [];

  if (ambientSound) {
    unloaders.push(ambientSound.unloadAsync().catch(() => {}));
    ambientSound = null;
  }

  soundCache.forEach((sound) => {
    unloaders.push(sound.unloadAsync().catch(() => {}));
  });
  soundCache.clear();

  await Promise.all(unloaders);
};

export const playCursor = async () => playSfx('cursor');
export const playConfirm = async () => playSfx('confirm');
export const playCorrect = async () => playSfx('correct');
export const playWrong = async () => playSfx('wrong');
export const playVictory = async () => playSfx('victory');
export const playDefeat = async () => playSfx('defeat');
