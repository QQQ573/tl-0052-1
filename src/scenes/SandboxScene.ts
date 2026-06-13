import Phaser from 'phaser';
import { getItemById, type Level, type Item } from '@/data/levels';
import { AudioManager } from '@/game/AudioManager';
import { GraphicsUtils } from '@/utils/GraphicsUtils';
import type { DraggedItem } from '@/types/game';

interface SandboxOrder {
  id: string;
  steps: string[];
  requiredItems: string[];
}

export class SandboxScene extends Phaser.Scene {
  private level!: Level;
  private audioManager!: AudioManager;
  private draggedItem: DraggedItem | null = null;
  private conveyorItems: Phaser.GameObjects.Container[] = [];
  private placedItemSprites: Phaser.GameObjects.Container[] = [];
  private packingZone!: Phaser.GameObjects.Zone;
  private packingZoneX: number = 0;
  private packingZoneY: number = 0;
  private packingZoneWidth: number = 300;
  private packingZoneHeight: number = 350;
  private conveyorSpeed: number = 1.5;
  private currentOrderIndex: number = 0;
  private orders: SandboxOrder[] = [];
  private currentStepIndex: number = 0;
  private hitCount: number = 0;
  private totalAttempts: number = 0;
  private consecutivePerfectOrders: number = 0;
  private weakSteps: string[] = [];
  private weakStepHitRate: Record<string, { hit: number; total: number }> = {};

  constructor() {
    super('SandboxScene');
  }

  init(data: { level: Level; weakSteps: string[] }) {
    this.level = data.level;
    this.weakSteps = data.weakSteps;
    this.generateSandboxOrders();
  }

  preload(): void {
    this.audioManager = new AudioManager(this);
    this.audioManager.preload();
  }

