import type { Achievement } from '@/data/achievements';
import { achievements } from '@/data/achievements';

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
  achievements: Achievement[];
  gameHistory: { levelId: string; completed: boolean; stars: number }[];
};

const defaultProgress: GameProgress = {
  levels: {},
  totalStars: 0,
  soundEnabled: true,
  musicEnabled: true,
  achievements: achievements.map(a => ({ ...a, unlocked: false, progress: 0 })),
  gameHistory: []
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
        const saved = JSON.parse(data);
        return {
          ...defaultProgress,
          ...saved,
          achievements: this.mergeAchievements(saved.achievements || [])
        };
      }
    } catch (e) {
      console.error('Failed to load progress:', e);
    }
    return { ...defaultProgress };
  }

  private static mergeAchievements(savedAchievements: Achievement[]): Achievement[] {
    return achievements.map(achievement => {
      const saved = savedAchievements.find(a => a.id === achievement.id);
      return {
        ...achievement,
        unlocked: saved?.unlocked || false,
        progress: saved?.progress || 0
      };
    });
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

  static saveAchievements(achievements: Achievement[]): void {
    const progress = this.loadProgress();
    progress.achievements = achievements;
    this.saveProgress(progress);
  }

  static getAchievements(): Achievement[] {
    const progress = this.loadProgress();
    return progress.achievements;
  }

  static addGameHistory(levelId: string, completed: boolean, stars: number): void {
    const progress = this.loadProgress();
    progress.gameHistory.push({ levelId, completed, stars });
    if (progress.gameHistory.length > 50) {
      progress.gameHistory = progress.gameHistory.slice(-50);
    }
    this.saveProgress(progress);
  }

  static getGameHistory(): { levelId: string; completed: boolean; stars: number }[] {
    const progress = this.loadProgress();
    return progress.gameHistory;
  }

  static resetProgress(): void {
    this.saveProgress({ ...defaultProgress });
  }
}
