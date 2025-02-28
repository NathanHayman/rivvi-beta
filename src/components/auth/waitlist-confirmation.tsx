"use client";

import confetti from "canvas-confetti";
import { useEffect } from "react";

const fireWorks = () => {
  const duration = 5 * 1000;
  const animationEnd = Date.now() + duration;
  const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

  const randomInRange = (min: number, max: number) =>
    Math.random() * (max - min) + min;

  const interval = window.setInterval(() => {
    const timeLeft = animationEnd - Date.now();

    if (timeLeft <= 0) {
      return clearInterval(interval);
    }

    const particleCount = 50 * (timeLeft / duration);
    confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
    });
    confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
    });
  }, 250);
};

const sideCannons = () => {
  const end = Date.now() + 3 * 1000; // 3 seconds
  const colors = ["#a786ff", "#fd8bbc", "#eca184", "#f8deb1"];

  const frame = () => {
    if (Date.now() > end) return;

    confetti({
      particleCount: 2,
      angle: 60,
      spread: 55,
      startVelocity: 60,
      origin: { x: 0, y: 0.5 },
      colors: colors,
    });
    confetti({
      particleCount: 2,
      angle: 120,
      spread: 55,
      startVelocity: 60,
      origin: { x: 1, y: 0.5 },
      colors: colors,
    });

    requestAnimationFrame(frame);
  };

  frame();
};

const stars = () => {
  const defaults = {
    spread: 360,
    ticks: 50,
    gravity: 0,
    decay: 0.94,
    startVelocity: 30,
    colors: ["#FFE400", "#FFBD00", "#E89400", "#FFCA6C", "#FDFFB8"],
  };

  const shoot = () => {
    confetti({
      ...defaults,
      particleCount: 40,
      scalar: 1.2,
      shapes: ["star"],
    });

    confetti({
      ...defaults,
      particleCount: 10,
      scalar: 0.75,
      shapes: ["circle"],
    });
  };

  setTimeout(shoot, 0);
  setTimeout(shoot, 100);
  setTimeout(shoot, 200);
};

const customShapes = () => {
  const scalar = 2;
  const triangle = confetti.shapeFromPath({
    path: "M0 10 L5 0 L10 10z",
  });
  const square = confetti.shapeFromPath({
    path: "M0 0 L10 0 L10 10 L0 10 Z",
  });
  const coin = confetti.shapeFromPath({
    path: "M5 0 A5 5 0 1 0 5 10 A5 5 0 1 0 5 0 Z",
  });
  const tree = confetti.shapeFromPath({
    path: "M5 0 L10 10 L0 10 Z",
  });

  const defaults = {
    spread: 360,
    ticks: 60,
    gravity: 0,
    decay: 0.96,
    startVelocity: 20,
    shapes: [triangle, square, coin, tree],
    scalar,
  };

  const shoot = () => {
    confetti({
      ...defaults,
      particleCount: 30,
    });

    confetti({
      ...defaults,
      particleCount: 5,
    });

    confetti({
      ...defaults,
      particleCount: 15,
      scalar: scalar / 2,
      shapes: ["circle"],
    });
  };

  setTimeout(shoot, 0);
  setTimeout(shoot, 100);
  setTimeout(shoot, 200);
};

const emojis = () => {
  const scalar = 2;
  const unicorn = confetti.shapeFromText({ text: "🦄", scalar });

  const defaults = {
    spread: 360,
    ticks: 60,
    gravity: 0,
    decay: 0.96,
    startVelocity: 20,
    shapes: [unicorn],
    scalar,
  };

  const shoot = () => {
    confetti({
      ...defaults,
      particleCount: 30,
    });

    confetti({
      ...defaults,
      particleCount: 5,
    });

    confetti({
      ...defaults,
      particleCount: 15,
      scalar: scalar / 2,
      shapes: ["circle"],
    });
  };

  setTimeout(shoot, 0);
  setTimeout(shoot, 100);
  setTimeout(shoot, 200);
};

type ConfettiType =
  | "fireworks"
  | "side-cannons"
  | "stars"
  | "custom-shapes"
  | "emojis";

interface ConfettiProps {
  type: ConfettiType;
  children: React.ReactNode;
  onMount?: boolean;
  onClick?: boolean;
}

const ConfettiComponent = ({
  type,
  children,
  onMount = true,
  onClick = false,
}: ConfettiProps) => {
  const triggerConfetti = () => {
    switch (type) {
      case "fireworks":
        fireWorks();
        break;
      case "side-cannons":
        sideCannons();
        break;
      case "stars":
        stars();
        break;
      case "custom-shapes":
        customShapes();
        break;
      case "emojis":
        emojis();
        break;
    }
  };

  // Trigger on mount if enabled
  useEffect(() => {
    if (onMount) {
      triggerConfetti();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="relative w-full"
      onClick={onClick ? triggerConfetti : undefined}
    >
      {children}
    </div>
  );
};

export { ConfettiComponent, type ConfettiType };
