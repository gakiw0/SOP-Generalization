export type OpenPosePointDef = {
  id: number
  x: number
  y: number
}

export const OPENPOSE25_MAX_ID = 24

export const OPENPOSE25_POINTS: OpenPosePointDef[] = [
  { id: 0, x: 160, y: 40 },
  { id: 1, x: 160, y: 76 },
  { id: 2, x: 124, y: 90 },
  { id: 3, x: 102, y: 132 },
  { id: 4, x: 86, y: 172 },
  { id: 5, x: 196, y: 90 },
  { id: 6, x: 218, y: 132 },
  { id: 7, x: 234, y: 172 },
  { id: 8, x: 160, y: 170 },
  { id: 9, x: 146, y: 170 },
  { id: 10, x: 142, y: 232 },
  { id: 11, x: 138, y: 294 },
  { id: 12, x: 174, y: 170 },
  { id: 13, x: 178, y: 232 },
  { id: 14, x: 182, y: 294 },
  { id: 15, x: 148, y: 30 },
  { id: 16, x: 172, y: 30 },
  { id: 17, x: 138, y: 34 },
  { id: 18, x: 182, y: 34 },
  { id: 19, x: 192, y: 318 },
  { id: 20, x: 202, y: 330 },
  { id: 21, x: 174, y: 322 },
  { id: 22, x: 126, y: 318 },
  { id: 23, x: 116, y: 330 },
  { id: 24, x: 146, y: 322 },
]

export const OPENPOSE25_BONES: Array<[number, number]> = [
  [8, 1],
  [1, 0],
  [0, 15],
  [15, 17],
  [0, 16],
  [16, 18],
  [1, 2],
  [2, 3],
  [3, 4],
  [1, 5],
  [5, 6],
  [6, 7],
  [8, 9],
  [9, 10],
  [10, 11],
  [11, 24],
  [11, 22],
  [22, 23],
  [8, 12],
  [12, 13],
  [13, 14],
  [14, 21],
  [14, 19],
  [19, 20],
]
