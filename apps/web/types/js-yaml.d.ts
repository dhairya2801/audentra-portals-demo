declare module "js-yaml" {
  export interface DumpOptions {
    lineWidth?: number;
    noCompatMode?: boolean;
    noRefs?: boolean;
  }

  export function load(value: string): unknown;
  export function dump(value: unknown, options?: DumpOptions): string;
}
