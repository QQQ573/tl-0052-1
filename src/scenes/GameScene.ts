import Phaser from 'phaser';
import { getLevelById, getItemById, type Level, type Order, type Item } from '@/data/levels';
import { GameStateManager } from '@/game/GameStateManager';
import { AudioManager } from '@/game/AudioManager';
import { GraphicsUtils } from '@/utils/GraphicsUtils';
import type { LevelResult, DraggedItem } from '@/types/game';

export class GameScene extends Phaser.Scene {
  private level!: Level;
  private gameState!: GameStateManager;
  private audioManager!: AudioManager;
  private draggedItem: DraggedItem | null = null;
  private conveyorItems: Phaser.GameObjects.Container[] = [];
  private placedItemSprites: Phaser.GameObjects.Container[] = [];
  private orderTickerText!: Phaser.GameObjects.Text;
  private orderTickerContainer!: Phaser.GameObjects.Container;
  private timeText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private qualityText!: Phaser.GameObjects.Text;
  private progressText!: Phaser.GameObjects.Text;
  private packingZone!: Phaser.GameObjects.Zone;
  private stepIndicator!: Phaser.GameObjects.Group;
  private conveyorBelt!: Phaser.GameObjects.TileSprite;
  private packingZoneX: number = 0;
  private packingZoneY: number = 0;
  private packingZoneWidth: number = 300;
  private packingZoneHeight: number = 350;
  private conveyorSpeed: number = 1.5;
  private tickerOffset: number = 0;
  private isPaused: boolean = false;

  constructor() {
    super('GameScene');
  }

  init(data: { levelId: string }): void {
    const level = getLevelById(data.levelId);
    if (!level) {
      this.scene.start('MenuScene');
      return;
    }
    this.level = level;
  }

  preload(): void {
    this.audioManager = new AudioManager(this);
    this.audioManager.preload();
  }

  create(): void {
    const width = this.scale.width;
    const height = this.scale.height;

    this.add.rectangle(width / 2, height / 2, width, height, parseInt(this.level.bgColor.replace('#', ''), 16));

    this.gameState = new GameStateManager(this.level);
    this.setupEventListeners();
    this.createUI();
    this.createConveyorBelt();
    this.createPackingZone();
    this.createStepIndicator();

    this.gameState.startLevel();
    this.audioManager.playBGM(1);

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => this.onPointerUp(pointer));

