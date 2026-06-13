import type { LevelResult, OrderResult } from '@/types/game';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  bgColor: string;
  unlocked: boolean;
  progress: number;
  maxProgress: number;
  check: (data: AchievementCheckData) => { unlocked: boolean; progress: number };
}

export interface AchievementCheckData {
  levelResult?: LevelResult;
  orderResults?: OrderResult[];
  totalStars?: number;
  completedLevels?: string[];
  gameHistory?: LevelResult[];
}

export const achievements: Achievement[] = [
  {
    id: 'first_three_stars',
    name: '金牌学徒',
    description: '首次获得三星评价',
    icon: '⭐',
    color: '#FFD700',
    bgColor: '#2C2C2C',
    unlocked: false,
    progress: 0,
    maxProgress: 1,
    check: (data) => {
      if (data.levelResult?.stars === 3) {
        return { unlocked: true, progress: 1 };
      }
      return { unlocked: false, progress: data.totalStars === undefined ? 0 : Math.min(1, data.totalStars >= 3 ? 1 : 0) };
    }
  },
  {
    id: 'perfect_run',
    name: '完美执行',
    description: '单局零重做完成关卡',
    icon: '🏆',
    color: '#FF6B6B',
    bgColor: '#2C2C2C',
    unlocked: false,
    progress: 0,
    maxProgress: 1,
    check: (data) => {
      if (!data.levelResult) return { unlocked: false, progress: 0 };
      const remadeOrders = data.levelResult.orderResults.filter(o => o.remade);
      const hasNoRemake = remadeOrders.length === 0 && data.levelResult.completed;
      return { unlocked: hasNoRemake, progress: hasNoRemake ? 1 : 0 };
    }
  },
  {
    id: 'speed_demon',
    name: '快手大师',
    description: '平均组装时间低于15秒',
    icon: '⚡',
    color: '#00CED1',
    bgColor: '#2C2C2C',
    unlocked: false,
    progress: 0,
    maxProgress: 1,
    check: (data) => {
      if (!data.levelResult?.completed) return { unlocked: false, progress: 0 };
      const avgTime = data.levelResult.avgAssemblyTime;
      const unlocked = avgTime < 15;
      return { unlocked, progress: unlocked ? 1 : Math.max(0, (30 - avgTime) / 15) };
    }
  },
  {
    id: 'quality_master',
    name: '品质达人',
    description: '单局品质分达到95分以上',
    icon: '�',
    color: '#9370DB',
    bgColor: '#2C2C2C',
    unlocked: false,
    progress: 0,
    maxProgress: 1,
    check: (data) => {
      if (!data.levelResult) return { unlocked: false, progress: 0 };
      const quality = data.levelResult.qualityScore;
      const unlocked = quality >= 95;
      return { unlocked, progress: unlocked ? 1 : quality / 95 };
    }
  },
  {
    id: 'combo_master',
    name: '连击高手',
    description: '高峰模式连续正确5次',
    icon: '🔥',
    color: '#FF4500',
    bgColor: '#2C2C2C',
    unlocked: false,
    progress: 0,
    maxProgress: 5,
    check: (data) => {
      if (!data.orderResults || data.orderResults.length === 0) return { unlocked: false, progress: 0 };
      
      let maxCombo = 0;
      let currentCombo = 0;
      
      data.orderResults.forEach(order => {
        order.errorSteps.forEach(() => {
          currentCombo = 0;
        });
        if (order.mistakes === 0) {
          currentCombo++;
          maxCombo = Math.max(maxCombo, currentCombo);
        }
      });
      
      return { unlocked: maxCombo >= 5, progress: Math.min(maxCombo, 5) };
    }
  },
  {
    id: 'all_brands',
    name: '全能员工',
    description: '三大品牌全部通关',
    icon: '🌍',
    color: '#32CD32',
    bgColor: '#2C2C2C',
    unlocked: false,
    progress: 0,
    maxProgress: 3,
    check: (data) => {
      const completed = data.completedLevels || [];
      const brands = ['mcdonalds', 'kfc', 'wallace'];
      const completedBrands = brands.filter(b => completed.includes(b));
      return { unlocked: completedBrands.length >= 3, progress: completedBrands.length };
    }
  },
  {
    id: 'triple_crown',
    name: '三冠王',
    description: '三大品牌全部三星通关',
    icon: '�',
    color: '#FFD700',
    bgColor: '#1A1A2E',
    unlocked: false,
    progress: 0,
    maxProgress: 3,
    check: (data) => {
      if (!data.gameHistory) return { unlocked: false, progress: 0 };
      const brands = ['mcdonalds', 'kfc', 'wallace'];
      let starsCount = 0;
      
      brands.forEach(brand => {
        const bestResult = data.gameHistory?.filter(r => r.level.id === brand)
          .reduce((max: number, r: { stars: number }) => Math.max(max, r.stars), 0) || 0;
        if (bestResult >= 3) starsCount++;
      });
      
      return { unlocked: starsCount >= 3, progress: starsCount };
    }
  },
  {
    id: 'no_mistakes',
    name: '零失误',
    description: '单局零错误完成关卡',
    icon: '✨',
    color: '#E0E0E0',
    bgColor: '#2C2C2C',
    unlocked: false,
    progress: 0,
    maxProgress: 1,
    check: (data) => {
      if (!data.levelResult?.completed) return { unlocked: false, progress: 0 };
      const totalErrors = data.levelResult.orderResults.reduce((sum, o) => sum + o.mistakes, 0);
      return { unlocked: totalErrors === 0, progress: totalErrors === 0 ? 1 : 0 };
    }
  },
  {
    id: 'sandbox_expert',
    name: '弱项沙盒',
    description: '在最易错步骤上连续成功5次',
    icon: '�️',
    color: '#87CEEB',
    bgColor: '#2C2C2C',
    unlocked: false,
    progress: 0,
    maxProgress: 5,
    check: (data) => {
      if (!data.levelResult) return { unlocked: false, progress: 0 };
      
      const errorCounts = data.levelResult.errorStepCounts;
      if (Object.keys(errorCounts).length === 0) {
        return { unlocked: true, progress: 5 };
      }
      
      return { unlocked: false, progress: 0 };
    }
  },
  {
    id: 'speed_challenge',
    name: '极速通关',
    description: '3分钟内完成关卡',
    icon: '⏱️',
    color: '#FF69B4',
    bgColor: '#2C2C2C',
    unlocked: false,
    progress: 0,
    maxProgress: 1,
    check: (data) => {
      if (!data.levelResult?.completed) return { unlocked: false, progress: 0 };
      const totalTime = data.levelResult.totalTime;
      const unlocked = totalTime < 180;
      return { unlocked, progress: unlocked ? 1 : Math.max(0, (300 - totalTime) / 120) };
    }
  },
  {
    id: 'streak_master',
    name: '连胜大师',
    description: '连续完成3局游戏',
    icon: '🎯',
    color: '#FF6347',
    bgColor: '#2C2C2C',
    unlocked: false,
    progress: 0,
    maxProgress: 3,
    check: (data) => {
      if (!data.gameHistory) return { unlocked: false, progress: 0 };
      
      let streak = 0;
      for (let i = data.gameHistory.length - 1; i >= 0; i--) {
        if (data.gameHistory[i].completed) {
          streak++;
        } else {
          break;
        }
      }
      
      return { unlocked: streak >= 3, progress: Math.min(streak, 3) };
    }
  },
  {
    id: 'collector',
    name: '成就收藏家',
    description: '解锁所有成就',
    icon: '�',
    color: '#DAA520',
    bgColor: '#1A1A2E',
    unlocked: false,
    progress: 0,
    maxProgress: 12,
    check: () => {
      return { unlocked: false, progress: 0 };
    }
  }
];

export function checkAchievements(data: AchievementCheckData, existingAchievements: Achievement[]): Achievement[] {
  return achievements.map(achievement => {
    const existing = existingAchievements.find(a => a.id === achievement.id);
    const checkResult = achievement.check(data);
    
    let newUnlocked = existing?.unlocked || checkResult.unlocked;
    let newProgress = Math.max(existing?.progress || 0, checkResult.progress);
    
    return {
      ...achievement,
      unlocked: newUnlocked,
      progress: newProgress
    };
  });
}

export function getNewlyUnlockedAchievements(
  previous: Achievement[],
  current: Achievement[]
): Achievement[] {
  return current.filter(curr => {
    const prev = previous.find(p => p.id === curr.id);
    return curr.unlocked && (!prev || !prev.unlocked);
  });
}
