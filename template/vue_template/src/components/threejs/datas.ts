// 相机位置
export const cameras = [
  {
    desc: "01",
    position: [-50, 90, -50],
    lookAt: [0, 0, 0],
  },
  {
    desc: "02",
    position: [50, 50, -50],
    lookAt: [0, 0, 5],
  },
];

// 发光墙体
export const walls = [
  [
    [12, 6],
    [12, -11],
    [-12, -11],
    [-12, 6],
    [12, 6],
  ],
];

// 悬浮标签
export const labels = [
  {
    id: 1,
    position: [-11, 2, -11],
    infos: { content: "Test Content" },
  },
];

// 路径
export const roads = [
  { size: { width: 3, height: 25 }, position: [13, 0, 11], color: 0x212121 },
];

// AGV移动位置
export const agvs = [
  {
    desc: "A",
    position: [17, 0, 7],
  },
  {
    desc: "B",
    position: [17, 0, -15],
  },
];
