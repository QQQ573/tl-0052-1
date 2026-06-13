import Phaser from 'phaser';
import { achievementManager } from '@/game/AchievementManager';
import { achievements, type Achievement } from '@/data/achievements';
import { GraphicsUtils } from '@/utils/GraphicsUtils';

export class AchievementScene extends Phaser.Scene {
  private scrollOffset: number = 0;
  private badgeCards: Phaser.GameObjects.Container[] = [];
  private scrollContainer!: Phaser.GameObjects.Container;
  private isDragging: boolean = false;
  private dragStartY: number = 0;
  private dragStartOffset: number = 0;

  constructor() {
    super('AchievementScene');
  }

  create(): void {
    const width = this.scale.width;
    const height = this.scale.height;

    this.add.rectangle(width / 2, height / 2, width, height, 0x1a1a2e);

    achievementManager.clearNewUnlocks();

    this.add.text(width / 2, 40, '🏆 成就里程碑墙', {
      fontSize: '36px',
      fontStyle: 'bold',
      color: '#FFD700'
    }).setOrigin(0.5);

    const unlockedCount = achievementManager.getUnlockedCount();
    const totalCount = achievementManager.getTotalCount();
    this.add.text(width / 2, 85, `已解锁 ${unlockedCount} / ${totalCount}`, {
      fontSize: '18px',
      color: '#aaaaaa'
    }).setOrigin(0.5);

    this.createBadgeGrid();

    const backBtn = this.add.text(width / 2, height - 50, '返回菜单', {
      fontSize: '22px',
      fontStyle: 'bold',
      color: '#ffffff',
      backgroundColor: '#333333',
      padding: { left: 30, right: 30, top: 12, bottom: 12 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    backBtn.on('pointerover', () => backBtn.setScale(1.05));
    backBtn.on('pointerout', () => backBtn.setScale(1));
    backBtn.on('pointerdown', () => {
      this.scene.start('MenuScene');
    });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.y < height - 100 && pointer.y > 110) {
        this.startDrag(pointer.y);
      }
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.isDragging) {
        this.updateDrag(pointer.y);
      }
    });

    this.input.on('pointerup', () => {
      this.endDrag();
    });
  }

  private startDrag(y: number): void {
    this.isDragging = true;
    this.dragStartY = y;
    this.dragStartOffset = this.scrollOffset;
  }

  private updateDrag(y: number): void {
    const deltaY = this.dragStartY - y;
    this.scrollOffset = Math.max(0, this.dragStartOffset + deltaY);
    this.updateScrollPosition();
  }

  private endDrag(): void {
    this.isDragging = false;
  }

  private createBadgeGrid(): void {
    const width = this.scale.width;
    const height = this.scale.height;

    this.scrollContainer = this.add.container(0, 0);

    const cardWidth = 140;
    const cardHeight = 160;
    const spacingX = 20;
    const spacingY = 20;
    const cols = 4;
    const startX = (width - (cols * cardWidth + (cols - 1) * spacingX)) / 2 + cardWidth / 2;
    const startY = 150;

    const userAchievements = achievementManager.getAchievements();

    achievements.forEach((achievement: Achievement, index: number) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = startX + col * (cardWidth + spacingX);
      const y = startY + row * (cardHeight + spacingY);

      const userAchievement = userAchievements.find(a => a.id === achievement.id);
      const isUnlocked = userAchievement?.unlocked || false;

      const card = this.createBadgeCard(achievement, x, y, cardWidth, cardHeight, isUnlocked);
      this.badgeCards.push(card);
      this.scrollContainer.add(card);
    });

    const totalRows = Math.ceil(achievements.length / cols);
    const totalHeight = totalRows * (cardHeight + spacingY);
    const maxScroll = Math.max(0, totalHeight - (height - 200));
    this.scrollOffset = Math.min(this.scrollOffset, maxScroll);
  }

  private createBadgeCard(
    achievement: Achievement,
    x: number,
    y: number,
    width: number,
    height: number,
    isUnlocked: boolean
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    const bg = this.add.graphics();
    const bgColor = isUnlocked ? parseInt(achievement.bgColor.replace('#', ''), 16) : 0x2C2C2C;
    const borderColor = isUnlocked ? parseInt(achievement.color.replace('#', ''), 16) : 0x444444;

    GraphicsUtils.drawRoundedRect(
      bg,
      -width / 2,
      -height / 2,
      width,
      height,
      12,
      bgColor,
      0.9,
      borderColor,
      1,
      isUnlocked ? 3 : 1
    );
    container.add(bg);

    const iconSize = isUnlocked ? 50 : 40;

    const iconBg = this.add.graphics();
    iconBg.fillStyle(isUnlocked ? parseInt(achievement.color.replace('#', ''), 16) : 0x444444, 0.3);
    iconBg.fillCircle(0, -25, iconSize / 2 + 8);
    container.add(iconBg);

    const icon = this.add.text(0, -25, isUnlocked ? achievement.icon : '🔒', {
      fontSize: `${iconSize}px`
    }).setOrigin(0.5);
    container.add(icon);

    const nameColor = isUnlocked ? '#ffffff' : '#666666';
    const name = this.add.text(0, 25, achievement.name, {
      fontSize: '13px',
      fontStyle: 'bold',
      color: nameColor,
      align: 'center',
      wordWrap: { width: width - 16 }
    }).setOrigin(0.5);
    container.add(name);

    const descColor = isUnlocked ? '#aaaaaa' : '#555555';
    const desc = this.add.text(0, 50, achievement.description, {
      fontSize: '10px',
      color: descColor,
      align: 'center',
      wordWrap: { width: width - 12 }
    }).setOrigin(0.5);
    container.add(desc);

    if (isUnlocked) {
      const glow = this.add.graphics();
      glow.lineStyle(2, parseInt(achievement.color.replace('#', ''), 16), 0.5);
      glow.strokeCircle(0, -25, iconSize / 2 + 12);
      container.add(glow);

      this.tweens.add({
        targets: glow,
        alpha: 0.3,
        duration: 1000,
        yoyo: true,
        repeat: -1
      });
    }

    return container;
  }

  private updateScrollPosition(): void {
    if (this.scrollContainer) {
      this.scrollContainer.y = -this.scrollOffset;
    }
  }
}
