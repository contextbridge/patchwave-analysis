import wordmark from '../brand/patchWaveWordmark.png';
import { Sprite } from './Sprite.tsx';

export function Logo() {
  return (
    <span className="flex items-center gap-2 lg:gap-3">
      <Sprite sprite="patchHead" scale={1} />
      <img src={wordmark} width={78} height={24} alt="PatchWave" className="block h-6 w-auto" />
    </span>
  );
}
