import Phaser from 'phaser';
import { StorageManager } from '@/game/StorageManager';
import { AudioManager } from '@/game/AudioManager';
import { achievementManager } from '@/game/AchievementManager';
import { GraphicsUtils } from '@/utils/GraphicsUtils';
import type { LevelResult } from '@/types/game';
import { getItemById, type Level } from '@/data/levels';
import type { Achievement } from '@/data/achievements';

export class ResultScene extends Phaser.Scene {
  private result!: LevelResult;
  private audioManager!: AudioManager;
  private newlyUnlocked: Achievement[] = [];

  constructor() {
    super('ResultScene');
  }

  init(data: { result: LevelResult }): void {
    this.result = data.result;
  }

  preload(): void {
    this.audioManager = new AudioManager(this);
    this.audioManager.preload();
  }

  create(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const level = this.result.level as Level;

    this.add.rectangle(width / 2, height / 2, width, height, parseInt(level.bgColor.replace('#', ''), 16));

    StorageManager.updateLevelProgress(
      level.id,
      this.result.stars,
      this.result.totalScore,
      this.result.totalTime
    );

    StorageManager.addGameHistory(level.id, this.result.completed, this.result.stars);

    if (this.result.completed) {
      const unlocked = achievementManager.checkAndUpdate({
        levelResult: this.result,
        orderResults: this.result.orderResults,
        totalStars: StorageManager.getTotalStars()
      });
      this.newlyUnlocked = unlocked;
    }

    const headerY = 50;
    const titleText = this.result.completed ? '关卡完成!' : '时间到!';
    this.add.text(width / 2, headerY, titleText, {
      fontSize: '42px',
      fontStyle: 'bold',
      color: level.primaryColor
    }).setOrigin(0.5);

    this.add.text(width / 2, headerY + 50, level.name, {
      fontSize: '22px',
      color: '#cccccc'
    }).setOrigin(0.5);

    GraphicsUtils.drawStars(this, width / 2, headerY + 100, this.result.stars, 3, 40);

    const statsY = headerY + 160;
    const statsLeft = width / 2 - 180;
    const statsRight = width / 2 + 180;

    this.drawStatCard(statsLeft, statsY, '总得分', `${this.result.totalScore}`, level.primaryColor);
    this.drawStatCard(statsRight, statsY, '品质分', `${this.result.qualityScore}/100`, this.result.qualityScore >= 70 ? '#2ECC71' : '#E74C3C');
    this.drawStatCard(statsLeft, statsY + 100, '完成订单', `${this.result.ordersCompleted}/${level.totalOrders}`, '#ffffff');
    this.drawStatCard(statsRight, statsY + 100, '平均组装', `${this.result.avgAssemblyTime.toFixed(1)}s`, '#F39C12');

    const errorRankY = statsY + 230;
    this.add.text(width / 2, errorRankY, '最易错步骤排行', {
      fontSize: '22px',
      fontStyle: 'bold',
      color: '#ffffff'
    }).setOrigin(0.5);

    const sortedErrors = Object.entries(this.result.errorStepCounts)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 5);

    if (sortedErrors.length === 0) {
      this.add.text(width / 2, errorRankY + 40, '完美操作，零失误!', {
        fontSize: '18px',
        color: '#2ECC71'
      }).setOrigin(0.5);
    } else {
      sortedErrors.forEach(([key, count], index) => {
        const parts = key.split('_before_');
        const expectedId = parts[0];
        const actualId = parts[1] || '';
        const expectedItem = getItemById(level, expectedId);
        const actualItem = getItemById(level, actualId);

        const expectedName = expectedItem ? expectedItem.name : expectedId;
        const actualName = actualItem ? actualItem.name : actualId;

        const rankY = errorRankY + 40 + index * 32;
        const rankText = `${index + 1}. 应放「${expectedName}」却放了「${actualName}」 x${count}`;
        this.add.text(width / 2, rankY, rankText, {
          fontSize: '15px',
          color: index === 0 ? '#E74C3C' : index === 1 ? '#F39C12' : '#aaaaaa'
        }).setOrigin(0.5);
      });
    }

    if (this.newlyUnlocked.length > 0) {
      this.showAchievementUnlock();
    }

    const errorKeys = Object.keys(this.result.errorStepCounts);
    const hasWeakSteps = this.result.completed && errorKeys.length > 0;

    let btnY = height - 80;