    this.input.keyboard?.on('keydown-ESC', () => this.togglePause());
  }

  private setupEventListeners(): void {
    this.gameState.on('order-start', (order: Order) => this.onOrderStart(order));
    this.gameState.on('correct-placement', (_itemId: string, stepIndex: number) => this.onCorrectPlacement(stepIndex));
    this.gameState.on('wrong-placement', (_itemId: string, _expected: string, _stepIndex: number) => this.onWrongPlacement());
    this.gameState.on('order-complete', () => this.onOrderComplete());
    this.gameState.on('order-remake', () => this.onOrderRemake());
    this.gameState.on('time-warning', () => this.onTimeWarning());
    this.gameState.on('level-complete', (result: LevelResult) => this.onLevelComplete(result));
    this.gameState.on('game-over', () => this.onGameOver());
  }

  private createUI(): void {
    const width = this.scale.width;

    const headerBar = this.add.graphics();
    GraphicsUtils.drawRoundedRect(headerBar, 0, 0, width, 100, 0, 0x000000, 0.7);

    this.timeText = this.add.text(30, 50, '时间: 5:00', {
      fontSize: '24px',
      fontStyle: 'bold',
      color: '#ffffff'
    }).setOrigin(0, 0.5);

    this.scoreText = this.add.text(width / 2, 35, `订单: 0/${this.level.totalOrders}`, {
      fontSize: '20px',
      color: '#ffffff'
    }).setOrigin(0.5);

    this.qualityText = this.add.text(width / 2, 65, '品质: 100', {
      fontSize: '18px',
      color: '#2ECC71'
    }).setOrigin(0.5);

    this.progressText = this.add.text(width - 30, 50, '', {
      fontSize: '16px',
      color: '#FFD700'
    }).setOrigin(1, 0.5);

    const pauseBtn = this.add.text(width - 100, 50, '⏸', {
      fontSize: '28px'
    }).setOrigin(0.5).setInteractive();

    pauseBtn.on('pointerdown', () => {
      this.audioManager.playClick();
      this.togglePause();
    });

    const muteBtn = this.add.text(width - 160, 50, this.audioManager.isMutedSound() ? '🔇' : '🔊', {
      fontSize: '28px'
    }).setOrigin(0.5).setInteractive();

    muteBtn.on('pointerdown', () => {
      const enabled = this.audioManager.toggleMute();
      muteBtn.setText(enabled ? '🔊' : '🔇');
      this.audioManager.playClick();
    });

    this.createOrderTicker();
  }

  private createOrderTicker(): void {
    const width = this.scale.width;
    const tickerWidth = width - 300;
    const tickerY = 120;

    this.orderTickerContainer = this.add.container(width / 2, tickerY);

    const tickerBg = this.add.graphics();
    GraphicsUtils.drawRoundedRect(tickerBg, -tickerWidth / 2, -25, tickerWidth, 50, 8, parseInt(this.level.primaryColor.replace('#', ''), 16), 0.9);
    this.orderTickerContainer.add(tickerBg);

    const maskShape = this.make.graphics();
    maskShape.beginPath();
    maskShape.fillRect(width / 2 - tickerWidth / 2 + 10, tickerY - 20, tickerWidth - 20, 40);
    const mask = maskShape.createGeometryMask();

    this.orderTickerText = this.add.text(width / 2, tickerY, '', {
      fontSize: '24px',
      fontStyle: 'bold',
      color: this.level.secondaryColor
    }).setOrigin(0, 0.5);
    this.orderTickerText.setMask(mask);
  }

  private createConveyorBelt(): void {
    const width = this.scale.width;
    const height = this.scale.height;

    const conveyorY = height - 150;
    this.conveyorBelt = this.add.tileSprite(width / 2, conveyorY + 20, width, 40, '__WHITE');
    this.conveyorBelt.setTint(0x4a4a4a);

    const conveyorBorder = this.add.graphics();
    conveyorBorder.lineStyle(4, 0x333333);
    conveyorBorder.strokeRect(0, conveyorY, width, 80);

    this.add.text(30, conveyorY + 40, '📦 传送带', {
      fontSize: '18px',
      color: '#cccccc'
    }).setOrigin(0, 0.5);
  }

  private createPackingZone(): void {
    const width = this.scale.width;
    const height = this.scale.height;

    this.packingZoneX = width - 180;
    this.packingZoneY = height / 2 + 30;

    const zoneBg = this.add.graphics();
    GraphicsUtils.drawRoundedRect(
      zoneBg,
      this.packingZoneX - this.packingZoneWidth / 2,
      this.packingZoneY - this.packingZoneHeight / 2,
      this.packingZoneWidth,
      this.packingZoneHeight,
      16,
      parseInt(this.level.primaryColor.replace('#', ''), 16),
      0.15,
      parseInt(this.level.primaryColor.replace('#', ''), 16),
      0.6,
      3
    );

    this.packingZone = this.add.zone(this.packingZoneX, this.packingZoneY, this.packingZoneWidth, this.packingZoneHeight).setInteractive();

    this.add.text(this.packingZoneX, this.packingZoneY - this.packingZoneHeight / 2 + 25, '📋 包装区', {
      fontSize: '22px',
      fontStyle: 'bold',
      color: this.level.primaryColor
    }).setOrigin(0.5);

    this.add.text(this.packingZoneX, this.packingZoneY - this.packingZoneHeight / 2 + 55, '拖入食材按顺序组装', {
      fontSize: '13px',
      color: '#aaaaaa'
    }).setOrigin(0.5);
  }

  private createStepIndicator(): void {
    this.stepIndicator = this.add.group();
  }

  private updateStepIndicator(order: Order, currentStep: number): void {
    this.stepIndicator.clear(true);
    const stepY = this.packingZoneY - this.packingZoneHeight / 2 - 60;
    const stepSpacing = 45;
    const maxVisibleSteps = 7;
    const startIndex = Math.max(0, currentStep - 3);
    const visibleSteps = order.steps.slice(startIndex, startIndex + maxVisibleSteps);

    visibleSteps.forEach((stepId: string, index: number) => {
      const actualStepIndex = startIndex + index;
      const isCompleted = actualStepIndex < currentStep;
      const isCurrent = actualStepIndex === currentStep;
      const item = getItemById(this.level, stepId);

      const stepX = this.packingZoneX - (visibleSteps.length * stepSpacing) / 2 + index * stepSpacing;

      const stepBg = this.add.graphics();
      const alpha = isCompleted ? 0.4 : (isCurrent ? 1 : 0.7);
      GraphicsUtils.drawRoundedRect(
        stepBg,
        -18,
        -18,
        36,
        36,
        8,
        item ? parseInt(item.color.replace('#', ''), 16) : 0x666666,
        alpha
      );
      stepBg.x = stepX;
      stepBg.y = stepY;
      this.stepIndicator.add(stepBg);

      if (isCompleted) {
        const check = this.add.text(stepX, stepY, '✓', {
          fontSize: '18px',
          color: '#ffffff'
        }).setOrigin(0.5);
        this.stepIndicator.add(check);
      } else if (isCurrent) {
        const arrow = this.add.text(stepX, stepY - 30, '▼', {
          fontSize: '14px',
          color: this.level.primaryColor
        }).setOrigin(0.5);
        this.stepIndicator.add(arrow);
      }

      if (item && !isCompleted) {
        const label = this.add.text(stepX, stepY + 28, item.name, {
          fontSize: '10px',
          color: isCurrent ? '#ffffff' : '#888888'
        }).setOrigin(0.5);
        this.stepIndicator.add(label);
      }
    });
  }

  private onOrderStart(order: Order): void {
    this.clearPlacedItemsImmediate();
    this.updateOrderTicker(order);
    this.updateStepIndicator(order, 0);
    this.spawnConveyorItems(order);
  }

  private updateOrderTicker(order: Order): void {
    const width = this.scale.width;
    const tickerText = `📌 当前订单: ${order.name}  |  步骤: ${order.steps.length}项`;
    this.orderTickerText.setText(tickerText);
    this.orderTickerText.x = width / 2 - 100;
    this.tickerOffset = 0;
  }

  private spawnConveyorItems(order: Order): void {
    this.conveyorItems.forEach(item => item.destroy());
    this.conveyorItems = [];

    const availableItems: Item[] = [];

    order.steps.forEach((itemId: string) => {
      const item = getItemById(this.level, itemId);
      if (item) availableItems.push(item);
    });

    this.level.distractors.forEach(item => {
      if (Math.random() > 0.5) availableItems.push(item);
    });

    Phaser.Utils.Array.Shuffle(availableItems);

    const height = this.scale.height;
    const conveyorY = height - 150;
    const itemSize = 60;

    availableItems.forEach((item, index) => {
      const startX = -100 - index * (itemSize + 80);
      const y = conveyorY + 40 + (index % 2 === 0 ? 0 : -30);

      const container = GraphicsUtils.createItemContainer(this, item, startX, y, itemSize, true);
      container.setData('itemId', item.id);
      container.setData('item', item);

      const hitZone = container.getData('hitZone') as Phaser.GameObjects.Zone | undefined;
      hitZone?.on('pointerdown', () => {
        this.onItemDragStart(container);
      });

      this.conveyorItems.push(container);
    });
  }

  private onItemDragStart(container: Phaser.GameObjects.Container): void {
    if (this.isPaused || this.gameState.getState() !== 'playing') return;

    const itemId = container.getData('itemId') as string;
    const item = container.getData('item') as Item;

    this.draggedItem = {
      id: Phaser.Utils.String.UUID(),
      itemId,
      item,
      sprite: container,
      originalX: container.x,
      originalY: container.y
    };

    container.setDepth(1000);
    container.setScale(1.2);
    this.audioManager.playClick();
  }

  private onPointerUp(_pointer: Phaser.Input.Pointer): void {
    if (!this.draggedItem || this.isPaused) return;

    const container = this.draggedItem.sprite;
    let placeResult: 'correct' | 'wrong' | 'remake' = 'wrong';

    if (this.isInPackingZone(this.input.activePointer.x, this.input.activePointer.y)) {
      placeResult = this.gameState.placeItem(this.draggedItem.itemId, this.draggedItem.item);

      if (placeResult === 'correct') {
        this.audioManager.playCorrect();
      } else if (placeResult === 'wrong') {
        this.audioManager.playWrong();
        this.returnItemToConveyor();
      } else if (placeResult === 'remake') {
        this.audioManager.playWrong();
      }
    } else {
      this.returnItemToConveyor();
    }

    if (placeResult !== 'correct') {
      container.setScale(1);
      container.setDepth(0);
    }

    this.draggedItem = null;
  }

  private isInPackingZone(x: number, y: number): boolean {
    const bounds = this.packingZone.getBounds();
    return bounds.contains(x, y);
  }

  private returnItemToConveyor(): void {
    if (!this.draggedItem) return;

    this.tweens.add({
      targets: this.draggedItem.sprite,
      x: this.draggedItem.originalX,
      y: this.draggedItem.originalY,
      scale: 1,
      duration: 200,
      ease: 'Power2'
    });
  }

  private onCorrectPlacement(stepIndex: number): void {
    if (!this.draggedItem) return;

    const order = this.gameState.getCurrentOrder();
    if (!order) return;

    this.addPlacedItem(this.draggedItem.item, stepIndex, order.steps.length);

    const itemIndex = this.conveyorItems.indexOf(this.draggedItem.sprite);
    if (itemIndex > -1) {
      this.conveyorItems.splice(itemIndex, 1);
      this.draggedItem.sprite.destroy();
    }

    this.updateStepIndicator(order, stepIndex + 1);
    this.updateUI();
  }

  private addPlacedItem(item: Item, stepIndex: number, totalSteps: number): void {
    const itemSize = 45;
    const stackSpacing = 18;
    const baseY = this.packingZoneY + this.packingZoneHeight / 2 - 60;
    const yOffset = -(stepIndex * stackSpacing);

    const container = this.add.container(this.packingZoneX, baseY + yOffset);

    const shape = this.createStackedItemShape(item, itemSize);
    container.add(shape);

    container.setAlpha(0);
    container.setScale(0.3);

    this.tweens.add({
      targets: container,
      alpha: 1,
      scale: 1,
      duration: 250,
      ease: 'Back.out'
    });

    this.placedItemSprites.push(container);
  }

  private createStackedItemShape(item: Item, size: number): Phaser.GameObjects.Graphics {
    const graphics = this.add.graphics();
    const halfSize = size / 2;

    graphics.fillStyle(parseInt(item.color.replace('#', ''), 16), 1);
    graphics.lineStyle(2, 0x000000, 0.4);

    switch (item.shape) {
      case 'circle':
        graphics.fillCircle(0, 0, halfSize);
        graphics.strokeCircle(0, 0, halfSize);
        break;
      case 'square':
        graphics.fillRect(-halfSize * 0.9, -halfSize * 0.3, size * 0.9, size * 0.35);
        graphics.strokeRect(-halfSize * 0.9, -halfSize * 0.3, size * 0.9, size * 0.35);
        break;
      case 'half-circle':
        graphics.slice(0, 0, halfSize, Math.PI, 0, false);
        graphics.fillPath();
        graphics.strokePath();
        break;
      case 'rectangle':
        graphics.fillRect(-halfSize, -halfSize * 0.15, size, size * 0.3);
        graphics.strokeRect(-halfSize, -halfSize * 0.15, size, size * 0.3);
        break;
      case 'leaf':
        graphics.fillEllipse(0, 0, size * 0.7, size * 0.3);
        graphics.strokeEllipse(0, 0, size * 0.7, size * 0.3);
        break;
      case 'slice':
        graphics.fillEllipse(0, 0, size * 0.9, size * 0.2);
        graphics.strokeEllipse(0, 0, size * 0.9, size * 0.2);
        break;
      case 'ring':
        graphics.beginPath();
        graphics.arc(0, 0, halfSize * 0.4, 0, Math.PI * 2, false);
        graphics.fillPath();
        graphics.strokePath();
        break;
      case 'splash':
        graphics.fillEllipse(0, 0, size * 0.8, size * 0.25);
        graphics.strokeEllipse(0, 0, size * 0.8, size * 0.25);
        break;
      case 'strip':
        graphics.fillRect(-halfSize * 0.2, -halfSize * 0.4, size * 0.4, size * 0.8);
        graphics.strokeRect(-halfSize * 0.2, -halfSize * 0.4, size * 0.4, size * 0.8);
        break;
      case 'irregular':
        graphics.fillEllipse(0, 0, size * 0.7, size * 0.5);
        graphics.strokeEllipse(0, 0, size * 0.7, size * 0.5);
        break;
      default:
        graphics.fillCircle(0, 0, halfSize);
        graphics.strokeCircle(0, 0, halfSize);
    }

    return graphics;
  }

  private clearPlacedItemsImmediate(): void {
    this.placedItemSprites.forEach(sprite => {
      sprite.destroy();
    });
    this.placedItemSprites = [];
  }

  private clearPlacedItems(): void {
    this.placedItemSprites.forEach(sprite => {
      this.tweens.add({
        targets: sprite,
        alpha: 0,
        scale: 0.5,
        duration: 200,
        onComplete: () => sprite.destroy()
      });
    });
    this.placedItemSprites = [];
  }

  private onWrongPlacement(): void {
    this.cameras.main.shake(200, 0.01);

    const flash = this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0xff0000, 0.2);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 300,
      onComplete: () => flash.destroy()
    });

    this.updateUI();
  }

  private onOrderComplete(): void {
    this.audioManager.playComplete();

    const order = this.gameState.getCurrentOrder();
    if (order) {
      this.orderTickerText.setText(`✅ 完成: ${order.name}!`);
    }

    this.time.delayedCall(800, () => {
      this.clearPlacedItems();
      this.updateUI();
    });
  }

  private onOrderRemake(): void {
    this.cameras.main.flash(500, 255, 200, 0);

    const warning = this.add.text(this.scale.width / 2, this.scale.height / 2, '⚠️ 连续错误3次！重做本单', {
      fontSize: '36px',
      fontStyle: 'bold',
      color: '#FFD700'
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({
      targets: warning,
      alpha: 1,
      duration: 300,
      yoyo: true,
      hold: 800,
      onComplete: () => {
        warning.destroy();
        this.clearPlacedItemsImmediate();
        const order = this.gameState.getCurrentOrder();
        if (order) {
          this.updateStepIndicator(order, 0);
          this.spawnConveyorItems(order);
        }
      }
    });

    this.updateUI();
  }

  private onTimeWarning(): void {
    this.audioManager.playWarning();
    this.audioManager.setBGMSpeed(1.5);
    this.timeText.setColor('#FF6B6B');

    this.tweens.add({
      targets: this.timeText,
      scale: 1.2,
      duration: 200,
      yoyo: true,
      repeat: -1
    });
  }

  private onLevelComplete(result: LevelResult): void {
    this.audioManager.stopBGM();
    this.audioManager.playComplete();
    this.scene.start('ResultScene', { result });
  }

  private onGameOver(): void {
    this.audioManager.stopBGM();
    this.audioManager.playWrong();

    this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0x000000, 0.8);
    this.add.text(this.scale.width / 2, this.scale.height / 2 - 50, '⏰ 时间到！', {
      fontSize: '48px',
      fontStyle: 'bold',
      color: '#FF6B6B'
    }).setOrigin(0.5);

    this.add.text(this.scale.width / 2, this.scale.height / 2 + 20, '别灰心，再试一次！', {
      fontSize: '24px',
      color: '#ffffff'
    }).setOrigin(0.5);

    const btn = this.add.text(this.scale.width / 2, this.scale.height / 2 + 80, '返回菜单', {
      fontSize: '24px',
      fontStyle: 'bold',
      color: this.level.primaryColor,
      backgroundColor: '#ffffff',
      padding: { left: 30, right: 30, top: 10, bottom: 10 }
    }).setOrigin(0.5).setInteractive();

    btn.on('pointerdown', () => {
      this.audioManager.playClick();
      this.scene.start('MenuScene');
    });
  }

  private updateUI(): void {
    const time = GraphicsUtils.formatTime(this.gameState.getTimeRemaining());
    this.timeText.setText(`时间: ${time}`);

    const currentOrder = this.gameState.getCurrentOrderIndex();
    const totalOrders = this.gameState.getTotalOrders();
    this.scoreText.setText(`订单: ${currentOrder}/${totalOrders}`);

    const quality = this.gameState.getQualityScore();
    this.qualityText.setText(`品质: ${quality}`);
    this.qualityText.setColor(quality >= 70 ? '#2ECC71' : quality >= 50 ? '#F39C12' : '#E74C3C');

    const mistakes = this.gameState.getConsecutiveMistakes();
    if (mistakes > 0) {
      this.progressText.setText(`连续错误: ${mistakes}/3`);
      this.progressText.setColor(mistakes >= 2 ? '#E74C3C' : '#F39C12');
    } else {
      this.progressText.setText('');
    }
  }

  private togglePause(): void {
    this.isPaused = !this.isPaused;

    if (this.isPaused) {
      this.gameState.pause();
      this.audioManager.stopBGM();

      const overlay = this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0x000000, 0.8);
      overlay.setName('pauseOverlay');

      this.add.text(this.scale.width / 2, this.scale.height / 2 - 50, '⏸ 已暂停', {
        fontSize: '48px',
        fontStyle: 'bold',
        color: '#ffffff'
      }).setOrigin(0.5).setName('pauseText');

      const resumeBtn = this.add.text(this.scale.width / 2, this.scale.height / 2 + 30, '继续游戏', {
        fontSize: '24px',
        fontStyle: 'bold',
        color: '#ffffff',
        backgroundColor: this.level.primaryColor,
        padding: { left: 30, right: 30, top: 10, bottom: 10 }
      }).setOrigin(0.5).setInteractive().setName('resumeBtn');

      const menuBtn = this.add.text(this.scale.width / 2, this.scale.height / 2 + 90, '返回菜单', {
        fontSize: '20px',
        color: '#aaaaaa'
      }).setOrigin(0.5).setInteractive().setName('menuBtn');

      resumeBtn.on('pointerdown', () => {
        this.audioManager.playClick();
        this.togglePause();
      });

      menuBtn.on('pointerdown', () => {
        this.audioManager.playClick();
        this.audioManager.destroy();
        this.scene.start('MenuScene');
      });
    } else {
      this.gameState.resume();
      this.audioManager.playBGM(this.gameState.getBgmSpeed());

      this.children.getByName('pauseOverlay')?.destroy();
      this.children.getByName('pauseText')?.destroy();
      this.children.getByName('resumeBtn')?.destroy();
      this.children.getByName('menuBtn')?.destroy();
    }
  }

  update(_time: number, delta: number): void {
    if (this.isPaused) return;

    const deltaSeconds = delta / 1000;
    this.gameState.updateTime(deltaSeconds);

    this.conveyorItems.forEach(container => {
      const hitZone = container.getData('hitZone') as Phaser.GameObjects.Zone | undefined;
      if (hitZone) {
        hitZone.setPosition(container.x, container.y);
      }

      if (this.draggedItem && this.draggedItem.sprite === container) return;

      container.x += this.conveyorSpeed;

      if (container.x > this.scale.width + 100) {
        container.x = -100 - Math.random() * 200;
      }
    });

    if (this.draggedItem) {
      const pointer = this.input.activePointer;
      this.draggedItem.sprite.x = pointer.x;
      this.draggedItem.sprite.y = pointer.y;
      const hitZone = this.draggedItem.sprite.getData('hitZone') as Phaser.GameObjects.Zone | undefined;
      hitZone?.setPosition(pointer.x, pointer.y);
    }

    this.tickerOffset += 0.5;
    if (this.tickerOffset > this.orderTickerText.width + 400) {
      this.tickerOffset = 0;
    }
    this.orderTickerText.x = this.scale.width / 2 - this.tickerOffset;

    this.updateUI();
  }
}