  create(): void {
    const width = this.scale.width;
    const height = this.scale.height;

    this.add.rectangle(width / 2, height / 2, width, height, parseInt(this.level.bgColor.replace('#', ''), 16));

    const headerBar = this.add.graphics();
    GraphicsUtils.drawRoundedRect(headerBar, 0, 0, width, 80, 0, 0x000000, 0.7);

    this.add.text(width / 2, 40, '🎯 弱项纠错沙盒', {
      fontSize: '32px',
      fontStyle: 'bold',
      color: '#FFD700'
    }).setOrigin(0.5);

    const weakStepNames = this.weakSteps.map(stepId => {
      const item = getItemById(this.level, stepId);
      return item?.name || stepId;
    });

    this.add.text(width / 2, 85, `弱项: ${weakStepNames.join(' / ')}`, {
      fontSize: '16px',
      color: '#FF6B6B'
    }).setOrigin(0.5);

    this.createPackingZone();
    this.createConveyorBelt();
    this.createStatsPanel();
    this.startNextOrder();

    const exitBtn = this.add.text(50, 40, '⏹ 退出', {
      fontSize: '18px',
      color: '#ffffff'
    }).setOrigin(0, 0.5).setInteractive();

    exitBtn.on('pointerdown', () => {
      this.audioManager.playClick();
      this.scene.start('MenuScene');
    });

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => this.onPointerUp(pointer));
  }

  private generateSandboxOrders(): void {
    this.orders = [];

    for (let i = 0; i < 5; i++) {
      const orderSteps: string[] = [];
      const requiredItems: string[] = [];

      const shuffledWeak = [...this.weakSteps].sort(() => Math.random() - 0.5);
      const stepsCount = Phaser.Math.Between(3, 5);

      for (let j = 0; j < stepsCount; j++) {
        if (j < shuffledWeak.length && Math.random() > 0.3) {
          orderSteps.push(shuffledWeak[j]);
        } else {
          const allItems = this.level.items.filter(item => !this.weakSteps.includes(item.id));
          if (allItems.length > 0) {
            const randomItem = Phaser.Utils.Array.GetRandom(allItems);
            orderSteps.push(randomItem.id);
          }
        }
      }

      orderSteps.forEach(step => {
        if (!requiredItems.includes(step)) {
          requiredItems.push(step);
        }
      });

      this.orders.push({
        id: `sandbox_order_${i}`,
        steps: orderSteps,
        requiredItems
      });
    }
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

    this.add.text(this.packingZoneX, this.packingZoneY - this.packingZoneHeight / 2 + 25, '📋 复训区', {
      fontSize: '22px',
      fontStyle: 'bold',
      color: this.level.primaryColor
    }).setOrigin(0.5);
  }

  private createConveyorBelt(): void {
    const width = this.scale.width;
    const height = this.scale.height;

    const conveyorY = height - 150;
    const conveyorBelt = this.add.tileSprite(width / 2, conveyorY + 20, width, 40, '__WHITE');
    conveyorBelt.setTint(0x4a4a4a);

    const conveyorBorder = this.add.graphics();
    conveyorBorder.lineStyle(4, 0x333333);
    conveyorBorder.strokeRect(0, conveyorY, width, 80);

    this.add.text(30, conveyorY + 40, '📦 传送带', {
      fontSize: '18px',
      color: '#cccccc'
    }).setOrigin(0, 0.5);
  }

  private createStatsPanel(): void {
    const statsBg = this.add.graphics();
    GraphicsUtils.drawRoundedRect(statsBg, 30, 120, 200, 100, 8, 0x222222, 0.8);

    this.add.text(130, 140, `订单: ${this.currentOrderIndex + 1}/${this.orders.length}`, {
      fontSize: '16px',
      color: '#ffffff'
    }).setOrigin(0.5);

    this.add.text(130, 170, `命中率: ${this.getHitRate()}%`, {
      fontSize: '16px',
      color: '#2ECC71'
    }).setOrigin(0.5);

    this.add.text(130, 200, `连续完美: ${this.consecutivePerfectOrders}`, {
      fontSize: '14px',
      color: '#FFD700'
    }).setOrigin(0.5);
  }

  private getHitRate(): number {
    if (this.totalAttempts === 0) return 0;
    return Math.round((this.hitCount / this.totalAttempts) * 100);
  }

  private startNextOrder(): void {
    if (this.currentOrderIndex >= this.orders.length) {
      this.completeSandbox();
      return;
    }

    this.clearPlacedItems();
    this.clearConveyorItems();

    const order = this.orders[this.currentOrderIndex];
    this.currentStepIndex = 0;

    this.add.text(this.scale.width / 2, 120, `订单 ${this.currentOrderIndex + 1}: ${order.steps.length} 步`, {
      fontSize: '18px',
      color: '#ffffff'
    }).setOrigin(0.5).setName('orderInfo');

    this.spawnConveyorItems(order);
    this.updateStats();
  }

  private spawnConveyorItems(order: SandboxOrder): void {
    const height = this.scale.height;
    const conveyorY = height - 150;
    const itemSize = 60;

    const availableItems: Item[] = [];

    order.requiredItems.forEach(itemId => {
      const item = getItemById(this.level, itemId);
      if (item) availableItems.push(item);
    });

    if (Math.random() < 0.2) {
      const distractors = this.level.distractors.filter(d => !order.requiredItems.includes(d.id));
      if (distractors.length > 0) {
        const randomDistractor = Phaser.Utils.Array.GetRandom(distractors);
        availableItems.push(randomDistractor);
      }
    }

    Phaser.Utils.Array.Shuffle(availableItems);

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
    if (!this.draggedItem) return;

    const container = this.draggedItem.sprite;

    if (this.isInPackingZone(this.input.activePointer.x, this.input.activePointer.y)) {
      this.totalAttempts++;
      const order = this.orders[this.currentOrderIndex];
      const expectedItemId = order.steps[this.currentStepIndex];
      const isWeakStep = this.weakSteps.includes(expectedItemId);

      if (this.draggedItem.itemId === expectedItemId) {
        this.hitCount++;
        if (isWeakStep) {
          if (!this.weakStepHitRate[expectedItemId]) {
            this.weakStepHitRate[expectedItemId] = { hit: 0, total: 0 };
          }
          this.weakStepHitRate[expectedItemId].hit++;
          this.weakStepHitRate[expectedItemId].total++;
        }

        this.audioManager.playCorrect();
        this.addPlacedItem(this.draggedItem.item, this.currentStepIndex);

        const itemIndex = this.conveyorItems.indexOf(this.draggedItem.sprite);
        if (itemIndex > -1) {
          this.conveyorItems.splice(itemIndex, 1);
          this.draggedItem.sprite.destroy();
        }

        this.currentStepIndex++;

        if (this.currentStepIndex >= order.steps.length) {
          this.consecutivePerfectOrders++;
          this.onOrderComplete();
        }
      } else {
        if (isWeakStep) {
          if (!this.weakStepHitRate[expectedItemId]) {
            this.weakStepHitRate[expectedItemId] = { hit: 0, total: 0 };
          }
          this.weakStepHitRate[expectedItemId].total++;
        }

        this.consecutivePerfectOrders = 0;
        this.audioManager.playWrong();
        this.returnItemToConveyor();

        this.cameras.main.shake(100, 0.01);
      }
    } else {
      this.returnItemToConveyor();
    }

    container.setScale(1);
    container.setDepth(0);
    this.draggedItem = null;

    this.updateStats();
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

  private addPlacedItem(item: Item, stepIndex: number): void {
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
      default:
        graphics.fillCircle(0, 0, halfSize);
        graphics.strokeCircle(0, 0, halfSize);
    }

    return graphics;
  }

  private onOrderComplete(): void {
    this.audioManager.playComplete();
    this.children.getByName('orderInfo')?.destroy();

    if (this.consecutivePerfectOrders >= 2) {
      this.showMasteryMessage();
      return;
    }

    this.time.delayedCall(800, () => {
      this.currentOrderIndex++;
      this.startNextOrder();
    });
  }

  private showMasteryMessage(): void {
    const width = this.scale.width;
    const height = this.scale.height;

    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.9);

    this.add.text(width / 2, height / 2 - 40, '🎉 弱项已掌握!', {
      fontSize: '42px',
      fontStyle: 'bold',
      color: '#FFD700'
    }).setOrigin(0.5);

    this.add.text(width / 2, height / 2 + 10, '连续两轮零失误，太棒了!', {
      fontSize: '20px',
      color: '#ffffff'
    }).setOrigin(0.5);

    const btn = this.add.text(width / 2, height / 2 + 70, '返回菜单', {
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

  private completeSandbox(): void {
    const width = this.scale.width;
    const height = this.scale.height;

    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.9);

    this.add.text(width / 2, height / 2 - 80, '🏁 复训完成', {
      fontSize: '36px',
      fontStyle: 'bold',
      color: '#2ECC71'
    }).setOrigin(0.5);

    const overallHitRate = this.getHitRate();
    this.add.text(width / 2, height / 2 - 30, `整体命中率: ${overallHitRate}%`, {
      fontSize: '22px',
      color: '#ffffff'
    }).setOrigin(0.5);

    const weakStats: string[] = [];
    this.weakSteps.forEach(stepId => {
      const item = getItemById(this.level, stepId);
      const stats = this.weakStepHitRate[stepId];
      if (stats) {
        const rate = Math.round((stats.hit / stats.total) * 100);
        weakStats.push(`${item?.name || stepId}: ${rate}%`);
      }
    });

    if (weakStats.length > 0) {
      this.add.text(width / 2, height / 2 + 10, '弱项命中率:', {
        fontSize: '16px',
        color: '#FF6B6B'
      }).setOrigin(0.5);

      weakStats.forEach((stat, index) => {
        this.add.text(width / 2, height / 2 + 40 + index * 25, stat, {
          fontSize: '14px',
          color: '#cccccc'
        }).setOrigin(0.5);
      });
    }

    const btn = this.add.text(width / 2, height / 2 + 120 + weakStats.length * 25, '返回菜单', {
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

    this.audioManager.playComplete();
  }

  private clearPlacedItems(): void {
    this.placedItemSprites.forEach(sprite => sprite.destroy());
    this.placedItemSprites = [];
  }

  private clearConveyorItems(): void {
    this.conveyorItems.forEach(item => item.destroy());
    this.conveyorItems = [];
  }

  private updateStats(): void {
    this.createStatsPanel();
  }

  update(_time: number, _delta: number): void {
    this.conveyorItems.forEach(container => {
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
    }
  }
}
