import type * as React from 'react';

export type Species = 'poppy' | 'cosmos' | 'lace' | 'dandelion';
/** The site's page colour, which follows the sky; set as `data-theme` on <html>. */
export type PageTheme = 'dark' | 'light';

export interface GlyphSpecimenProps {
  /** Which flower to print. */
  species?: Species;
  /** 'bloom' (default) or 'bud'; a poppy bud nods on a hooked stalk. */
  stage?: 'bloom' | 'bud';
  /** Wind strength, 0 still to 2.5 gale. Default 1. */
  wind?: number;
  /** Cell width in px; height is 1.32x. Default 9. */
  cell?: number;
  /** Figure height in px. Default 300. */
  height?: number;
  /** Optional italic caption, bottom left. */
  label?: string;
  /** Hour of day, 0 to 24: picks the scene colours. Default 15. */
  hour?: number;
}
export declare function GlyphSpecimen(props: GlyphSpecimenProps): React.ReactElement;

export interface TimeDialProps {
  /** Hour of day, 0 to 24. Controlled when set. */
  value?: number;
  defaultValue?: number;
  onChange?: (hour: number) => void;
  /** Shows the "Follow my clock" checkbox when onLiveChange is given. */
  live?: boolean;
  onLiveChange?: (live: boolean) => void;
}
export declare function TimeDial(props: TimeDialProps): React.ReactElement;

export interface WindControlProps {
  /** 0 to 2.5. Controlled when set. */
  value?: number;
  defaultValue?: number;
  onChange?: (wind: number) => void;
  /** Hour of day for the grass colours. Default 15. */
  hour?: number;
}
export declare function WindControl(props: WindControlProps): React.ReactElement;

export interface ControlPanelProps {
  /** Starting hour. Omit to follow the viewer's clock until the time is moved. */
  hour?: number;
  wind?: number;
  onHour?: (hour: number) => void;
  /** Called with the page theme whenever the hour changes; set it as `data-theme` on <html>. */
  onPage?: (theme: PageTheme) => void;
  onWind?: (wind: number) => void;
  onText?: (visible: boolean) => void;
  onRegrow?: () => void;
  onHide?: () => void;
}
export declare function ControlPanel(props: ControlPanelProps): React.ReactElement;

export interface HeroTextProps {
  /** Bio paragraph(s); inline links are styled. Keep the copy exactly as written. */
  children?: React.ReactNode;
  links?: { label: string; href: string }[];
  /** Draw the full-bleed demo scene behind. Default true. */
  garden?: boolean;
  /** Hour of day for the scene colours. Default 15. */
  hour?: number;
  /** 0 (home) to 1 (plain page): how far the page colour has closed in from the edges. Default 0. */
  veil?: number;
  height?: number;
}
export declare function HeroText(props: HeroTextProps): React.ReactElement;

export interface GlyphRampProps {
  /** Subset of rows by name: Petal, Outline, Centre, Foliage, Seed, Land, Cloud. */
  materials?: string[];
}
export declare function GlyphRamp(props: GlyphRampProps): React.ReactElement;

/** The page theme for an hour: light by day, dark from about 18:30 to 05:30. */
export declare function pageFor(hour: number): PageTheme;

/** When the veil covers a point (u, v in 0..1): 0 at the edges, 1 in the middle. */
export declare function veilOrder(u: number, v: number): number;
/** Lays page colour over a canvas as far as `veil` (0 to 1, already eased) has come. Draw it last. */
export declare function paintVeil(ctx: CanvasRenderingContext2D, width: number, height: number, page: [number, number, number], veil: number): void;

declare global {
  interface Window {
    Meadow: {
      GlyphSpecimen: typeof GlyphSpecimen;
      TimeDial: typeof TimeDial;
      WindControl: typeof WindControl;
      ControlPanel: typeof ControlPanel;
      HeroText: typeof HeroText;
      GlyphRamp: typeof GlyphRamp;
      pageFor: typeof pageFor;
      veilOrder: typeof veilOrder;
      paintVeil: typeof paintVeil;
    };
  }
}
