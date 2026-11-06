import { Suspense, lazy, type ComponentProps } from 'react';
import type { Avatar3D as A } from './Avatar3D';

const Avatar3DImpl = lazy(() => import('./Avatar3D').then((m) => ({ default: m.Avatar3D })));

/** Loads three.js only when a body view is on screen, keeping the first load small. */
export function Avatar3D(props: ComponentProps<typeof A>) {
  return (
    <Suspense fallback={<div className="avatar-canvas avatar-loading" style={{ height: props.height ?? 360 }} aria-busy="true">טוען את התצוגה…</div>}>
      <Avatar3DImpl {...props} />
    </Suspense>
  );
}
