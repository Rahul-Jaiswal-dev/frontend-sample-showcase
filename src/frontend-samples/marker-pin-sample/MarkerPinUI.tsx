/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import "common/samples-common.scss";
import { Point3d, Range2d } from "@bentley/geometry-core";
import { imageElementFromUrl, IModelApp, IModelConnection, ScreenViewport, StandardViewId, ViewState } from "@bentley/imodeljs-frontend";
import { Button, ButtonType, Toggle } from "@bentley/ui-core";
import { PlaceMarkerTool } from "./PlaceMarkerTool";
import { PopupMenu } from "./PopupMenu";
import { RadioCard, RadioCardEntry } from "frontend-samples/marker-pin-sample/RadioCard/RadioCard";
import { PointSelector } from "common/PointSelector/PointSelector";
import { SandboxViewport } from "common/SandboxViewport/SandboxViewport";
import { ViewSetup } from "api/viewSetup";
import MarkerPinApp from "./MarkerPinApp";
import { ControlPane } from "common/ControlPane/ControlPane";
import { MarkerData } from "./MarkerPinDecorator";

interface ManualPinSelection {
  name: string;
  image: string;
}

interface MarkerPinsUIState {
  imodel?: IModelConnection;
  viewport?: ScreenViewport;
  showDecorator: boolean;
  manualPin: ManualPinSelection;
  markersData: MarkerData[];
  range: Range2d;
  height: number;
}

