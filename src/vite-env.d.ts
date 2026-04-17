/// <reference types="vite/client" />

declare module '*.csv?url' {
  const src: string;
  export default src;
}
