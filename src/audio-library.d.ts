declare module "virtual:audio-library" {
  const tracks: readonly { title: string; artist: string; src: string }[];
  export default tracks;
}