    if (hasWeakSteps) {
      const weakSteps = this.extractWeakSteps(errorKeys);
      
      const sandboxBtn = this.createButton(width / 2, btnY, '🎯 弱项复训', '#E74C3C', '#ffffff');
      sandboxBtn.on('pointerdown', () => {
        this.audioManager.playClick();
        this.scene.start('SandboxScene', { level, weakSteps });
      });

      btnY += 55;
    }

    const retryBtn = this.createButton(width / 2 - 130, btnY, '再玩一次', level.primaryColor, level.secondaryColor);
    retryBtn.on('pointerdown', () => {
      this.audioManager.playClick();
      this.scene.start('GameScene', { levelId: level.id });
    });

    const menuBtn = this.createButton(width / 2 + 130, btnY, '返回菜单', '#333333', '#ffffff');
    menuBtn.on('pointerdown', () => {
      this.audioManager.playClick();
      this.scene.start('MenuScene');
    });

    this.audioManager.playComplete();
  }

  private extractWeakSteps(errorKeys: string[]): string[] {
    const stepCounts: Record<string, number> = {};

    errorKeys.forEach(key => {
      const parts = key.split('_before_');
      const expectedId = parts[0];
      stepCounts[expectedId] = (stepCounts[expectedId] || 0) + this.result.errorStepCounts[key];
    });

    return Object.entries(stepCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([id]) => id);
  }

  private showAchievementUnlock(): void {
    const width = this.scale.width;
    const achievement = this.newlyUnlocked[0];

    if (!achievement) return;

    const popupY = 180;

    const popupBg = this.add.graphics();
    GraphicsUtils.drawRoundedRect(
      popupBg,
      width / 2 - 200,
      popupY - 50,
      400,
      100,
      16,
      0x2a2a3e,
      0.95,
      parseInt(achievement.color.replace('#', ''), 16),
      1,
      3
    );

    const iconBg = this.add.graphics();
    GraphicsUtils.drawRoundedRect(
      iconBg,
      width / 2 - 180,
      popupY - 35,
      70,
      70,
      12,
      parseInt(achievement.color.replace('#', ''), 16),
      1
    );

    const icon = this.add.text(width / 2 - 145, popupY, achievement.icon, {
      fontSize: '36px'
    }).setOrigin(0.5);

    const title = this.add.text(width / 2 - 90, popupY - 25, '🎉 成就解锁!', {
      fontSize: '16px',
      fontStyle: 'bold',
      color: '#FFD700'
    }).setOrigin(0, 0.5);

    const name = this.add.text(width / 2 - 90, popupY, achievement.name, {
      fontSize: '20px',
      fontStyle: 'bold',
      color: '#ffffff'
    }).setOrigin(0, 0.5);

    const desc = this.add.text(width / 2 - 90, popupY + 25, achievement.description, {
      fontSize: '13px',
      color: '#aaaaaa'
    }).setOrigin(0, 0.5);

    this.tweens.add({
      targets: [popupBg, iconBg, icon, title, name, desc],
      alpha: { from: 0, to: 1 },
      y: { from: popupY - 20, to: popupY },
      duration: 500,
      ease: 'Back.out'
    });

    this.tweens.add({
      targets: icon,
      scale: { from: 0.5, to: 1.2 },
      duration: 300,
      yoyo: true,
      delay: 500
    });

    this.audioManager.playComplete();
  }

  private drawStatCard(x: number, y: number, label: string, value: string, valueColor: string): void {
    const cardW = 160;
    const cardH = 70;

    const bg = this.add.graphics();
    GraphicsUtils.drawRoundedRect(bg, x - cardW / 2, y - cardH / 2, cardW, cardH, 12, 0x222222, 0.8);

    this.add.text(x, y - 12, label, {
      fontSize: '13px',
      color: '#888888'
    }).setOrigin(0.5);

    this.add.text(x, y + 16, value, {
      fontSize: '22px',
      fontStyle: 'bold',
      color: valueColor
    }).setOrigin(0.5);
  }

  private createButton(x: number, y: number, text: string, bgColor: string, textColor: string): Phaser.GameObjects.Text {
    const bg = this.add.graphics();
    GraphicsUtils.drawRoundedRect(
      bg,
      x - 90,
      y - 22,
      180,
      44,
      10,
      parseInt(bgColor.replace('#', ''), 16),
      1
    );

    const btn = this.add.text(x, y, text, {
      fontSize: '20px',
      fontStyle: 'bold',
      color: textColor
    }).setOrigin(0.5).setInteractive();

    btn.on('pointerover', () => btn.setScale(1.05));
    btn.on('pointerout', () => btn.setScale(1));

    return btn;
  }
}