export default class MarkerPinsUI extends React.Component<{
  iModelName: string; iModelSelector: React.ReactNode;
}, MarkerPinsUIState> {

  /** Creates a Sample instance */
  constructor(props?: any) {
    super(props);
    this.state = {
      showDecorator: true,
      manualPin: MarkerPinsUI.getManualPinSelections()[0],
      markersData: [],
      range: Range2d.createNull(),
      height: 0,
    };
  }

  public async componentDidMount() {

    MarkerPinApp._sampleNamespace = IModelApp.i18n.registerNamespace("marker-pin-i18n-namespace");

    PlaceMarkerTool.register(MarkerPinApp._sampleNamespace);

    MarkerPinApp._images = new Map();
    MarkerPinApp._images.set("Google_Maps_pin.svg", await imageElementFromUrl(".\\Google_Maps_pin.svg"));
    MarkerPinApp._images.set("pin_celery.svg", await imageElementFromUrl(".\\pin_celery.svg"));
    MarkerPinApp._images.set("pin_poloblue.svg", await imageElementFromUrl(".\\pin_poloblue.svg"));

    return <MarkerPinsUI iModelName={this.props.iModelName} iModelSelector={this.props.iModelSelector} />;
  }

  public componentWillUnmount() {
    MarkerPinApp.disableDecorations();
    MarkerPinApp._markerDecorator = undefined;

    IModelApp.i18n.unregisterNamespace("marker-pin-i18n-namespace");
    IModelApp.tools.unRegister(PlaceMarkerTool.toolId);
  }

  public componentDidUpdate(_prevProps: {}, prevState: MarkerPinsUIState) {
    if (prevState.imodel !== this.state.imodel)
      if (this.state.showDecorator) {
        MarkerPinApp.setupDecorator(this.state.markersData);
        MarkerPinApp.enableDecorations();
      }

    if (prevState.markersData !== this.state.markersData) {
      if (MarkerPinApp.decoratorIsSetup())
        MarkerPinApp.setMarkersData(this.state.markersData);
    }

    if (prevState.showDecorator !== this.state.showDecorator) {
      if (this.state.showDecorator)
        MarkerPinApp.enableDecorations();
      else
        MarkerPinApp.disableDecorations();
    }
  }

  /** This callback will be executed when the user interacts with the PointSelector
   * UI component.  It is also called once when the component initializes.
   */
  private _onPointsChanged = async (points: Point3d[]): Promise<void> => {
    const markersData: MarkerData[] = [];
    for (const point of points) {
      point.z = this.state.height;
      markersData.push({ point });
    }
    this.setState({ markersData });
  };

  /** Called when the user changes the showMarkers toggle. */
  private _onChangeShowMarkers = (checked: boolean) => {
    if (checked) {
      this.setState({ showDecorator: true });
    } else {
      this.setState({ showDecorator: false });
    }
  };

  /** A static array of pin images. */
  private static getManualPinSelections(): ManualPinSelection[] {
    return ([
      { image: "Google_Maps_pin.svg", name: "Google Pin" },
      { image: "pin_celery.svg", name: "Celery Pin" },
      { image: "pin_poloblue.svg", name: "Polo blue Pin" }]);
  }

  /** Creates the array which populates the RadioCard UI component */
  private getMarkerList(): RadioCardEntry[] {
    return (MarkerPinsUI.getManualPinSelections().map((entry: ManualPinSelection) => ({ image: entry.image, value: entry.name })));
  }

  /** Called when the user clicks a new option in the RadioCard UI component */
  private _onManualPinChange = (name: string) => {
    const manualPin = MarkerPinsUI.getManualPinSelections().find((entry: ManualPinSelection) => entry.name === name)!;
    this.setState({ manualPin });
  };

  /** This callback will be executed by the PlaceMarkerTool when it is time to create a new marker */
  private _manuallyAddMarker = (point: Point3d) => {
    MarkerPinApp.addMarkerPoint(point, MarkerPinApp._images.get(this.state.manualPin.image)!);
  };

  /** This callback will be executed when the user clicks the UI button.  It will start the tool which
   * handles further user input.
   */
  private _onStartPlaceMarkerTool = () => {
    IModelApp.tools.run(PlaceMarkerTool.toolId, this._manuallyAddMarker);
  };

  /** This callback will be executed by SandboxViewport to initialize the viewstate */
  public static async getTopView(imodel: IModelConnection): Promise<ViewState> {
    const viewState = await ViewSetup.getDefaultView(imodel);

    // The marker pins look better in a top view
    viewState.setStandardRotation(StandardViewId.Top);

    const range = viewState.computeFitRange();
    const aspect = viewState.getAspectRatio();

    viewState.lookAtVolume(range, aspect);

    return viewState;
  }

  /** This callback will be executed by SandboxViewport once the iModel has been loaded */
  private onIModelReady = (imodel: IModelConnection) => {
    IModelApp.viewManager.onViewOpen.addOnce((viewport: ScreenViewport) => {

      // Grab range of the contents of the view. We'll use this to position the random markers.
      const range3d = viewport.view.computeFitRange();
      const range = Range2d.createFrom(range3d);

      // Grab the max Z for the view contents.  We'll use this as the plane for the auto-generated markers. */
      const height = range3d.zHigh;

      this.setState({ imodel, viewport, range, height });
    });
  };

  /** Components for rendering the sample's instructions and controls */
  public getControls() {
    return (
      <>
        <PopupMenu canvas={this.state.viewport?.canvas} />
        <div className="sample-options-2col">
          <span>Show Markers</span>
          <Toggle isOn={this.state.showDecorator} onChange={this._onChangeShowMarkers} />
        </div>
        <hr></hr>
        <div className="sample-heading">
          <span>Auto-generate locations</span>
        </div>
        <div className="sample-options-2col">
          <PointSelector onPointsChanged={this._onPointsChanged} range={this.state.range} />
        </div>
        <hr></hr>
        <div className="sample-heading">
          <span>Manual placement</span>
        </div>
        <div style={{ textAlign: "center" }}>
          <RadioCard entries={this.getMarkerList()} selected={this.state.manualPin.name} onChange={this._onManualPinChange} />
          <Button buttonType={ButtonType.Primary} onClick={this._onStartPlaceMarkerTool} title="Click here and then click the view to place a new marker">Place Marker</Button>
        </div>
      </>
    );
  }

  /** The sample's render method */
  public render() {
    return (
      <>
        <ControlPane instructions="Use the options below to control the marker pins.  Click a marker to open a menu of options." controls={this.getControls()} iModelSelector={this.props.iModelSelector}></ControlPane>
        <SandboxViewport iModelName={this.props.iModelName} onIModelReady={this.onIModelReady} getCustomViewState={MarkerPinsUI.getTopView.bind(MarkerPinsUI)} />      </>
    );
  }
}
