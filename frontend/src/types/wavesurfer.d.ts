declare module 'wavesurfer.js/dist/plugins/regions.esm.js' {
    export default class RegionsPlugin {
        static create(params?: any): RegionsPlugin;
        on(event: string, callback: (region: any, e?: any) => void): void;
        clearRegions(): void;
        addRegion(params: any): void;
        destroy(): void;
    }
}
