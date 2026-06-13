const STORAGE_KEY = 'fast_food_training_progress';

export type LevelProgress = {
  levelId: string;
  stars: number;
  bestScore: number;
  bestTime: number;
  lastPlayed: number;
};

export type GameProgress = {
  levels: Record<string, LevelProgress>;
  totalStars: number;
  soundEnabled: boolean;
  musicEnabled: boolean;
};

const defaultProgress: GameProgress = {
  levels: {},
  totalStars: 0,
  soundEnabled: true,
  musicEnabled: true
};

export class StorageManager {
  static saveProgress(progress: GameProgress): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch (e) {
      console.error('Failed to save progress:', e);
    }
  }

  static loadProgress(): GameProgress {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        return { ...defaultProgress, ...JSON.parse(data) };
      }
    } catch (e) {
      console.error('Failed to load progress:', e);
    }
    return { ...defaultProgress };
  }

  static updateLevelProgress(levelId: string, stars: number, score: number, time: number): void {
    const progress = this.loadProgress();
    const existing = progress.levels[levelId];

    if (!existing || stars > existing.stars || score > existing.bestScore) {
      progress.levels[levelId] = {
        levelId,
        stars: Math.max(existing?.stars || 0, stars),
        bestScore: Math.max(existing?.bestScore || 0, score),
        bestTime: existing ? Math.min(existing.bestTime, time) : time,
        lastPlayed: Date.now()
      };

      progress.totalStars = Object.values(progress.levels).reduce((sum, l) => sum + l.stars, 0);
      this.saveProgress(progress);
    }
  }

  static getLevelProgress(levelId: string): LevelProgress | undefined {
    const progress = this.loadProgress();
    return progress.levels[levelId];
  }

  static getTotalStars(): number {
    const progress = this.loadProgress();
    return progress.totalStars;
  }

  static setSoundEnabled(enabled: boolean): void {
    const progress = this.loadProgress();
    progress.soundEnabled = enabled;
    this.saveProgress(progress);
  }

  static isSoundEnabled(): boolean {
    return this.loadProgress().soundEnabled;
  }

  static setMusicEnabled(enabled: boolean): void {
    const progress = this.loadProgress();
    progress.musicEnabled = enabled;
    this.saveProgress(progress);
  }

  static isMusicEnabled(): boolean {
    return this.loadProgress().musicEnabled;
  }

  static resetProgress(): void {
    this.saveProgress({ ...defaultProgress });
  }
}
