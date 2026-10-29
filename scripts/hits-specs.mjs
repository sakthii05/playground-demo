// What each piece of Top Hits album art should be, shared by optimize-hits (which makes them) and
// check-hits (which checks them). Sized to what the page shows at 2× (graphics memory goes by pixels:
// a 1100 × 1000 image is about 6 MB on the GPU; a 2048 × 2048 one would be 22 MB).
//   front: the booklet, 1.1 : 1
//   back:  the whole insert as printed flat, a 48 px spine each side of the 1104 px back panel
//   disc:  the disc label, square
// `budget` is the largest the file should be.
export const SPECS = {
  front: { width: 1100, height: 1000, budget: 220 * 1024 },
  back: { width: 1200, height: 950, budget: 220 * 1024 },
  disc: { width: 1024, height: 1024, budget: 180 * 1024 },
};
