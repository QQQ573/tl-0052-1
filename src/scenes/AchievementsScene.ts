import Phaser from 'phaser';
import { StorageManager } from '@/game/StorageManager';
import { AudioManager } from '@/game/AudioManager';
import { GraphicsUtils } from '@/utils/GraphicsUtils';
import type { Achievement } from '@/data/achievements';

export class AchievementsScene extends Phaser.Scene {
  private audioManager!: AudioManager;
  private achievements: Achievement[] = [];
  private achievementCards: Phaser.GameObjects.Container[] = [];
  private scrollY: number = 0;
  private scrollContainer!: Phaser.GameObjects.Container;

  constructor() {
    super('AchievementsScene');
  }

  preload(): void {
    this.audioManager = new AudioManager(this);
    this.audioManager.preload();
  }

  create(): void {
    const width = this.scale.width;
    const height = this.scale.height;

    this.add.rectangle(width / 2, height / 2, width, height, 0x1a1a2e);

    this.add.text(width / 2, 50, '🏆 成就里程碑', {
      fontSize: '42px',
      fontStyle: 'bold',
      color: '#FFD700'
    }).setOrigin(0.5);

    const backBtn = this.add.text(50, 50, '← 返回', {
      fontSize: '22px',
      color: '#ffffff'
    }).setOrigin(0, 0.5).setInteractive();

    backBtn.on('pointerdown', () => {
      this.audioManager.playClick();
      this.scene.start('MenuScene');
    });

    const progress = this.getAchievementProgress();
    this.add.text(width / 2, 100, `已解锁: ${progress.unlocked}/${progress.total}`, {
      fontSize: '18px',
      color: '#2ECC71'
    }).setOrigin(0.5);

    this.achievements = StorageManager.getAchievements();
    this.createAchievementGrid();

    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gameObjects: Phaser.GameObjects.GameObject[], _deltaX: number, deltaY: number) => {
      this.scrollY = Math.max(0, Math.min(this.scrollY - deltaY * 0.5, Math.max(0, this.scrollContainer.height - height + 200)));
      this.scrollContainer.y = -this.scrollY;
    });

    this.input.keyboard?.on('keydown-UP', () => {
      this.scrollY = Math.max(0, this.scrollY - 50);
      this.scrollContainer.y = -this.scrollY;
    });

    this.input.keyboard?.on('keydown-DOWN', () => {
      this.scrollY = Math.min(this.scrollY + 50, Math.max(0, this.scrollContainer.height - height + 200));
      this.scrollContainer.y = -this.scrollY;
    });
  }

  private getAchievementProgress(): { unlocked: number; total: number } {
    const unlocked = this.achievements.filter(a => a.unlocked).length;
    return { unlocked, total: this.achievements.length };
  }

  private createAchievementGrid(): void {
    const width = this.scale.width;
    const padding = 30;
    const cardWidth = (width - padding * 3) / 2;
    const cardHeight = 120;
    const cardSpacing = padding;

    this.scrollContainer = this.add.container(width / 2, 150);

    this.achievements.forEach((achievement, index) => {
      const row = Math.floor(index / 2);
      const col = index % 2;
      const x = col * (cardWidth + cardSpacing) + cardWidth / 2;
      const y = row * (cardHeight + cardSpacing) + cardHeight / 2;

      const card = this.createAchievementCard(achievement, x, y, cardWidth, cardHeight);
      this.scrollContainer.add(card);
      this.achievementCards.push(card);
    });

    this.scrollContainer.setSize(width, this.achievements.length * (cardHeight + cardSpacing) / 2);
  }

  private createAchievementCard(
    achievement: Achievement,
    x: number,
    y: number,
    width: number,
    height: number
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    const bg = this.add.graphics();
    GraphicsUtils.drawRoundedRect(
      bg,
      -width / 2,
      -height / 2,
      width,
      height,
      12,
      achievement.unlocked 
        ? parseInt(achievement.bgColor.replace('#', ''), 16)
        : 0x2a2a2a,
      achievement.unlocked ? 0.9 : 0.5
    );
    container.add(bg);

    if (!achievement.unlocked) {
      const lockBg = this.add.graphics();
      lockBg.fillStyle(0x333333, 0.8);
      lockBg.fillRect(-width / 2, -height / 2, width, height);
      container.add(lockBg);
    }

    const iconSize = 60;
    const iconBg = this.add.graphics();
    GraphicsUtils.drawRoundedRect(
      iconBg,
      -width / 2 + 15 - iconSize / 2,
      -iconSize / 2,
      iconSize,
      iconSize,
      10,
      parseInt(achievement.color.replace('#', ''), 16),
      achievement.unlocked ? 0.3 : 0.1
    );
    container.add(iconBg);

    const iconText = this.add.text(
      -width / 2 + 15,
      0,
      achievement.unlocked ? achievement.icon : '❓',
      {
        fontSize: achievement.unlocked ? '32px' : '24px',
        color: achievement.unlocked ? achievement.color : '#666666'
      }
    ).setOrigin(0.5);
    container.add(iconText);

    const textX = -width / 2 + 15 + iconSize + 15;
    const textWidth = width - iconSize - 60;

    const nameText = this.add.text(textX, -20, achievement.name, {
      fontSize: '18px',
      fontStyle: 'bold',
      color: achievement.unlocked ? achievement.color : '#888888',
      wordWrap: { width: textWidth }
    }).setOrigin(0, 0.5);
    container.add(nameText);

    const descText = this.add.text(textX, 10, achievement.description, {
      fontSize: '13px',
      color: achievement.unlocked ? '#cccccc' : '#555555',
      wordWrap: { width: textWidth }
    }).setOrigin(0, 0.5);
    container.add(descText);

    if (achievement.maxProgress > 1) {
      const progressBarBg = this.add.graphics();
      progressBarBg.fillStyle(0x333333, 0.5);
      progressBarBg.fillRect(textX, 35, textWidth, 6);
      container.add(progressBarBg);

      const progressBar = this.add.graphics();
      progressBar.fillStyle(parseInt(achievement.color.replace('#', ''), 16), 1);
      const progressWidth = (achievement.progress / achievement.maxProgress) * textWidth;
      progressBar.fillRect(textX, 35, Math.max(0, progressWidth), 6);
      container.add(progressBar);

      const progressText = this.add.text(textX + textWidth / 2, 35, `${achievement.progress}/${achievement.maxProgress}`, {
        fontSize: '10px',
        color: '#ffffff'
      }).setOrigin(0.5);
      container.add(progressText);
    }

    return container;
  }
}
