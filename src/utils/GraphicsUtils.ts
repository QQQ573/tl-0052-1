import Phaser from 'phaser';
import type { Item } from '@/data/levels';

export class GraphicsUtils {
  static createItemShape(
    scene: Phaser.Scene,
    item: Item,
    size: number = 60
  ): Phaser.GameObjects.Graphics {
    const graphics = scene.add.graphics();
    const halfSize = size / 2;

    graphics.fillStyle(parseInt(item.color.replace('#', ''), 16), 1);
    graphics.lineStyle(2, 0x000000, 0.3);

    switch (item.shape) {
      case 'circle':
        graphics.fillCircle(0, 0, halfSize);
        graphics.strokeCircle(0, 0, halfSize);
        break;
      case 'square':
        graphics.fillRect(-halfSize * 0.8, -halfSize * 0.8, size * 0.8, size * 0.8);
        graphics.strokeRect(-halfSize * 0.8, -halfSize * 0.8, size * 0.8, size * 0.8);
        break;
      case 'half-circle':
        graphics.slice(0, 0, halfSize, Math.PI, 0, false);
        graphics.fillPath();
        graphics.strokePath();
        break;
      case 'rectangle':
        graphics.fillRect(-halfSize, -halfSize * 0.5, size, size * 0.5);
        graphics.strokeRect(-halfSize, -halfSize * 0.5, size, size * 0.5);
        break;
      case 'leaf':
        this.drawLeaf(graphics, halfSize);
        break;
      case 'slice':
        this.drawSlice(graphics, halfSize);
        break;
      case 'ring':
        this.drawRing(graphics, halfSize);
        break;
      case 'splash':
        this.drawSplash(graphics, halfSize);
        break;
      case 'strip':
        this.drawStrip(graphics, halfSize);
        break;
      case 'irregular':
        this.drawIrregular(graphics, halfSize);
        break;
      default:
        graphics.fillCircle(0, 0, halfSize);
        graphics.strokeCircle(0, 0, halfSize);
    }

    return graphics;
  }

  private static drawLeaf(graphics: Phaser.GameObjects.Graphics, r: number): void {
    const g = graphics as any;
    g.beginPath();
    g.moveTo(0, -r);
    g.bezierCurveTo(r * 0.8, -r * 0.5, r * 0.8, r * 0.5, 0, r);
    g.bezierCurveTo(-r * 0.8, r * 0.5, -r * 0.8, -r * 0.5, 0, -r);
    g.fillPath();
    g.strokePath();

    graphics.lineStyle(1, 0x000000, 0.2);
    graphics.beginPath();
    graphics.moveTo(0, -r * 0.8);
    graphics.lineTo(0, r * 0.8);
    graphics.strokePath();
  }

  private static drawSlice(graphics: Phaser.GameObjects.Graphics, r: number): void {
    const g = graphics as any;
    g.beginPath();
    g.ellipse(0, 0, r, r * 0.3, 0, 0, Math.PI * 2);
    g.fillPath();
    g.strokePath();
  }

  private static drawRing(graphics: Phaser.GameObjects.Graphics, r: number): void {
    graphics.beginPath();
    graphics.arc(0, 0, r * 0.8, 0, Math.PI * 2, false);
    graphics.arc(0, 0, r * 0.4, 0, Math.PI * 2, true);
    graphics.fillPath();
    graphics.strokePath();
  }

  private static drawSplash(graphics: Phaser.GameObjects.Graphics, r: number): void {
    graphics.beginPath();
    const points = 8;
    for (let i = 0; i <= points; i++) {
      const angle = (i / points) * Math.PI * 2;
      const radius = r * (0.6 + Math.random() * 0.4);
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) {
        graphics.moveTo(x, y);
      } else {
        graphics.lineTo(x, y);
      }
    }
    graphics.closePath();
    graphics.fillPath();
    graphics.strokePath();
  }

  private static drawStrip(graphics: Phaser.GameObjects.Graphics, r: number): void {
    graphics.fillRect(-r * 0.3, -r, r * 0.6, r * 2);
    graphics.strokeRect(-r * 0.3, -r, r * 0.6, r * 2);
  }

  private static drawIrregular(graphics: Phaser.GameObjects.Graphics, r: number): void {
    graphics.beginPath();
    const points = 6;
    for (let i = 0; i < points; i++) {
      const angle = (i / points) * Math.PI * 2;
      const radius = r * (0.7 + Math.sin(angle * 2) * 0.3);
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) {
        graphics.moveTo(x, y);
      } else {
        graphics.lineTo(x, y);
      }
    }
    graphics.closePath();
    graphics.fillPath();
    graphics.strokePath();
  }

  static createItemContainer(
    scene: Phaser.Scene,
    item: Item,
    x: number,
    y: number,
    size: number = 60
  ): Phaser.GameObjects.Container {
    const container = scene.add.container(x, y);
    const shape = this.createItemShape(scene, item, size);
    const label = scene.add.text(0, size / 2 + 5, item.name, {
      fontSize: '12px',
      color: '#ffffff',
      align: 'center'
    }).setOrigin(0.5);

    container.add([shape, label]);
    container.setSize(size, size + 20);
    container.setInteractive(new Phaser.Geom.Rectangle(-size / 2, -size / 2, size, size + 20), Phaser.Geom.Rectangle.Contains);

    return container;
  }

  static formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  static drawRoundedRect(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
    fillColor: number,
    fillAlpha: number = 1,
    strokeColor?: number,
    strokeAlpha: number = 1,
    strokeWidth: number = 0
  ): void {
    graphics.fillStyle(fillColor, fillAlpha);
    if (strokeColor !== undefined) {
      graphics.lineStyle(strokeWidth, strokeColor, strokeAlpha);
    }

    graphics.beginPath();
    graphics.moveTo(x + radius, y);
    graphics.lineTo(x + width - radius, y);
    graphics.arc(x + width - radius, y + radius, radius, -Math.PI / 2, 0, false);
    graphics.lineTo(x + width, y + height - radius);
    graphics.arc(x + width - radius, y + height - radius, radius, 0, Math.PI / 2, false);
    graphics.lineTo(x + radius, y + height);
    graphics.arc(x + radius, y + height - radius, radius, Math.PI / 2, Math.PI, false);
    graphics.lineTo(x, y + radius);
    graphics.arc(x + radius, y + radius, radius, Math.PI, Math.PI * 1.5, false);
    graphics.closePath();
    graphics.fillPath();
    if (strokeColor !== undefined) {
      graphics.strokePath();
    }
  }

  static drawStars(
    scene: Phaser.Scene,
    x: number,
    y: number,
    count: number,
    total: number = 3,
    size: number = 30
  ): Phaser.GameObjects.Group {
    const group = scene.add.group();
    const spacing = size * 1.2;
    const startX = x - ((total - 1) * spacing) / 2;

    for (let i = 0; i < total; i++) {
      const starX = startX + i * spacing;
      const filled = i < count;
      const star = scene.add.text(starX, y, '★', {
        fontSize: `${size}px`,
        color: filled ? '#FFD700' : '#444444'
      }).setOrigin(0.5);
      group.add(star);
    }

    return group;
  }
}
