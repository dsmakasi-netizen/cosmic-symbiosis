export enum AppState {
  DISCONNECTED = 'DISCONNECTED',
  AWAKENING = 'AWAKENING',
  RESONANT = 'RESONANT'
}

export enum GestureType {
  NONE = 'NONE',
  CLOSED_FIST = 'CLOSED_FIST',
  OPEN_PALM = 'OPEN_PALM',
  POINTING = 'POINTING',
  PINCH = 'PINCH'
}

export enum MoonPhase {
  NEW = 0,
  WAXING = 0.25,
  FULL = 0.5,
  WANING = 0.75
}

export enum Season {
  SPRING = 'SPRING',
  SUMMER = 'SUMMER',
  AUTUMN = 'AUTUMN',
  WINTER = 'WINTER'
}

export interface Landmark {
  x: number;
  y: number;
  z: number;
}

export interface ParticleConfig {
  count: number;
  size: number;
  color: string;
  spread: number;
}

export interface ImprintData {
  heartRate: number;
  moonPhase: MoonPhase;
  tideHeight: number;
  resonanceLevel: number;
  timestamp: string;
}