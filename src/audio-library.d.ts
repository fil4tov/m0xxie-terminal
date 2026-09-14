declare module "virtual:audio-library" {
  const tracks: readonly {
    title: string;
    artist: string;
    src: string;
    duration: number | null;
  }[];
  export default tracks;
}
