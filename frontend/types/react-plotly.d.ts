declare module 'react-plotly.js' {
  import { Component } from 'react';
  
  interface PlotProps {
    data: any[];
    layout?: any;
    config?: any;
    style?: React.CSSProperties;
    className?: string;
    onClick?: (event: any) => void;
    onHover?: (event: any) => void;
    onUnHover?: (event: any) => void;
    onSelected?: (event: any) => void;
    onDeselect?: (event: any) => void;
    onDoubleClick?: (event: any) => void;
    onAfterPlot?: (event: any) => void;
    onAfterExport?: (event: any) => void;
    onBeforeExport?: (event: any) => void;
    onAnimated?: (event: any) => void;
    onAnimatingFrame?: (event: any) => void;
    onAnimationInterrupted?: (event: any) => void;
    onAutoSize?: (event: any) => void;
    onBeforeHover?: (event: any) => void;
    onButtonClicked?: (event: any) => void;
    onClickAnnotation?: (event: any) => void;
    onDeselect?: (event: any) => void;
    onDoubleClick?: (event: any) => void;
    onFramework?: (event: any) => void;
    onHover?: (event: any) => void;
    onLegendClick?: (event: any) => void;
    onLegendDoubleClick?: (event: any) => void;
    onRelayout?: (event: any) => void;
    onRestyle?: (event: any) => void;
    onSelected?: (event: any) => void;
    onSelecting?: (event: any) => void;
    onSliderChange?: (event: any) => void;
    onSliderEnd?: (event: any) => void;
    onSliderStart?: (event: any) => void;
    onSunburstClick?: (event: any) => void;
    onTransitioning?: (event: any) => void;
    onTransitionInterrupted?: (event: any) => void;
    onUnHover?: (event: any) => void;
    onUpdateMenu?: (event: any) => void;
    onVisibilityChange?: (event: any) => void;
  }
  
  export default class Plot extends Component<PlotProps> {}
} 

declare module 'react-plotly.js/factory' {
  type Plotly = any;
  export default function createPlotlyComponent(plotly: Plotly): any;
}

declare module 'plotly.js-dist-min' {
  const Plotly: any;
  export default Plotly;
}