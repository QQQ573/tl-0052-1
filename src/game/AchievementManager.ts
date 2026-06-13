import { StorageManager } from './StorageManager';
import type { Achievement } from '@/data/achievements';
import { achievements, checkAchievements, getNewlyUnlockedAchievements } from '@/data/achievements';

const NEW_UNLOCKS_KEY = 'fast_food_new_achievements';

export class AchievementManager {
  private achievements: Achievement[] = [];

  constructor() {
    this.load();
  }

  private load(): void {
    this.achievements = StorageManager.getAchievements();
  }

  private save(): void {
    StorageManager.saveAchievements(this.achievements);
  }

  getAchievements(): Achievement[] {
    return [...this.achievements];
  }

  getUnlockedCount(): number {
    return this.achievements.filter(a => a.unlocked).length;
  }

  getTotalCount(): number {
    return this.achievements.length;
  }

  checkAndUpdate(data: {
    levelResult?: any;
    orderResults?: any[];
    totalStars?: number;
    completedLevels?: string[];
    gameHistory?: any[];
  }): Achievement[] {
    const previous = [...this.achievements];
    
    const completedLevels = data.completedLevels || 
      Object.keys(StorageManager.loadProgress().levels);
    
    const gameHistoryData = data.gameHistory || 
      StorageManager.getGameHistory().map(h => ({
        level: { id: h.levelId },
        stars: h.stars,
        completed: h.completed
      }));

    const checkData = {
      ...data,
      completedLevels,
      gameHistory: gameHistoryData
    };

    this.achievements = checkAchievements(checkData, this.achievements);
    
    this.achievements = this.achievements.map((ach) => {
      if (ach.id === 'collector') {
        const unlockedCount = this.achievements.filter(a => a.unlocked && a.id !== 'collector').length;
        return {
          ...ach,
          unlocked: unlockedCount >= 11,
          progress: unlockedCount
        };
      }
      return ach;
    });

    const newlyUnlocked = getNewlyUnlockedAchievements(previous, this.achievements);
    
    if (newlyUnlocked.length > 0) {
      this.save();
      this.saveNewUnlocks(newlyUnlocked);
    }

    return newlyUnlocked;
  }

  hasNewUnlocks(): boolean {
    try {
      const data = localStorage.getItem(NEW_UNLOCKS_KEY);
      return data ? JSON.parse(data).length > 0 : false;
    } catch {
      return false;
    }
  }

  getNewUnlocks(): Achievement[] {
    try {
      const data = localStorage.getItem(NEW_UNLOCKS_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  clearNewUnlocks(): void {
    localStorage.removeItem(NEW_UNLOCKS_KEY);
  }

  private saveNewUnlocks(unlocks: Achievement[]): void {
    const existing = this.getNewUnlocks();
    const allUnlocks = [...existing, ...unlocks];
    const unique = allUnlocks.filter((item, index, self) => 
      index === self.findIndex(t => t.id === item.id)
    );
    localStorage.setItem(NEW_UNLOCKS_KEY, JSON.stringify(unique));
  }

  reset(): void {
    this.achievements = achievements.map(a => ({ ...a, unlocked: false, progress: 0 }));
    this.save();
    this.clearNewUnlocks();
  }
}

export const achievementManager = new AchievementManager();
