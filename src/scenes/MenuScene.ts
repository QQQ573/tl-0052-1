import Phaser from 'phaser';
import { levels, type Level } from '@/data/levels';
import { StorageManager } from '@/game/StorageManager';
import { AudioManager } from '@/game/AudioManager';
import { GraphicsUtils } from '@/utils/GraphicsUtils';

export class MenuScene extends Phaser.Scene {
  private audioManager!: AudioManager;
  private selectedLevelIndex: number = 0;
  private levelCards: Phaser.GameObjects.Container[] = [];

  constructor() {
    super('MenuScene');
  }

  preload(): void {
    this.audioManager = new AudioManager(this);
    this.audioManager.preload();
  }

  create(): void {
    const width = this.scale.width;
    const height = this.scale.height;

    this.add.rectangle(width / 2, height / 2, width, height, 0x1a1a2e);

    this.add.text(width / 2, 60, '快餐员工培训游戏', {
      fontSize: '48px',
      fontStyle: 'bold',
      color: '#ffffff'
    }).setOrigin(0.5);

    this.add.text(width / 2, 110, '选择关卡开始训练', {
      fontSize: '20px',
      color: '#aaaaaa'
    }).setOrigin(0.5);

    const totalStars = StorageManager.getTotalStars();
    this.add.text(width / 2, 150, `总星级: ${totalStars} / ${levels.length * 3}`, {
      fontSize: '18px',
      color: '#FFD700'
    }).setOrigin(0.5);

    this.createLevelCards();

    const muteBtn = this.add.text(width - 50, 30, this.audioManager.isMutedSound() ? '🔇' : '🔊', {
      fontSize: '28px'
    }).setOrigin(0.5).setInteractive();

    muteBtn.on('pointerdown', () => {
      const enabled = this.audioManager.toggleMute();
      muteBtn.setText(enabled ? '🔊' : '🔇');
      this.audioManager.playClick();
    });

    this.input.keyboard?.on('keydown-LEFT', () => this.navigateLevels(-1));
    this.input.keyboard?.on('keydown-RIGHT', () => this.navigateLevels(1));
    this.input.keyboard?.on('keydown-ENTER', () => this.startSelectedLevel());
  }

  private createLevelCards(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const cardWidth = 280;
    const cardHeight = 320;
    const spacing = 40;
    const totalWidth = levels.length * cardWidth + (levels.length - 1) * spacing;
    const startX = (width - totalWidth) / 2 + cardWidth / 2;
    const cardY = height / 2 + 20;

    levels.forEach((level: Level, index: number) => {
      const x = startX + index * (cardWidth + spacing);
      const card = this.createLevelCard(level, x, cardY, cardWidth, cardHeight, index);
      this.levelCards.push(card);
    });

    this.updateCardSelection();
  }

  private createLevelCard(
    level: Level,
    x: number,
    y: number,
    width: number,
    height: number,
    index: number
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    const bg = this.add.graphics();
    GraphicsUtils.drawRoundedRect(
      bg,
      -width / 2,
      -height / 2,
      width,
      height,
      16,
      parseInt(level.bgColor.replace('#', ''), 16),
      0.8,
      parseInt(level.primaryColor.replace('#', ''), 16),
      1,
      3
    );
    container.add(bg);

    const brandRect = this.add.rectangle(0, -height / 2 + 50, width - 20, 60, parseInt(level.primaryColor.replace('#', ''), 16));
    container.add(brandRect);

    const brandName = this.add.text(0, -height / 2 + 50, level.name, {
      fontSize: '18px',
      fontStyle: 'bold',
      color: level.secondaryColor
    }).setOrigin(0.5);
    container.add(brandName);

    const progress = StorageManager.getLevelProgress(level.id);
    if (progress) {
      GraphicsUtils.drawStars(this, x, y - height / 2 + 110, progress.stars, 3, 24);
      this.add.text(x, y - height / 2 + 150, `最高分: ${progress.bestScore}`, {
        fontSize: '14px',
        color: '#ffffff'
      }).setOrigin(0.5);
    } else {
      this.add.text(x, y - height / 2 + 110, '未通关', {
        fontSize: '16px',
        color: '#888888'
      }).setOrigin(0.5);
    }

    const infoY = y - height / 2 + 190;
    this.add.text(x - width / 2 + 20, infoY, `订单数: ${level.totalOrders}`, {
      fontSize: '14px',
      color: '#cccccc'
    });
    this.add.text(x - width / 2 + 20, infoY + 25, `时限: ${GraphicsUtils.formatTime(level.timeLimit)}`, {
      fontSize: '14px',
      color: '#cccccc'
    });
    this.add.text(x - width / 2 + 20, infoY + 50, `食材数: ${level.items.length}`, {
      fontSize: '14px',
      color: '#cccccc'
    });

    const btnBg = this.add.graphics();
    GraphicsUtils.drawRoundedRect(
      btnBg,
      -80,
      height / 2 - 60,
      160,
      40,
      8,
      parseInt(level.primaryColor.replace('#', ''), 16),
      1
    );
    container.add(btnBg);

    const btnText = this.add.text(0, height / 2 - 40, '开始训练', {
      fontSize: '16px',
      fontStyle: 'bold',
      color: level.secondaryColor
    }).setOrigin(0.5);
    container.add(btnText);

    container.setSize(width, height);

    const hitZone = this.add.zone(x, y, width, height).setInteractive({ useHandCursor: true });
    container.setData('hitZone', hitZone);
    container.on('destroy', () => hitZone.destroy());

    hitZone.on('pointerover', () => {
      this.selectedLevelIndex = index;
      this.updateCardSelection();
    });

    hitZone.on('pointerdown', () => {
      this.selectedLevelIndex = index;
      this.audioManager.playClick();
      this.startSelectedLevel();
    });

    return container;
  }

  private navigateLevels(direction: number): void {
    this.selectedLevelIndex = Phaser.Math.Wrap(this.selectedLevelIndex + direction, 0, levels.length);
    this.updateCardSelection();
    this.audioManager.playClick();
  }

  private updateCardSelection(): void {
    this.levelCards.forEach((card, index) => {
      const isSelected = index === this.selectedLevelIndex;
      const scale = isSelected ? 1.05 : 1;
      const alpha = isSelected ? 1 : 0.7;

      this.tweens.add({
        targets: card,
        scale: scale,
        alpha: alpha,
        duration: 200
      });
    });
  }

  private startSelectedLevel(): void {
    this.audioManager.playClick();
    const level = levels[this.selectedLevelIndex];
    this.scene.start('GameScene', { levelId: level.id });
  }
}
