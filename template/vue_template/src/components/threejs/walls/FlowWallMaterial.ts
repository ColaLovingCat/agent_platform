import * as THREE from 'three'

export class FlowWallMaterial extends THREE.ShaderMaterial {
  readonly time!: { value: number }
  readonly tex = { value: null as null | THREE.Texture }
  readonly color = { value: new THREE.Color('#a8e2ff') }
  readonly speed = { value: 1 }
  readonly dir = { value: [1, 0] }
  readonly repeat = { value: [1, 1] }

  constructor(props: any) {
    super({
      vertexShader: `
      out vec2 v_uv;

      void main(){
        v_uv = uv;
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
      }`,
      fragmentShader: /* glsl */ `
      precision lowp float;
      out vec4 fragColor;

      in vec2 v_uv;
      uniform float u_time;
      uniform vec3 u_color;
      uniform float u_speed;
      uniform vec2 u_dir;

      void main(){
        vec2 uv = v_uv * vec2(1.0, 4.0); // x [0, 1] y [0, 4]
        // 取小数部分
        float t1 = fract(uv.y - u_time * u_speed);
        t1 = step(t1, 0.15);
        // y 越大 透明度越低
        float t2 = 1.0 - v_uv.y;
        // 线性叠加
        float t = t1 * t2 + t2;
        t = clamp(t, 0.0, 1.0);

        fragColor = vec4(u_color, t);
      }`,
      glslVersion: THREE.GLSL3,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false
    })

    this.time = props.time
    props.color && (this.color.value = props.color)
    props.speed && (this.speed.value = props.speed)
    props.dir && (this.dir.value = props.dir)

    this.uniforms.u_time = this.time
    this.uniforms.u_color = this.color
    this.uniforms.u_speed = this.speed
    this.uniforms.u_dir = this.dir
  }
}
