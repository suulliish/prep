import type { World } from '../three/world';
// Один 3D-мир на всё приложение: экраны управляют им (режим камеры, бой, сундук).
export const W: { world: World | null; dim: boolean } = $state({ world: null, dim: false });
