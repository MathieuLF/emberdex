export type DamageInput = {
  level: number;
  attack: number;
  defense: number;
  power: number;
  stab?: boolean;
  effectiveness?: number;
  critical?: boolean;
  burn?: boolean;
  category?: "physical" | "special";
  weatherMultiplier?: number;
  terrainMultiplier?: number;
  otherMultipliers?: number[];
};

export type DamageResult = {
  min: number;
  max: number;
  average: number;
  baseDamage: number;
  rolls: number[];
  multiplier: number;
  notes: string[];
};

const ROLLS = Array.from({ length: 16 }, (_, index) => 0.85 + index * 0.01);

export function calculateDamage(input: DamageInput): DamageResult {
  const notes: string[] = [];
  const level = Math.max(1, Math.floor(input.level));
  const attack = Math.max(1, Math.floor(input.attack));
  const defense = Math.max(1, Math.floor(input.defense));
  const power = Math.max(1, Math.floor(input.power));
  const effectiveness = input.effectiveness ?? 1;
  const stab = input.stab ? 1.5 : 1;
  const critical = input.critical ? 1.5 : 1;
  const burn = input.burn && input.category === "physical" ? 0.5 : 1;
  const weather = input.weatherMultiplier ?? 1;
  const terrain = input.terrainMultiplier ?? 1;
  const otherMultipliers = input.otherMultipliers ?? [];

  if (input.stab) {
    notes.push("Same-type attack bonus applied.");
  }
  if (input.effectiveness && input.effectiveness !== 1) {
    notes.push(`Type effectiveness x${input.effectiveness}.`);
  }
  if (input.critical) {
    notes.push("Critical hit multiplier applied.");
  }
  if (input.burn && input.category === "physical") {
    notes.push("Physical burn penalty applied.");
  }

  const levelFactor = Math.floor((2 * level) / 5) + 2;
  const baseDamage = Math.floor((Math.floor((levelFactor * power * attack) / defense) / 50) + 2);
  const modifier =
    stab *
    effectiveness *
    critical *
    burn *
    weather *
    terrain *
    otherMultipliers.reduce((product, value) => product * value, 1);

  const rolls = effectiveness === 0
    ? ROLLS.map(() => 0)
    : ROLLS.map((roll) => Math.max(1, Math.floor(baseDamage * modifier * roll)));
  const min = Math.min(...rolls);
  const max = Math.max(...rolls);
  const average = Math.round(rolls.reduce((sum, value) => sum + value, 0) / rolls.length);

  if (effectiveness === 0) {
    notes.push("The target is immune.");
  }

  return {
    min,
    max,
    average,
    baseDamage,
    rolls,
    multiplier: Number(modifier.toFixed(3)),
    notes,
  };
}

export function formatDamageRange(result: DamageResult) {
  if (result.min === result.max) {
    return `${result.min} HP`;
  }

  return `${result.min} - ${result.max} HP`;
}
