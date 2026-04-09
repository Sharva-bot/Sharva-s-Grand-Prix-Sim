
export type Point = {
  world: { x: number; y: number; z: number };
  camera: { x: number; y: number; z: number };
  screen: { x: number; y: number; w: number; scale: number };
};

export class RenderUtils {
  static project(
    p: Point,
    cameraX: number,
    cameraY: number,
    cameraZ: number,
    cameraDepth: number,
    width: number,
    height: number,
    roadWidth: number
  ) {
    p.camera.x = (p.world.x || 0) - cameraX;
    p.camera.y = (p.world.y || 0) - cameraY;
    // p.camera.z = (p.world.z || 0) - cameraZ; // Don't overwrite, Z is pre-calculated for looping
    p.screen.scale = cameraDepth / p.camera.z;
    p.screen.x = Math.round((width / 2) + (p.screen.scale * p.camera.x * width / 2));
    p.screen.y = Math.round((height / 2) - (p.screen.scale * p.camera.y * height / 2));
    p.screen.w = Math.round((p.screen.scale * roadWidth * width / 2));
  }

  static drawPolygon(
    ctx: CanvasRenderingContext2D,
    x1: number, y1: number,
    x2: number, y2: number,
    x3: number, y3: number,
    x4: number, y4: number,
    color: string
  ) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x3, y3);
    ctx.lineTo(x4, y4);
    ctx.closePath();
    ctx.fill();
  }

  static drawSegment(
    ctx: CanvasRenderingContext2D,
    width: number,
    lanes: number,
    x1: number, y1: number, w1: number,
    x2: number, y2: number, w2: number,
    fog: number,
    color: { road: string; grass: string; rumble: string; lane: string }
  ) {
    const r1 = w1 / Math.max(6, 2 * lanes);
    const r2 = w2 / Math.max(6, 2 * lanes);
    const l1 = w1 / Math.max(6, 2 * lanes);
    const l2 = w2 / Math.max(6, 2 * lanes);

    ctx.fillStyle = color.grass;
    ctx.fillRect(0, y2, width, y1 - y2);

    RenderUtils.drawPolygon(ctx, x1 - w1 - r1, y1, x1 - w1, y1, x2 - w2, y2, x2 - w2 - r2, y2, color.rumble);
    RenderUtils.drawPolygon(ctx, x1 + w1 + r1, y1, x1 + w1, y1, x2 + w2, y2, x2 + w2 + r2, y2, color.rumble);
    RenderUtils.drawPolygon(ctx, x1 - w1, y1, x1 + w1, y1, x2 + w2, y2, x2 - w2, y2, color.road);

    if (color.lane) {
      const lanew1 = w1 * 2 / lanes;
      const lanew2 = w2 * 2 / lanes;
      let lanex1 = x1 - w1 + lanew1;
      let lanex2 = x2 - w2 + lanew2;
      for (let i = 1; i < lanes; i++) {
        RenderUtils.drawPolygon(ctx, lanex1 - l1 / 2, y1, lanex1 + l1 / 2, y1, lanex2 + l2 / 2, y2, lanex2 - l2 / 2, y2, color.lane);
        lanex1 += lanew1;
        lanex2 += lanew2;
      }
    }
    
    // Simple Fog
    if (fog > 0) {
       ctx.globalAlpha = fog;
       ctx.fillStyle = '#3b82f6'; // Match Sky color
       ctx.fillRect(0, y2, width, y1 - y2);
       ctx.globalAlpha = 1;
    }
  }

  static drawPitCrew(ctx: CanvasRenderingContext2D, width: number, height: number, timer: number) {
      const maxTime = 3000;
      const progress = 1 - (timer / maxTime); // 0 to 1
      
      // Phases
      // 0.0 - 0.2: Approach
      // 0.2 - 0.8: Work
      // 0.8 - 1.0: Leave
      
      let phase = 'work';
      let animOffset = 0;
      
      if (progress < 0.2) {
          phase = 'approach';
          animOffset = (1 - (progress / 0.2)) * 200; // Slide in from 200px away
      } else if (progress > 0.8) {
          phase = 'leave';
          animOffset = ((progress - 0.8) / 0.2) * 200; // Slide out to 200px away
      }

      // Overlay
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height * 0.85; // Car base position
      
      // Draw Crew Member Helper
      const drawCrew = (x: number, y: number, color: string, action: string) => {
          ctx.save();
          ctx.translate(x, y);
          
          // Shadow
          ctx.fillStyle = 'rgba(0,0,0,0.5)';
          ctx.beginPath();
          ctx.ellipse(0, 0, 20, 10, 0, 0, Math.PI * 2);
          ctx.fill();

          // Body
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(0, -25, 15, 0, Math.PI * 2); // Head
          ctx.fill();
          ctx.fillRect(-12, -20, 24, 25); // Torso

          // Arms / Action
          ctx.strokeStyle = color;
          ctx.lineWidth = 5;
          ctx.beginPath();
          if (action === 'tire') {
              // Working on tire
              if (phase === 'work') {
                  const workAnim = Math.sin(Date.now() / 50) * 5;
                  ctx.moveTo(-10, -15);
                  ctx.lineTo(0 + workAnim, 5);
                  ctx.moveTo(10, -15);
                  ctx.lineTo(0 + workAnim, 5);
              } else {
                  // Carrying tire
                  ctx.moveTo(-10, -15);
                  ctx.lineTo(-15, 0);
                  ctx.moveTo(10, -15);
                  ctx.lineTo(15, 0);
              }
          } else if (action === 'fuel') {
               // Holding hose
               ctx.moveTo(-10, -15);
               ctx.lineTo(-20, 0);
               ctx.moveTo(10, -15);
               ctx.lineTo(20, 0);
               
               // Hose
               if (phase === 'work') {
                   ctx.strokeStyle = '#fbbf24'; // Yellow hose
                   ctx.lineWidth = 8;
                   ctx.beginPath();
                   ctx.moveTo(20, 0);
                   ctx.lineTo(40, 10); // Connect to car
                   ctx.stroke();
               }
          }
          ctx.stroke();

          ctx.restore();
      };

      // Positions relative to car center (cx, cy)
      // Front Left
      drawCrew(cx - 120 - animOffset, cy - 20, '#ef4444', 'tire');
      // Front Right
      drawCrew(cx + 120 + animOffset, cy - 20, '#ef4444', 'tire');
      // Rear Left
      drawCrew(cx - 140 - animOffset, cy + 40, '#ef4444', 'tire');
      // Rear Right
      drawCrew(cx + 140 + animOffset, cy + 40, '#ef4444', 'tire');
      
      // Refueler (Right side)
      drawCrew(cx + 80 + animOffset, cy - 80, '#3b82f6', 'fuel');
      
      // Jackman (Front)
      drawCrew(cx, cy - 100 - animOffset, '#10b981', 'jack');

      // Status Text
      ctx.fillStyle = 'white';
      ctx.font = 'bold italic 40px monospace';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'black';
      ctx.shadowBlur = 10;
      
      let statusText = "PIT STOP";
      if (phase === 'approach') statusText = "CREW READY";
      if (phase === 'work') statusText = "WORKING...";
      if (phase === 'leave') statusText = "GO! GO! GO!";
      
      ctx.fillText(statusText, width/2, height/2 - 100);
      ctx.shadowBlur = 0;
  }
}
