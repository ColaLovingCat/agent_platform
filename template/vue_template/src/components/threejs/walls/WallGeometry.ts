import * as THREE from 'three';
// import type { Num2 } from '../type';

export interface WallGeometryProps {
  points: any[];
  height?: number;
  heights?: any[];
  uvType?: 'PER' | 'ALL';
  face?: 'XOY' | 'XOZ';
}

export class WallGeometry extends THREE.BufferGeometry {
  type = 'WallGeometry';
  parameters: WallGeometryProps;

  constructor(props: WallGeometryProps) {
    const { points, height = 1, heights, uvType = 'ALL', face = 'XOZ' } = props;

    super();
    this.parameters = { points, height, uvType };

    const vertices: number[] = [];
    const uvs: number[] = [];
    const per = 1 / (points.length - 1);

    for (let i = 0; i < points.length - 1; i++) {
      const cur = points[i];
      const next = points[i + 1];
      let curHeight = [0, height];
      let nextHeight = [0, height];
      if (heights?.[i]) {
        curHeight = [heights[i][0] ?? 0, heights[i][1] ?? height];
      }
      if (heights?.[i + 1]) {
        nextHeight = [heights[i + 1][0] ?? 0, heights[i + 1][1] ?? height];
      }

      if (face === 'XOY') {
        vertices.push(
          cur[0],
          cur[1],
          curHeight[0],
          next[0],
          next[1],
          nextHeight[0],
          next[0],
          next[1],
          nextHeight[1],
        );
        vertices.push(
          cur[0],
          cur[1],
          curHeight[0],
          next[0],
          next[1],
          nextHeight[1],
          cur[0],
          cur[1],
          curHeight[1],
        );
      } else {
        vertices.push(
          cur[0],
          curHeight[0],
          cur[1],
          next[0],
          nextHeight[0],
          next[1],
          next[0],
          nextHeight[1],
          next[1],
        );
        vertices.push(
          cur[0],
          curHeight[0],
          cur[1],
          next[0],
          nextHeight[1],
          next[1],
          cur[0],
          curHeight[1],
          cur[1],
        );
      }

      if (uvType === 'PER') {
        uvs.push(0, 0, 1, 0, 1, 1);
        uvs.push(0, 0, 1, 1, 0, 1);
      } else {
        uvs.push(i * per, 0, (i + 1) * per, 0, (i + 1) * per, 1);
        uvs.push(i * per, 0, (i + 1) * per, 1, i * per, 1);
      }
    }

    this.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(vertices), 3),
    );
    this.setAttribute(
      'uv',
      new THREE.BufferAttribute(new Float32Array(uvs), 2),
    );
    this.computeVertexNormals();
  }

  copy(source: any) {
    super.copy(source);
    this.parameters = Object.assign({}, source.parameters);
    return this;
  }

  static fromJSON(data: WallGeometryProps) {
    return new WallGeometry(data);
  }
}
